// Logs component - log viewer with auto-scroll

import {
  createSignal,
  createMemo,
  For,
  Show,
  createEffect,
  on,
} from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTilt } from "../context/tilt";
import { useFocus } from "../context/focus";
import { defaultTheme, type Theme, logLevelColor } from "../theme/theme";

export function Logs() {
  const { state } = useTilt();
  const { state: focusState } = useFocus();
  const theme = defaultTheme;

  const [autoScroll, setAutoScroll] = createSignal(true);
  const [xOffset, setXOffset] = createSignal(0);

  // Reference to scrollbox for programmatic control
  let scrollRef: ScrollBoxRenderable | undefined;

  const isFocused = createMemo(() => focusState.activePane === "logs");

  const logs = createMemo(() => {
    const resourceName = state.selectedResource;
    if (!resourceName) return [];
    return state.logs[resourceName] ?? [];
  });

  // Reset scroll position when resource changes
  createEffect(
    on(
      () => state.selectedResource,
      () => {
        setAutoScroll(true);
        setXOffset(0);
        if (scrollRef) {
          scrollRef.scrollTo(scrollRef.scrollHeight);
        }
      },
    ),
  );

  // Keyboard handling
  useKeyboard((key) => {
    if (!isFocused()) return;

    switch (key.name) {
      case "j":
      case "down":
        key.preventDefault();
        setAutoScroll(false);
        if (scrollRef) {
          scrollRef.scrollBy(1);
        }
        break;
      case "k":
      case "up":
        key.preventDefault();
        setAutoScroll(false);
        if (scrollRef) {
          scrollRef.scrollBy(-1);
        }
        break;
      case "g":
        key.preventDefault();
        if (key.shift) {
          // Shift+g (G) - go to bottom
          setAutoScroll(true);
          if (scrollRef) {
            scrollRef.scrollTo(scrollRef.scrollHeight);
          }
        } else {
          // g - go to top
          setAutoScroll(false);
          if (scrollRef) {
            scrollRef.scrollTo(0);
          }
        }
        break;
      case "h":
      case "left":
        key.preventDefault();
        setXOffset((x) => Math.max(0, x - 4));
        break;
      case "l":
      case "right":
        key.preventDefault();
        setXOffset((x) => x + 4);
        break;
      case "pageup":
        key.preventDefault();
        setAutoScroll(false);
        if (scrollRef) {
          scrollRef.scrollBy(-Math.floor(scrollRef.height / 2));
        }
        break;
      case "pagedown":
        key.preventDefault();
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
      case "f":
        key.preventDefault();
        setAutoScroll((s) => {
          const newVal = !s;
          if (newVal && scrollRef) {
            scrollRef.scrollTo(scrollRef.scrollHeight);
          }
          return newVal;
        });
        break;
    }
  });

  return (
    <box
      flexDirection="column"
      backgroundColor={theme.backgroundPane}
      flexGrow={1}
    >
      {/* Title - fixed */}
      <box paddingLeft={1} paddingRight={1} flexDirection="row" flexShrink={0}>
        <text fg={theme.primary} attributes={1} flexShrink={0}>
          Logs: {state.selectedResource ?? ""}
        </text>
        <Show when={autoScroll()}>
          <text fg={theme.success} flexShrink={0}>
            {" "}
            [follow]
          </text>
        </Show>
      </box>

      {/* Log content - scrollable */}
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        flexGrow={1}
        stickyScroll={autoScroll()}
        stickyStart="bottom"
      >
        <Show
          when={logs().length > 0}
          fallback={
            <box paddingLeft={1} flexDirection="row">
              <text fg={theme.textMuted}>
                No logs available. Select a resource to view logs.
              </text>
            </box>
          }
        >
          <For each={logs()}>
            {(entry) => (
              <LogLine entry={entry} theme={theme} xOffset={xOffset()} />
            )}
          </For>
        </Show>
      </scrollbox>
    </box>
  );
}

// Strip ANSI escape codes from text
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
}

function LogLine(props: {
  entry: { timestamp: Date; level: string; text: string };
  theme: Theme;
  xOffset: number;
}) {
  const timestamp = createMemo(() => {
    const t = props.entry.timestamp;
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
