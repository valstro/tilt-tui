// Entry point for Tilt TUI

import { render } from "@opentui/solid";
import { App } from "./app";
import { ConsolePosition } from "@opentui/core";
import { parseCLI } from "./cli";
import { startTiltProcess } from "./tilt/process";

const config = parseCLI();

if (config.spawnProcess) {
  startTiltProcess(config.tiltArgs);
}

render(App, {
  targetFps: 30,
  exitOnCtrlC: false,
  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    startInDebugMode: true,
  },
});
