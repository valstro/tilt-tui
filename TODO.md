# BUGS

- resource tree
  - when you're on a selected resource node, and the node list changes (based on active filters), the logs view doesn't update. e.g. select a node that's currently building while the building filter is active. that node will disappear and be replaced with the next building resource, and the logs won't update.
  - up should circle around to bottom of tree when already at top, and same for down.
- screen resizing
  - command help should adjust to screen width. show fewer commands when screen is below a threshold
  - terminal resize doesn't trigger logview resize
- logs
  - log clearing doens't work
  - should show span separators between span segments. e.g. "initial build", "web trigger", "live reload", etc.
- resource picker search doens't prioritize exact match.
- status indicator rendering issues, mostly with warning indicator.
- reload-resource command from the command palette doesn't work, but `r` does.

# ROADMAP

- UI Unit tests
- ui improvements
  - animate log content replacement to make it obvious that log content changed
- split pane
- favorites
- log clearing
- user config
  - mutable keymap
  - user-defined log filters?
- global actions
  - actionbuttons e.g. NAV
- status line
  - show AWS SSO session info
- self-updating tui client
