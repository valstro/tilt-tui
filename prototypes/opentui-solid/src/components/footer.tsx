// Footer component - context-aware help

import { createMemo } from "solid-js"
import { useFocus } from "../context/focus"
import { defaultTheme } from "../theme/theme"

export function Footer() {
  const { state } = useFocus()
  const theme = defaultTheme

  const helpText = createMemo(() => {
    if (state.activePane === "tree") {
      return "[RESOURCES] <j/k> Up/Down  <Enter> Select  <r> Trigger  <Q> Quit"
    } else {
      return "[LOGS] <j/k> Up/Down  <h/l> Scroll L/R  <g/G> Top/Bottom  <f> Follow  <Q> Quit"
    }
  })

  return (
    <box flexDirection="row" flexShrink={0}>
      <text fg={theme.foreground}>{helpText()}</text>
    </box>
  )
}
