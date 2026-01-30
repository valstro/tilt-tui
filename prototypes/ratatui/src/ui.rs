//! UI rendering for Tilt TUI

use crate::app::{App, ConnectionStatus, FocusedPane, StatusCounts, TreeNode};
use chrono::{DateTime, Utc};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph, Scrollbar, ScrollbarOrientation, ScrollbarState},
    Frame,
};

// Theme colors
const COLOR_GREEN: Color = Color::Rgb(34, 197, 94);
const COLOR_RED: Color = Color::Rgb(239, 68, 68);
const COLOR_YELLOW: Color = Color::Rgb(234, 179, 8);
const COLOR_BLUE: Color = Color::Rgb(59, 130, 246);
const COLOR_GRAY: Color = Color::Rgb(113, 113, 122);
const COLOR_DIM: Color = Color::Rgb(82, 82, 91);
const COLOR_BORDER: Color = Color::Rgb(63, 63, 70);
const COLOR_BORDER_FOCUSED: Color = Color::Rgb(59, 130, 246);

/// Status icons
fn status_icon(status: &str) -> (&'static str, Color) {
    match status {
        "ok" => ("✓", COLOR_GREEN),
        "error" => ("✗", COLOR_RED),
        "pending" => ("◐", COLOR_YELLOW),
        "building" => ("⟳", COLOR_BLUE),
        "disabled" => ("○", COLOR_GRAY),
        _ => ("○", COLOR_GRAY),
    }
}

/// Connection status icon
fn connection_icon(status: ConnectionStatus) -> (&'static str, Color) {
    match status {
        ConnectionStatus::Connected => ("●", COLOR_GREEN),
        ConnectionStatus::Connecting => ("◐", COLOR_YELLOW),
        ConnectionStatus::Disconnected => ("○", COLOR_RED),
    }
}

/// Format relative time
fn format_relative_time(timestamp: &str) -> String {
    if timestamp.is_empty() {
        return String::new();
    }

    let Ok(dt) = DateTime::parse_from_rfc3339(timestamp) else {
        return String::new();
    };

    let now = Utc::now();
    let duration = now.signed_duration_since(dt.with_timezone(&Utc));

    if duration.num_seconds() < 0 {
        return "just now".to_string();
    }

    let seconds = duration.num_seconds();
    if seconds < 60 {
        return format!("{}s ago", seconds);
    }

    let minutes = duration.num_minutes();
    if minutes < 60 {
        return format!("{}m ago", minutes);
    }

    let hours = duration.num_hours();
    if hours < 24 {
        return format!("{}h ago", hours);
    }

    let days = duration.num_days();
    format!("{}d ago", days)
}

/// Strip ANSI codes from text
fn strip_ansi(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // Skip escape sequence
            if chars.peek() == Some(&'[') {
                chars.next();
                // Skip until we hit a letter
                while let Some(&nc) = chars.peek() {
                    chars.next();
                    if nc.is_ascii_alphabetic() {
                        break;
                    }
                }
            }
        } else {
            result.push(c);
        }
    }

    result
}

/// Main render function
pub fn render(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Header
            Constraint::Min(10),   // Main content
            Constraint::Length(1), // Footer
        ])
        .split(f.area());

    render_header(f, app, chunks[0]);
    render_main(f, app, chunks[1]);
    render_footer(f, app, chunks[2]);
}

/// Render header with connection status and resource counts
fn render_header(f: &mut Frame, app: &App, area: Rect) {
    let (conn_icon, conn_color) = connection_icon(app.connection_status);
    let conn_text = match app.connection_status {
        ConnectionStatus::Connected => "Connected",
        ConnectionStatus::Connecting => "Connecting",
        ConnectionStatus::Disconnected => "Disconnected",
    };

    let counts = app.status_counts();

    let header_line = Line::from(vec![
        Span::raw(" "),
        Span::styled(conn_icon, Style::default().fg(conn_color)),
        Span::raw(" "),
        Span::styled(conn_text, Style::default().fg(conn_color)),
        Span::styled(" · ", Style::default().fg(COLOR_DIM)),
        Span::styled(&app.cluster_context, Style::default().fg(COLOR_GRAY)),
    ]);

    // Status counts on right side
    let status_line = format_status_counts(&counts);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(COLOR_BORDER));

    // Calculate positions
    let inner = block.inner(area);
    
    let left_para = Paragraph::new(header_line);
    let right_para = Paragraph::new(status_line)
        .alignment(ratatui::layout::Alignment::Right);

    f.render_widget(block, area);
    f.render_widget(left_para, inner);
    f.render_widget(right_para, inner);
}

