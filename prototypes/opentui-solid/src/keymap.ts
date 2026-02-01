import { Commands } from "./commands";
import { KeyMapping } from "./keyboard/keymap-utils";

// Declarative keymap configuration
// Defines all keyboard shortcuts and their associated commands
export const keymap: KeyMapping[] = [
  // App-level commands
  {
    modes: ["app"],
    key: "p",
    modifiers: { ctrl: true },
    command: Commands.PALETTE_OPEN,
    description: "palette",
  },
  {
    modes: ["app"],
    key: "q",
    command: Commands.APP_QUIT,
    description: "quit",
  },
  {
    modes: ["app"],
    key: "c",
    modifiers: { ctrl: true },
    command: Commands.APP_QUIT,
    description: "quit",
    showInHelp: false,
  },
  {
    modes: ["app"],
    key: "e",
    modifiers: { ctrl: true },
    command: Commands.SIDEBAR_TOGGLE,
    description: "sidebar",
  },
  {
    modes: ["app"],
    key: "tab",
    command: Commands.FOCUS_NEXT,
    description: "switch",
  },
  {
    modes: ["app"],
    key: "tab",
    modifiers: { shift: true },
    command: Commands.FOCUS_PREV,
    description: "switch",
    showInHelp: false,
  },

  // Shared navigation (tree + resource)
  {
    modes: ["tree", "resource"],
    key: "j",
    command: Commands.NAV_DOWN,
    description: "down",
  },
  {
    modes: ["tree", "resource"],
    key: "down",
    command: Commands.NAV_DOWN,
    description: "down",
    showInHelp: false,
  },
  {
    modes: ["tree", "resource"],
    key: "k",
    command: Commands.NAV_UP,
    description: "up",
    showInHelp: false,
  }, // Combined with j
  {
    modes: ["tree", "resource"],
    key: "up",
    command: Commands.NAV_UP,
    description: "up",
    showInHelp: false,
  },
  {
    modes: ["tree", "resource"],
    key: "g",
    command: Commands.NAV_TOP,
    description: "top",
  },
  {
    modes: ["tree", "resource"],
    key: "g",
    modifiers: { shift: true },
    command: Commands.NAV_BOTTOM,
    description: "bottom",
    showInHelp: false,
  }, // Combined with g

  // Tree-specific
  {
    modes: ["tree"],
    key: "return",
    command: Commands.TREE_SELECT,
    description: "select",
  },
  {
    modes: ["tree"],
    key: "space",
    command: Commands.TREE_SELECT,
    description: "select",
    showInHelp: false,
  },
  {
    modes: ["tree", "resource"],
    key: "r",
    command: Commands.RELOAD_RESOURCE,
    description: "reload resource",
  },
  {
    modes: ["tree", "resource"],
    key: "d",
    command: Commands.RESOURCE_DISABLE_TOGGLE,
    description: "toggle disable",
  },

  // Resource-specific
  {
    modes: ["resource"],
    key: "h",
    command: Commands.SCROLL_LEFT,
    description: "left",
  },
  {
    modes: ["resource"],
    key: "left",
    command: Commands.SCROLL_LEFT,
    description: "left",
    showInHelp: false,
  },
  {
    modes: ["resource"],
    key: "l",
    command: Commands.SCROLL_RIGHT,
    description: "right",
    showInHelp: false,
  }, // Combined with h
  {
    modes: ["resource"],
    key: "right",
    command: Commands.SCROLL_RIGHT,
    description: "right",
    showInHelp: false,
  },
  {
    modes: ["resource"],
    key: "pageup",
    command: Commands.SCROLL_PAGEUP,
    description: "pgup",
    showInHelp: false,
  },
  {
    modes: ["resource"],
    key: "pagedown",
    command: Commands.SCROLL_PAGEDOWN,
    description: "pgdn",
    showInHelp: false,
  },
  {
    modes: ["resource"],
    key: "f",
    command: Commands.SCROLL_FOLLOW,
    description: "follow",
  },
];
