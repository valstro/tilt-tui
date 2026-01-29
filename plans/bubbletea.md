# Bubbletea Prototype Plan

## Overview

A Tilt TUI prototype built with the Charmbracelet stack (bubbletea, lipgloss, bubbles), focused on layout and navigation. Uses the opsy component pattern with consistent `Init/Update/View` interface and `viewport.Model` for scrollable panes.

## Directory Structure

```
prototypes/bubbletea/
├── cmd/
│   └── tilt-tui/
│       └── main.go
├── internal/
│   ├── tilt/
│   │   ├── client.go                  # Copied from examples
│   │   └── types.go
│   ├── theme/
│   │   └── theme.go
│   └── tui/
│       ├── tui.go
│       ├── styles.go
│       ├── keymap.go
│       ├── messages.go
│       └── components/
│           ├── header/
│           │   └── header.go
│           ├── tree/
│           │   └── tree.go
│           ├── logs/
│           │   └── logs.go
│           └── footer/
│               └── footer.go
├── go.mod
└── go.sum
```

## Target Layout (from GOALS.md)

```
+----------------------------------------------------------------------------------+
| [status: × 1 / ● 1 / ✓ 4]                                                        |
+----------------------------------------------------------------------------------+

+-RESOURCES----------------+ +--LOGS: backend-service------------------------------+
|                          | |                                                     |
|  ▼ (All)                 | |                                                     |
|  ✓ react-frontend        | |  [14:20:01] • Building Dockerfile: context='.'      |
|  ● backend-service       | |  [14:20:02] │ Step 1/5 : FROM alpine:3.14           |
|  ✓ auth-db               | |  ...                                                |
|  × redis-cache           | |                                                     |
+--------------------------+ +-----------------------------------------------------+

[LOGS] <j/k> Up/Down <h/l> Scroll L/R  <r> Trigger Update  <i> Details <Q> Quit
```

## Component Specifications

### Header (`components/header/header.go`)

| Field | Type | Purpose |
|-------|------|---------|
| `theme` | `theme.Theme` | Color palette |
| `maxWidth` | `int` | Terminal width |
| `errorCount` | `int` | Resources with status `×` |
| `pendingCount` | `int` | Resources with status `●` |
| `okCount` | `int` | Resources with status `✓` |

**Renders:** `[status: × 1 / ● 1 / ✓ 4]` with colored icons, full-width border

### Tree (`components/tree/tree.go`)

| Field | Type | Purpose |
|-------|------|---------|
| `theme` | `theme.Theme` | Color palette |
| `maxWidth`, `maxHeight` | `int` | Dimensions |
| `viewport` | `viewport.Model` | Vertical scrolling |
| `resources` | `[]tilt.Resource` | Resource list |
| `cursor` | `int` | Current selection index |
| `selected` | `string` | Selected resource name |
| `focused` | `bool` | Has keyboard focus |
| `xOffset` | `int` | Horizontal scroll offset |

**Methods:** `Focus()`, `Blur()`, `SelectedResource() string`

**Renders:** Bordered pane titled "RESOURCES" with status icons per resource

### Logs (`components/logs/logs.go`)

| Field | Type | Purpose |
|-------|------|---------|
| `theme` | `theme.Theme` | Color palette |
| `maxWidth`, `maxHeight` | `int` | Dimensions |
| `viewport` | `viewport.Model` | Vertical scrolling |
| `resourceName` | `string` | Current resource |
| `entries` | `[]tilt.LogEntry` | Log lines |
| `focused` | `bool` | Has keyboard focus |
| `xOffset` | `int` | Horizontal scroll (no wrap) |

**Methods:** `Focus()`, `Blur()`, `SetResourceName(name string)`

**Renders:** Bordered pane titled "LOGS: {resourceName}" with timestamped entries

### Footer (`components/footer/footer.go`)

| Field | Type | Purpose |
|-------|------|---------|
| `theme` | `theme.Theme` | Color palette |
| `maxWidth` | `int` | Terminal width |
| `activePane` | `string` | "TREE" or "LOGS" |

**Renders:** `[{PANE}] <j/k> Up/Down <h/l> Scroll L/R  <r> Trigger Update  <Q> Quit` (no border)

## Main Model (`tui/tui.go`)

```go
type Pane int
const (
    TreePane Pane = iota
    LogsPane
)

type Model struct {
    theme      *theme.Theme
    client     *tilt.Client
    header     *header.Model
    tree       *tree.Model
    logs       *logs.Model
    footer     *footer.Model
    activePane Pane
    width, height int
}
```

**Message Routing:**

| Message Type | Routed To |
|--------------|-----------|
| `tea.WindowSizeMsg` | All components (with calculated sizes) |
| `tea.KeyMsg` (global: `q`, `Tab`) | Main model handles |
| `tea.KeyMsg` (nav: `j/k/g/G/h/l`) | Focused pane only |
| `ResourcesUpdatedMsg` | Header + Tree |
| `LogsUpdatedMsg` | Logs |
| `ActivePaneChangedMsg` | Footer |

