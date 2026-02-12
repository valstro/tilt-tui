// Resource Picker component - modal dialog for quick resource selection with fuzzy search

import { TextAttributes } from "@opentui/core";
import type { ScrollBoxRenderable, InputRenderable } from "@opentui/core";
import { createEffect, createMemo, For, on, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { useKeyboard } from "@opentui/solid";
import { defaultTheme } from "../theme/theme";
import { useTilt } from "../context/tilt";
import { useFocus } from "../context/focus";
import { type Resource } from "../tilt/types";
import { getGroupKey } from "./tree";
import { getEffectiveStatus } from "@/tilt/status-utils";
import { useBlinkWhenBuilding } from "@/hooks/useBlinkWhenBuilding";

/**
 * Simple fuzzy match function.
 * Returns a score (lower is better) or null if no match.
 * Each character in needle must appear in haystack in order.
 */
function fuzzyMatch(needle: string, haystack: string): number | null {
  const needleLower = needle.toLowerCase();
  const haystackLower = haystack.toLowerCase();

  let score = 0;
  let haystackIdx = 0;

  for (const char of needleLower) {
    const foundIdx = haystackLower.indexOf(char, haystackIdx);
    if (foundIdx === -1) return null;

    // Penalize gaps between matched characters
    score += foundIdx - haystackIdx;
    haystackIdx = foundIdx + 1;
  }

  return score;
}

interface PickerOption {
  resource: Resource;
  group: string;
  score: number;
}

interface ResourcePickerProps {
  onClose: () => void;
}

export function ResourcePicker(props: ResourcePickerProps) {
  const theme = defaultTheme;
  const { state, selectResource, resetStatusFilter } = useTilt();
  const { setActivePane } = useFocus();
  const { getBlinkingColor } = useBlinkWhenBuilding({ theme });

  const [store, setStore] = createStore({
    selected: 0,
    filter: "",
  });

  let inputRef: InputRenderable | undefined;
  let scrollRef: ScrollBoxRenderable | undefined;

  // Build options with fuzzy matching - uses ALL resources (ignores status filter)
  const options = createMemo(() => {
    const needle = store.filter;
    return state.resources
      .map((r) => ({
        resource: r,
        group: getGroupKey(r),
        score: needle ? (fuzzyMatch(needle, r.name) ?? Infinity) : 0,
      }))
      .filter((opt) => opt.score !== Infinity)
      .sort((a, b) => a.score - b.score);
  });

  // Group options by resource group
  const grouped = createMemo(() => {
    const groups = new Map<string, PickerOption[]>();
    const groupOrder: string[] = [];

    for (const opt of options()) {
      if (!groups.has(opt.group)) {
        groupOrder.push(opt.group);
        groups.set(opt.group, []);
      }
      groups.get(opt.group)!.push(opt);
    }

    // Sort groups (ungrouped at end)
    groupOrder.sort((a, b) => {
      if (a === "ungrouped") return 1;
      if (b === "ungrouped") return -1;
      return a.localeCompare(b);
    });

    // Return in sorted order
    const result: [string, PickerOption[]][] = [];
    for (const group of groupOrder) {
      const opts = groups.get(group);
      if (opts && opts.length > 0) {
        result.push([group, opts]);
      }
    }
    return result;
  });

  // Flat list for navigation
  const flat = createMemo(() => {
    const result: PickerOption[] = [];
    for (const [_, opts] of grouped()) {
      result.push(...opts);
    }
    return result;
  });

  // Currently selected option
  const selected = createMemo(() => flat()[store.selected]);

  // Reset selection when filter changes
  createEffect(
    on(
      () => store.filter,
      () => {
        setStore("selected", 0);
      },
    ),
  );

  // Navigation functions
  function move(direction: number) {
    if (flat().length === 0) return;
    let next = store.selected + direction;
    if (next < 0) next = flat().length - 1;
    if (next >= flat().length) next = 0;
    setStore("selected", next);

    // Scroll to keep selected item visible
    if (scrollRef) {
      const itemHeight = 1;
      const visibleItems = 10;
      const scrollTop = scrollRef.scrollTop;
      const itemTop = next * itemHeight;

      if (itemTop < scrollTop) {
        scrollRef.scrollTo(itemTop);
      } else if (itemTop >= scrollTop + visibleItems) {
        scrollRef.scrollTo(itemTop - visibleItems + 1);
      }
    }
  }

  // Handle selection
  function handleSelect() {
    const opt = selected();
    if (!opt) return;

    // Check if resource is visible with current filter
    const effectiveStatus = getEffectiveStatus(opt.resource);
    if (
      state.statusFilter !== "all" &&
      effectiveStatus !== state.statusFilter
    ) {
      // Reset filter so resource becomes visible
      resetStatusFilter();
    }

    // Select the resource and switch to resource pane
    selectResource(opt.resource.name);
    setActivePane("resource");
    props.onClose();
  }

  // Keyboard handling
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

    if (evt.name === "return") {
      evt.preventDefault();
      handleSelect();
      return;
    }
  });

  // Focus input on mount
  createEffect(() => {
    setTimeout(() => inputRef?.focus(), 10);
  });

  const maxHeight = 20;

  return (
    <box
      position="absolute"
      top={2}
      left="50%"
      marginLeft={-30}
      width={60}
      backgroundColor={theme.contentPane}
      border={false}
      flexDirection="column"
    >
      {/* Header with title */}
      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Resources
        </text>
        <text fg={theme.textMuted}>esc</text>
      </box>

      {/* Filter input */}
      <box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
        <input
          ref={(r) => (inputRef = r)}
          onContentChange={(e) => {
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
          placeholder="Type to filter..."
        />
      </box>

      {/* Options list */}
      <Show
        when={grouped().length > 0}
        fallback={
          <box paddingLeft={2} paddingRight={2} paddingBottom={1}>
            <text fg={theme.textMuted}>No resources found</text>
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
            {([group, groupOptions], groupIndex) => (
              <>
                {/* Group header */}
                <box paddingTop={groupIndex() > 0 ? 1 : 0} paddingLeft={1}>
                  <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                    {group}
                  </text>
                </box>

                {/* Options in group */}
                <For each={groupOptions}>
                  {(option) => {
                    // Plain accessors instead of createMemo - avoids memo creation per item
                    const isSelected = () =>
                      option.resource.name === selected()?.resource.name;
                    const status = () => getEffectiveStatus(option.resource);
                    const dotColor = () =>
                      isSelected()
                        ? theme.background
                        : getBlinkingColor(
                            status(),
                            option.resource.isBuilding,
                            option.resource.isDisabled,
                          );

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
                        {/* Status indicator dot */}
                        <text fg={dotColor()}>{"\u25CF"}</text>

                        {/* Resource name */}
                        <text
                          flexGrow={1}
                          fg={isSelected() ? theme.background : theme.text}
                          attributes={
                            isSelected() ? TextAttributes.BOLD : undefined
                          }
                          wrapMode="none"
                          overflow="hidden"
                        >
                          {option.resource.name}
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
    </box>
  );
}
