// Main App component

import { Show } from "solid-js";
import { useRenderer } from "@opentui/solid";
import { TiltProvider } from "./context/tilt";
import { FocusProvider, useFocus } from "./context/focus";
import { Header } from "./components/header";
import { Tree } from "./components/tree";
import { ResourceView } from "./components/resourceview";
import { defaultTheme } from "./theme/theme";
import { useKeyHandler } from "./keyboard/useKeyHandler";
import { Commands } from "./commands";

function AppContent() {
  const renderer = useRenderer();
  const { cyclePane, cyclePaneReverse, sidebarVisible, toggleSidebar } =
    useFocus();
  const theme = defaultTheme;

  // App-level keyboard handling
  useKeyHandler("app", (command) => {
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
    }
  });

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
