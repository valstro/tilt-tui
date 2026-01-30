// Entry point for Tilt TUI

import { render } from "@opentui/solid"
import { App } from "./app"

render(App, {
  targetFps: 30,
  exitOnCtrlC: false,
})
