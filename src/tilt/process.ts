import type { Subprocess } from "bun";
import { resolveTiltBinary, TILT_ENV } from "./tilt-cli";

let tiltProcess: Subprocess | null = null;

export async function isTiltRunning(): Promise<boolean> {
  let binary: string;
  try {
    binary = resolveTiltBinary();
  } catch {
    return false;
  }

  const proc = Bun.spawn([binary, "get", "uiresources"], {
    stdout: "ignore",
    stderr: "ignore",
    env: { ...process.env, ...TILT_ENV },
  });

  const exitCode = await proc.exited;
  return exitCode === 0;
}

/** Spawn `tilt up` as a child process. Args are passed through verbatim. */
export function startTiltProcess(tiltArgs: string[]): void {
  const binary = resolveTiltBinary();
  const args = [binary, "up", ...tiltArgs];

  tiltProcess = Bun.spawn(args, {
    stdout: "ignore",
    stderr: "ignore",
    env: { ...process.env, ...TILT_ENV },
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
