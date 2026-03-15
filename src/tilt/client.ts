// Tilt API Client - TypeScript translation from Go

import { parseArgs } from "util";
import type {
  APIViewResponse,
  APILogList,
  APIButton,
  APIInputStatus,
  APIFileWatchList,
} from "./api-types";
import type { Resource, LogEntry } from "./types";
import { resourceFromAPIResource as convertResource } from "./types";
import {
  resource,
  createSignal,
  action,
  call,
  type Operation,
  type Stream,
  type Signal,
} from "effection";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 10350;

export interface TiltClientOptions {
  host?: string;
  port?: number;
}

export interface ResourcesUpdate {
  resources: Resource[];
}

export interface ButtonsUpdate {
  buttons: APIButton[];
}

export interface SessionUpdate {
  tiltStartTime: string;
}

/** @deprecated Use ResourcesUpdate instead */
export type TiltData = ResourcesUpdate;

/** Logs update from WebSocket */
export interface LogsUpdate {
  logList: APILogList;
  /** Parsed log entries keyed by resource name */
  entries: Map<string, LogEntry[]>;
}

/** Combined streams returned by useTiltStreams() */
export interface TiltStreams {
  resources: Stream<ResourcesUpdate, void>;
  buttons: Stream<ButtonsUpdate, void>;
  logs: Stream<LogsUpdate, void>;
  session: Stream<SessionUpdate, void>;
}

export class TiltClient {
  private baseURL: string;
  private wsURL: string;

  constructor(options: TiltClientOptions = {}) {
    const host = options.host ?? DEFAULT_HOST;
    const port = options.port ?? DEFAULT_PORT;
    this.baseURL = `http://${host}:${port}`;
    this.wsURL = `ws://${host}:${port}`;
  }

  /**
   * Get the websocket token for authentication
   */
  private async getWebsocketToken(): Promise<string> {
    const response = await fetch(`${this.baseURL}/api/websocket_token`);
    if (!response.ok) {
      throw new Error(`Failed to get websocket token: ${response.status}`);
    }
    return response.text();
  }

  /**
   * Get the WebSocket URL with authentication token.
   * This is an Effection operation that fetches the token.
   */
  private *getWebSocketURL(): Operation<string> {
    const token: string = yield* call(() => this.getWebsocketToken());
    return `${this.wsURL}/ws/view?csrf=${encodeURIComponent(token)}`;
  }

  /**
   * Create two subscription-based streams from a single WebSocket connection.
   *
   * Returns an Operation that yields TiltStreams with:
   * - `resources`: Subscription for resource/button updates
   * - `logs`: Subscription for log updates
   *
   * Both subscriptions share the same WebSocket connection. The connection
   * is automatically closed when the operation's scope exits (structured concurrency).
   *
   * Usage with Effection:
   * ```
   * const streams = yield* client.useTiltStreams();
   *
   * yield* spawn(function*() {
   *   for (const update of yield* each(streams.resources)) {
   *     // handle resources serially
   *     yield* each.next();
   *   }
   * });
   *
   * yield* spawn(function*() {
   *   for (const update of yield* each(streams.logs)) {
   *     // handle logs serially
   *     yield* each.next();
   *   }
   * });
   *
   * yield* suspend(); // keep alive until scope exits
   * ```
   */
  *useTiltStreams(): Operation<TiltStreams> {
    const wsURL: string = yield* this.getWebSocketURL();

    return yield* resource<TiltStreams>(function* (provide) {
      // Create two signals - one for resources, one for logs
      const resourcesSignal: Signal<ResourcesUpdate, void> = createSignal<
        ResourcesUpdate,
        void
      >();
      const logsSignal: Signal<LogsUpdate, void> = createSignal<
        LogsUpdate,
        void
      >();
      const buttonsSignal: Signal<ButtonsUpdate, void> = createSignal<
        ButtonsUpdate,
        void
      >();
      const sessionSignal: Signal<SessionUpdate, void> = createSignal<
        SessionUpdate,
        void
      >();

      const ws = new WebSocket(wsURL);

      ws.onmessage = (event) => {
        try {
          const viewResp: APIViewResponse = JSON.parse(event.data);

          if (viewResp.uiSession?.status.tiltfileKey) {
            console.log(
              "USING TILTFILE",
              viewResp.uiSession?.status.tiltfileKey,
            );
          }

          if (viewResp.uiSession?.status.tiltStartTime) {
            sessionSignal.send({
              tiltStartTime: viewResp.uiSession.status.tiltStartTime,
            });
          }

          if (viewResp.uiResources) {
            const resources = viewResp.uiResources.map(convertResource);
            resourcesSignal.send({
              resources,
            });
          }

          if (viewResp.uiButtons) {
            buttonsSignal.send({
              buttons: viewResp.uiButtons,
            });
          }

          // Send logs update if logList is present
          if (viewResp.logList) {
            const entries = parseLogList(viewResp.logList);
            logsSignal.send({
              logList: viewResp.logList,
              entries,
            });
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
        }
      };

      ws.onerror = () => {
        console.error("WebSocket error");
      };

      ws.onclose = () => {
        resourcesSignal.close();
        buttonsSignal.close();
        logsSignal.close();
        sessionSignal.close();
      };

      yield* waitForWebSocketOpen(ws);

      try {
        // Provide all subscriptions to the caller
        yield* provide({
          resources: resourcesSignal,
          buttons: buttonsSignal,
          logs: logsSignal,
          session: sessionSignal,
        });
      } finally {
        // Cleanup: close WebSocket when scope exits
        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          ws.close();
        }
      }
    });
  }

