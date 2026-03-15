// Engine Info modal - shows FileWatch state from the Tilt engine API

import { TextAttributes } from "@opentui/core";
import type { ScrollBoxRenderable, InputRenderable } from "@opentui/core";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { useKeyboard } from "@opentui/solid";
import { defaultTheme } from "../theme/theme";
import { useTilt } from "../context/tilt";
import type { APIFileWatch } from "../tilt/api-types";
import { fuzzyMatch } from "@/utils/fuzzy";

const CONTINUATION_PREFIX = "↳ ";
const CONTINUATION_PREFIX_WIDTH = 2;

// Modal is 80 wide, scrollbox has paddingLeft=1 paddingRight=1,
// items have paddingLeft=2 paddingRight=2
const CONTENT_WIDTH = 74;

// Word-aware line wrapping matching log-buffer style
function wrapText(text: string, maxWidth: number): string[] {
  if (text.length <= maxWidth) return [text];

  const rows: string[] = [];
  const continuationWidth = maxWidth - CONTINUATION_PREFIX_WIDTH;

  // First row gets full width
  const first = wrapAtWord(text, maxWidth);
  rows.push(first.wrapped);
  let remaining = first.remaining;

  // Continuation rows get reduced width for ↳ prefix
  while (remaining.length > 0) {
    const result = wrapAtWord(remaining, continuationWidth);
    rows.push(CONTINUATION_PREFIX + result.wrapped);
    remaining = result.remaining;
  }

  return rows;
}

function wrapAtWord(
  text: string,
  maxWidth: number,
): { wrapped: string; remaining: string } {
  if (text.length <= maxWidth) {
    return { wrapped: text, remaining: "" };
  }

  // Find last space or path separator within maxWidth
  let breakPoint = -1;
  for (let i = maxWidth - 1; i > 0; i--) {
    if (text[i] === " " || text[i] === "/") {
      breakPoint = i;
      break;
    }
  }

  // No good break found, hard wrap
  if (breakPoint <= 0) {
    return {
      wrapped: text.slice(0, maxWidth),
      remaining: text.slice(maxWidth),
    };
  }

  // For space: skip the space. For slash: keep the slash on the first line.
  if (text[breakPoint] === "/") {
    return {
      wrapped: text.slice(0, breakPoint + 1),
      remaining: text.slice(breakPoint + 1),
    };
  }

  return {
    wrapped: text.slice(0, breakPoint),
    remaining: text.slice(breakPoint + 1),
  };
}

interface WatchPathItem {
  watchName: string;
  path: string;
  kind: "path" | "ignore" | "event";
}

// A display row links back to its logical item index for selection
interface DisplayRow {
  text: string;
  isContinuation: boolean;
  itemIndex: number;
  item: WatchPathItem;
}

interface EngineInfoProps {
  onClose: () => void;
}

