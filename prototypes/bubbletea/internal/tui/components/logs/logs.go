package logs

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"tilt-tui/internal/theme"
	"tilt-tui/internal/tilt"
	"tilt-tui/internal/tui/keymap"
	"tilt-tui/internal/tui/messages"
)

// Model represents the logs component
type Model struct {
	theme        theme.Theme
	maxWidth     int
	maxHeight    int
	viewport     viewport.Model
	resourceName string
	entries      []tilt.LogEntry
	focused      bool
	xOffset      int
	keyMap       keymap.KeyMap
	autoScroll   bool
}

// Option is a function that modifies the Model
type Option func(*Model)

// New creates a new logs component
func New(opts ...Option) *Model {
	m := &Model{
		viewport:   viewport.New(0, 0),
		keyMap:     keymap.Default(),
		autoScroll: true,
	}

	for _, opt := range opts {
		opt(m)
	}

	return m
}

// Init initializes the logs component
func (m *Model) Init() tea.Cmd {
	return nil
}

// Update handles messages and updates the logs component
func (m *Model) Update(msg tea.Msg) (*Model, tea.Cmd) {
	var cmd tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.maxWidth = msg.Width
		m.maxHeight = msg.Height
		// Adjust for border (2 chars each side) and title line (2 lines for title + separator)
		m.viewport.Width = msg.Width - 4
		m.viewport.Height = msg.Height - 4
		m.renderContent()

	case messages.LogsUpdatedMsg:
		if msg.Err == nil {
			m.resourceName = msg.ResourceName
			if msg.Append {
				m.entries = append(m.entries, msg.Entries...)
			} else {
				m.entries = msg.Entries
			}
			m.renderContent()
			// Auto-scroll to bottom on new logs
			if m.autoScroll {
				m.viewport.GotoBottom()
			}
		}

	case messages.ResourceSelectedMsg:
		// Clear logs when resource changes
		if msg.ResourceName != m.resourceName {
			m.resourceName = msg.ResourceName
			m.entries = nil
			m.xOffset = 0
			m.autoScroll = true
			m.renderContent()
		}

	case tea.KeyMsg:
		if !m.focused {
			return m, nil
		}

		switch {
		case key.Matches(msg, m.keyMap.Up):
			m.autoScroll = false
			m.viewport.LineUp(1)
		case key.Matches(msg, m.keyMap.Down):
			m.viewport.LineDown(1)
			// Re-enable auto-scroll if at bottom
			if m.viewport.AtBottom() {
				m.autoScroll = true
			}
		case key.Matches(msg, m.keyMap.Home):
			m.autoScroll = false
			m.viewport.GotoTop()
		case key.Matches(msg, m.keyMap.End):
			m.viewport.GotoBottom()
			m.autoScroll = true
		case key.Matches(msg, m.keyMap.PageUp):
			m.autoScroll = false
			m.viewport.HalfViewUp()
		case key.Matches(msg, m.keyMap.PageDown):
			m.viewport.HalfViewDown()
			if m.viewport.AtBottom() {
				m.autoScroll = true
			}
		case key.Matches(msg, m.keyMap.Left):
			if m.xOffset > 0 {
				m.xOffset--
				m.renderContent()
			}
		case key.Matches(msg, m.keyMap.Right):
			m.xOffset++
			m.renderContent()
		case msg.String() == "f":
			// Toggle follow mode
			m.autoScroll = !m.autoScroll
			if m.autoScroll {
				m.viewport.GotoBottom()
			}
		}
	}

	m.viewport, cmd = m.viewport.Update(msg)
	return m, cmd
}

