//! Main application state and logic

use crate::tilt::{LogEntry, Resource, TiltClient};
use std::collections::HashMap;

/// Which pane is currently focused
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FocusedPane {
    Tree,
    Logs,
}

/// Connection status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionStatus {
    Connected,
    Connecting,
    Disconnected,
}

/// Tree node type
#[derive(Debug, Clone)]
pub enum TreeNode {
    Group {
        name: String,
        expanded: bool,
        child_count: usize,
    },
    Resource {
        resource: Resource,
        depth: usize,
    },
}

/// Application state
pub struct App {
    pub client: TiltClient,
    pub should_quit: bool,
    pub focused_pane: FocusedPane,
    pub connection_status: ConnectionStatus,
    pub cluster_context: String,
    pub namespace: String,
    
    // Resources
    pub resources: Vec<Resource>,
    pub tree_nodes: Vec<TreeNode>,
    pub expanded_groups: HashMap<String, bool>,
    pub tree_cursor: usize,
    pub tree_scroll: usize,
    pub selected_resource: Option<String>,
    
    // Logs
    pub logs: HashMap<String, Vec<LogEntry>>,
    pub log_scroll: usize,
    pub log_x_offset: usize,
    pub auto_scroll: bool,
}

impl App {
    pub fn new() -> Self {
        Self {
            client: TiltClient::new(None, None),
            should_quit: false,
            focused_pane: FocusedPane::Tree,
            connection_status: ConnectionStatus::Connecting,
            cluster_context: "docker-desktop".to_string(),
            namespace: String::new(),
            resources: Vec::new(),
            tree_nodes: Vec::new(),
            expanded_groups: HashMap::new(),
            tree_cursor: 0,
            tree_scroll: 0,
            selected_resource: None,
            logs: HashMap::new(),
            log_scroll: 0,
            log_x_offset: 0,
            auto_scroll: true,
        }
    }

    /// Build tree nodes from resources with grouping
    pub fn rebuild_tree(&mut self) {
        self.tree_nodes.clear();
        
        // Group resources by labels
        let mut grouped: HashMap<String, Vec<usize>> = HashMap::new();
        let mut group_order: Vec<String> = Vec::new();

        for (i, r) in self.resources.iter().enumerate() {
            let group_key = self.get_group_key(r);
            if !grouped.contains_key(&group_key) {
                group_order.push(group_key.clone());
            }
            grouped.entry(group_key).or_default().push(i);
        }

        // Sort groups (ungrouped at end)
        group_order.sort_by(|a, b| {
            if a == "ungrouped" {
                std::cmp::Ordering::Greater
            } else if b == "ungrouped" {
                std::cmp::Ordering::Less
            } else {
                a.cmp(b)
            }
        });

        // Build nodes
        for group_key in group_order {
            let indices = grouped.get(&group_key).unwrap();
            let expanded = *self.expanded_groups.get(&group_key).unwrap_or(&true);

            self.tree_nodes.push(TreeNode::Group {
                name: group_key.clone(),
                expanded,
                child_count: indices.len(),
            });

            if expanded {
                for &idx in indices {
                    self.tree_nodes.push(TreeNode::Resource {
                        resource: self.resources[idx].clone(),
                        depth: 1,
                    });
                }
            }
        }

        // Clamp cursor
        if self.tree_cursor >= self.tree_nodes.len() && !self.tree_nodes.is_empty() {
            self.tree_cursor = self.tree_nodes.len() - 1;
        }
    }

    fn get_group_key(&self, r: &Resource) -> String {
        let priority_keys = [
            "app",
            "app.kubernetes.io/name",
            "app.kubernetes.io/component",
            "component",
            "service",
            "tilt.dev/resource",
        ];

        for key in priority_keys {
            if let Some(val) = r.labels.get(key) {
                if !val.is_empty() {
                    return val.clone();
                }
            }
        }

        // Fall back to first label value
        for val in r.labels.values() {
            if !val.is_empty() {
                return val.clone();
            }
        }

        "ungrouped".to_string()
    }

