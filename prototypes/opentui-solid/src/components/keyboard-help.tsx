// Keyboard Help Modal - shows all keyboard shortcuts grouped by mode

import { TextAttributes } from "@opentui/core";
import type { ScrollBoxRenderable } from "@opentui/core";
import { createMemo, For } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import { defaultTheme } from "../theme/theme";
import { keymap } from "../keymap";
import { formatKeyDisplay, type Mode, type KeyMapping } from "../keyboard/keymap-utils";

interface KeyboardHelpProps {
  onClose: () => void;
}

interface HelpGroup {
  mode: Mode;
  title: string;
  mappings: KeyMapping[];
}

export function KeyboardHelp(props: KeyboardHelpProps) {
  const theme = defaultTheme;

  let scrollRef: ScrollBoxRenderable | undefined;

  // Group mappings by mode with readable titles
  const groups = createMemo((): HelpGroup[] => {
    const modeConfig: { mode: Mode; title: string }[] = [
      { mode: "app", title: "Global" },
      { mode: "tree", title: "Tree View" },
      { mode: "resource", title: "Log View" },
    ];

    return modeConfig.map(({ mode, title }) => {
      // Get all mappings for this mode, excluding duplicates and hidden ones
      const seen = new Set<string>();
      const mappings = keymap.filter((m) => {
        if (!m.modes.includes(mode)) return false;
        // Skip if we've already seen this command in this mode
        const key = `${m.command}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return { mode, title, mappings };
    });
  });

  // Keyboard handling - just escape to close
  useKeyboard((evt) => {
    if (evt.name === "escape" || evt.name === "?" || evt.name === "q") {
      evt.preventDefault();
      props.onClose();
    }
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
      {/* Header */}
      <box
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        flexDirection="row"
        justifyContent="space-between"
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Keyboard Shortcuts
        </text>
        <text fg={theme.textMuted}>esc/q/?</text>
      </box>

      {/* Shortcuts list */}
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        maxHeight={maxHeight}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
      >
        <For each={groups()}>
          {(group, groupIndex) => (
            <>
              {/* Mode header */}
              <box paddingTop={groupIndex() > 0 ? 1 : 0} paddingLeft={1}>
                <text fg={theme.accent} attributes={TextAttributes.BOLD}>
                  {group.title}
                </text>
              </box>

              {/* Mappings in this mode */}
              <For each={group.mappings}>
                {(mapping) => (
                  <box flexDirection="row" paddingLeft={2} paddingRight={2}>
                    {/* Key display - fixed width */}
                    <box width={12}>
                      <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                        {formatKeyDisplay(mapping)}
                      </text>
                    </box>

                    {/* Description */}
                    <text fg={theme.text} flexGrow={1}>
                      {mapping.description}
                    </text>
                  </box>
                )}
              </For>
            </>
          )}
        </For>
      </scrollbox>
    </box>
  );
}
