// Main App component

import { createSignal, Show } from "solid-js";
import { useRenderer } from "@opentui/solid";
import { TiltProvider } from "./context/tilt";
import { FocusProvider, useFocus } from "./context/focus";
import { Header } from "./components/header";
import { Tree } from "./components/tree";
import { ResourceView } from "./components/resourceview";
import {
  CommandPalette,
  type PaletteOption,
} from "./components/command-palette";
import { ResourcePicker } from "./components/resource-picker";
import { KeyboardHelp } from "./components/keyboard-help";
import { defaultTheme } from "./theme/theme";
import { useKeyHandler } from "./keyboard/useKeyHandler";
import { Commands } from "./commands";

function AppContent() {
  const renderer = useRenderer();
  renderer.keyInput.on("keypress", (key) => {
    // Toggle with backtick key
    if (key.name === "`") {
      renderer.console.toggle();
    }
  });

  const {
    cyclePane,
    cyclePaneReverse,
    sidebarVisible,
    toggleSidebar,
    paletteOpen,
    setPaletteOpen,
    resourcePickerOpen,
    setResourcePickerOpen,
    helpOpen,
    setHelpOpen,
  } = useFocus();
  const theme = defaultTheme;

  // Execute a command from the palette or keyboard
  function executeCommand(command: string) {
    switch (command) {
      case Commands.APP_QUIT:
        renderer.destroy();
        break;
      case Commands.SIDEBAR_TOGGLE:
        toggleSidebar();
        break;
      case Commands.FOCUS_NEXT:
        cyclePane();
        break;
      case Commands.FOCUS_PREV:
        cyclePaneReverse();
        break;
      case Commands.PALETTE_OPEN:
        setPaletteOpen(true);
        break;
      case Commands.RESOURCE_PICKER_OPEN:
        setResourcePickerOpen(true);
        break;
      case Commands.HELP_OPEN:
        setHelpOpen(true);
        break;
    }
  }

  // App-level keyboard handling (disabled when any modal is open)
  useKeyHandler(
    "app",
    executeCommand,
    () => !paletteOpen() && !resourcePickerOpen() && !helpOpen(),
  );

  // Handle palette selection
  function handlePaletteSelect(option: PaletteOption) {
    console.log("paletteselect", option);
    if (option.command) {
      executeCommand(option.command);
    }
  }

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme.background}
    >
      {/* Header - only shown when sidebar is hidden */}
      <Show when={!sidebarVisible()}>
        <box flexShrink={0}>
          <Header />
        </box>
      </Show>

      {/* Main content: Tree (sidebar) + ResourceView */}
      <box flexDirection="row" flexGrow={1}>
        <Show when={sidebarVisible()}>
          <Tree />
        </Show>
        <ResourceView />
      </box>

      {/* Command Palette overlay */}
      <Show when={paletteOpen()}>
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onSelect={handlePaletteSelect}
        />
      </Show>

      {/* Resource Picker overlay */}
      <Show when={resourcePickerOpen()}>
        <ResourcePicker onClose={() => setResourcePickerOpen(false)} />
      </Show>

      {/* Keyboard Help overlay */}
      <Show when={helpOpen()}>
        <KeyboardHelp onClose={() => setHelpOpen(false)} />
      </Show>
    </box>
  );
}

export function App() {
  return (
    <TiltProvider>
      <FocusProvider>
        <AppContent />
      </FocusProvider>
    </TiltProvider>
  );
}
