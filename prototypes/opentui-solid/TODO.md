# BUGS

- buttons
  - disable doesn't update resource tree ui state
  - ui buttons can only be triggered once.

- ui
  - more padding around tree items

# ROADMAP

- split pane
- favorites
- search
- tree filtering
  - search text
  - toggle failed/successful/etc.
- log filtering
  - filter by type of log (build, cluster, cmd, disabletoggle-\*, tiltfile)
- user config
  - mutable keymap
  - user-defined log filters?
- keyboard shortcut help modal

## Feature: Tree Navigation

### Goals

- make tree view easier to navigate for large tilt resource collections
- allow filtering by resource name
- allow filtering by resource status

### Resource Picker Design

A modal picker-style dialog for resources that acts like a palette with inline search filtering.

- use same styles/modal/filter input as current command palette
- keyboard shortcut is `ctrl+space`
- group resources by resource group, use same grouping style as in command palette
  - only show group heading if any resources match current filter (or if no filter text is present)
- fuzzy search
- selection of a resource from picker selects that item on the tree, focus on resource pane.
  - expands group if collapsed

- ignore status filter for picker options. if the picked resource isn't visible due to filtering, reset the status filter to (all)

### Status Filter Toggle Design

A one-button status filter toggle/cycle for the tree view.

- keyboard shortcut `f`
- filters treeview resources by active status (failed, in-progress, successful, all)
- cycle through statuses
- if no resources exist in active status, don't show empty resource groups.
- indicate active status in the treeview PaneHeader

## Keyboard Shortcut Modal

### Goals

- Show a cheat sheet to help users remember available commands

### Design

- Use modal with same style as picker
- Show all commands and keyboard shortcuts
- Group by mode
- Triggered by `?` key
