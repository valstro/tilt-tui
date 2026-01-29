package tui

import (
	"context"
	"time"

	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"tilt-tui/internal/theme"
	"tilt-tui/internal/tilt"
	"tilt-tui/internal/tui/components/footer"
	"tilt-tui/internal/tui/components/header"
	"tilt-tui/internal/tui/components/logs"
	"tilt-tui/internal/tui/components/tree"
	"tilt-tui/internal/tui/keymap"
	"tilt-tui/internal/tui/messages"
)

const (
	headerHeight = 3
	footerHeight = 1
	paneMargin   = 1
	minTreeWidth = 25
	maxTreeWidth = 50
	treeWidthPct = 35
)

// Model is the main TUI model
type Model struct {
	theme  theme.Theme
	client *tilt.Client
	keyMap keymap.KeyMap

	// Components
	header *header.Model
	tree   *tree.Model
	logs   *logs.Model
	footer *footer.Model

	// State
	activePane messages.Pane
	width      int
	height     int
	ready      bool
}

// Option is a function that configures the Model
type Option func(*Model)

// New creates a new TUI instance
func New(opts ...Option) *Model {
	t := theme.Default()

	m := &Model{
		theme:      t,
		keyMap:     keymap.Default(),
		activePane: messages.TreePane,
	}

	for _, opt := range opts {
		opt(m)
	}

	// Initialize components
	m.header = header.New(header.WithTheme(m.theme))
	m.tree = tree.New(tree.WithTheme(m.theme))
	m.logs = logs.New(logs.WithTheme(m.theme))
	m.footer = footer.New(footer.WithTheme(m.theme))

	// Set initial focus
	m.tree.Focus()

	return m
}

// Init initializes the TUI
func (m *Model) Init() tea.Cmd {
	cmds := []tea.Cmd{
		tea.SetWindowTitle("Tilt TUI"),
	}

	// Fetch initial data if client is available
	if m.client != nil {
		cmds = append(cmds, m.fetchInitialData())
	}

	return tea.Batch(cmds...)
}

// Update handles all messages and updates the TUI
func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		// Handle global keys
		switch {
		case key.Matches(msg, m.keyMap.Quit):
			return m, tea.Quit

		case key.Matches(msg, m.keyMap.Tab):
			m.cycleFocus()
			cmds = append(cmds, m.notifyPaneChange())

		case key.Matches(msg, m.keyMap.ShiftTab):
			m.cycleFocusReverse()
			cmds = append(cmds, m.notifyPaneChange())

		default:
			// Route to focused component
			cmd := m.routeKeyToFocused(msg)
			if cmd != nil {
				cmds = append(cmds, cmd)
			}
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.ready = true
		cmds = append(cmds, m.propagateSizes())

	case messages.ResourcesUpdatedMsg:
		// Route to header (for counts) and tree (for list)
		var headerCmd, treeCmd tea.Cmd
		m.header, headerCmd = m.header.Update(header.UpdateCounts(msg.Resources))
		m.tree, treeCmd = m.tree.Update(msg)
		cmds = append(cmds, headerCmd, treeCmd)

		// Auto-select first resource if none selected
		if m.tree.SelectedResource() == "" && len(msg.Resources) > 0 {
			cmds = append(cmds, m.fetchLogs(msg.Resources[0].Name))
		}

	case messages.LogsUpdatedMsg:
		var cmd tea.Cmd
		m.logs, cmd = m.logs.Update(msg)
		cmds = append(cmds, cmd)

	case messages.ResourceSelectedMsg:
		// Update logs component and fetch logs
		var cmd tea.Cmd
		m.logs, cmd = m.logs.Update(msg)
		cmds = append(cmds, cmd, m.fetchLogs(msg.ResourceName))

	case messages.TriggerResourceMsg:
		cmds = append(cmds, m.triggerResource(msg.ResourceName))

	case messages.ActivePaneChangedMsg:
		var cmd tea.Cmd
		m.footer, cmd = m.footer.Update(msg)
		cmds = append(cmds, cmd)

	case messages.TickMsg:
		// Periodic refresh
		if m.client != nil {
			cmds = append(cmds, m.fetchResources(), m.tickCmd())
		}
	}

	return m, tea.Batch(cmds...)
}

// View renders the TUI
func (m *Model) View() string {
	if !m.ready {
		return "Loading..."
	}

	// Header
	headerView := m.header.View()

	// Main panes (tree + logs)
	treeView := m.tree.View()
	logsView := m.logs.View()

	// Join tree and logs horizontally with margin
	margin := lipgloss.NewStyle().Width(paneMargin).Render("")
	panes := lipgloss.JoinHorizontal(lipgloss.Top, treeView, margin, logsView)

	// Footer
	footerView := m.footer.View()

	// Join all vertically (no margin between header and panes)
	return lipgloss.JoinVertical(lipgloss.Left,
		headerView,
		panes,
		footerView,
	)
}

// WithClient sets the Tilt client
func WithClient(client *tilt.Client) Option {
	return func(m *Model) {
		m.client = client
	}
}

