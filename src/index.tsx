// Entry point for Tilt TUI

import { render } from "@opentui/solid";
import { ErrorBoundary } from "solid-js";
import { App } from "./app";
import { ErrorFallback } from "./components/error-fallback";
import { ConsolePosition } from "@opentui/core";
import { parseCLI } from "./cli";
import { startTiltProcess, isTiltRunning } from "./tilt/process";
import { setGlobalRenderer, getGlobalRenderer } from "./global-renderer";

const config = parseCLI();

if (config.spawnProcess) {
  if (await isTiltRunning()) {
    console.error("Another tilt instance is already running");
    process.exit(1);
  }
  startTiltProcess(config.tiltArgs);
}

// Process-level error handlers for unrecoverable errors
function emergencyExit(error: unknown, source: string) {
  console.error(`[${source}]`, error);
  const renderer = getGlobalRenderer();
  if (renderer) {
    try {
      renderer.destroy();
    } catch {
      // Ignore cleanup errors during emergency exit
    }
  }
  process.exit(1);
}

process.on("uncaughtException", (error) => {
  emergencyExit(error, "uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  emergencyExit(reason, "unhandledRejection");
});

// Wrapped App component with ErrorBoundary
function RootApp() {
  return (
    <ErrorBoundary
      fallback={(err, reset) => <ErrorFallback error={err} reset={reset} />}
    >
      <App />
    </ErrorBoundary>
  );
}

render(RootApp, {
  targetFps: 30,
  exitOnCtrlC: false,
  consoleOptions: {
    position: ConsolePosition.BOTTOM,
    startInDebugMode: true,
  },
  onDestroy: () => {
    setGlobalRenderer(null);
  },
});
