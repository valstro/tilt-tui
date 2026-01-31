// Footer component - context-aware help

import { createMemo, For } from "solid-js";
import { useFocus } from "../context/focus";
import { defaultTheme } from "../theme/theme";

interface HelpItem {
  keys: string;
  action: string;
}

export function Footer() {
  const { state } = useFocus();
  const theme = defaultTheme;

  const helpItems = createMemo((): HelpItem[] => {
    if (state.activePane === "tree") {
      return [
        { keys: "j/k", action: "nav" },
        { keys: "Enter", action: "select" },
        { keys: "r", action: "trigger" },
        { keys: "Tab", action: "switch" },
        { keys: "^e", action: "sidebar" },
        { keys: "Q", action: "quit" },
      ];
    } else {
      return [
        { keys: "j/k", action: "scroll" },
        { keys: "g/G", action: "top/bottom" },
        { keys: "f", action: "follow" },
        { keys: "Tab", action: "switch" },
        { keys: "^e", action: "sidebar" },
        { keys: "Q", action: "quit" },
      ];
    }
  });

  return (
    <box
      paddingLeft={1}
      paddingRight={1}
      paddingBottom={1}
      flexShrink={0}
      flexDirection="row"
    >
      <For each={helpItems()}>
        {(item, index) => (
          <>
            {index() > 0 && <text fg={theme.textMuted}> · </text>}
            <text fg={theme.primary}>{item.keys}</text>
            <text fg={theme.textMuted}> {item.action}</text>
          </>
        )}
      </For>
    </box>
  );
}