    /// Toggle expand/collapse for group at cursor
    pub fn toggle_group(&mut self) {
        if let Some(TreeNode::Group { name, expanded, .. }) = self.tree_nodes.get(self.tree_cursor) {
            let name = name.clone();
            let new_expanded = !expanded;
            self.expanded_groups.insert(name, new_expanded);
            self.rebuild_tree();
        }
    }

    /// Select resource at cursor
    pub fn select_resource(&mut self) {
        if let Some(TreeNode::Resource { resource, .. }) = self.tree_nodes.get(self.tree_cursor) {
            self.selected_resource = Some(resource.name.clone());
            self.log_scroll = 0;
            self.log_x_offset = 0;
            self.auto_scroll = true;
        }
    }

    /// Get currently selected resource name
    pub fn current_resource_name(&self) -> Option<&str> {
        if let Some(TreeNode::Resource { resource, .. }) = self.tree_nodes.get(self.tree_cursor) {
            Some(&resource.name)
        } else {
            None
        }
    }

    /// Move cursor up in tree
    pub fn tree_up(&mut self) {
        if self.tree_cursor > 0 {
            self.tree_cursor -= 1;
        }
    }

    /// Move cursor down in tree
    pub fn tree_down(&mut self) {
        if self.tree_cursor + 1 < self.tree_nodes.len() {
            self.tree_cursor += 1;
        }
    }

    /// Move cursor to start of tree
    pub fn tree_home(&mut self) {
        self.tree_cursor = 0;
    }

    /// Move cursor to end of tree
    pub fn tree_end(&mut self) {
        if !self.tree_nodes.is_empty() {
            self.tree_cursor = self.tree_nodes.len() - 1;
        }
    }

    /// Cycle focus to next pane
    pub fn cycle_pane(&mut self) {
        self.focused_pane = match self.focused_pane {
            FocusedPane::Tree => FocusedPane::Logs,
            FocusedPane::Logs => FocusedPane::Tree,
        };
    }

    /// Get logs for currently selected resource
    pub fn current_logs(&self) -> &[LogEntry] {
        self.selected_resource
            .as_ref()
            .and_then(|name| self.logs.get(name))
            .map(|v| v.as_slice())
            .unwrap_or(&[])
    }

    /// Scroll logs up
    pub fn logs_up(&mut self) {
        if self.log_scroll > 0 {
            self.log_scroll -= 1;
            self.auto_scroll = false;
        }
    }

    /// Scroll logs down
    pub fn logs_down(&mut self) {
        let log_count = self.current_logs().len();
        if self.log_scroll + 1 < log_count {
            self.log_scroll += 1;
        }
    }

    /// Scroll logs to top
    pub fn logs_home(&mut self) {
        self.log_scroll = 0;
        self.auto_scroll = false;
    }

    /// Scroll logs to bottom
    pub fn logs_end(&mut self) {
        let log_count = self.current_logs().len();
        self.log_scroll = log_count.saturating_sub(1);
        self.auto_scroll = true;
    }

    /// Scroll logs left
    pub fn logs_left(&mut self) {
        self.log_x_offset = self.log_x_offset.saturating_sub(4);
    }

    /// Scroll logs right
    pub fn logs_right(&mut self) {
        self.log_x_offset += 4;
    }

    /// Toggle auto-scroll
    pub fn toggle_follow(&mut self) {
        self.auto_scroll = !self.auto_scroll;
        if self.auto_scroll {
            self.logs_end();
        }
    }

    /// Calculate status counts
    pub fn status_counts(&self) -> StatusCounts {
        let mut counts = StatusCounts::default();

        for r in &self.resources {
            if r.is_disabled {
                counts.disabled += 1;
                continue;
            }

            counts.total_enabled += 1;

            match r.effective_status() {
                "error" => counts.unhealthy += 1,
                "pending" => counts.pending += 1,
                "ok" => counts.healthy += 1,
                _ => {}
            }
        }

        counts
    }
}

#[derive(Debug, Default)]
pub struct StatusCounts {
    pub healthy: usize,
    pub total_enabled: usize,
    pub pending: usize,
    pub unhealthy: usize,
    pub warning: usize,
    pub disabled: usize,
}
