// Entry point for Tilt TUI

import { render } from "@opentui/solid";
import { App } from "./app";
import { ConsolePosition } from "@opentui/core";

render(App, {
  targetFps: 30,
  exitOnCtrlC: false,
  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    startInDebugMode: true,
  },
});
