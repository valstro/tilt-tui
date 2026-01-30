# OpenTUI Solid Tilt TUI Prototype

## Overview

A TUI for Tilt.dev built with OpenTUI Solid (TypeScript), aiming for feature parity with the Bubbletea prototype.

## Target Layout

```
╭──────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ● Connected · docker-desktop                                                       ✗ 2 ✓ 2 / 4   │
╰──────────────────────────────────────────────────────────────────────────────────────────────────╯
╭─────────────────────────────────╮ ╭──────────────────────────────────────────────────────────────╮
│ Resources (4)                   │ │ Logs: api [follow]                                           │
│───────────────────────────────  │ │────────────────────────────────────────────────────────────  │
│ ▼ backend (1)                   │ │[01:07:46] Step 1 - Building...                               │
│   ● api                         │ │[01:07:47] Step 2 - Deploying...                              │
│     ✓ 35m ago · 3.3s            │ │[01:07:48] Done!                                              │
│ ▼ frontend (1)                  │ │                                                              │
│   ● web                         │ │                                                              │
│     ✓ 35m ago · 4.1s            │ │                                                              │
│ ▼ ungrouped (2)                 │ │                                                              │
│   ○ (Tiltfile)                  │ │                                                              │
│     ✓ just now · 450ms          │ │                                                              │
╰─────────────────────────────────╯ ╰──────────────────────────────────────────────────────────────╯
[RESOURCES] <j/k> Up/Down  <Enter> Select  <r> Trigger  <Q> Quit
```

## Features (Parity with Bubbletea)

### Header Component
- Connection status icon: `●` Connected (green), `◐` Connecting (yellow), `○` Disconnected (red)
- Cluster context (e.g., `docker-desktop`)
- Namespace if available
- Status counts on right: `✗ N` (errors), `⚠ N` (warnings), `● N` (pending), `✓ N / N` (healthy/total), `⊘ N` (disabled)

### Tree Component (Resources Panel)
- Resource grouping by labels (app, component, etc.)
- Collapsible groups with `▼`/`▶` indicators
- 2-line resource items:
  - Line 1: Runtime status icon + resource name [+ pending indicator ⟳]
  - Line 2: Build status icon + last update time + build duration
- Vim-style navigation (j/k/g/G)
- Space/Enter to toggle groups or select resources
- `r` to trigger resource rebuild

### Logs Component
- Log viewer with timestamps
- Auto-scroll with `[follow]` indicator
- Toggle follow mode with `f`
- Vim-style navigation (j/k/g/G for vertical, h/l for horizontal scroll)

### Footer Component
- Context-aware help based on active pane
- RESOURCES mode: `<j/k> Up/Down  <Enter> Select  <r> Trigger  <Q> Quit`
- LOGS mode: `<j/k> Up/Down  <h/l> Scroll L/R  <g/G> Top/Bottom  <Q> Quit`

### Keyboard Navigation
- `Tab` / `Shift+Tab` to cycle between panes
- `j/k` for up/down
- `h/l` for horizontal scroll (in logs)
- `g/G` for home/end
- `Space` / `Enter` to toggle/select
- `r` to trigger resource
- `Q` to quit

## Project Structure

```
prototypes/opentui-solid/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx              # Entry point
│   ├── app.tsx                # Main App component
│   ├── tilt/
│   │   ├── client.ts          # Tilt API client
│   │   └── types.ts           # TypeScript types for Tilt API
│   ├── theme/
│   │   └── theme.ts           # Colors, icons, styles
│   ├── context/
│   │   ├── tilt.tsx           # Tilt data provider
│   │   └── focus.tsx          # Focus management provider
│   └── components/
│       ├── header.tsx         # Header component
│       ├── tree.tsx           # Resource tree component
│       ├── logs.tsx           # Log viewer component
│       └── footer.tsx         # Footer component
```

## Dependencies

- `@opentui/solid` - OpenTUI Solid framework
- `@opentui/core` - Core utilities
- `solid-js` - SolidJS reactive primitives

## Implementation Notes

### State Management
- Use SolidJS signals for local component state
- Use stores for complex nested state (resources, logs)
- Create context providers for shared state (Tilt data, focus)

### Data Fetching
- Initial data via websocket connection (like Bubbletea)
- Periodic polling as fallback
- SSE for log streaming if available

### Focus Management
- Track active pane with signal
- Components check focus state for keyboard handling
- Visual indication of focused pane (border color change)

### Scrolling
- Use `<scrollbox>` for tree and logs
- Implement horizontal scroll offset for logs
- Sticky scroll (auto-follow) for logs
