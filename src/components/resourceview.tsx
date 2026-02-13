// ResourceView component - main content pane for selected resource
// Uses LogBufferView for high-performance log rendering with FrameBuffer

import { createSignal, createMemo, Show } from "solid-js";
import { useTilt } from "../context/tilt";
import { useFocus } from "../context/focus";
import { useKeyHandler } from "../keyboard/useKeyHandler";
import { Commands } from "../commands";
import { defaultTheme, focusBorder } from "../theme/theme";
import { PaneHeader } from "./pane-header";
import { Footer } from "./footer";
import { LogBufferView, type LogBufferViewRef } from "./log-buffer-view";

export function ResourceView() {
  const { state, logStore, triggerResource, toggleResourceDisable } = useTilt();
  const { state: focusState, sidebarVisible } = useFocus();
  const theme = defaultTheme;

  // Local state
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [showTimestamps, setShowTimestamps] = createSignal(true);

  // Reference to LogBufferView for scroll control
  let logBufferRef: LogBufferViewRef | null = null;

  const isFocused = createMemo(() => focusState.activePane === "resource");

  // Create LogBufferView - returns [Component, Ref] tuple
  const [LogView, logRef] = LogBufferView({
    logStore,
    manifestName: () => state.selectedResource,
    theme,
    showTimestamps,
    onAutoScrollChange: setAutoScroll,
  });

  // Store ref for keyboard handlers
  logBufferRef = logRef;

  // Keyboard handling - only active when focused
  useKeyHandler(
    "resource",
    (command) => {
      switch (command) {
        case Commands.NAV_DOWN:
          logBufferRef?.scrollBy(1);
          break;
        case Commands.NAV_UP:
          logBufferRef?.scrollBy(-1);
          break;
        case Commands.NAV_TOP:
          logBufferRef?.scrollToTop();
          break;
        case Commands.NAV_BOTTOM:
          logBufferRef?.scrollToBottom();
          break;
        case Commands.SCROLL_PAGEUP:
          logBufferRef?.scrollBy(-Math.floor((logBufferRef?.height ?? 20) / 2));
          break;
        case Commands.SCROLL_PAGEDOWN:
          logBufferRef?.scrollBy(Math.floor((logBufferRef?.height ?? 20) / 2));
          break;
        case Commands.SCROLL_FOLLOW:
          logBufferRef?.toggleAutoScroll();
          break;
        case Commands.TOGGLE_TIMESTAMPS:
          setShowTimestamps((s) => !s);
          break;
        case Commands.RESOURCE_DISABLE_TOGGLE: {
          if (state.selectedResource) {
            toggleResourceDisable(state.selectedResource);
          }
          break;
        }
        case Commands.RELOAD_RESOURCE: {
          if (state.selectedResource) {
            triggerResource(state.selectedResource);
          }
          break;
        }
        case Commands.CLEAR_LOGS: {
          // Clear logs is now handled by removing spans in logstore2
          // For now, this is a no-op - can implement later if needed
          break;
        }
      }
    },
    isFocused,
  );

  return (
    <box
      flexDirection="column"
      backgroundColor={theme.background}
      flexGrow={1}
      margin={1}
      marginLeft={0}
      paddingLeft={isFocused() ? 0 : 1}
      {...focusBorder(theme, isFocused())}
    >
      {/* Sticky header */}
      <PaneHeader title={`Logs: ${state.selectedResource ?? ""}`}>
        <Show when={autoScroll()}>
          <text fg={theme.success} flexShrink={0}>
            {" "}
            [follow]
          </text>
        </Show>
        <Show when={!showTimestamps()}>
          <text fg={theme.textMuted} flexShrink={0}>
            {" "}
            [no timestamps]
          </text>
        </Show>
      </PaneHeader>

      {/* Logs buffer */}
      <box marginLeft={1} flexGrow={1}>
        <Show
          when={state.selectedResource}
          fallback={
            <text fg={theme.textMuted}>Select a resource to view logs.</text>
          }
        >
          <LogView />
        </Show>
      </box>

      {/* Sticky footer */}
      <box flexShrink={0}>
        <Footer />
      </box>
    </box>
  );
}
