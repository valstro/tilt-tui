package tree

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"tilt-tui/internal/theme"
	"tilt-tui/internal/tilt"
	"tilt-tui/internal/tui/keymap"
	"tilt-tui/internal/tui/messages"
)

// NodeType represents the type of tree node
type NodeType int

const (
	GroupNode NodeType = iota
	ResourceNode
)

// TreeNode represents an item in the tree (either a group or resource)
type TreeNode struct {
	Type        NodeType
	GroupName   string         // For group nodes: the label key used for grouping
	GroupValue  string         // For group nodes: the label value
	Resource    *tilt.Resource // For resource nodes: the resource
	ResourceIdx int            // Original index in resources slice
	Expanded    bool           // For group nodes: whether expanded
	ChildCount  int            // For group nodes: number of children
	Depth       int            // Nesting depth (0 for groups, 1 for resources)
}

// Model represents the tree component
type Model struct {
	theme        theme.Theme
	maxWidth     int
	maxHeight    int
	viewport     viewport.Model
	resources    []tilt.Resource
	groups       map[string]bool // group key -> expanded state
	displayNodes []TreeNode      // flattened display list
	cursor       int             // cursor position in displayNodes
	selected     string
	focused      bool
	xOffset      int
	keyMap       keymap.KeyMap
}

// Option is a function that modifies the Model
type Option func(*Model)

// New creates a new tree component
func New(opts ...Option) *Model {
	m := &Model{
		viewport: viewport.New(0, 0),
		keyMap:   keymap.Default(),
		groups:   make(map[string]bool),
	}

	for _, opt := range opts {
		opt(m)
	}

	return m
}

// Init initializes the tree component
func (m *Model) Init() tea.Cmd {
	return nil
}

// Update handles messages and updates the tree component
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

	case messages.ResourcesUpdatedMsg:
		if msg.Err == nil {
			m.resources = msg.Resources
			m.rebuildTree()
			// Maintain cursor bounds
			if m.cursor >= len(m.displayNodes) {
				m.cursor = max(0, len(m.displayNodes)-1)
			}
			m.renderContent()
		}

	case tea.KeyMsg:
		if !m.focused {
			return m, nil
		}

		switch {
		case key.Matches(msg, m.keyMap.Up):
			if m.cursor > 0 {
				m.cursor--
				m.ensureCursorVisible()
				m.renderContent()
			}
		case key.Matches(msg, m.keyMap.Down):
			if m.cursor < len(m.displayNodes)-1 {
				m.cursor++
				m.ensureCursorVisible()
				m.renderContent()
			}
		case key.Matches(msg, m.keyMap.Home):
			m.cursor = 0
			m.viewport.GotoTop()
			m.renderContent()
		case key.Matches(msg, m.keyMap.End):
			m.cursor = max(0, len(m.displayNodes)-1)
			m.viewport.GotoBottom()
			m.renderContent()
		case key.Matches(msg, m.keyMap.Left):
			if m.xOffset > 0 {
				m.xOffset--
				m.renderContent()
			}
		case key.Matches(msg, m.keyMap.Right):
			m.xOffset++
			m.renderContent()
		case msg.String() == " ":
			// Toggle group expand/collapse
			m.toggleGroup()
			m.renderContent()
		case key.Matches(msg, m.keyMap.Select):
			if len(m.displayNodes) > 0 && m.cursor < len(m.displayNodes) {
				node := m.displayNodes[m.cursor]
				if node.Type == ResourceNode && node.Resource != nil {
					m.selected = node.Resource.Name
					return m, func() tea.Msg {
						return messages.ResourceSelectedMsg{ResourceName: m.selected}
					}
				} else if node.Type == GroupNode {
					// Toggle group on Enter as well
					m.toggleGroup()
					m.renderContent()
				}
			}
		case key.Matches(msg, m.keyMap.Trigger):
			if len(m.displayNodes) > 0 && m.cursor < len(m.displayNodes) {
				node := m.displayNodes[m.cursor]
				if node.Type == ResourceNode && node.Resource != nil {
					return m, func() tea.Msg {
						return messages.TriggerResourceMsg{ResourceName: node.Resource.Name}
					}
				}
			}
		}
	}

	m.viewport, cmd = m.viewport.Update(msg)
	return m, cmd
}