  async getTiltArgs(): Promise<Record<string, string | boolean | undefined>> {
    // use the following command to get tilt getTiltArgs
    // parse the args and return as a Record<string, string>
    //
    // ❯ EDITOR=cat tilt args
    // # edit args for the running Tilt here
    // --environment FOO --reset-nx-cache
    // Tilt is already running with those args -- no action taken

    const tiltBinary = Bun.which("tilt");
    if (!tiltBinary) {
      console.error("unable to locate tilt binary in your environment");
      return {};
    }

    const proc = Bun.spawn([tiltBinary, "args"], {
      env: {
        ...process.env,
        // tilt args will open interactive editor if you don't change it
        // cat will dump the contents of the temp file tilt args creates
        EDITOR: "cat",
        TILT_DISABLE_ANALYTICS: "true",
        DO_NOT_TRACK: "true",
      },

      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const errorOutput = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.error("tilt args failed", exitCode, output, errorOutput);
      return {};
    }

    // tilt args are on second line of output
    const argsLine = output.split("\n")[1];
    const args = argsLine.split(" ");

    // TODO: expected args as config?
    try {
      const tiltArgs = parseArgs({
        args,
        strict: false,
        options: {
          environment: {
            type: "string",
          },
          profile: {
            type: "string",
          },
        },
      });

      return {
        environment: tiltArgs.values.environment,
        profile: tiltArgs.values.profile,
      };
    } catch (e) {
      console.error("error parsing tilt args", e);
      return {};
    }
  }

  /**
   * Trigger a resource rebuild
   */
  async triggerResource(
    resourceName: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const body = JSON.stringify({
      manifest_names: [resourceName],
      build_reason: 16,
    });

    const response = await fetch(`${this.baseURL}/api/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to trigger resource: ${response.status}`);
    }
  }

  /**
   * Format a date for Tilt API (requires exactly 6 decimal places for microseconds)
   * e.g., "2024-01-15T10:30:00.000000Z"
   *
   * see https://github.com/tilt-dev/tilt/blob/master/web/src/tiltApi.ts#L6
   */
  private formatApiTime(date: Date): string {
    const iso = date.toISOString(); // "2024-01-15T10:30:00.123Z"
    // Replace milliseconds (.123Z) with microseconds (.123000Z)
    return iso.replace(/\.(\d{3})Z$/, ".$1000Z");
  }

