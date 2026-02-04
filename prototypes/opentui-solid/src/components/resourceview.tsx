// ResourceView component - main content pane for selected resource
// Contains logs viewer with auto-scroll, will eventually include actions and details

import {
  createSignal,
  createMemo,
  For,
  Show,
  createEffect,
  on,
} from "solid-js";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTilt } from "../context/tilt";
import { useFocus } from "../context/focus";
import { useKeyHandler } from "../keyboard/useKeyHandler";
import { Commands } from "../commands";
import {
  defaultTheme,
  type Theme,
  logLevelColor,
  focusBorder,
} from "../theme/theme";
import { PaneHeader } from "./pane-header";
import { Footer } from "./footer";
import type { StoredLine } from "../tilt/logstore";

export function ResourceView() {
  const { state, logStore, triggerResource, toggleResourceDisable } = useTilt();
  const { state: focusState } = useFocus();
  const theme = defaultTheme;

  const [autoScroll, setAutoScroll] = createSignal(true);
  const [xOffset, setXOffset] = createSignal(0);

  // Checkpoint tracking for incremental log fetching
  const [checkpoint, setCheckpoint] = createSignal(0);
  const [renderedLines, setRenderedLines] = createSignal<StoredLine[]>([]);

  // Reference to scrollbox for programmatic control
  let scrollRef: ScrollBoxRenderable | undefined;

  const isFocused = createMemo(() => focusState.activePane === "resource");

  // Reset scroll position and checkpoint when resource changes
  createEffect(
    on(
      () => state.selectedResource,
      () => {
        setAutoScroll(true);
        setXOffset(0);
        setCheckpoint(0);
        setRenderedLines([]);
        // Reset scroll to top first - scrollbox will handle positioning
        if (scrollRef) {
          scrollRef.scrollTo(0);
        }
      },
    ),
  );

  // Fetch new log lines when logStore updates
  createEffect(() => {
    const resourceName = state.selectedResource;
    if (!resourceName) return;

    // Track logStore.version for reactivity
    logStore.version;

    const patch = logStore.manifestLogPatchSet(resourceName, checkpoint());
    if (patch.lines.length > 0) {
      setRenderedLines((prev) => [...prev, ...patch.lines]);
      setCheckpoint(patch.checkpoint);
    }
  });

  // Scroll to bottom when logs change and autoScroll is enabled
  createEffect(
    on(
      () => renderedLines().length,
      () => {
        if (autoScroll() && scrollRef) {
          scrollRef.scrollTo(scrollRef.scrollHeight);
        }
      },
    ),
  );

  // Keyboard handling - only active when focused
  useKeyHandler(
    "resource",
    (command) => {
      switch (command) {
        case Commands.NAV_DOWN:
          setAutoScroll(false);
          if (scrollRef) {
            scrollRef.scrollBy(1);
          }
          break;
        case Commands.NAV_UP:
          setAutoScroll(false);
          if (scrollRef) {
            scrollRef.scrollBy(-1);
          }
          break;
        case Commands.NAV_TOP:
          setAutoScroll(false);
          if (scrollRef) {
            scrollRef.scrollTo(0);
          }
          break;
        case Commands.NAV_BOTTOM:
          setAutoScroll(true);
          if (scrollRef) {
            scrollRef.scrollTo(scrollRef.scrollHeight);
          }
          break;
        case Commands.SCROLL_LEFT:
          setXOffset((x) => Math.max(0, x - 4));
          break;
        case Commands.SCROLL_RIGHT:
          setXOffset((x) => x + 4);
          break;
        case Commands.SCROLL_PAGEUP:
          setAutoScroll(false);
          if (scrollRef) {
            scrollRef.scrollBy(-Math.floor(scrollRef.height / 2));
          }
          break;
        case Commands.SCROLL_PAGEDOWN:
          if (scrollRef) {
            scrollRef.scrollBy(Math.floor(scrollRef.height / 2));
            // Check if at bottom
            if (
              scrollRef.scrollTop >=
              scrollRef.scrollHeight - scrollRef.height
            ) {
              setAutoScroll(true);
            }
          }
          break;
        case Commands.SCROLL_FOLLOW:
          setAutoScroll((s) => {
            const newVal = !s;
            if (newVal && scrollRef) {
              scrollRef.scrollTo(scrollRef.scrollHeight);
            }
            return newVal;
          });
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
      </PaneHeader>

      {/* Future: Resource header with status, actions will go here */}

      {/* Log content - scrollable, keyed by resource to force re-render */}
      <Show when={state.selectedResource} keyed>
        {(resourceName) => (
          <scrollbox
            ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
            flexGrow={1}
            stickyScroll={autoScroll()}
            stickyStart="bottom"
          >
            <For
              each={renderedLines()}
              fallback={
                <box paddingLeft={1} flexDirection="row">
                  <text fg={theme.textMuted}>
                    No logs available for {resourceName}.
                  </text>
                </box>
              }
            >
              {(entry) => (
                <LogLine entry={entry} theme={theme} xOffset={xOffset()} />
              )}
            </For>
          </scrollbox>
        )}
      </Show>

      {/* Sticky footer */}
      <box flexShrink={0}>
        <Footer />
      </box>
    </box>
  );
}

// Strip ANSI escape codes from text
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

function LogLine(props: { entry: StoredLine; theme: Theme; xOffset: number }) {
  const timestamp = createMemo(() => {
    const t = new Date(props.entry.time);
    return t.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  });

  const textColor = createMemo(() =>
    logLevelColor(props.theme, props.entry.level),
  );

  const displayText = createMemo(() => {
    // Strip ANSI codes and apply offset
    const text = stripAnsi(props.entry.text);
    if (props.xOffset <= 0) return text;
    return text.slice(props.xOffset);
  });

  // Combine timestamp and text into single line
  const fullLine = createMemo(() => `[${timestamp()}] ${displayText()}`);

  return (
    <box paddingLeft={1} flexDirection="row">
      <text fg={textColor()} wrapMode="none">
        {fullLine()}
      </text>
    </box>
  );
}
