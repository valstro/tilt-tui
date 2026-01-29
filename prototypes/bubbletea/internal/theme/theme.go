package theme

import "github.com/charmbracelet/lipgloss"

// Theme defines the color palette for the TUI
type Theme struct {
	// Base colors
	Background    lipgloss.Color
	Foreground    lipgloss.Color
	Muted         lipgloss.Color
	Border        lipgloss.Color
	BorderFocused lipgloss.Color

	// Status colors (runtime)
	StatusOk       lipgloss.Color // green
	StatusPending  lipgloss.Color // yellow
	StatusError    lipgloss.Color // red
	StatusDisabled lipgloss.Color // gray

	// Log level colors
	LogError   lipgloss.Color
	LogWarning lipgloss.Color
	LogInfo    lipgloss.Color
}

// Default returns the default theme
func Default() Theme {
	return Theme{
		// Base colors
		Background:    lipgloss.Color("#1F2937"),
		Foreground:    lipgloss.Color("#F9FAFB"),
		Muted:         lipgloss.Color("#6B7280"),
		Border:        lipgloss.Color("#374151"),
		BorderFocused: lipgloss.Color("#7C3AED"),

		// Status colors
		StatusOk:       lipgloss.Color("#10B981"), // green
		StatusPending:  lipgloss.Color("#F59E0B"), // yellow
		StatusError:    lipgloss.Color("#EF4444"), // red
		StatusDisabled: lipgloss.Color("#6B7280"), // gray

		// Log level colors
		LogError:   lipgloss.Color("#EF4444"),
		LogWarning: lipgloss.Color("#F59E0B"),
		LogInfo:    lipgloss.Color("#F9FAFB"),
	}
}

// RuntimeStatusIcon returns the icon for a given runtime status
func RuntimeStatusIcon(status string) string {
	switch status {
	case "ok":
		return "●"
	case "pending", "in_progress":
		return "◐"
	case "error":
		return "✗"
	case "not_applicable":
		return "○"
	default:
		return "○"
	}
}

// BuildStatusIcon returns the icon for a given build/update status
func BuildStatusIcon(status string) string {
	switch status {
	case "ok":
		return "✓"
	case "pending", "in_progress":
		return "⟳"
	case "error":
		return "✗"
	case "not_applicable":
		return "−"
	default:
		return "−"
	}
}

// StatusIcon returns the combined status icon (for header display)
func StatusIcon(status string) string {
	switch status {
	case "ok":
		return "✓"
	case "pending":
		return "●"
	case "error":
		return "×"
	default:
		return "•"
	}
}

// RuntimeStatusColor returns the color for a given runtime status
func (t Theme) RuntimeStatusColor(status string) lipgloss.Color {
	switch status {
	case "ok":
		return t.StatusOk
	case "pending", "in_progress":
		return t.StatusPending
	case "error":
		return t.StatusError
	default:
		return t.StatusDisabled
	}
}

// BuildStatusColor returns the color for a given build/update status
func (t Theme) BuildStatusColor(status string) lipgloss.Color {
	switch status {
	case "ok":
		return t.StatusOk
	case "pending", "in_progress":
		return t.StatusPending
	case "error":
		return t.StatusError
	default:
		return t.StatusDisabled
	}
}

// StatusColor returns the color for a combined status (for header display)
func (t Theme) StatusColor(status string) lipgloss.Color {
	switch status {
	case "ok":
		return t.StatusOk
	case "pending":
		return t.StatusPending
	case "error":
		return t.StatusError
	default:
		return t.StatusDisabled
	}
}

// LogLevelColor returns the color for a log level
func (t Theme) LogLevelColor(level string) lipgloss.Color {
	switch level {
	case "ERROR":
		return t.LogError
	case "WARN", "WARNING":
		return t.LogWarning
	default:
		return t.Foreground
	}
}