// View renders the tree component
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

	// Count resources (not groups)
	resourceCount := 0
	for _, node := range m.displayNodes {
		if node.Type == ResourceNode {
			resourceCount++
		}
	}

	// Build content with title at top
	title := titleStyle.Render(fmt.Sprintf("Resources (%d)", len(m.resources)))
	separator := lipgloss.NewStyle().
		Foreground(borderColor).
		Render(strings.Repeat("─", m.maxWidth-4))

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

// SelectedResource returns the currently selected resource name
func (m *Model) SelectedResource() string {
	if len(m.displayNodes) > 0 && m.cursor < len(m.displayNodes) {
		node := m.displayNodes[m.cursor]
		if node.Type == ResourceNode && node.Resource != nil {
			return node.Resource.Name
		}
	}
	return ""
}

// WithTheme sets the theme for the tree component
func WithTheme(t theme.Theme) Option {
	return func(m *Model) {
		m.theme = t
	}
}

// WithResources sets the initial resources
func WithResources(resources []tilt.Resource) Option {
	return func(m *Model) {
		m.resources = resources
		m.rebuildTree()
	}
}

// rebuildTree rebuilds the display tree from resources with grouping
func (m *Model) rebuildTree() {
	m.displayNodes = []TreeNode{}

	// Group resources by their label keys
	groupedResources := make(map[string][]int) // group key -> resource indices
	groupOrder := []string{}                   // maintain order of groups

	for i, r := range m.resources {
		groupKey := m.getGroupKey(r)
		if _, exists := groupedResources[groupKey]; !exists {
			groupOrder = append(groupOrder, groupKey)
		}
		groupedResources[groupKey] = append(groupedResources[groupKey], i)
	}

	// Sort group order (but keep "ungrouped" at the end)
	sort.SliceStable(groupOrder, func(i, j int) bool {
		if groupOrder[i] == "ungrouped" {
			return false
		}
		if groupOrder[j] == "ungrouped" {
			return true
		}
		return groupOrder[i] < groupOrder[j]
	})

	// Build display nodes
	for _, groupKey := range groupOrder {
		resourceIndices := groupedResources[groupKey]

		// Initialize group expanded state if not set
		if _, exists := m.groups[groupKey]; !exists {
			m.groups[groupKey] = true // expanded by default
		}

		// Add group node
		groupNode := TreeNode{
			Type:       GroupNode,
			GroupName:  groupKey,
			GroupValue: groupKey,
			Expanded:   m.groups[groupKey],
			ChildCount: len(resourceIndices),
			Depth:      0,
		}
		m.displayNodes = append(m.displayNodes, groupNode)

		// Add resource nodes (only if expanded)
		if m.groups[groupKey] {
			for _, idx := range resourceIndices {
				resourceNode := TreeNode{
					Type:        ResourceNode,
					Resource:    &m.resources[idx],
					ResourceIdx: idx,
					Depth:       1,
				}
				m.displayNodes = append(m.displayNodes, resourceNode)
			}
		}
	}
}

// getGroupKey returns the group key for a resource based on its labels
func (m *Model) getGroupKey(r tilt.Resource) string {
	if r.Raw == nil {
		return "ungrouped"
	}

	labels := r.Raw.Metadata.Labels
	if len(labels) == 0 {
		return "ungrouped"
	}

	// Use common label keys for grouping, in priority order
	priorityKeys := []string{
		"app",
		"app.kubernetes.io/name",
		"app.kubernetes.io/component",
		"component",
		"service",
		"tilt.dev/resource",
	}

	for _, key := range priorityKeys {
		if val, ok := labels[key]; ok && val != "" {
			return val
		}
	}

	// Fall back to first label value
	for _, val := range labels {
		if val != "" {
			return val
		}
	}

	return "ungrouped"
}

// toggleGroup toggles the expanded state of the group at cursor
func (m *Model) toggleGroup() {
	if len(m.displayNodes) == 0 || m.cursor >= len(m.displayNodes) {
		return
	}

	node := &m.displayNodes[m.cursor]

	if node.Type == GroupNode {
		node.Expanded = !node.Expanded
		m.groups[node.GroupValue] = node.Expanded
		m.rebuildTree()
	}
}

