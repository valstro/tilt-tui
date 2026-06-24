// Entry point for Tilt TUI

import { render } from "@opentui/solid";
import { ErrorBoundary } from "solid-js";
import { App } from "./app";
import { ErrorFallback } from "./components/error-fallback";
import { ConsolePosition } from "@opentui/core";
import { parseCLI } from "./cli";
import {
  startTiltProcess,
  isTiltRunning,
  isPortInUse,
  TiltStartError,
} from "./tilt/process";
import { setGlobalRenderer, getGlobalRenderer } from "./global-renderer";

const config = await parseCLI();

if (config.kind === "logs") {
  const { dumpLogs } = await import("./tilt/dump-logs");
  await dumpLogs(config);
  process.exit(0);
}

if (config.spawnProcess) {
  if (await isTiltRunning(config.port)) {
    console.error(
      `A tilt instance is already running on port ${config.port}`,
    );
    process.exit(1);
  }
  if (await isPortInUse(config.port)) {
    console.error(
      `Port ${config.port} is already in use by another process (not a tilt API).\n` +
        `Pick a different port with --port, or free the port before starting.`,
    );
    process.exit(1);
  }
  try {
    await startTiltProcess(config.tiltArgs, config.port);
  } catch (err) {
    if (err instanceof TiltStartError) {
      console.error(`Failed to start tilt:\n${err.message}`);
    } else {
      console.error("Failed to start tilt:", err);
    }
    process.exit(1);
  }
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
      <App port={config.port} />
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
