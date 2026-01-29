package keymap

import (
	"tilt-tui/internal/tui/messages"

	"github.com/charmbracelet/bubbles/key"
)

// KeyMap defines all the keybindings for the TUI
type KeyMap struct {
	// Global keys
	Quit     key.Binding
	Tab      key.Binding
	ShiftTab key.Binding
	Help     key.Binding

	// Navigation keys (vim-style)
	Up       key.Binding
	Down     key.Binding
	Left     key.Binding
	Right    key.Binding
	Home     key.Binding
	End      key.Binding
	PageUp   key.Binding
	PageDown key.Binding

	// Action keys
	Select  key.Binding
	Trigger key.Binding
	Search  key.Binding
}

// Default returns the default keybindings
func Default() KeyMap {
	return KeyMap{
		// Global keys
		Quit: key.NewBinding(
			key.WithKeys("q", "Q", "ctrl+c"),
			key.WithHelp("q", "quit"),
		),
		Tab: key.NewBinding(
			key.WithKeys("tab"),
			key.WithHelp("tab", "next pane"),
		),
		ShiftTab: key.NewBinding(
			key.WithKeys("shift+tab"),
			key.WithHelp("shift+tab", "prev pane"),
		),
		Help: key.NewBinding(
			key.WithKeys("?"),
			key.WithHelp("?", "help"),
		),

		// Navigation keys (vim-style)
		Up: key.NewBinding(
			key.WithKeys("k", "up"),
			key.WithHelp("k/up", "up"),
		),
		Down: key.NewBinding(
			key.WithKeys("j", "down"),
			key.WithHelp("j/down", "down"),
		),
		Left: key.NewBinding(
			key.WithKeys("h", "left"),
			key.WithHelp("h/left", "scroll left"),
		),
		Right: key.NewBinding(
			key.WithKeys("l", "right"),
			key.WithHelp("l/right", "scroll right"),
		),
		Home: key.NewBinding(
			key.WithKeys("g", "home"),
			key.WithHelp("g", "go to top"),
		),
		End: key.NewBinding(
			key.WithKeys("G", "end"),
			key.WithHelp("G", "go to bottom"),
		),
		PageUp: key.NewBinding(
			key.WithKeys("ctrl+k", "pgup"),
			key.WithHelp("ctrl+k", "page up"),
		),
		PageDown: key.NewBinding(
			key.WithKeys("ctrl+j", "pgdown"),
			key.WithHelp("ctrl+j", "page down"),
		),

		// Action keys
		Select: key.NewBinding(
			key.WithKeys("enter"),
			key.WithHelp("enter", "select"),
		),
		Trigger: key.NewBinding(
			key.WithKeys("r"),
			key.WithHelp("r", "trigger update"),
		),
		Search: key.NewBinding(
			key.WithKeys("/"),
			key.WithHelp("/", "search"),
		),
	}
}

// ShortHelp returns the short help for the current pane
func (k KeyMap) ShortHelp(pane messages.Pane) []key.Binding {
	switch pane {
	case messages.TreePane:
		return []key.Binding{k.Up, k.Down, k.Select, k.Trigger, k.Tab, k.Quit}
	case messages.LogsPane:
		return []key.Binding{k.Up, k.Down, k.Left, k.Right, k.Home, k.End, k.Tab, k.Quit}
	default:
		return []key.Binding{k.Tab, k.Quit}
	}
}

// FullHelp returns the full help
func (k KeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{
		{k.Up, k.Down, k.Left, k.Right},
		{k.Home, k.End, k.PageUp, k.PageDown},
		{k.Select, k.Trigger, k.Search},
		{k.Tab, k.Quit, k.Help},
	}
}
