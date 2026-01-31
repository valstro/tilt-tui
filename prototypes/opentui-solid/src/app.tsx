// Main App component

import { Show } from "solid-js";
import { useKeyboard, useRenderer } from "@opentui/solid";
import { TiltProvider } from "./context/tilt";
import { FocusProvider, useFocus } from "./context/focus";
import { Header } from "./components/header";
import { Tree } from "./components/tree";
import { ResourceView } from "./components/resourceview";
import { defaultTheme } from "./theme/theme";

function AppContent() {
  const renderer = useRenderer();
  const { cyclePane, cyclePaneReverse, sidebarVisible, toggleSidebar } = useFocus();
  const theme = defaultTheme;

  // Global keyboard handling
  useKeyboard((key) => {
    // Quit with Q (shift+q) or Ctrl+C
    if ((key.name === "q" && key.shift) || (key.ctrl && key.name === "c")) {
      key.preventDefault();
      renderer.destroy();
      return;
    }

    // Toggle sidebar with Ctrl+e
    if (key.ctrl && key.name === "e") {
      key.preventDefault();
      toggleSidebar();
      return;
    }

    // Tab switching
    if (key.name === "tab") {
      key.preventDefault();
      if (key.shift) {
        cyclePaneReverse();
      } else {
        cyclePane();
      }
      return;
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
