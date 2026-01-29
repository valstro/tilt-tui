# Tilt TUI Experiments

## TUI SPECS

### TUI Layout

```
+----------------------------------------------------------------------------------+
| [status: × 1 / ● 1 / ✓ 4]                                                        |
+----------------------------------------------------------------------------------+
+-RESOURCES----------------+ +--LOGS: backend-service------------------------------+
|                          | |                                                     |
|                          | |                                                     |
|  ▼ (All)                 | |  [Build]  [Service]  [Ingress]                      |
|  ✓ react-frontend        | |  ────────────────────────────────────────────────── |
|  ● backend-service       | |                                                     |
|  ✓ auth-db               | |  [14:20:01] • Building Dockerfile: context='.'      |
|  × redis-cache           | |  [14:20:02] │ Step 1/5 : FROM alpine:3.14           |
|  ✓ analytics-worker      | |  [14:20:04] │ Step 2/5 : WORKDIR /app               |
|  ✓ notification-svc      | |  [14:20:05] │ Step 3/5 : COPY . .                   |
|  • local-resource        | |  [14:20:10] │ Step 4/5 : RUN go build -o main .     |
|                          | |  [14:20:15] ✓ Container built in 14.2s              |
|                          | |  [14:20:16]                                         |
|                          | |  [14:20:17] Serving on http://localhost:8080        |
|                          | |  [14:20:18] GET /api/health 200 OK                  |
|                          | |  [14:20:19] WARN: Database latency high             |
|                          | |  [14:20:20] GET /api/users 500 Internal Error       |
|                          | |                                                     |
+--------------------------+ +-----------------------------------------------------+
[LOGS] <j/k> Up/Down <h/l> Scroll L/R  <r> Trigger Update  <i> Details <Q> Quit
```

### TUI Guidelines

- text areas should not wrap text. they should scroll horizontally if possible in target framework.
  - text wrapping should be a last resort if horizontal scrolling is not possible in a context.
- all large text areas should have vim-like navigation.
  - j/k for up/down
  - h/l for scroll left/scroll right
  - g/G for home/end

## Tilt Reference

- [tilt api docs](https://api.tilt.dev/)
- [golang tilt client](./examples/bubbletea/tilt-tui-v1/internal/tilt/)

## TUI Stack Reference

### Charmbracelet (golang)

- Charmbracelet libraries
  - [bubbletea](./libraries/bubbletea/examples/)
  - [lipgloss](./libraries/lipgloss/examples/)
  - [bubbletea bubbles](./libraries/bubbles)
- Example apps
  - [opsy](./examples/bubbletea/opsy/internal/tui/)
- Reference tilt tui
  - [tilt tui v1](./examples/bubbletea/tilt-tui-v1/)

### React INK (typescript)

- Ink libraries
  - [ink](./libraries/ink/examples/)
- Example apps
  - [gitgud](./examples/ink/gitgud/)

### OpenTui Solid (typescript)

- OpenTui libraries
  - [@opentui/solid](./libraries/opentui/packages/solid/examples/)
- Example apps
  - [opencode](./examples/opentui/opencode/packages/opencode/src/cli/cmd/tui)

### Ratatui (rust)

- ratatui libraries
  - [ratatui](./libraries/ratatui/examples/)
- Example apps
  - [openapi-tui](./examples/ratatui/openapi-tui/)
  - [slumber](./examples/ratatui/slumber/)
  - [yozefu](./examples/ratatui/yuzefu/)

## TUI Testing Instructions

- use `tmux` and `tmux capture-pane` to verify tui layouts
