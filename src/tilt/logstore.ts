// LogStore - Checkpoint-based log storage following Tilt web app's pattern
// Stores log segments from WebSocket, provides incremental patch sets for rendering

import { createSignal } from "solid-js";
import type { APILogList, APILogSegment, APISpan } from "./api-types";

/**
 * A processed log line ready for rendering.
 * Each segment becomes one StoredLine.
 */
export interface StoredLine {
  spanId: string;
  time: string;
  text: string;
  level: string;
  manifestName: string;
  storedLineIndex: number;
}

/**
 * A set of log lines with a checkpoint for incremental fetching.
 * Components use the returned checkpoint for their next fetch.
 */
export interface LogPatchSet {
  lines: StoredLine[];
  checkpoint: number;
}

/**
 * Central log storage with checkpoint-based incremental updates.
 *
 * The LogStore tracks:
 * - Raw segments received from the WebSocket
 * - Span metadata (maps spanId -> manifestName)
 * - Processed lines for rendering
 * - A global checkpoint of ingested data
 *
 * Components call manifestLogPatchSet() with their local checkpoint
 * to get only new lines since their last read.
 *
 * Uses a SolidJS signal for reactivity - components can track `version`
 * to re-run effects when new logs arrive.
 */
export class LogStore {
  // Track which segments we've received from server
  checkpoint: number = 0;

  // Raw segments storage
  private segments: APILogSegment[] = [];

  // Span metadata (maps spanId -> manifestName)
  private spans: Map<string, string> = new Map();

  // Processed lines (each segment becomes one line)
  private lines: StoredLine[] = [];

  // SolidJS signal for reactivity - components track this
  private _version: ReturnType<typeof createSignal<number>>;

  constructor() {
    this._version = createSignal(0);
  }

  /**
   * Accessor for reactive version tracking.
   * Components should read this in effects to trigger on log updates.
   */
  get version(): number {
    return this._version[0]();
  }

  private bumpVersion(): void {
    this._version[1]((v) => v + 1);
  }

  /**
   * Append new logs from WebSocket.
   * Handles checkpoint-based deduplication - if the server re-sends
   * segments we've already processed, they're skipped.
   */
  append(logList: APILogList): void {
    const fromCheckpoint = logList.fromCheckpoint ?? 0;
    const toCheckpoint = logList.toCheckpoint ?? 0;
    let newSegments = logList.segments ?? [];

    // Skip if this is invalid data
    if (fromCheckpoint < 0) return;

    // Server re-sending segments we already have - slice them off
    if (fromCheckpoint < this.checkpoint) {
      const deleteCount = this.checkpoint - fromCheckpoint;
      newSegments = newSegments.slice(deleteCount);
    }

    // Update checkpoint
    if (toCheckpoint > this.checkpoint) {
      this.checkpoint = toCheckpoint;
    }

    // Process span metadata
    const spans = logList.spans ?? {};
    for (const [spanId, span] of Object.entries(spans) as [
      string,
      APISpan | null,
    ][]) {
      if (!span?.manifestName) {
        console.error("no manifest for span", span);
        continue;
      }

      if (span && !this.spans.has(spanId)) {
        this.spans.set(spanId, span.manifestName);
      }
    }

    // Process segments into lines
    for (const segment of newSegments) {
      this.segments.push(segment);

      if (!segment.spanId) {
        console.error("log segment missing spanid", segment);
        continue;
      }

      const manifestName = this.spans.get(segment.spanId) ?? "";
      const line: StoredLine = {
        spanId: segment.spanId,
        time: segment.time,
        text: segment.text.replace(/\n$/, ""), // Strip trailing newline
        level: segment.level,
        manifestName,
        storedLineIndex: this.lines.length,
      };
      this.lines.push(line);
    }

    if (newSegments.length > 0) {
      this.bumpVersion();
    }
  }

  /**
   * Get all logs since a checkpoint.
   * Returns lines from checkpoint to end, plus the new checkpoint.
   */
  allLogPatchSet(fromCheckpoint: number): LogPatchSet {
    const lines =
      fromCheckpoint < this.lines.length
        ? this.lines.slice(fromCheckpoint)
        : [];
    return {
      lines,
      checkpoint: this.lines.length,
    };
  }

  /**
   * Get logs for a specific manifest/resource since a checkpoint.
   * This is the main method used by ResourceView components.
   */
  manifestLogPatchSet(
    manifestName: string,
    fromCheckpoint: number,
  ): LogPatchSet {
    const lines: StoredLine[] = [];

    // Scan from fromCheckpoint to find lines matching this manifest
    for (let i = fromCheckpoint; i < this.lines.length; i++) {
      if (this.lines[i].manifestName === manifestName) {
        lines.push(this.lines[i]);
      }
    }

    return {
      lines,
      checkpoint: this.lines.length,
    };
  }

  /**
   * Get all lines for a manifest (for initial load).
   */
  manifestLog(manifestName: string): StoredLine[] {
    return this.lines.filter((line) => line.manifestName === manifestName);
  }

  removeLines(_lines: StoredLine[]): void {
    throw new Error("implement");
  }

  /**
   * Get the total number of stored lines.
   */
  get lineCount(): number {
    return this.lines.length;
  }

  /**
   * Clear all logs (e.g., on reconnect).
   */
  clear(): void {
    this.segments = [];
    this.spans.clear();
    this.lines = [];
    this.checkpoint = 0;
    this.bumpVersion();
  }
}
