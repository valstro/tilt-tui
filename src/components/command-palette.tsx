// Command Palette component - filterable command list with grouping
// Adapted from OpenCode's dialog-select.tsx

import { TextAttributes } from "@opentui/core";
import type { ScrollBoxRenderable, InputRenderable } from "@opentui/core";
import { createEffect, createMemo, For, on, Show, untrack } from "solid-js";
import { createStore } from "solid-js/store";
import { useKeyboard } from "@opentui/solid";
import { defaultTheme } from "../theme/theme";
import { useTilt } from "../context/tilt";
import { useFocus } from "../context/focus";
import {
  getHelpMappingsForMode,
  formatKeyDisplay,
  type Command,
} from "../keyboard/keymap-utils";
import type { APIButton } from "../tilt/types";

export interface PaletteOption {
  title: string;
  value: string;
  description?: string;
  category: string;
  command?: Command;
  url?: string;
  /** Raw APIButton for API calls */
  button?: APIButton;
}

interface CommandPaletteProps {
  onClose: () => void;
  onSelect: (option: PaletteOption) => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  const theme = defaultTheme;
  const { state: tiltState, triggerResource, client } = useTilt();
  const { state: focusState } = useFocus();

  const [store, setStore] = createStore({
    selected: 0,
    filter: "",
  });

  let inputRef: InputRenderable | undefined;
  let scrollRef: ScrollBoxRenderable | undefined;

  // Capture options once on mount using untrack to avoid reactive dependencies
  // This ensures the palette content is stable while open
  const initialOptions = untrack(() => {
    const result: PaletteOption[] = [];
    const selectedResource = tiltState.resources.find(
      (r) => r.name === tiltState.selectedResource,
    );

    // Group 1: Links from selected resource
    if (selectedResource) {
      for (const endpoint of selectedResource.endpoints) {
        const hasName = endpoint.name && endpoint.name !== endpoint.url;
        result.push({
          title: hasName ? endpoint.name : endpoint.url,
          value: `link:${endpoint.url}`,
          description: hasName ? endpoint.url : undefined,
          category: "Links",
          url: endpoint.url,
        });
      }

      // Group 2: UIButton actions from selected resource
      for (const button of selectedResource.buttons) {
        if (!button.disabled) {
          result.push({
            title: button.text,
            value: `button:${button.name}`,
            description: `${button.name}`,
            category: "Actions",
            button: button.raw,
          });
        }
      }
    }

    // Group 3: Commands for app (static)
    const appBindings = getHelpMappingsForMode("app").concat({
      description: "exit",
      key: "x",
      command: "app.quit",
    });

    const modeBindings = getHelpMappingsForMode(focusState.activePane);
    for (const mapping of appBindings.concat(modeBindings)) {
      result.push({
        title: mapping.description,
        value: `command:${mapping.command}`,
        description: formatKeyDisplay(mapping),
        category: "Commands",
        command: mapping.command,
      });
    }

    return result;
  });

  // Options returns the stable initial options
  const options = () => initialOptions;

  // Filter options based on search
  const filtered = createMemo(() => {
    const needle = store.filter.toLowerCase();
    if (!needle) return options();

    return options().filter(
      (opt) =>
        opt.title.toLowerCase().includes(needle) ||
        opt.category.toLowerCase().includes(needle) ||
        (opt.description?.toLowerCase().includes(needle) ?? false),
    );
  });

  // Group filtered options by category
  const grouped = createMemo(() => {
    const groups = new Map<string, PaletteOption[]>();
    const categoryOrder = ["Links", "Actions", "Commands"];

    for (const opt of filtered()) {
      const existing = groups.get(opt.category) ?? [];
      existing.push(opt);
      groups.set(opt.category, existing);
    }

    // Return in defined order
    const result: [string, PaletteOption[]][] = [];
    for (const cat of categoryOrder) {
      const opts = groups.get(cat);
      if (opts && opts.length > 0) {
        result.push([cat, opts]);
      }
    }
    return result;
  });

  // Flat list for navigation
  const flat = createMemo(() => {
    const result: PaletteOption[] = [];
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
      const itemHeight = 1; // Approximate height per item
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
  async function handleSelect() {
    const opt = selected();
    if (!opt) return;

    if (opt.url) {
      // Open URL in default browser
      client.openUrl(opt.url);
    } else if (opt.button) {
      // Click UI button and update the cached button with new resourceVersion
      try {
        const updatedButton = await client.clickButton(opt.button);
        // Update the cached button so subsequent clicks work
        opt.button = updatedButton;
      } catch (err) {
        console.error("Failed to click button:", err);
      }
    } else if (opt.command) {
      // Execute command
      props.onSelect(opt);
    }

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
          Commands
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
            <text fg={theme.textMuted}>No results found</text>
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
            {([category, categoryOptions], groupIndex) => (
              <>
                {/* Category header */}
                <box paddingTop={groupIndex() > 0 ? 1 : 0} paddingLeft={1}>
                  <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                    {category}
                  </text>
                </box>

                {/* Options in category */}
                <For each={categoryOptions}>
                  {(option) => {
                    const isSelected = () => option.value === selected()?.value;

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
                          fg={isSelected() ? theme.background : theme.text}
                          attributes={
                            isSelected() ? TextAttributes.BOLD : undefined
                          }
                          wrapMode="none"
                          overflow="hidden"
                          justifyContent="space-between"
                          flexDirection="row"
                        >
                          {option.title}
                          <Show when={option.description}>
                            <span
                              style={{
                                fg: isSelected()
                                  ? theme.background
                                  : theme.textMuted,
                              }}
                            >
                              {" "}
                              {option.description}
                            </span>
                          </Show>
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