## Keybindings

| Context | Key | Action |
|---------|-----|--------|
| Global | `q`, `Q`, `Ctrl+C` | Quit |
| Global | `Tab` | Cycle focus: Tree → Logs → Tree |
| Global | `/` | Focus search (future) |
| Tree (focused) | `j`, `↓` | Move cursor down |
| Tree (focused) | `k`, `↑` | Move cursor up |
| Tree (focused) | `g` | Go to first resource |
| Tree (focused) | `G` | Go to last resource |
| Tree (focused) | `h` | Scroll left (long names) |
| Tree (focused) | `l` | Scroll right |
| Tree (focused) | `Enter` | Select resource, load logs |
| Tree (focused) | `r` | Trigger update for selected |
| Logs (focused) | `j`, `↓` | Scroll down |
| Logs (focused) | `k`, `↑` | Scroll up |
| Logs (focused) | `g` | Scroll to top |
| Logs (focused) | `G` | Scroll to bottom |
| Logs (focused) | `h` | Scroll left (long lines) |
| Logs (focused) | `l` | Scroll right |

## Custom Messages (`tui/messages.go`)

```go
type ResourcesUpdatedMsg struct {
    Resources []tilt.Resource
    Err       error
}

type LogsUpdatedMsg struct {
    ResourceName string
    Entries      []tilt.LogEntry
    Append       bool  // true = append, false = replace
    Err          error
}

type ActivePaneChangedMsg struct {
    Pane Pane
}

type TickMsg time.Time

type WebsocketConnectedMsg struct{}
type WebsocketErrorMsg struct{ Err error }
```

## Theme (`theme/theme.go`)

```go
type Theme struct {
    // Base colors
    Background    lipgloss.Color
    Foreground    lipgloss.Color
    Border        lipgloss.Color
    BorderFocused lipgloss.Color
    
    // Status colors
    StatusOk      lipgloss.Color  // ✓ green
    StatusPending lipgloss.Color  // ● yellow  
    StatusError   lipgloss.Color  // × red
    StatusDisabled lipgloss.Color // • gray
}

func Default() Theme { ... }
```

## Layout Calculation

```go
const (
    headerHeight = 3   // Status bar + borders
    footerHeight = 1   // Help text, no border
    paneMargin   = 1   // Space between panes
)

func (m *Model) calculateLayout() {
    paneHeight := m.height - headerHeight - footerHeight - paneMargin
    
    // Tree: 30-40% width, clamped
    treeWidth := clamp(m.width*35/100, 25, 50)
    logsWidth := m.width - treeWidth - paneMargin
    
    // Propagate to components...
}
```

## Implementation Tasks

### Phase 1: Project Setup

| # | Task | Files |
|---|------|-------|
| 1.1 | Create directory structure | `prototypes/bubbletea/...` |
| 1.2 | Initialize Go module | `go.mod` |
| 1.3 | Copy tilt client/types | `internal/tilt/` |
| 1.4 | Add dependencies | `go.mod` (bubbletea, lipgloss, bubbles, gorilla/websocket) |

### Phase 2: Foundation

| # | Task | Files |
|---|------|-------|
| 2.1 | Define theme/colors | `internal/theme/theme.go` |
| 2.2 | Define shared styles | `internal/tui/styles.go` |
| 2.3 | Define custom messages | `internal/tui/messages.go` |
| 2.4 | Define keybindings | `internal/tui/keymap.go` |

### Phase 3: Components

| # | Task | Files |
|---|------|-------|
| 3.1 | Header component | `internal/tui/components/header/header.go` |
| 3.2 | Tree component (viewport) | `internal/tui/components/tree/tree.go` |
| 3.3 | Logs component (viewport) | `internal/tui/components/logs/logs.go` |
| 3.4 | Footer component | `internal/tui/components/footer/footer.go` |

### Phase 4: Main App

| # | Task | Files |
|---|------|-------|
| 4.1 | Main model + composition | `internal/tui/tui.go` |
| 4.2 | Layout calculation | `internal/tui/tui.go` |
| 4.3 | Message routing | `internal/tui/tui.go` |
| 4.4 | Focus management | `internal/tui/tui.go` |
| 4.5 | Websocket streaming | `internal/tui/tui.go` |

### Phase 5: Entry Point & Testing

| # | Task | Files |
|---|------|-------|
| 5.1 | CLI entry point | `cmd/tilt-tui/main.go` |
| 5.2 | Test with tmux capture-pane | Manual |

## Dependencies

```
github.com/charmbracelet/bubbletea v1.x
github.com/charmbracelet/lipgloss v1.x
github.com/charmbracelet/bubbles v0.x
github.com/gorilla/websocket v1.x
```