export function EngineInfo(props: EngineInfoProps) {
  const theme = defaultTheme;
  const { client } = useTilt();

  const [store, setStore] = createStore({
    selected: 0, // index into flat items (logical items, not display rows)
    filter: "",
  });

  const [fileWatches, setFileWatches] = createSignal<APIFileWatch[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  let inputRef: InputRenderable | undefined;
  let scrollRef: ScrollBoxRenderable | undefined;

  // Fetch file watches on mount
  createEffect(() => {
    client
      .getFileWatches()
      .then((result) => {
        setFileWatches(result.items);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  });

  // Build flat items from file watches, grouped by watch name
  const allItems = createMemo((): WatchPathItem[] => {
    const items: WatchPathItem[] = [];
    const watches = [...fileWatches()].sort((a, b) =>
      a.metadata.name.localeCompare(b.metadata.name),
    );

    for (const fw of watches) {
      for (const p of fw.spec.watchedPaths) {
        items.push({ watchName: fw.metadata.name, path: p, kind: "path" });
      }
      for (const ignore of fw.spec.ignores ?? []) {
        for (const pattern of ignore.patterns ?? []) {
          const display = `${ignore.basePath}/${pattern}`;
          items.push({ watchName: fw.metadata.name, path: display, kind: "ignore" });
        }
      }
      const events = fw.status.fileEvents;
      if (events && events.length > 0) {
        const last = events[events.length - 1];
        const time = new Date(last.time);
        const timeStr = time.toLocaleTimeString();
        for (const f of last.seenFiles) {
          items.push({
            watchName: fw.metadata.name,
            path: `${f} (${timeStr})`,
            kind: "event",
          });
        }
      }
    }
    return items;
  });

  // Filter items with fuzzy matching
  const filtered = createMemo(() => {
    const needle = store.filter;
    if (!needle) return allItems();
    return allItems().filter((item) => {
      const matchPath = fuzzyMatch(needle, item.path) !== null;
      const matchName = fuzzyMatch(needle, item.watchName) !== null;
      return matchPath || matchName;
    });
  });

  // Group filtered items by watch name, preserving sort order
  const grouped = createMemo(() => {
    const groups = new Map<string, WatchPathItem[]>();
    const groupOrder: string[] = [];

    for (const item of filtered()) {
      if (!groups.has(item.watchName)) {
        groupOrder.push(item.watchName);
        groups.set(item.watchName, []);
      }
      groups.get(item.watchName)!.push(item);
    }

    const result: [string, WatchPathItem[]][] = [];
    for (const name of groupOrder) {
      const items = groups.get(name);
      if (items && items.length > 0) {
        result.push([name, items]);
      }
    }
    return result;
  });

  // Flat list for keyboard navigation (logical items)
  const flat = createMemo(() => {
    const result: WatchPathItem[] = [];
    for (const [_, items] of grouped()) {
      result.push(...items);
    }
    return result;
  });

  const selected = createMemo(() => flat()[store.selected]);

  // Build display rows with wrapping, tracking which logical item each row belongs to
  const displayRows = createMemo((): DisplayRow[] => {
    const rows: DisplayRow[] = [];
    // Build a lookup from item identity to flat index
    const flatList = flat();
    const itemToIndex = new Map<WatchPathItem, number>();
    for (let i = 0; i < flatList.length; i++) {
      itemToIndex.set(flatList[i], i);
    }

    for (const [_, groupItems] of grouped()) {
      for (const item of groupItems) {
        const prefix = kindPrefix(item.kind);
        const fullText = prefix + item.path;
        const wrapped = wrapText(fullText, CONTENT_WIDTH);
        const idx = itemToIndex.get(item) ?? -1;

        for (let r = 0; r < wrapped.length; r++) {
          rows.push({
            text: wrapped[r],
            isContinuation: r > 0,
            itemIndex: idx,
            item,
          });
        }
      }
    }
    return rows;
  });

  // Reset selection when filter changes
  createEffect(
    on(
      () => store.filter,
      () => setStore("selected", 0),
    ),
  );

  function move(direction: number) {
    if (flat().length === 0) return;
    let next = store.selected + direction;
    if (next < 0) next = flat().length - 1;
    if (next >= flat().length) next = 0;
    setStore("selected", next);

    // Scroll to keep the selected item's rows visible
    if (scrollRef) {
      const rows = displayRows();
      // Find the first display row for this item
      const firstRow = rows.findIndex((r) => r.itemIndex === next);
      const lastRow = rows.findLastIndex((r) => r.itemIndex === next);
      if (firstRow === -1) return;

      const visibleItems = 16;
      const scrollTop = scrollRef.scrollTop;

      if (firstRow < scrollTop) {
        scrollRef.scrollTo(firstRow);
      } else if (lastRow >= scrollTop + visibleItems) {
        scrollRef.scrollTo(lastRow - visibleItems + 1);
      }
    }
  }

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault();
      props.onClose();
      return;
    }

    if (evt.name === "up" || (evt.ctrl && evt.name === "k")) {
      evt.preventDefault();
      move(-1);
      return;
    }

    if (evt.name === "down" || (evt.ctrl && evt.name === "j")) {
      evt.preventDefault();
      move(1);
      return;
    }
  });

  // Focus input on mount
  createEffect(() => {
    setTimeout(() => inputRef?.focus(), 10);
  });

  const maxHeight = 24;

  function kindPrefix(kind: WatchPathItem["kind"]): string {
    switch (kind) {
      case "path":
        return "";
      case "ignore":
        return "ignore: ";
      case "event":
        return "last: ";
    }
  }

  function rowColor(row: DisplayRow, isSelected: boolean): string {
    if (isSelected) return theme.background;
    if (row.isContinuation) return theme.textMuted;
    switch (row.item.kind) {
      case "path":
        return theme.text;
      case "ignore":
        return theme.textMuted;
      case "event":
        return theme.accent;
    }
  }

  return (
    <box
      position="absolute"
      top={2}
      left="50%"
      marginLeft={-40}
      width={80}
      backgroundColor={theme.contentPane}
      border={false}
      flexDirection="column"
    >
      {/* Header */}
      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Engine Info — File Watches
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      {/* Filter input */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
        <input
          ref={(r) => (inputRef = r)}
          onContentChange={() => {
            if (inputRef?.value === "") {
              setStore("filter", "");
            }
          }}
          onInput={(e) => {
            setStore("filter", e);
          }}
          focusedBackgroundColor={theme.background}
          cursorColor={theme.primary}
          focusedTextColor={theme.text}
          placeholder="Type to filter paths..."
        />
      </box>

      {/* Content */}
      <Show when={!loading()} fallback={
        <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
          <text fg={theme.textMuted}>Loading file watches...</text>
        </box>
      }>
        <Show when={!error()} fallback={
          <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
            <text fg={theme.error}>Error: {error()}</text>
          </box>
        }>
          <Show
            when={grouped().length > 0}
            fallback={
              <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
                <text fg={theme.textMuted}>No file watches found</text>
              </box>
            }
          >
            <scrollbox
              ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
              maxHeight={maxHeight}
              paddingLeft={1}
              paddingRight={1}
              paddingBottom={1}
            >
              <For each={grouped()}>
                {([name, _groupItems], groupIndex) => (
                  <>
                    {/* Group header: FileWatch name */}
                    <box paddingTop={groupIndex() > 0 ? 1 : 0} paddingLeft={1}>
                      <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                        {name}
                      </text>
                    </box>

                    {/* Display rows for items in this group */}
                    <For each={displayRows().filter((r) => r.item.watchName === name)}>
                      {(row) => {
                        const isSelected = () =>
                          row.itemIndex === store.selected;

                        return (
                          <box
                            flexDirection="row"
                            backgroundColor={
                              isSelected() ? theme.primary : undefined
                            }
                            paddingLeft={2}
                            paddingRight={2}
                          >
                            <text
                              flexGrow={1}
                              fg={rowColor(row, isSelected())}
                              attributes={
                                row.isContinuation ? TextAttributes.DIM : undefined
                              }
                              wrapMode="none"
                              overflow="hidden"
                            >
                              {row.text}
                            </text>
                          </box>
                        );
                      }}
                    </For>
                  </>
                )}
              </For>
            </scrollbox>
          </Show>
        </Show>
      </Show>
    </box>
  );
}
