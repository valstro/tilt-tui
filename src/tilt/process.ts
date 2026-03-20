import type { Subprocess } from "bun";

let tiltProcess: Subprocess | null = null;

export function startTiltProcess(tiltArgs: string[]): void {
  const tiltBinary = Bun.which("tilt");
  if (!tiltBinary) {
    console.error("Unable to locate tilt binary in your PATH");
    process.exit(1);
  }

  // Construct: tilt up -- <tiltfile-args>
  // The '--' separates tilt's own flags from Tiltfile config args
  const args = [tiltBinary, "up", "--", ...tiltArgs];

  tiltProcess = Bun.spawn(args, {
    cwd: process.cwd(),
    stdout: "ignore",
    stderr: "ignore", // we can rely on the TUI for this info
    env: {
      ...process.env,
      TILT_DISABLE_ANALYTICS: "true",
      DO_NOT_TRACK: "true",
    },
  });

  const cleanup = () => {
    if (tiltProcess && !tiltProcess.killed) {
      tiltProcess.kill("SIGTERM");
      tiltProcess = null;
    }
  };

  process.on("exit", cleanup);
}
