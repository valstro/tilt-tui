// PaneHeader component - consistent header for panes

import { type JSX } from "solid-js";
import { defaultTheme } from "../theme/theme";

interface PaneHeaderProps {
  title: string;
  children?: JSX.Element;
}

export function PaneHeader(props: PaneHeaderProps) {
  const theme = defaultTheme;

  return (
    <box
      padding={1}
      paddingLeft={2}
      paddingRight={2}
      flexDirection="row"
      flexShrink={0}
      justifyContent="space-between"
    >
      <text fg={theme.primary} attributes={1} flexShrink={0}>
        {props.title}
      </text>
      {props.children}
    </box>
  );
}
