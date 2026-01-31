// Footer component - context-aware help

import { createMemo } from "solid-js";
import { useFocus } from "../context/focus";
import { defaultTheme } from "../theme/theme";

export function Footer() {
  const { state } = useFocus();
  const theme = defaultTheme;

  const helpText = createMemo(() => {
    if (state.activePane === "tree") {
      return "j/k nav · Enter select · r trigger · Tab switch · ^e sidebar · Q quit";
    } else {
      return "j/k scroll · g/G top/bottom · f follow · Tab switch · ^e sidebar · Q quit";
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
      <text fg={theme.textMuted}>{helpText()}</text>
    </box>
  );
}