  /**
   * Click a UI button
   * @param button - The full APIButton object (includes resourceVersion needed for updates)
   * @param inputValues - Optional input values for buttons with inputs
   * @returns The updated APIButton with new resourceVersion
   */
  async clickButton(
    button: APIButton,
    inputValues: Record<string, any> = {},
    signal?: AbortSignal,
  ): Promise<APIButton> {
    // Build input statuses from the button's input specs and provided values
    const inputStatuses: APIInputStatus[] = [];
    for (const spec of button.spec.inputs ?? []) {
      const name = spec.name;
      const value = inputValues[name];
      const defined = value !== undefined;

      const status: APIInputStatus = { name };

      if (spec.text) {
        status.text = {
          value: defined ? value : (spec.text.defaultValue ?? ""),
        };
      } else if (spec.bool) {
        status.bool = {
          value: (defined ? value : spec.bool.defaultValue) === true,
        };
      } else if (spec.hidden) {
        // Allow overriding hidden input values (needed for disable toggle)
        status.hidden = { value: defined ? value : (spec.hidden.value ?? "") };
      } else if (spec.choice) {
        status.choice = {
          value: defined ? value : (spec.choice.choices?.[0] ?? ""),
        };
      }

      inputStatuses.push(status);
    }

    // Construct payload with full metadata (including resourceVersion) and updated status
    const payload = {
      metadata: { ...button.metadata },
      status: {
        ...button.status,
        lastClickedAt: this.formatApiTime(new Date()),
        inputs: inputStatuses,
      },
    };

    const response = await fetch(
      `${this.baseURL}/proxy/apis/tilt.dev/v1alpha1/uibuttons/${button.metadata.name}/status`,
      {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal,
      },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to click button: ${response.status} - ${text}`);
    }

    // Return the updated button with new resourceVersion from server
    const updatedButton: APIButton = await response.json();

    return updatedButton;
  }

  /**
   * Check if Tilt server is running
   */
  async checkHealth(signal?: AbortSignal): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/view`, { signal });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all FileWatch resources via the tilt CLI
   */
  async getFileWatches(): Promise<APIFileWatchList> {
    const tiltBinary = Bun.which("tilt");
    if (!tiltBinary) {
      throw new Error("unable to locate tilt binary in your environment");
    }

    const proc = Bun.spawn([tiltBinary, "get", "filewatches", "-o", "json"], {
      env: {
        ...process.env,
        TILT_DISABLE_ANALYTICS: "true",
        DO_NOT_TRACK: "true",
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const errorOutput = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(
        `tilt get filewatches failed (exit ${exitCode}): ${errorOutput}`,
      );
    }

    const parsed = JSON.parse(output);
    return { items: parsed.items ?? [] };
  }

  /**
   * Open a URL in the default browser
   */
  async openUrl(url: string): Promise<void> {
    const { spawn } = await import("bun");
    // Use 'open' on macOS, 'xdg-open' on Linux, 'start' on Windows
    const cmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    spawn([cmd, url], { stdout: "ignore", stderr: "ignore" });
  }
}

/**
 * Wait for a WebSocket to open using action() for callback-style API.
 */
function waitForWebSocketOpen(ws: WebSocket): Operation<void> {
  if (ws.readyState === WebSocket.OPEN) {
    return {
      *[Symbol.iterator]() {
        return;
      },
    };
  }

  return action<void>((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("WebSocket failed to connect"));
    };

    const onClose = () => {
      cleanup();
      reject(new Error("WebSocket closed before opening"));
    };

    const cleanup = () => {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
    };

    ws.addEventListener("open", onOpen);
    ws.addEventListener("error", onError);
    ws.addEventListener("close", onClose);

    // Return cleanup function for when operation is halted
    return cleanup;
  });
}

/**
 * Parse a LogList from the WebSocket into LogEntry objects grouped by resource name.
 * Returns a Map where keys are resource names and values are arrays of log entries.
 */
export function parseLogList(logList: APILogList): Map<string, LogEntry[]> {
  const result = new Map<string, LogEntry[]>();

  if (!logList.segments || !logList.spans) {
    return result;
  }

  // Build span to manifest mapping
  const spanToManifest = new Map<string, string>();
  for (const [spanId, span] of Object.entries(logList.spans)) {
    if (span?.manifestName) {
      spanToManifest.set(spanId, span.manifestName);
    }
  }

  // Parse segments into LogEntry objects grouped by resource
  for (const seg of logList.segments) {
    if (!seg.spanId) {
      console.warn("no spanid for segment", seg);
      continue;
    }

    const resourceName = spanToManifest.get(seg.spanId) ?? "";

    const entry: LogEntry = {
      timestamp: new Date(seg.time),
      spanId: seg.spanId,
      level: seg.level,
      text: seg.text.replace(/\n$/, ""),
      source: resourceName,
    };

    const existing = result.get(resourceName) ?? [];
    existing.push(entry);
    result.set(resourceName, existing);
  }

  return result;
}