// View renders the logs component
func (m *Model) View() string {
	borderColor := m.theme.Border
	if m.focused {
		borderColor = m.theme.BorderFocused
	}

	// Title style
	titleStyle := lipgloss.NewStyle().
		Foreground(m.theme.BorderFocused).
		Bold(true).
		Padding(0, 1)

	// Border style
	borderStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Width(m.maxWidth - 2).
		Height(m.maxHeight - 2)

	// Build title with resource name and follow indicator
	titleText := "Logs"
	if m.resourceName != "" {
		titleText = fmt.Sprintf("Logs: %s", m.resourceName)
	}
	if m.autoScroll {
		followStyle := lipgloss.NewStyle().Foreground(m.theme.StatusOk)
		titleText += followStyle.Render(" [follow]")
	}

	title := titleStyle.Render(titleText)
	separator := lipgloss.NewStyle().
		Foreground(borderColor).
		Render(strings.Repeat("─", m.maxWidth-4))

	// Build content with title at top
	content := lipgloss.JoinVertical(lipgloss.Left,
		title,
		separator,
		m.viewport.View(),
	)

	return borderStyle.Render(content)
}

// Focus sets the focused state
func (m *Model) Focus() {
	m.focused = true
}

// Blur removes the focused state
func (m *Model) Blur() {
	m.focused = false
}

// IsFocused returns the focused state
func (m *Model) IsFocused() bool {
	return m.focused
}

// SetResourceName sets the resource name for the title
func (m *Model) SetResourceName(name string) {
	m.resourceName = name
}

// WithTheme sets the theme for the logs component
func WithTheme(t theme.Theme) Option {
	return func(m *Model) {
		m.theme = t
	}
}

// renderContent renders the log entries
func (m *Model) renderContent() {
	if len(m.entries) == 0 {
		emptyStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)
		m.viewport.SetContent(emptyStyle.Render("No logs available. Select a resource to view logs."))
		return
	}

	var sb strings.Builder

	for i, entry := range m.entries {
		line := m.renderLogLine(entry)
		sb.WriteString(line)
		if i < len(m.entries)-1 {
			sb.WriteString("\n")
		}
	}

	m.viewport.SetContent(sb.String())
}

// renderLogLine renders a single log entry with level-based styling
func (m *Model) renderLogLine(entry tilt.LogEntry) string {
	// Timestamp style
	timestampStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)

	// Format timestamp
	timestamp := entry.Timestamp.Format("15:04:05")

	// Get text style based on log level
	textStyle := lipgloss.NewStyle().Foreground(m.theme.LogLevelColor(entry.Level))

	// Build line without wrapping (horizontal scroll instead)
	line := fmt.Sprintf("[%s] %s", timestampStyle.Render(timestamp), textStyle.Render(entry.Text))

	// Apply horizontal scroll offset
	if m.xOffset > 0 {
		// Need to handle ANSI codes properly - for now, simple offset
		visibleLine := stripAnsiAndOffset(line, m.xOffset)
		return visibleLine
	}

	return line
}

// renderLogLine renders a single log entry with level-based styling
func (m *Model) renderLogLineWithWidth(entry tilt.LogEntry, width int) string {
	// Timestamp style
	timestampStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)

	// Format timestamp
	timestamp := entry.Timestamp.Format("15:04:05")

	// Get text style based on log level
	textStyle := lipgloss.NewStyle().Foreground(m.theme.LogLevelColor(entry.Level))

	// Build line without wrapping (horizontal scroll instead)
	line := fmt.Sprintf("[%s] %s", timestampStyle.Render(timestamp), textStyle.Render(entry.Text))

	// Apply horizontal scroll offset
	if m.xOffset > 0 {
		visibleLine := stripAnsiAndOffset(line, m.xOffset)
		return visibleLine
	}

	return line
}

// stripAnsiAndOffset applies horizontal offset, attempting to handle visible characters
func stripAnsiAndOffset(s string, offset int) string {
	if offset <= 0 {
		return s
	}

	// Simple approach: just slice the string
	// This won't handle ANSI codes perfectly but works for basic cases
	runes := []rune(s)
	if offset >= len(runes) {
		return ""
	}
	return string(runes[offset:])
}
