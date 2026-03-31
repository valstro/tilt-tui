export interface CLIConfig {
  spawnProcess: boolean;
  /** Everything after "up" -- passed verbatim to `tilt up`. */
  tiltArgs: string[];
}

const HELP = `
tilt-tui - A terminal UI for Tilt

Usage:
  tilt-tui              Connect to an already-running tilt instance
  tilt-tui up [args…]   Start tilt and connect to it

Options:
  -h, --help            Show this help message

Examples:
  tilt-tui                          Connect to tilt on localhost:10350
  tilt-tui up                       Start tilt with default settings
  tilt-tui up --port 10351          Start tilt on a custom port
  tilt-tui up -- --foo=bar          Pass Tiltfile args after --
`.trim();

/**
 * Parse CLI args into a config.
 *
 * `tilt-tui up [tilt-args...]` → spawn tilt as a child process
 * `tilt-tui`                   → connect to an already-running tilt
 */
export function parseCLI(): CLIConfig {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes("-h") || rawArgs.includes("--help")) {
    console.log(HELP);
    process.exit(0);
  }

  const upIndex = rawArgs.indexOf("up");

  if (upIndex === -1) return { spawnProcess: false, tiltArgs: [] };

  const tiltArgs = rawArgs.slice(upIndex + 1);

  return {
    spawnProcess: true,
    tiltArgs,
  };
}
