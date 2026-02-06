// Command constants
export const Commands = {
  // App-level
  APP_QUIT: "app.quit",
  SIDEBAR_TOGGLE: "sidebar.toggle",
  FOCUS_NEXT: "focus.next",
  FOCUS_PREV: "focus.prev",
  RELOAD_RESOURCE: "resource.trigger",
  RESOURCE_DISABLE_TOGGLE: "resource.disable.toggle",

  // Navigation (shared between tree and resource)
  NAV_DOWN: "nav.down",
  NAV_UP: "nav.up",
  NAV_TOP: "nav.top",
  NAV_BOTTOM: "nav.bottom",

  // Tree-specific
  TREE_SELECT: "tree.select",
  STATUS_FILTER_CYCLE: "status.filter.cycle",
  STATUS_FILTER_RESET: "status.filter.reset",

  // Resource/scroll-specific
  SCROLL_LEFT: "scroll.left",
  SCROLL_RIGHT: "scroll.right",
  SCROLL_PAGEUP: "scroll.pageup",
  SCROLL_PAGEDOWN: "scroll.pagedown",
  SCROLL_FOLLOW: "scroll.follow",
  CLEAR_LOGS: "logs.clear",

  // Command palette
  PALETTE_OPEN: "palette.open",

  // Resource picker
  RESOURCE_PICKER_OPEN: "resource.picker.open",

  // Help
  HELP_OPEN: "help.open",
} as const;
