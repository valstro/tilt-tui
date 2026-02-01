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
import { defaultTheme } from "./theme/theme";
import { useKeyHandler } from "./keyboard/useKeyHandler";
import { Commands } from "./commands";

function AppContent() {
  const renderer = useRenderer();
  const {
    cyclePane,
    cyclePaneReverse,
    sidebarVisible,
    toggleSidebar,
    paletteOpen,
    setPaletteOpen,
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
    }
  }

  // App-level keyboard handling (disabled when palette is open)
  useKeyHandler("app", executeCommand, () => !paletteOpen());

  // Handle palette selection
  function handlePaletteSelect(option: PaletteOption) {
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
