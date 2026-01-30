//! Tilt TUI - A terminal UI for Tilt built with Ratatui

mod app;
mod tilt;
mod ui;

use app::{App, ConnectionStatus, FocusedPane};
use color_eyre::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};
use std::{io, time::Duration};
use tokio::time::interval;

#[tokio::main]
async fn main() -> Result<()> {
    // Setup error hooks
    color_eyre::install()?;

    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // Create app
    let mut app = App::new();

    // Run app
    let result = run_app(&mut terminal, &mut app).await;

    // Restore terminal
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen,
        DisableMouseCapture
    )?;
    terminal.show_cursor()?;

    // Handle any errors
    if let Err(err) = result {
        eprintln!("Error: {err:?}");
    }

    Ok(())
}

async fn run_app(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    app: &mut App,
) -> Result<()> {
    // Initial data fetch - use HTTP polling directly (more reliable than websocket)
    match app.client.get_resources().await {
        Ok(resources) => {
            app.connection_status = ConnectionStatus::Connected;
            app.resources = resources;
            app.rebuild_tree();

            // Select first resource if available
            if !app.tree_nodes.is_empty() {
                app.tree_cursor = 0;
                app.select_resource();
            }
        }
        Err(_) => {
            app.connection_status = ConnectionStatus::Disconnected;
        }
    }

    // Fetch initial logs if we have a selected resource
    if let Some(ref resource_name) = app.selected_resource {
        if let Ok(logs) = app.client.get_logs(resource_name).await {
            app.logs.insert(resource_name.clone(), logs);
        }
    }

    // Polling interval for updates
    let mut poll_interval = interval(Duration::from_secs(2));
    let mut log_poll_interval = interval(Duration::from_millis(500));

    loop {
        // Draw UI
        terminal.draw(|f| ui::render(f, app))?;

        // Handle events with timeout
        if event::poll(Duration::from_millis(100))? {
            if let Event::Key(key) = event::read()? {
                // Global keybindings
                match key.code {
                    KeyCode::Char('Q') => {
                        app.should_quit = true;
                    }
                    KeyCode::Char('q') if key.modifiers.contains(KeyModifiers::SHIFT) => {
                        app.should_quit = true;
                    }
                    KeyCode::Tab => {
                        app.cycle_pane();
                    }
                    KeyCode::Char('r') => {
                        // Trigger rebuild for current resource
                        if let Some(name) = app.current_resource_name() {
                            let name = name.to_string();
                            if let Err(e) = app.client.trigger_resource(&name).await {
                                eprintln!("Trigger failed: {}", e);
                            }
                        }
                    }
                    KeyCode::Char('f') => {
                        if app.focused_pane == FocusedPane::Logs {
                            app.toggle_follow();
                        }
                    }
                    _ => {
                        // Pane-specific keybindings
                        match app.focused_pane {
                            FocusedPane::Tree => handle_tree_keys(app, key.code, key.modifiers),
                            FocusedPane::Logs => handle_log_keys(app, key.code, key.modifiers),
                        }
                    }
                }
            }
        }

        if app.should_quit {
            break;
        }

        // Poll for resource updates
        tokio::select! {
            _ = poll_interval.tick() => {
                if let Ok(resources) = app.client.get_resources().await {
                    app.connection_status = ConnectionStatus::Connected;
                    app.resources = resources;
                    app.rebuild_tree();
                } else {
                    app.connection_status = ConnectionStatus::Disconnected;
                }
            }
            _ = log_poll_interval.tick() => {
                // Fetch logs for selected resource
                if let Some(ref resource_name) = app.selected_resource.clone() {
                    if let Ok(logs) = app.client.get_logs(resource_name).await {
                        let log_count = logs.len();
                        app.logs.insert(resource_name.clone(), logs);

                        // Auto-scroll if enabled
                        if app.auto_scroll && log_count > 0 {
                            app.log_scroll = log_count.saturating_sub(1);
                        }
                    }
                }
            }
            else => {}
        }
    }

    Ok(())
}

fn handle_tree_keys(app: &mut App, code: KeyCode, modifiers: KeyModifiers) {
    match code {
        KeyCode::Char('j') | KeyCode::Down => app.tree_down(),
        KeyCode::Char('k') | KeyCode::Up => app.tree_up(),
        KeyCode::Char('g') => {
            if modifiers.contains(KeyModifiers::SHIFT) {
                app.tree_end();
            } else {
                app.tree_home();
            }
        }
        KeyCode::Char('G') => app.tree_end(),
        KeyCode::Home => app.tree_home(),
        KeyCode::End => app.tree_end(),
        KeyCode::Enter | KeyCode::Char(' ') => {
            // Toggle group or select resource
            if let Some(node) = app.tree_nodes.get(app.tree_cursor) {
                match node {
                    app::TreeNode::Group { .. } => app.toggle_group(),
                    app::TreeNode::Resource { .. } => {
                        app.select_resource();
                        app.focused_pane = FocusedPane::Logs;
                    }
                }
            }
        }
        _ => {}
    }
}

fn handle_log_keys(app: &mut App, code: KeyCode, modifiers: KeyModifiers) {
    match code {
        KeyCode::Char('j') | KeyCode::Down => app.logs_down(),
        KeyCode::Char('k') | KeyCode::Up => app.logs_up(),
        KeyCode::Char('g') => {
            if modifiers.contains(KeyModifiers::SHIFT) {
                app.logs_end();
            } else {
                app.logs_home();
            }
        }
        KeyCode::Char('G') => app.logs_end(),
        KeyCode::Home => app.tree_home(),
        KeyCode::End => app.logs_end(),
        KeyCode::Char('h') | KeyCode::Left => app.logs_left(),
        KeyCode::Char('l') | KeyCode::Right => app.logs_right(),
        _ => {}
    }
}
