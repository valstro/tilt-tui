// LogBuffer - Manages log lines and virtual scrolling for FrameBuffer rendering
//
// This class handles:
// - Word-aware line wrapping with continuation indicators
// - Virtual scrolling (only renders visible rows)
// - Timestamp toggle support
// - Auto-scroll (follow) mode

import type { LogLine } from "../tilt/types";
import { displayWidth } from "../utils/ansi-parser";

/**
 * A wrapped line with its display rows and source reference.
 */
interface WrappedLine {
  /** Reference to the original LogLine from logstore2 */
  line: LogLine;
  /** Pre-computed display rows (including continuation prefixes) */
  displayRows: string[];
  /** The starting virtual row index for this line */
  startRow: number;
}

/**
 * A single row visible in the viewport.
 */
export interface VisibleRow {
  /** The text to display (may include continuation prefix) */
  text: string;
  /** The log level for coloring (INFO, WARN, ERROR) */
  level: string;
  /** Whether this row is a continuation of the previous line */
  isContinuation: boolean;
  /** Reference to the source LogLine */
  line: LogLine;
}

/**
 * Manages log lines with word-aware wrapping and virtual scrolling.
 *
 * Design principles:
 * - Stores references to LogLine objects (owned by logstore2, not copied)
 * - Pre-computes wrapped rows for efficient scrolling
 * - Only returns rows visible in the current viewport
 * - Supports timestamp toggling with rewrap
 */
export class LogBuffer {
  /** References to LogLine objects from logstore2 */
  private lines: LogLine[] = [];

  /** Pre-computed wrapped lines with display rows */
  private wrappedLines: WrappedLine[] = [];

  /** Total number of display rows (sum of all wrapped row counts) */
  private totalDisplayRows: number = 0;

  /** Current scroll position (in display rows, not lines) */
  private _scrollTop: number = 0;

  /** Whether to auto-scroll to bottom when new lines are appended */
  private _autoScroll: boolean = true;

  /** Whether to show timestamps in the output */
  private _showTimestamps: boolean = true;

  /** Checkpoint for incremental updates from LogStore */
  checkpoint: number = 0;

  /** Viewport width in characters */
  width: number = 80;

  /** Viewport height in rows */
  height: number = 24;

  // Constants
  private readonly CONTINUATION_PREFIX = "↳ ";
  private readonly CONTINUATION_PREFIX_WIDTH = 2;

  // --- Public API ---

  /**
   * Toggle timestamp display. Triggers full rewrap of all lines.
   */
  get showTimestamps(): boolean {
    return this._showTimestamps;
  }

  set showTimestamps(value: boolean) {
    if (this._showTimestamps !== value) {
      this._showTimestamps = value;
      this.recalculateWrapping();
    }
  }

  resize(w: number, h: number): void {
    this.width = w;
    this.height = h;
    this.recalculateWrapping();
  }

  /**
   * Append new lines from LogStore patch.
   * Only wraps new lines - O(m) where m = new lines count.
   * Stores references to LogLine objects (does not copy).
   */
  appendLines(newLines: LogLine[]): void {
    for (const line of newLines) {
      const displayRows = this.wrapLine(line);
      this.wrappedLines.push({
        line,
        displayRows,
        startRow: this.totalDisplayRows,
      });
      this.totalDisplayRows += displayRows.length;
      this.lines.push(line);
    }

    if (this._autoScroll) {
      this.scrollToBottom();
    }
  }

  /**
   * Clear all lines and reset state.
   * Call this when switching resources or on truncation events.
   */
  clear(): void {
    this.lines = [];
    this.wrappedLines = [];
    this.totalDisplayRows = 0;
    this._scrollTop = 0;
    this.checkpoint = 0;
  }

  /**
   * Recalculate wrapping for all lines.
   * Call this when viewport width or timestamp visibility changes.
   */
  recalculateWrapping(): void {
    this.wrappedLines = [];
    this.totalDisplayRows = 0;

    for (const line of this.lines) {
      const displayRows = this.wrapLine(line);
      this.wrappedLines.push({
        line,
        displayRows,
        startRow: this.totalDisplayRows,
      });
      this.totalDisplayRows += displayRows.length;
    }

    // Clamp scroll position to valid range after rewrap
    this.scrollTo(this._scrollTop);
  }

  /**
   * Get rows currently visible in the viewport.
   * Returns an array of VisibleRow objects with text, level, and continuation info.
   * Uses binary search to find the starting line - O(log n + viewport) instead of O(n).
   */
  getVisibleRows(): VisibleRow[] {
    const result: VisibleRow[] = [];

    if (this.wrappedLines.length === 0) {
      return result;
    }

    // Binary search to find the first wrapped line that contains visible rows
    const startIdx = this.findFirstVisibleLineIndex(this._scrollTop);

    for (let i = startIdx; i < this.wrappedLines.length; i++) {
      const wrapped = this.wrappedLines[i];

      for (let j = 0; j < wrapped.displayRows.length; j++) {
        const displayRow = wrapped.startRow + j;

        // Skip rows before viewport
        if (displayRow < this._scrollTop) {
          continue;
        }

        // Stop if past viewport
        if (displayRow >= this._scrollTop + this.height) {
          return result;
        }

        result.push({
          text: wrapped.displayRows[j],
          level: wrapped.line.level,
          isContinuation: j > 0,
          line: wrapped.line,
        });
      }

      // Early exit if we've filled the viewport
      if (result.length >= this.height) {
        return result;
      }
    }

    return result;
  }

