// LogBufferView - High-performance log rendering using FrameBufferRenderable
//
// Replaces JSX-based log rendering with direct character drawing for:
// - Constant-time rendering regardless of log count
// - Word-aware line wrapping with continuation indicators
// - ANSI color preservation
// - Virtual scrolling with custom scrollbar

import { BoxRenderable, FrameBufferRenderable, RGBA } from "@opentui/core";
import { useRenderer, onResize } from "@opentui/solid";
import {
  createSignal,
  createEffect,
  createMemo,
  onMount,
  onCleanup,
  on,
  type JSX,
} from "solid-js";
import { LogBuffer, type VisibleRow } from "./log-buffer";
import { parseAnsi } from "../utils/ansi-parser";
import type LogStore from "../tilt/logstore2";
import { LogUpdateAction, type LogUpdateEvent } from "../tilt/logstore2";
import { Theme } from "../theme/theme";
import debug from "debug";

const debugLog = debug("tilt-tui:logview");

export interface LogBufferViewProps {
  /** The log store to read logs from */
  logStore: LogStore;
  /** Accessor for the current manifest/resource name to display logs for */
  manifestName: () => string | null;
  /** Theme for colors */
  theme: Theme;
  /** Whether to show timestamps */
  showTimestamps: () => boolean;
  /** Callback when auto-scroll state changes */
  onAutoScrollChange?: (autoScroll: boolean) => void;
}

export interface LogBufferViewRef {
  /** Scroll by a relative amount (positive = down) */
  scrollBy: (delta: number) => void;
  /** Scroll to an absolute position */
  scrollTo: (position: number) => void;
  /** Scroll to the top */
  scrollToTop: () => void;
  /** Scroll to the bottom and enable auto-scroll */
  scrollToBottom: () => void;
  /** Toggle auto-scroll mode */
  toggleAutoScroll: () => void;
  /** Current auto-scroll state */
  readonly autoScroll: boolean;
  /** Current scroll position in display rows */
  readonly scrollTop: number;
  /** Total height in display rows */
  readonly scrollHeight: number;
  /** Viewport height in rows */
  readonly height: number;
}

/**
 * High-performance log view using FrameBufferRenderable.
 *
 * Returns a tuple of [Component, Ref] for use in parent components.
 * The ref provides scroll control methods.
 *
 * @example
 * ```tsx
 * const [LogView, logRef] = LogBufferView({
 *   logStore,
 *   manifestName: () => selectedResource,
 *   theme,
 *   showTimestamps: () => showTimestamps(),
 * });
 *
 * // Use in JSX
 * <LogView />
 *
 * // Control scrolling
 * logRef.scrollBy(1);
 * ```
 */
interface Dimensions {
  width: number;
  height: number;
}

