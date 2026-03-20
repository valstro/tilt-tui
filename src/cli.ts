export interface CLIConfig {
  spawnProcess: boolean;
  tiltArgs: string[];
}

function parseCLI(): CLIConfig {
  const rawArgs = process.argv.slice(2);
  const upIndex = rawArgs.indexOf("up");

  if (upIndex === -1) return { spawnProcess: false, tiltArgs: [] };

  let tiltArgs = rawArgs.slice(upIndex + 1);
  if (tiltArgs[0] === "--") tiltArgs = tiltArgs.slice(1);

  return {
    spawnProcess: true,
    tiltArgs,
  };
}

let _config: CLIConfig | undefined;

export function initCLI(): CLIConfig {
  _config = parseCLI();
  return _config;
}
