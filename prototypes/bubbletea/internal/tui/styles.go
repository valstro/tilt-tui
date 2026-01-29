package tui

import (
	"github.com/charmbracelet/lipgloss"
	"tilt-tui/internal/theme"
)

// Styles contains all the shared styles for the TUI
type Styles struct {
	Theme theme.Theme

	// Border styles
	BorderStyle        lipgloss.Style
	BorderFocusedStyle lipgloss.Style

	// Text styles
	TextStyle      lipgloss.Style
	MutedTextStyle lipgloss.Style
	BoldTextStyle  lipgloss.Style

	// Status styles
	StatusOkStyle       lipgloss.Style
	StatusPendingStyle  lipgloss.Style
	StatusErrorStyle    lipgloss.Style
	StatusDisabledStyle lipgloss.Style
}

// NewStyles creates a new Styles instance with the given theme
func NewStyles(t theme.Theme) Styles {
	return Styles{
		Theme: t,

		// Border styles
		BorderStyle: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(t.Border),

		BorderFocusedStyle: lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(t.BorderFocused),

		// Text styles
		TextStyle: lipgloss.NewStyle().
			Foreground(t.Foreground),

		MutedTextStyle: lipgloss.NewStyle().
			Foreground(t.Muted),

		BoldTextStyle: lipgloss.NewStyle().
			Foreground(t.Foreground).
			Bold(true),

		// Status styles
		StatusOkStyle: lipgloss.NewStyle().
			Foreground(t.StatusOk),

		StatusPendingStyle: lipgloss.NewStyle().
			Foreground(t.StatusPending),

		StatusErrorStyle: lipgloss.NewStyle().
			Foreground(t.StatusError),

		StatusDisabledStyle: lipgloss.NewStyle().
			Foreground(t.StatusDisabled),
	}
}

// StatusStyle returns the appropriate style for a given status
func (s Styles) StatusStyle(status string) lipgloss.Style {
	switch status {
	case "ok":
		return s.StatusOkStyle
	case "pending":
		return s.StatusPendingStyle
	case "error":
		return s.StatusErrorStyle
	default:
		return s.StatusDisabledStyle
	}
}
