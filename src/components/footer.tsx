// Footer component - context-aware help
// Dynamically generates help text from keymap

import { createMemo, For } from "solid-js";
import { useFocus } from "../context/focus";
import { defaultTheme } from "../theme/theme";
import { getHelpItemsForMode } from "../keyboard/keymap-utils";

export function Footer() {
  const { state } = useFocus();
  const theme = defaultTheme;

  // Get help items dynamically from keymap
  const helpItems = createMemo(() => getHelpItemsForMode(state.activePane));

  return (
    <box
      padding={1}
      paddingLeft={2}
      paddingRight={2}
      flexShrink={0}
      flexDirection="row"
    >
      <For each={helpItems()}>
        {(item, index) => (
          <>
            {index() > 0 && <text fg={theme.textMuted}> · </text>}
            <text fg={theme.primary}>{item.keys}</text>
            <text fg={theme.textMuted}> {item.description}</text>
          </>
        )}
      </For>
    </box>
  );
}
