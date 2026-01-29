package footer

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"tilt-tui/internal/theme"
	"tilt-tui/internal/tui/messages"
)

// Model represents the footer component
type Model struct {
	theme      theme.Theme
	maxWidth   int
	activePane messages.Pane
}

// Option is a function that modifies the Model
type Option func(*Model)

// New creates a new footer component
func New(opts ...Option) *Model {
	m := &Model{
		activePane: messages.TreePane,
	}

	for _, opt := range opts {
		opt(m)
	}

	return m
}

// Init initializes the footer component
func (m *Model) Init() tea.Cmd {
	return nil
}

// Update handles messages and updates the footer component
func (m *Model) Update(msg tea.Msg) (*Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.maxWidth = msg.Width
	case messages.ActivePaneChangedMsg:
		m.activePane = msg.Pane
	}

	return m, nil
}

// View renders the footer component
func (m *Model) View() string {
	// Styles
	paneStyle := lipgloss.NewStyle().
		Foreground(m.theme.Foreground).
		Bold(true)

	keyStyle := lipgloss.NewStyle().
		Foreground(m.theme.BorderFocused)

	descStyle := lipgloss.NewStyle().
		Foreground(m.theme.Muted)

	// Build help text based on active pane
	var helpText string

	switch m.activePane {
	case messages.TreePane:
		helpText = fmt.Sprintf("[%s] %s %s  %s %s  %s %s  %s %s",
			paneStyle.Render("RESOURCES"),
			keyStyle.Render("<j/k>"), descStyle.Render("Up/Down"),
			keyStyle.Render("<Enter>"), descStyle.Render("Select"),
			keyStyle.Render("<r>"), descStyle.Render("Trigger"),
			keyStyle.Render("<Q>"), descStyle.Render("Quit"),
		)
	case messages.LogsPane:
		helpText = fmt.Sprintf("[%s] %s %s  %s %s  %s %s  %s %s",
			paneStyle.Render("LOGS"),
			keyStyle.Render("<j/k>"), descStyle.Render("Up/Down"),
			keyStyle.Render("<h/l>"), descStyle.Render("Scroll L/R"),
			keyStyle.Render("<g/G>"), descStyle.Render("Top/Bottom"),
			keyStyle.Render("<Q>"), descStyle.Render("Quit"),
		)
	}

	// No border for footer
	containerStyle := lipgloss.NewStyle().
		Foreground(m.theme.Foreground).
		Width(m.maxWidth)

	return containerStyle.Render(helpText)
}

// WithTheme sets the theme for the footer component
func WithTheme(t theme.Theme) Option {
	return func(m *Model) {
		m.theme = t
	}
}

// WithActivePane sets the initial active pane
func WithActivePane(pane messages.Pane) Option {
	return func(m *Model) {
		m.activePane = pane
	}
}
