// Custom hook for declarative keyboard handling
// Wraps useKeyboard with mode-based command resolution

import { useKeyboard } from "@opentui/solid";
import { handleKeyEvent } from "./handler";
import { Mode, Command } from "./keymap-utils";

/**
 * Hook for handling keyboard events with declarative command mapping
 * @param mode - The mode to use for key mapping lookup
 * @param onCommand - Callback invoked when a mapped command is triggered
 * @param enabled - Optional reactive condition to enable/disable handling (e.g., focus state)
 */
export function useKeyHandler(
  mode: Mode,
  onCommand: (command: Command) => void,
  enabled: () => boolean = () => true,
) {
  useKeyboard((event) => {
    // Skip if not enabled (e.g., not focused)
    if (!enabled()) return;

    const command = handleKeyEvent(event, mode);
    if (command) {
      onCommand(command);
    }
  });
}
