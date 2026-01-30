package header

import (
	"fmt"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"tilt-tui/internal/theme"
	"tilt-tui/internal/tilt"
)

// ConnectionStatus represents the connection state to Tilt
type ConnectionStatus int

const (
	Disconnected ConnectionStatus = iota
	Connecting
	Connected
)

// Model represents the header component
type Model struct {
	theme    theme.Theme
	maxWidth int

	// Connection info
	connectionStatus ConnectionStatus
	clusterContext   string
	namespace        string

	// Resource status counts (matching Tilt UI's StatusCounts)
	healthyCount   int
	totalEnabled   int
	pendingCount   int
	unhealthyCount int
	warningCount   int
	disabledCount  int
}

// Option is a function that modifies the Model
type Option func(*Model)

// New creates a new header component
func New(opts ...Option) *Model {
	m := &Model{
		connectionStatus: Connecting,
	}

	for _, opt := range opts {
		opt(m)
	}

	return m
}

// Init initializes the header component
func (m *Model) Init() tea.Cmd {
	return nil
}

// Update handles messages and updates the header component
func (m *Model) Update(msg tea.Msg) (*Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.maxWidth = msg.Width
	case ResourceCountsMsg:
		m.healthyCount = msg.Healthy
		m.totalEnabled = msg.TotalEnabled
		m.pendingCount = msg.Pending
		m.unhealthyCount = msg.Unhealthy
		m.warningCount = msg.Warning
		m.disabledCount = msg.Disabled
		m.namespace = msg.Namespace
		m.clusterContext = msg.ClusterContext
		// If we have resources, we're connected
		if msg.TotalEnabled > 0 || msg.Disabled > 0 {
			m.connectionStatus = Connected
		}
	case ConnectionStatusMsg:
		m.connectionStatus = msg.Status
		if msg.ClusterContext != "" {
			m.clusterContext = msg.ClusterContext
		}
	}

	return m, nil
}

// View renders the header component
func (m *Model) View() string {
	// Build connection status on the left
	connectionDisplay := m.renderConnectionDisplay()

	// Build status display on the right
	statusDisplay := m.renderStatusDisplay()

	// Container style with border
	containerStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(m.theme.Border).
		Foreground(m.theme.Foreground).
		Width(m.maxWidth-2). // Account for border
		Padding(0, 1)

	// Calculate widths
	leftWidth := lipgloss.Width(connectionDisplay)
	rightWidth := lipgloss.Width(statusDisplay)
	middleWidth := m.maxWidth - leftWidth - rightWidth - 6 // Account for border and padding

	// Middle spacer
	middleStyle := lipgloss.NewStyle().Width(middleWidth)
	middleContent := middleStyle.Render("")

	// Join left, middle, and right
	content := lipgloss.JoinHorizontal(lipgloss.Top, connectionDisplay, middleContent, statusDisplay)

	return containerStyle.Render(content)
}

// renderConnectionDisplay renders the connection status and cluster context
func (m *Model) renderConnectionDisplay() string {
	okStyle := lipgloss.NewStyle().Foreground(m.theme.StatusOk).Bold(true)
	pendingStyle := lipgloss.NewStyle().Foreground(m.theme.StatusPending).Bold(true)
	errorStyle := lipgloss.NewStyle().Foreground(m.theme.StatusError).Bold(true)
	mutedStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)
	normalStyle := lipgloss.NewStyle().Foreground(m.theme.Foreground)

	var statusIcon, statusText string
	var statusStyle lipgloss.Style

	switch m.connectionStatus {
	case Connected:
		statusIcon = "●"
		statusText = "Connected"
		statusStyle = okStyle
	case Connecting:
		statusIcon = "◐"
		statusText = "Connecting"
		statusStyle = pendingStyle
	case Disconnected:
		statusIcon = "○"
		statusText = "Disconnected"
		statusStyle = errorStyle
	}

	result := statusStyle.Render(statusIcon) + " " + statusStyle.Render(statusText)

	// Add cluster context if available
	if m.clusterContext != "" {
		result += mutedStyle.Render(" · ") + normalStyle.Render(m.clusterContext)
	}

	// Add namespace if available
	if m.namespace != "" {
		result += mutedStyle.Render("/") + normalStyle.Render(m.namespace)
	}

	return result
}

