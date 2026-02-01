// Command constants
export const Commands = {
  // App-level
  APP_QUIT: "app.quit",
  SIDEBAR_TOGGLE: "sidebar.toggle",
  FOCUS_NEXT: "focus.next",
  FOCUS_PREV: "focus.prev",
  RELOAD_RESOURCE: "resource.trigger",

  // Navigation (shared between tree and resource)
  NAV_DOWN: "nav.down",
  NAV_UP: "nav.up",
  NAV_TOP: "nav.top",
  NAV_BOTTOM: "nav.bottom",

  // Tree-specific
  TREE_SELECT: "tree.select",

  // Resource/scroll-specific
  SCROLL_LEFT: "scroll.left",
  SCROLL_RIGHT: "scroll.right",
  SCROLL_PAGEUP: "scroll.pageup",
  SCROLL_PAGEDOWN: "scroll.pagedown",
  SCROLL_FOLLOW: "scroll.follow",

  // Command palette
  PALETTE_OPEN: "palette.open",
} as const;