// WithTheme sets the theme
func WithTheme(t theme.Theme) Option {
	return func(m *Model) {
		m.theme = t
	}
}

// cycleFocus cycles focus to the next pane
func (m *Model) cycleFocus() {
	m.tree.Blur()
	m.logs.Blur()

	switch m.activePane {
	case messages.TreePane:
		m.activePane = messages.LogsPane
		m.logs.Focus()
	case messages.LogsPane:
		m.activePane = messages.TreePane
		m.tree.Focus()
	}
}

// cycleFocusReverse cycles focus to the previous pane
func (m *Model) cycleFocusReverse() {
	m.tree.Blur()
	m.logs.Blur()

	switch m.activePane {
	case messages.TreePane:
		m.activePane = messages.LogsPane
		m.logs.Focus()
	case messages.LogsPane:
		m.activePane = messages.TreePane
		m.tree.Focus()
	}
}

// notifyPaneChange returns a command to notify components of pane change
func (m *Model) notifyPaneChange() tea.Cmd {
	return func() tea.Msg {
		return messages.ActivePaneChangedMsg{Pane: m.activePane}
	}
}

// routeKeyToFocused routes key messages to the focused component
func (m *Model) routeKeyToFocused(msg tea.KeyMsg) tea.Cmd {
	var cmd tea.Cmd

	switch m.activePane {
	case messages.TreePane:
		m.tree, cmd = m.tree.Update(msg)
	case messages.LogsPane:
		m.logs, cmd = m.logs.Update(msg)
	}

	return cmd
}

// propagateSizes sends size messages to all components
func (m *Model) propagateSizes() tea.Cmd {
	// Calculate sizes (no margin between header and panes)
	paneHeight := m.height - headerHeight - footerHeight

	// Tree width: 35% clamped between min and max
	treeWidth := m.width * treeWidthPct / 100
	if treeWidth < minTreeWidth {
		treeWidth = minTreeWidth
	}
	if treeWidth > maxTreeWidth {
		treeWidth = maxTreeWidth
	}

	// Logs width: remaining space minus margin
	logsWidth := m.width - treeWidth - paneMargin

	// Update components
	var headerCmd, treeCmd, logsCmd, footerCmd tea.Cmd

	m.header, headerCmd = m.header.Update(tea.WindowSizeMsg{
		Width:  m.width,
		Height: headerHeight,
	})

	m.tree, treeCmd = m.tree.Update(tea.WindowSizeMsg{
		Width:  treeWidth,
		Height: paneHeight,
	})

	m.logs, logsCmd = m.logs.Update(tea.WindowSizeMsg{
		Width:  logsWidth,
		Height: paneHeight,
	})

	m.footer, footerCmd = m.footer.Update(tea.WindowSizeMsg{
		Width:  m.width,
		Height: footerHeight,
	})

	return tea.Batch(headerCmd, treeCmd, logsCmd, footerCmd)
}

// fetchInitialData fetches initial resources and starts the tick
func (m *Model) fetchInitialData() tea.Cmd {
	return tea.Batch(m.fetchResourcesViaWebsocket(), m.tickCmd())
}

// fetchResourcesViaWebsocket fetches resources using websocket
func (m *Model) fetchResourcesViaWebsocket() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return messages.ResourcesUpdatedMsg{Err: nil, Resources: nil}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		data, err := m.client.GetInitialData(ctx)
		if err != nil {
			return messages.ResourcesUpdatedMsg{Err: err}
		}

		// Associate buttons with resources
		resources := tilt.AssociateButtonsWithResources(data.Resources, data.Buttons)

		return messages.ResourcesUpdatedMsg{Resources: resources}
	}
}

// fetchResources fetches resources via HTTP
func (m *Model) fetchResources() tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return messages.ResourcesUpdatedMsg{Err: nil, Resources: nil}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		resources, err := m.client.GetResources(ctx)
		if err != nil {
			return messages.ResourcesUpdatedMsg{Err: err}
		}

		return messages.ResourcesUpdatedMsg{Resources: resources}
	}
}

// fetchLogs fetches logs for a specific resource
func (m *Model) fetchLogs(resourceName string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return messages.LogsUpdatedMsg{ResourceName: resourceName, Err: nil}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		entries, err := m.client.GetLogs(ctx, resourceName)
		if err != nil {
			return messages.LogsUpdatedMsg{ResourceName: resourceName, Err: err}
		}

		return messages.LogsUpdatedMsg{
			ResourceName: resourceName,
			Entries:      entries,
			Append:       false,
		}
	}
}

// triggerResource triggers an update for a resource
func (m *Model) triggerResource(resourceName string) tea.Cmd {
	return func() tea.Msg {
		if m.client == nil {
			return nil
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := m.client.TriggerResource(ctx, resourceName)
		if err != nil {
			return messages.ErrorMsg{Err: err}
		}

		// Refresh resources after trigger
		return messages.TickMsg(time.Now())
	}
}

// tickCmd returns a command for the periodic tick
func (m *Model) tickCmd() tea.Cmd {
	return tea.Tick(5*time.Second, func(t time.Time) tea.Msg {
		return messages.TickMsg(t)
	})
}