// renderContent renders the tree content
func (m *Model) renderContent() {
	if len(m.displayNodes) == 0 {
		emptyStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)
		m.viewport.SetContent(emptyStyle.Render("No resources"))
		return
	}

	var sb strings.Builder

	for i, node := range m.displayNodes {
		isSelected := i == m.cursor && m.focused

		if node.Type == GroupNode {
			line := m.renderGroupLine(node, isSelected)
			sb.WriteString(line)
			sb.WriteString("\n")
		} else {
			lines := m.renderResourceItem(*node.Resource, isSelected, node.Depth)
			for _, line := range lines {
				sb.WriteString(line)
				sb.WriteString("\n")
			}
		}
	}

	m.viewport.SetContent(sb.String())
}

// renderGroupLine renders a group header line
func (m *Model) renderGroupLine(node TreeNode, selected bool) string {
	// Expand/collapse indicator
	var expandIcon string
	if node.Expanded {
		expandIcon = "▼"
	} else {
		expandIcon = "▶"
	}

	// Group name with count
	countStr := fmt.Sprintf("(%d)", node.ChildCount)

	maxNameLen := m.viewport.Width - 10
	if maxNameLen < 10 {
		maxNameLen = 10
	}

	name := node.GroupValue
	if len(name) > maxNameLen-len(countStr)-2 {
		name = name[:maxNameLen-len(countStr)-3] + "…"
	}

	groupText := fmt.Sprintf("%s %s", name, countStr)

	// Styles
	headerStyle := lipgloss.NewStyle().Foreground(m.theme.BorderFocused).Bold(true)
	mutedStyle := lipgloss.NewStyle().Foreground(m.theme.Muted)
	selectedStyle := lipgloss.NewStyle().Background(m.theme.BorderFocused).Foreground(m.theme.Foreground).Bold(true)

	// Build line
	var line string
	if selected {
		line = fmt.Sprintf(" %s %s",
			headerStyle.Render(expandIcon),
			selectedStyle.Render(groupText))
	} else {
		line = fmt.Sprintf(" %s %s",
			mutedStyle.Render(expandIcon),
			headerStyle.Render(groupText))
	}

	return line
}

// renderResourceItem renders a 2-line resource item
// Line 1: runtime status icon + resource name [+ pending indicator]
// Line 2: build status icon + last update time + build duration
func (m *Model) renderResourceItem(r tilt.Resource, selected bool, depth int) []string {
	// Indentation for nested resources
	indent := strings.Repeat("  ", depth)

	// Available width for content
	contentWidth := m.viewport.Width - 2 - (depth * 2)
	if contentWidth < 15 {
		contentWidth = 15
	}

	// --- Line 1: Runtime status icon + resource name ---
	runtimeIcon := theme.RuntimeStatusIcon(r.RuntimeStatus)
	runtimeStyle := lipgloss.NewStyle().Foreground(m.theme.RuntimeStatusColor(r.RuntimeStatus)).Bold(true)

	maxNameLen := contentWidth - 4 // space for icon and indent
	if maxNameLen < 10 {
		maxNameLen = 10
	}
	name := r.Name
	if len(name) > maxNameLen {
		name = name[:maxNameLen-1] + "…"
	}

	nameStyle := lipgloss.NewStyle().Foreground(m.theme.Foreground)
	if selected {
		nameStyle = nameStyle.Background(m.theme.BorderFocused).Foreground(m.theme.Foreground).Bold(true)
	}

	line1 := fmt.Sprintf("%s %s %s", indent, runtimeStyle.Render(runtimeIcon), nameStyle.Render(name))

	// Add pending indicator if needed
	if r.HasPending {
		pendingStyle := lipgloss.NewStyle().Foreground(m.theme.StatusPending)
		line1 += pendingStyle.Render(" ⟳")
	}

	// --- Line 2: Build status icon + last update + build duration ---
	buildIcon := theme.BuildStatusIcon(r.UpdateStatus)
	buildStyle := lipgloss.NewStyle().Foreground(m.theme.BuildStatusColor(r.UpdateStatus))

	// Format last update time
	lastUpdate := formatRelativeTime(r.LastDeployAt)

	// Get build duration from raw resource
	buildDuration := ""
	if r.Raw != nil && len(r.Raw.Status.BuildHistory) > 0 {
		lastBuild := r.Raw.Status.BuildHistory[0]
		buildDuration = formatBuildDuration(lastBuild.StartTime, lastBuild.FinishTime)
	}

	// Build the subheading content
	var subheadingParts []string
	if lastUpdate != "" {
		subheadingParts = append(subheadingParts, lastUpdate)
	}
	if buildDuration != "" {
		subheadingParts = append(subheadingParts, buildDuration)
	}

	subheading := strings.Join(subheadingParts, " · ")
	if subheading == "" {
		subheading = "—"
	}

	// Truncate subheading if needed
	maxSubLen := contentWidth - 6
	if len(subheading) > maxSubLen {
		subheading = subheading[:maxSubLen-1] + "…"
	}

	subheadingStyle := lipgloss.NewStyle().Foreground(m.theme.Muted).Italic(true)
	line2 := fmt.Sprintf("%s   %s %s", indent, buildStyle.Render(buildIcon), subheadingStyle.Render(subheading))

	return []string{line1, line2}
}

