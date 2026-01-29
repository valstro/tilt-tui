package messages

import (
	"time"

	"tilt-tui/internal/tilt"
)

// Pane represents which pane is currently focused
type Pane int

const (
	TreePane Pane = iota
	LogsPane
)

func (p Pane) String() string {
	switch p {
	case TreePane:
		return "RESOURCES"
	case LogsPane:
		return "LOGS"
	default:
		return ""
	}
}

// ResourcesUpdatedMsg is sent when resources are fetched/updated
type ResourcesUpdatedMsg struct {
	Resources []tilt.Resource
	Err       error
}

// LogsUpdatedMsg is sent when logs are fetched/updated
type LogsUpdatedMsg struct {
	ResourceName string
	Entries      []tilt.LogEntry
	Append       bool // true = append, false = replace
	Err          error
}

// ActivePaneChangedMsg is sent when focus changes between panes
type ActivePaneChangedMsg struct {
	Pane Pane
}

// ResourceSelectedMsg is sent when a resource is selected in the tree
type ResourceSelectedMsg struct {
	ResourceName string
}

// TickMsg is sent for periodic refresh
type TickMsg time.Time

// WebsocketConnectedMsg is sent when websocket connection is established
type WebsocketConnectedMsg struct{}

// WebsocketErrorMsg is sent when websocket encounters an error
type WebsocketErrorMsg struct {
	Err error
}

// TriggerResourceMsg is sent to trigger an update for a resource
type TriggerResourceMsg struct {
	ResourceName string
}

// ErrorMsg is sent when a general error occurs
type ErrorMsg struct {
	Err error
}