  /**
   * Binary search to find the index of the first wrapped line that contains
   * rows at or after the given scrollTop position.
   */
  private findFirstVisibleLineIndex(scrollTop: number): number {
    if (this.wrappedLines.length === 0) return 0;

    let lo = 0;
    let hi = this.wrappedLines.length - 1;

    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const wrapped = this.wrappedLines[mid];
      const endRow = wrapped.startRow + wrapped.displayRows.length;

      if (endRow <= scrollTop) {
        // This line ends before the viewport, search later
        lo = mid + 1;
      } else {
        // This line contains or is after the viewport start
        hi = mid;
      }
    }

    return lo;
  }

  // --- Scroll API ---

  /**
   * Scroll to an absolute position (in display rows).
   * Position is clamped to valid range.
   */
  scrollTo(position: number): void {
    const maxScroll = Math.max(0, this.totalDisplayRows - this.height);
    this._scrollTop = Math.max(0, Math.min(position, maxScroll));
    // Auto-scroll is enabled when we're at or near the bottom
    this._autoScroll = this._scrollTop >= maxScroll;
  }

  /**
   * Scroll by a relative amount (positive = down, negative = up).
   */
  scrollBy(delta: number): void {
    this.scrollTo(this._scrollTop + delta);
  }

  /**
   * Scroll to the bottom and enable auto-scroll.
   */
  scrollToBottom(): void {
    this.scrollTo(this.totalDisplayRows);
  }

  /**
   * Scroll to the top and disable auto-scroll.
   */
  scrollToTop(): void {
    this.scrollTo(0);
    this._autoScroll = false;
  }

  // --- Properties ---

  /** Current scroll position in display rows */
  get scrollTop(): number {
    return this._scrollTop;
  }

  /** Total height in display rows (accounts for wrapping) */
  get scrollHeight(): number {
    return this.totalDisplayRows;
  }

  /** Whether auto-scroll is enabled */
  get autoScroll(): boolean {
    return this._autoScroll;
  }

  set autoScroll(value: boolean) {
    this._autoScroll = value;
    if (value) {
      this.scrollToBottom();
    }
  }

  /** Number of original log lines (not display rows) */
  get lineCount(): number {
    return this.lines.length;
  }

  // --- Private Implementation ---

  /**
   * Wrap a line at word boundaries when possible.
   * Falls back to character wrap if a single word exceeds available width.
   */
  private wrapLine(line: LogLine): string[] {
    const prefix = this.getLinePrefix(line);
    const text = line.text;
    const fullLine = prefix + text;

    // Reserve 1 char for scrollbar
    const availableWidth = this.width - 1;

    // If line fits, no wrapping needed
    if (displayWidth(fullLine) <= availableWidth) {
      return [fullLine];
    }

    const rows: string[] = [];
    const continuationWidth = availableWidth - this.CONTINUATION_PREFIX_WIDTH;

    // First row gets full width
    const firstResult = this.wrapAtWord(fullLine, availableWidth);
    rows.push(firstResult.wrapped);
    let remaining = firstResult.remaining;

    // Continuation rows get reduced width (for ↳ prefix)
    while (remaining.length > 0) {
      const result = this.wrapAtWord(remaining, continuationWidth);
      rows.push(this.CONTINUATION_PREFIX + result.wrapped);
      remaining = result.remaining;
    }

    return rows;
  }

  /**
   * Wrap text at word boundary, falling back to character wrap.
   * Returns the wrapped portion and the remaining text.
   */
  private wrapAtWord(
    text: string,
    maxWidth: number,
  ): { wrapped: string; remaining: string } {
    // If text fits, return it all
    if (displayWidth(text) <= maxWidth) {
      return { wrapped: text, remaining: "" };
    }

    // Find the last space within maxWidth, accounting for ANSI codes
    let breakPoint = -1;
    let currentWidth = 0;
    let lastCharIndex = 0;
    let inEscape = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Handle ANSI escape sequences - don't count them in width
      if (char === "\x1B") {
        inEscape = true;
        continue;
      }
      if (inEscape) {
        // End of SGR sequence
        if (char === "m") {
          inEscape = false;
        }
        continue;
      }

      // We've exceeded the width, stop here
      if (currentWidth >= maxWidth) {
        break;
      }

      // Track word boundaries
      if (char === " ") {
        breakPoint = i;
      }

      currentWidth++;
      lastCharIndex = i + 1;
    }

    // If no space found or space is at start, fall back to character wrap
    if (breakPoint <= 0) {
      return {
        wrapped: text.slice(0, lastCharIndex),
        remaining: text.slice(lastCharIndex),
      };
    }

    // Word wrap at space (skip the space itself)
    return {
      wrapped: text.slice(0, breakPoint),
      remaining: text.slice(breakPoint + 1),
    };
  }

  /**
   * Get the line prefix (timestamp if enabled).
   */
  private getLinePrefix(line: LogLine): string {
    if (!this._showTimestamps) {
      return "";
    }
    const timestamp = this.formatTimestamp(line.time);
    return `[${timestamp}] `;
  }

  /**
   * Format a timestamp string for display.
   */
  private formatTimestamp(time: string | undefined): string {
    if (!time) {
      return "??:??:??";
    }
    try {
      const t = new Date(time);
      return t.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return "??:??:??";
    }
  }
}