fn format_status_counts(counts: &StatusCounts) -> Line<'static> {
    let mut spans = Vec::new();

    if counts.unhealthy > 0 {
        spans.push(Span::styled("✗ ", Style::default().fg(COLOR_RED)));
        spans.push(Span::styled(
            counts.unhealthy.to_string(),
            Style::default().fg(COLOR_RED),
        ));
        spans.push(Span::raw(" "));
    }

    if counts.pending > 0 {
        spans.push(Span::styled("◐ ", Style::default().fg(COLOR_YELLOW)));
        spans.push(Span::styled(
            counts.pending.to_string(),
            Style::default().fg(COLOR_YELLOW),
        ));
        spans.push(Span::raw(" "));
    }

    spans.push(Span::styled("✓ ", Style::default().fg(COLOR_GREEN)));
    spans.push(Span::styled(
        format!("{}", counts.healthy),
        Style::default().fg(COLOR_GREEN),
    ));

    spans.push(Span::styled(
        format!(" / {}", counts.total_enabled),
        Style::default().fg(COLOR_GRAY),
    ));
    spans.push(Span::raw(" "));

    Line::from(spans)
}

/// Render main content area with tree and logs
fn render_main(f: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(35), // Tree
            Constraint::Percentage(65), // Logs
        ])
        .split(area);

    render_tree(f, app, chunks[0]);
    render_logs(f, app, chunks[1]);
}

/// Render resource tree
fn render_tree(f: &mut Frame, app: &App, area: Rect) {
    let is_focused = app.focused_pane == FocusedPane::Tree;
    let border_color = if is_focused { COLOR_BORDER_FOCUSED } else { COLOR_BORDER };

    let title = format!("Resources ({})", app.resources.len());
    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(border_color));

    let inner = block.inner(area);

    // Build list items
    let items: Vec<ListItem> = app
        .tree_nodes
        .iter()
        .enumerate()
        .map(|(i, node)| {
            let is_selected = i == app.tree_cursor;
            tree_node_to_list_item(node, is_selected)
        })
        .collect();

    let list = List::new(items);

    f.render_widget(block, area);
    f.render_widget(list, inner);

    // Scrollbar
    if app.tree_nodes.len() > inner.height as usize {
        let scrollbar = Scrollbar::default()
            .orientation(ScrollbarOrientation::VerticalRight)
            .begin_symbol(None)
            .end_symbol(None);
        let mut scrollbar_state = ScrollbarState::new(app.tree_nodes.len())
            .position(app.tree_cursor);
        f.render_stateful_widget(
            scrollbar,
            area.inner(ratatui::layout::Margin { horizontal: 0, vertical: 1 }),
            &mut scrollbar_state,
        );
    }
}

fn tree_node_to_list_item(node: &TreeNode, is_selected: bool) -> ListItem<'static> {
    let style = if is_selected {
        Style::default().bg(Color::Rgb(39, 39, 42))
    } else {
        Style::default()
    };

    match node {
        TreeNode::Group { name, expanded, child_count } => {
            let arrow = if *expanded { "▼" } else { "▶" };
            let line = Line::from(vec![
                Span::styled(format!("{} ", arrow), Style::default().fg(COLOR_GRAY)),
                Span::styled(name.clone(), Style::default().fg(Color::White).add_modifier(Modifier::BOLD)),
                Span::styled(format!(" ({})", child_count), Style::default().fg(COLOR_DIM)),
            ]);
            ListItem::new(vec![line]).style(style)
        }
        TreeNode::Resource { resource, depth: _ } => {
            let (icon, color) = status_icon(resource.effective_status());
            
            // First line: icon + name
            let line1 = Line::from(vec![
                Span::raw("  "),
                Span::styled(icon, Style::default().fg(color)),
                Span::raw(" "),
                Span::styled(resource.name.clone(), Style::default().fg(Color::White)),
            ]);

            // Second line: status details
            let time_str = format_relative_time(&resource.last_deploy_at);
            let line2 = Line::from(vec![
                Span::raw("    "),
                Span::styled(icon, Style::default().fg(color)),
                Span::raw(" "),
                Span::styled(time_str, Style::default().fg(COLOR_DIM)),
            ]);

            ListItem::new(vec![line1, line2]).style(style)
        }
    }
}

