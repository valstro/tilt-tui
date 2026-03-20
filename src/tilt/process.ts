import type { Subprocess } from "bun";

let tiltProcess: Subprocess | null = null;

/** Spawn `tilt up` as a child process. Args are passed through verbatim. */
export function startTiltProcess(tiltArgs: string[]): void {
  const tiltBinary = Bun.which("tilt");
  if (!tiltBinary) {
    console.error("Unable to locate tilt binary in your PATH");
    process.exit(1);
  }

  const args = [tiltBinary, "up", ...tiltArgs];

  tiltProcess = Bun.spawn(args, {
    stdout: "ignore",
    stderr: "ignore", // we can rely on the TUI for this info
    env: {
      ...process.env,
      TILT_DISABLE_ANALYTICS: "true",
      DO_NOT_TRACK: "true",
    },
  });

  // cleanup() nulls tiltProcess before tilt actually exits, so when
  // this fires after an intentional kill, tiltProcess is already null.
  tiltProcess.exited.then((code) => {
    if (!tiltProcess) return;
    tiltProcess = null;
    if (code !== 0) {
      console.error(`tilt exited with code ${code}`);
      process.exit(code ?? 1);
    }
  });

  const cleanup = () => {
    if (tiltProcess && !tiltProcess.killed) {
      tiltProcess.kill("SIGTERM");
      tiltProcess = null;
    }
  };

  process.on("exit", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
}
