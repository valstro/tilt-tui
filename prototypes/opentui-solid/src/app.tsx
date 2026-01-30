// Main App component

import { useKeyboard, useRenderer } from "@opentui/solid";
import { TiltProvider } from "./context/tilt";
import { FocusProvider, useFocus } from "./context/focus";
import { Header } from "./components/header";
import { Tree } from "./components/tree";
import { Logs } from "./components/logs";
import { Footer } from "./components/footer";
import { defaultTheme } from "./theme/theme";

function AppContent() {
  const renderer = useRenderer();
  const { cyclePane, cyclePaneReverse } = useFocus();
  const theme = defaultTheme;

  // Global keyboard handling
  useKeyboard((key) => {
    // Quit with Q (shift+q) or Ctrl+C
    if ((key.name === "q" && key.shift) || (key.ctrl && key.name === "c")) {
      key.preventDefault();
      renderer.destroy();
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
      {/* Header - fixed height */}
      <box flexShrink={0}>
        <Header />
      </box>

      {/* Main content: Tree + Logs - grows to fill */}
      <box flexDirection="row" flexGrow={1} gap={1}>
        <Tree />
        <Logs />
      </box>

      {/* Footer - fixed height */}
      <box flexShrink={0}>
        <Footer />
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