/// Render log viewer
fn render_logs(f: &mut Frame, app: &App, area: Rect) {
    let is_focused = app.focused_pane == FocusedPane::Logs;
    let border_color = if is_focused { COLOR_BORDER_FOCUSED } else { COLOR_BORDER };

    let resource_name = app.selected_resource.as_deref().unwrap_or("(none)");
    let follow_indicator = if app.auto_scroll { " [follow]" } else { "" };
    let title = format!("Logs: {}{}", resource_name, follow_indicator);

    let block = Block::default()
        .title(title)
        .borders(Borders::ALL)
        .border_style(Style::default().fg(border_color));

    let inner = block.inner(area);
    let logs = app.current_logs();

    if logs.is_empty() {
        let empty_text = Paragraph::new("No logs available")
            .style(Style::default().fg(COLOR_DIM));
        f.render_widget(block, area);
        f.render_widget(empty_text, inner);
        return;
    }

    // Calculate visible range
    let visible_height = inner.height as usize;
    let total_logs = logs.len();
    
    let start_idx = if app.auto_scroll {
        total_logs.saturating_sub(visible_height)
    } else {
        app.log_scroll.min(total_logs.saturating_sub(visible_height))
    };
    let end_idx = (start_idx + visible_height).min(total_logs);

    // Build log lines
    let log_lines: Vec<Line> = logs[start_idx..end_idx]
        .iter()
        .map(|entry| {
            let time_str = entry.timestamp.format("[%H:%M:%S]").to_string();
            let text = strip_ansi(&entry.text);
            
            // Apply horizontal scroll
            let display_text = if app.log_x_offset < text.len() {
                &text[app.log_x_offset..]
            } else {
                ""
            };

            Line::from(vec![
                Span::styled(time_str, Style::default().fg(COLOR_DIM)),
                Span::raw(" "),
                Span::styled(display_text.to_string(), Style::default().fg(Color::White)),
            ])
        })
        .collect();

    let log_para = Paragraph::new(log_lines);

    f.render_widget(block, area);
    f.render_widget(log_para, inner);

    // Scrollbar
    if total_logs > visible_height {
        let scrollbar = Scrollbar::default()
            .orientation(ScrollbarOrientation::VerticalRight)
            .begin_symbol(None)
            .end_symbol(None);
        let mut scrollbar_state = ScrollbarState::new(total_logs)
            .position(start_idx);
        f.render_stateful_widget(
            scrollbar,
            area.inner(ratatui::layout::Margin { horizontal: 0, vertical: 1 }),
            &mut scrollbar_state,
        );
    }
}

/// Render footer with context-aware help
fn render_footer(f: &mut Frame, app: &App, area: Rect) {
    let help_text = match app.focused_pane {
        FocusedPane::Tree => {
            "[RESOURCES] <j/k> Up/Down  <g/G> Home/End  <Enter> Select  <Tab> Switch  <r> Trigger  <Q> Quit"
        }
        FocusedPane::Logs => {
            "[LOGS] <j/k> Up/Down  <h/l> Left/Right  <g/G> Home/End  <f> Follow  <Tab> Switch  <Q> Quit"
        }
    };

    let footer = Paragraph::new(help_text)
        .style(Style::default().fg(COLOR_GRAY));

    f.render_widget(footer, area);
}
