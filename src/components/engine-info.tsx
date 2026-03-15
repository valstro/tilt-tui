// Engine Info modal - shows FileWatch state from the Tilt engine API

import { TextAttributes } from "@opentui/core";
import type { ScrollBoxRenderable, InputRenderable } from "@opentui/core";
import { createEffect, createMemo, createSignal, For, on, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { useKeyboard } from "@opentui/solid";
import { defaultTheme } from "../theme/theme";
import { useTilt } from "../context/tilt";
import type { APIFileWatch } from "../tilt/api-types";

function fuzzyMatch(needle: string, haystack: string): number | null {
  const needleLower = needle.toLowerCase();
  const haystackLower = haystack.toLowerCase();

  let score = 0;
  let haystackIdx = 0;

  for (const char of needleLower) {
    const foundIdx = haystackLower.indexOf(char, haystackIdx);
    if (foundIdx === -1) return null;
    score += foundIdx - haystackIdx;
    haystackIdx = foundIdx + 1;
  }

  return score;
}

interface WatchPathItem {
  watchName: string;
  path: string;
  kind: "path" | "ignore" | "event";
}

interface EngineInfoProps {
  onClose: () => void;
}

export function EngineInfo(props: EngineInfoProps) {
  const theme = defaultTheme;
  const { client } = useTilt();

  const [store, setStore] = createStore({
    selected: 0,
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
      // Show last file event if present
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

  // Flat list for keyboard navigation
  const flat = createMemo(() => {
    const result: WatchPathItem[] = [];
    for (const [_, items] of grouped()) {
      result.push(...items);
    }
    return result;
  });

  const selected = createMemo(() => flat()[store.selected]);

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

    if (scrollRef) {
      const itemHeight = 1;
      const visibleItems = 16;
      const scrollTop = scrollRef.scrollTop;
      const itemTop = next * itemHeight;

      if (itemTop < scrollTop) {
        scrollRef.scrollTo(itemTop);
      } else if (itemTop >= scrollTop + visibleItems) {
        scrollRef.scrollTo(itemTop - visibleItems + 1);
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

  function kindColor(kind: WatchPathItem["kind"], isSelected: boolean): string {
    if (isSelected) return theme.background;
    switch (kind) {
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
                {([name, groupItems], groupIndex) => (
                  <>
                    {/* Group header: FileWatch name */}
                    <box paddingTop={groupIndex() > 0 ? 1 : 0} paddingLeft={1}>
                      <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                        {name}
                      </text>
                    </box>

                    {/* Items in group */}
                    <For each={groupItems}>
                      {(item) => {
                        const isSelected = () =>
                          item === selected();

                        return (
                          <box
                            flexDirection="row"
                            backgroundColor={
                              isSelected() ? theme.primary : undefined
                            }
                            paddingLeft={2}
                            paddingRight={2}
                            gap={1}
                          >
                            <Show when={item.kind !== "path"}>
                              <text
                                fg={
                                  isSelected()
                                    ? theme.background
                                    : theme.textMuted
                                }
                                attributes={TextAttributes.DIM}
                              >
                                {kindPrefix(item.kind)}
                              </text>
                            </Show>
                            <text
                              flexGrow={1}
                              fg={kindColor(item.kind, isSelected())}
                              wrapMode="none"
                              overflow="hidden"
                            >
                              {item.path}
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