export function LogBufferView(
  props: LogBufferViewProps,
): [() => JSX.Element, LogBufferViewRef] {
  const renderer = useRenderer();

  // Viewport dimensions - updated on mount and resize (single signal to avoid double triggers)
  const [dimensions, setDimensions] = createSignal<Dimensions>({
    width: 80,
    height: 20,
  });

  // Trigger re-renders when buffer state changes
  const [renderVersion, setRenderVersion] = createSignal(0);

  // The LogBuffer manages virtual scrolling and line wrapping
  const buffer = new LogBuffer();

  // FrameBuffer for direct character rendering
  let frameBuffer: FrameBufferRenderable | null = null;

  // Container element reference for size tracking
  let containerEl: BoxRenderable | null = null;

  // Pre-compute colors from theme
  const colors = createMemo(() => ({
    bg: RGBA.fromHex(props.theme.background),
    text: RGBA.fromHex(props.theme.text),
    textMuted: RGBA.fromHex(props.theme.textMuted),
    warn: RGBA.fromHex(props.theme.warning),
    error: RGBA.fromHex(props.theme.error),
    accent: RGBA.fromHex(props.theme.accent),
    scrollTrack: RGBA.fromHex(props.theme.textMuted),
    scrollThumb: RGBA.fromHex(props.theme.primary),
  }));

  /**
   * Get the color for a log level.
   */
  function getLevelColor(level: string): RGBA {
    switch (level) {
      case "WARN":
        return colors().warn;
      case "ERROR":
        return colors().error;
      default:
        return colors().text;
    }
  }

  /**
   * Create or recreate the FrameBuffer with current dimensions.
   */
  function createFrameBuffer(): void {
    if (frameBuffer) {
      frameBuffer.destroy();
    }

    const { width: w, height: h } = dimensions();

    if (w <= 0 || h <= 0) return;

    frameBuffer = new FrameBufferRenderable(renderer, {
      id: `log-buffer-${props.manifestName() ?? "default"}-${Date.now()}`,
      width: w,
      height: h,
      flexGrow: 1,
    });

    buffer.width = w;
    buffer.height = h;

    if (containerEl) {
      containerEl.add(frameBuffer);
    }

    renderVisibleLines();
  }

  /**
   * Handle log store updates via callback.
   * This bridges logstore2's callback-based updates to SolidJS reactivity.
   */
  function handleLogUpdate(e: LogUpdateEvent): void {
    const name = props.manifestName();
    if (!name) return;

    if (e.action === LogUpdateAction.truncate) {
      // Full reset - logs were truncated, all checkpoints invalidated
      buffer.clear();
    }

    // Fetch new/updated lines incrementally
    const patch = props.logStore.manifestLogPatchSet(name, buffer.checkpoint);
    if (patch.lines.length > 0 || e.action === LogUpdateAction.truncate) {
      buffer.appendLines(patch.lines);
      buffer.checkpoint = patch.checkpoint;
      setRenderVersion((v) => v + 1);
    }
  }

  // Setup on mount
  onMount(() => {
    // Subscribe to logstore2 updates
    props.logStore.addUpdateListener(handleLogUpdate);

    // Initial load of existing logs
    const name = props.manifestName();
    if (name) {
      const patch = props.logStore.manifestLogPatchSet(name, 0);
      if (patch.lines.length > 0) {
        buffer.appendLines(patch.lines);
        buffer.checkpoint = patch.checkpoint;
        debugLog("onMount: loaded %d lines for %s", patch.lines.length, name);
      }
    }

    // Don't create frame buffer here - wait for ref callback with dimensions
    // createFrameBuffer() will be called from the ref callback when containerEl is set
  });

  // Cleanup on unmount
  onCleanup(() => {
    props.logStore.removeUpdateListener(handleLogUpdate);

    if (frameBuffer) {
      frameBuffer.destroy();
      frameBuffer = null;
    }
  });

  // Handle terminal resize
  onResize((newWidth, newHeight) => {
    if (containerEl) {
      // Get actual container dimensions from layout
      const el = containerEl;

      // re-flow buffer after a delay. the initial containerEl size doesn't
      // immediately update in the scope of this event handler.
      setTimeout(() => {
        const w = el.width ?? newWidth;
        const h = el.height ?? newHeight;
        const current = dimensions();

        if (w > 0 && h > 0 && (w !== current.width || h !== current.height)) {
          setDimensions({ width: w, height: h });
          buffer.resize(w, h);

          if (frameBuffer) {
            frameBuffer.frameBuffer.resize(w, h);
          }

          setRenderVersion((v) => v + 1);
        }
      }, 100);
    }
  });

  // Reset when manifest changes
  createEffect(
    on(
      () => props.manifestName(),
      (name) => {
        buffer.clear();

        // Load logs for new manifest
        if (name) {
          const patch = props.logStore.manifestLogPatchSet(name, 0);
          if (patch.lines.length > 0) {
            buffer.appendLines(patch.lines);
            buffer.checkpoint = patch.checkpoint;
          }
        }

        setRenderVersion((v) => v + 1);
      },
    ),
  );

  // Handle timestamp toggle
  createEffect(
    on(
      () => props.showTimestamps(),
      (show) => {
        buffer.showTimestamps = show;
        setRenderVersion((v) => v + 1);
      },
    ),
  );

  // Render when version changes
  createEffect(
    on(renderVersion, () => {
      renderVisibleLines();
    }),
  );

  /**
   * Render visible log lines to the FrameBuffer.
   * This is O(viewport height), not O(total lines).
   */
  function renderVisibleLines(): void {
    if (!frameBuffer) return;

    const fb = frameBuffer.frameBuffer;
    const { width: w, height: h } = dimensions();
    const c = colors();

    // Clear buffer with background color
    fb.fillRect(0, 0, w, h, c.bg);

    // Get visible rows from LogBuffer
    const rows = buffer.getVisibleRows();

    // Draw each row
    for (let y = 0; y < h && y < rows.length; y++) {
      const row = rows[y];
      drawRow(fb, row, y, w, c);
    }

    // Draw scrollbar in rightmost column
    drawScrollbar(fb, w, h, c);
  }

  /**
   * Draw a single row to the FrameBuffer.
   */
  function drawRow(
    fb: any,
    row: VisibleRow,
    y: number,
    w: number,
    c: ReturnType<typeof colors>,
  ): void {
    if (row.isContinuation) {
      // Draw continuation indicator in accent color
      fb.drawText("↳", 0, y, c.accent, c.bg);
      // Draw rest of line dimmed, preserving ANSI colors
      drawAnsiText(fb, row.text.slice(2), 2, y, c.textMuted, c.bg, true, w);
    } else {
      // Draw normal line with level color as default
      const levelColor = getLevelColor(row.level);
      drawAnsiText(fb, row.text, 0, y, levelColor, c.bg, false, w);
    }
  }

  /**
   * Draw text with ANSI color codes to the FrameBuffer.
   */
  function drawAnsiText(
    fb: any,
    text: string,
    startX: number,
    y: number,
    defaultFg: RGBA,
    bg: RGBA,
    dimmed: boolean,
    maxWidth: number,
  ): void {
    const segments = parseAnsi(text);
    let x = startX;
    const c = colors();

    for (const segment of segments) {
      let fg = segment.fg ?? defaultFg;

      // Apply dimming for continuation lines
      if (dimmed && !segment.fg) {
        fg = c.textMuted;
      }

      // Apply dim attribute from ANSI
      if (segment.dim) {
        fg = c.textMuted;
      }

      for (const char of segment.text) {
        // Reserve rightmost column for scrollbar
        if (x >= maxWidth - 1) break;
        fb.setCell(x, y, char, fg, bg);
        x++;
      }
    }
  }

  /**
   * Draw the scrollbar in the rightmost column.
   */
  function drawScrollbar(
    fb: any,
    w: number,
    h: number,
    c: ReturnType<typeof colors>,
  ): void {
    const totalRows = buffer.scrollHeight;

    // No scrollbar needed if content fits in viewport
    if (totalRows <= h) return;

    const scrollbarX = w - 1;

    // Calculate thumb size and position
    const thumbRatio = h / totalRows;
    const thumbSize = Math.max(1, Math.floor(h * thumbRatio));
    const maxScrollTop = Math.max(1, totalRows - h);
    const thumbPos = Math.floor(
      (buffer.scrollTop / maxScrollTop) * (h - thumbSize),
    );

    // Draw scrollbar track and thumb
    for (let y = 0; y < h; y++) {
      const isThumb = y >= thumbPos && y < thumbPos + thumbSize;
      const char = isThumb ? "█" : "░";
      const color = isThumb ? c.scrollThumb : c.scrollTrack;
      fb.setCell(scrollbarX, y, char, color, c.bg);
    }
  }

  // --- Ref API for external control ---

  const ref: LogBufferViewRef = {
    scrollBy: (delta: number) => {
      buffer.scrollBy(delta);
      props.onAutoScrollChange?.(buffer.autoScroll);
      setRenderVersion((v) => v + 1);
    },

    scrollTo: (position: number) => {
      buffer.scrollTo(position);
      props.onAutoScrollChange?.(buffer.autoScroll);
      setRenderVersion((v) => v + 1);
    },

    scrollToTop: () => {
      buffer.scrollToTop();
      props.onAutoScrollChange?.(buffer.autoScroll);
      setRenderVersion((v) => v + 1);
    },

    scrollToBottom: () => {
      buffer.scrollToBottom();
      props.onAutoScrollChange?.(buffer.autoScroll);
      setRenderVersion((v) => v + 1);
    },

    toggleAutoScroll: () => {
      buffer.autoScroll = !buffer.autoScroll;
      props.onAutoScrollChange?.(buffer.autoScroll);
      setRenderVersion((v) => v + 1);
    },

    get autoScroll() {
      return buffer.autoScroll;
    },

    get scrollTop() {
      return buffer.scrollTop;
    },

    get scrollHeight() {
      return buffer.scrollHeight;
    },

    get height() {
      return buffer.height;
    },
  };

  // --- Component ---

  function Component() {
    // Track if we've initialized
    let initialized = false;

    // Try to initialize with element dimensions
    const tryInitialize = (el: BoxRenderable) => {
      if (initialized) return;

      const w = el.width;
      const h = el.height;

      // Only proceed if we have real computed dimensions
      if (w && h && w > 0 && h > 0) {
        debugLog("Initializing with dimensions: %dx%d", w, h);
        setDimensions({ width: w, height: h });
        buffer.resize(w, h);

        createFrameBuffer();
        initialized = true;

        // Trigger initial render
        setRenderVersion((v) => v + 1);
      } else {
        // Layout not computed yet, schedule a retry
        debugLog("Dimensions not ready: %dx%d, retrying...", w, h);
        setTimeout(() => {
          if (containerEl) {
            tryInitialize(containerEl);
          }
        }, 16); // Try again next frame
      }
    };

    return (
      <box flexGrow={1} flexDirection="column">
        <box
          ref={(el: BoxRenderable) => {
            containerEl = el;
            if (el) {
              tryInitialize(el);
            }
          }}
          flexGrow={1}
        />
      </box>
    );
  }

  return [Component, ref];
}
