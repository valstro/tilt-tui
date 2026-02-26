# Tilt Tui

![screenshot](./docs/tui-screenshot.png)

## Requirements

- bun
- a running tilt process

## Running

### Dev Mode

```
bun install
bun dev
```

### Compile a Binary

compile a binary for the current platform

```
bun run build:binary:single
```

### Debugging

run debug command then click lick to open javascript debug console, or attach another debugger to port.

```
❯ bun run debug
$ SHOW_CONSOLE=true bun run --inspect-wait --conditions=browser --preload @opentui/solid/preload ./src/index.tsx
--------------------- Bun Inspector ---------------------
Listening:
  ws://localhost:6499/de2t02omqqh
Inspect in browser:
  https://debug.bun.sh/#localhost:6499/de2t02omqqh
--------------------- Bun Inspector ---------------------
```

## Using

`?` will show you list of context-aware keyboard shortcuts.

## Configuration

Tilt TUI loads user settings from `~/.config/tilt-tui/config.json`.

### Log Filters

Filter out noisy log lines using regex patterns. Create named filters to hide logs matching specific patterns.

Example `~/.config/tilt-tui/config.json`:

```json
{
  "logFilters": {
    "health-checks": [
      "GET /health",
      "GET /readiness"
    ],
    "debug-logs": [
      "^DEBUG:",
      "\\[debug\\]"
    ]
  }
}
```

Each filter:
- Has a **name** (displayed in the UI when active)
- Contains an array of **regex patterns** (JavaScript regex syntax)
- Filters are applied automatically when the config file is present

Active filters are shown in the log view header: `[logFilters: health-checks, debug-logs]`
