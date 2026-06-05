export interface TuiConfig {
  kind: "tui";
  spawnProcess: boolean;
  /** Everything after "up" -- passed verbatim to `tilt up`. */
  tiltArgs: string[];
}

export interface LogsConfig {
  kind: "logs";
  /** Resource name to filter logs for. Empty string means all resources. */
  resource: string;
  /** Stream new logs continuously instead of dumping and exiting. */
  follow: boolean;
  host: string;
  port: number;
}

export type CLIConfig = TuiConfig | LogsConfig;

const HELP = `
tilt-tui - A terminal UI for Tilt

Usage:
  tilt-tui                        Connect to an already-running tilt instance
  tilt-tui up [args…]             Start tilt and connect to it
  tilt-tui logs [resource]        Dump logs from a running tilt instance

Options:
  -h, --help                      Show this help message

Logs options:
  -f, --follow                    Stream new logs continuously
  --host <host>                   Tilt API host (default: localhost)
  --port <port>                   Tilt API port (default: 10350)

Examples:
  tilt-tui                          Connect to tilt on localhost:10350
  tilt-tui up                       Start tilt with default settings
  tilt-tui up --port 10351          Start tilt on a custom port
  tilt-tui up -- --foo=bar          Pass Tiltfile args after --
  tilt-tui logs                     Dump all logs
  tilt-tui logs my-service          Dump logs for my-service
  tilt-tui logs my-service -f       Stream logs for my-service
  tilt-tui logs --port 10351        Dump logs from tilt on custom port
`.trim();

export function parseCLI(): CLIConfig {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.includes("-h") || rawArgs.includes("--help")) {
    console.log(HELP);
    process.exit(0);
  }

  const logsIndex = rawArgs.indexOf("logs");
  if (logsIndex !== -1) {
    return parseLogsCommand(rawArgs.slice(logsIndex + 1));
  }

  const upIndex = rawArgs.indexOf("up");
  if (upIndex === -1) return { kind: "tui", spawnProcess: false, tiltArgs: [] };

  const tiltArgs = rawArgs.slice(upIndex + 1);
  return { kind: "tui", spawnProcess: true, tiltArgs };
}

function parseLogsCommand(args: string[]): LogsConfig {
  let resource = "";
  let follow = false;
  let host = "localhost";
  let port = 10350;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-f" || arg === "--follow") {
      follow = true;
    } else if (arg === "--host") {
      host = args[++i] ?? host;
    } else if (arg === "--port") {
      const p = parseInt(args[++i], 10);
      if (!isNaN(p)) port = p;
    } else if (!arg.startsWith("-")) {
      resource = arg;
    }
  }

  return { kind: "logs", resource, follow, host, port };
}