// renderStatusDisplay renders the status counts display (matching Tilt UI format)
func (m *Model) renderStatusDisplay() string {
	if m.totalEnabled == 0 && m.disabledCount == 0 {
		return ""
	}

	// Styles
	errorStyle := lipgloss.NewStyle().Foreground(m.theme.StatusError).Bold(true)
	pendingStyle := lipgloss.NewStyle().Foreground(m.theme.StatusPending).Bold(true)
	okStyle := lipgloss.NewStyle().Foreground(m.theme.StatusOk).Bold(true)
	mutedStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)
	normalStyle := lipgloss.NewStyle().Foreground(m.theme.Foreground)

	var items []string

	// Show unhealthy count with X icon (if any)
	if m.unhealthyCount > 0 {
		items = append(items,
			errorStyle.Render("✗")+" "+
				errorStyle.Render(fmt.Sprintf("%d", m.unhealthyCount)))
	}

	// Show warning count with warning icon (if any)
	if m.warningCount > 0 {
		items = append(items,
			pendingStyle.Render("⚠")+" "+
				pendingStyle.Render(fmt.Sprintf("%d", m.warningCount)))
	}

	// Show pending count with pending icon (if any)
	if m.pendingCount > 0 {
		items = append(items,
			pendingStyle.Render("●")+" "+
				pendingStyle.Render(fmt.Sprintf("%d", m.pendingCount)))
	}

	// Show healthy / totalEnabled (always, if there are enabled resources)
	if m.totalEnabled > 0 {
		items = append(items,
			okStyle.Render("✓")+" "+
				okStyle.Render(fmt.Sprintf("%d", m.healthyCount))+
				mutedStyle.Render(" / ")+
				normalStyle.Render(fmt.Sprintf("%d", m.totalEnabled)))
	}

	// Show disabled count (if any)
	if m.disabledCount > 0 {
		items = append(items,
			mutedStyle.Render("⊘")+" "+
				mutedStyle.Render(fmt.Sprintf("%d", m.disabledCount)))
	}

	if len(items) == 0 {
		return ""
	}

	// Join items with space separator
	var result string
	for i, item := range items {
		if i > 0 {
			result += mutedStyle.Render(" ")
		}
		result += item
	}

	return result
}

// WithTheme sets the theme for the header component
func WithTheme(t theme.Theme) Option {
	return func(m *Model) {
		m.theme = t
	}
}

// ResourceCountsMsg is used to update the resource counts in the header
type ResourceCountsMsg struct {
	Healthy        int
	TotalEnabled   int
	Pending        int
	Unhealthy      int
	Warning        int
	Disabled       int
	Namespace      string
	ClusterContext string
}

// ConnectionStatusMsg is used to update the connection status
type ConnectionStatusMsg struct {
	Status         ConnectionStatus
	ClusterContext string
}

// getCombinedStatus returns a combined status for a resource following Tilt's logic
func getCombinedStatus(r *tilt.Resource) string {
	buildStat := getBuildStatus(r)
	runtimeStat := getRuntimeStatus(r)

	// Build status takes priority
	if buildStat != "healthy" && buildStat != "none" {
		return buildStat
	}

	// If runtime is none, use build status
	if runtimeStat == "none" {
		return buildStat
	}

	return runtimeStat
}

// getBuildStatus determines build status from update status
func getBuildStatus(r *tilt.Resource) string {
	if r.IsDisabled {
		return "disabled"
	}

	switch r.UpdateStatus {
	case "in_progress":
		return "building"
	case "pending":
		return "pending"
	case "not_applicable", "none", "":
		return "none"
	case "error":
		return "unhealthy"
	case "ok":
		return "healthy"
	default:
		return "none"
	}
}

// getRuntimeStatus determines runtime status
func getRuntimeStatus(r *tilt.Resource) string {
	if r.IsDisabled {
		return "disabled"
	}

	switch r.RuntimeStatus {
	case "error":
		return "unhealthy"
	case "pending":
		return "pending"
	case "ok":
		return "healthy"
	case "not_applicable", "none", "":
		return "none"
	default:
		return "none"
	}
}

// hasWarning checks if a resource has warnings (build warnings without errors)
func hasWarning(r *tilt.Resource) bool {
	if r.Raw == nil {
		return false
	}
	if len(r.Raw.Status.BuildHistory) > 0 {
		lastBuild := r.Raw.Status.BuildHistory[0]
		// Has warnings but no error
		return len(lastBuild.Warnings) > 0 && (lastBuild.Error == nil || *lastBuild.Error == "")
	}
	return false
}

// UpdateCounts calculates counts from resources and returns an update message
func UpdateCounts(resources []tilt.Resource) ResourceCountsMsg {
	var healthy, totalEnabled, pending, unhealthy, warning, disabled int
	var namespace, clusterContext string

	for _, r := range resources {
		// Check for namespace resource to extract namespace info
		if r.Type == "k8s" && r.Raw != nil {
			// Try to get namespace from K8s resource info
			if r.Raw.Status.K8sResourceInfo != nil {
				// The namespace might be in the pod name or we need to look elsewhere
			}
			// Check labels for namespace info
			if ns, ok := r.Raw.Metadata.Labels["tilt.dev/namespace"]; ok && ns != "" {
				namespace = ns
			}
		}

		// Look for a "namespace" resource type or name
		if r.Name == "namespace" || r.Type == "namespace" {
			namespace = r.Name
		}

		// Try to extract cluster context from annotations
		if r.Raw != nil {
			if ctx, ok := r.Raw.Metadata.Annotations["tilt.dev/cluster"]; ok && ctx != "" {
				clusterContext = ctx
			}
		}

		if r.IsDisabled {
			disabled++
			continue
		}

		totalEnabled++

		// Check for warnings first
		if hasWarning(&r) {
			warning++
		}

		status := getCombinedStatus(&r)
		switch status {
		case "unhealthy":
			unhealthy++
		case "pending", "building":
			pending++
		case "healthy":
			healthy++
			// "none" doesn't count toward any category
		}
	}

	// Default cluster context if not found
	if clusterContext == "" {
		clusterContext = "docker-desktop" // Common default
	}

	return ResourceCountsMsg{
		Healthy:        healthy,
		TotalEnabled:   totalEnabled,
		Pending:        pending,
		Unhealthy:      unhealthy,
		Warning:        warning,
		Disabled:       disabled,
		Namespace:      namespace,
		ClusterContext: clusterContext,
	}
}