// ensureCursorVisible ensures the cursor is visible in the viewport
func (m *Model) ensureCursorVisible() {
	// Calculate the visual line position of the cursor
	cursorLine := m.cursorVisualLine()
	cursorHeight := m.nodeHeight(m.displayNodes[m.cursor])
	visibleHeight := m.viewport.Height

	if cursorLine < m.viewport.YOffset {
		m.viewport.SetYOffset(cursorLine)
	} else if cursorLine+cursorHeight > m.viewport.YOffset+visibleHeight {
		m.viewport.SetYOffset(cursorLine + cursorHeight - visibleHeight)
	}
}

// cursorVisualLine returns the visual line position of the cursor
func (m *Model) cursorVisualLine() int {
	line := 0
	for i := 0; i < m.cursor && i < len(m.displayNodes); i++ {
		line += m.nodeHeight(m.displayNodes[i])
	}
	return line
}

// nodeHeight returns the number of lines a node takes up
func (m *Model) nodeHeight(node TreeNode) int {
	if node.Type == ResourceNode {
		return 2 // Resources are 2-line items
	}
	return 1 // Groups are 1-line items
}

// formatRelativeTime formats a timestamp as a relative time string
func formatRelativeTime(timestamp string) string {
	if timestamp == "" {
		return ""
	}

	t, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		t, err = time.Parse(time.RFC3339Nano, timestamp)
		if err != nil {
			return ""
		}
	}

	now := time.Now()
	diff := now.Sub(t)

	switch {
	case diff < time.Minute:
		return "just now"
	case diff < time.Hour:
		mins := int(diff.Minutes())
		if mins == 1 {
			return "1m ago"
		}
		return fmt.Sprintf("%dm ago", mins)
	case diff < 24*time.Hour:
		hours := int(diff.Hours())
		if hours == 1 {
			return "1h ago"
		}
		return fmt.Sprintf("%dh ago", hours)
	case diff < 7*24*time.Hour:
		days := int(diff.Hours() / 24)
		if days == 1 {
			return "1d ago"
		}
		return fmt.Sprintf("%dd ago", days)
	default:
		return t.Format("Jan 2")
	}
}

// formatBuildDuration formats the build duration from start and finish times
func formatBuildDuration(startTime, finishTime *string) string {
	if startTime == nil || finishTime == nil {
		return ""
	}

	start, err := time.Parse(time.RFC3339, *startTime)
	if err != nil {
		start, err = time.Parse(time.RFC3339Nano, *startTime)
		if err != nil {
			return ""
		}
	}

	finish, err := time.Parse(time.RFC3339, *finishTime)
	if err != nil {
		finish, err = time.Parse(time.RFC3339Nano, *finishTime)
		if err != nil {
			return ""
		}
	}

	duration := finish.Sub(start)

	switch {
	case duration < time.Second:
		return fmt.Sprintf("%dms", duration.Milliseconds())
	case duration < time.Minute:
		return fmt.Sprintf("%.1fs", duration.Seconds())
	case duration < time.Hour:
		mins := int(duration.Minutes())
		secs := int(duration.Seconds()) % 60
		return fmt.Sprintf("%dm%ds", mins, secs)
	default:
		hours := int(duration.Hours())
		mins := int(duration.Minutes()) % 60
		return fmt.Sprintf("%dh%dm", hours, mins)
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
