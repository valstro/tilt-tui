// Tilt API Client - TypeScript translation from Go

import type {
  ViewResponse,
  Resource,
  LogEntry,
  LogSegment,
  resourceFromAPIResource,
  associateButtonsWithResources,
  UIButton,
  UIInputStatus,
} from "./types";
import {
  resourceFromAPIResource as convertResource,
  associateButtonsWithResources as associateButtons,
} from "./types";

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 10350;

export interface TiltClientOptions {
  host?: string;
  port?: number;
}

export interface TiltData {
  resources: Resource[];
  buttons: any[];
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
   * Subscribe to data updates via websocket connection
   * Returns an object with the websocket and a way to close it
   */
  async subscribe(
    onData: (data: TiltData) => void,
    onError?: (error: Error) => void,
    onClose?: () => void,
    signal?: AbortSignal,
  ): Promise<{ close: () => void }> {
    const token = await this.getWebsocketToken();
    const wsURL = `${this.wsURL}/ws/view?csrf=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsURL);

    if (signal) {
      signal.addEventListener("abort", () => {
        ws.close();
      });
    }

    ws.onmessage = (event) => {
      try {
        const viewResp: ViewResponse = JSON.parse(event.data);

        if (!viewResp.isComplete) {
          return; // Wait for complete message
        }

        const resources = viewResp.uiResources.map(convertResource);
        const withButtons = associateButtons(resources, viewResp.uiButtons);

        onData({
          resources: withButtons,
          buttons: viewResp.uiButtons,
        });
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    ws.onerror = () => {
      onError?.(new Error("WebSocket error"));
    };

    ws.onclose = () => {
      onClose?.();
    };

    return {
      close: () => ws.close(),
    };
  }

  /**
   * Get initial data via websocket connection (one-shot)
   */
  async getInitialData(signal?: AbortSignal): Promise<TiltData> {
    return new Promise((resolve, reject) => {
      let subscription: { close: () => void } | null = null;

      this.subscribe(
        (data) => {
          subscription?.close();
          resolve(data);
        },
        (error) => {
          subscription?.close();
          reject(error);
        },
        undefined,
        signal,
      )
        .then((sub) => {
          subscription = sub;
        })
        .catch(reject);
    });
  }

  /**
   * Get resources via HTTP polling
   */
  async getResources(signal?: AbortSignal): Promise<Resource[]> {
    const response = await fetch(`${this.baseURL}/api/view`, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch resources: ${response.status}`);
    }

    const viewResp: ViewResponse = await response.json();
    return viewResp.uiResources.map(convertResource);
  }

  /**
   * Get logs for a specific resource
   */
  async getLogs(
    resourceName: string,
    signal?: AbortSignal,
  ): Promise<LogEntry[]> {
    let path = "/api/view";
    if (resourceName && resourceName !== "(Tiltfile)") {
      path = `/api/view?name=${encodeURIComponent(resourceName)}`;
    }

    const response = await fetch(`${this.baseURL}${path}`, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status}`);
    }

    const viewResp: ViewResponse = await response.json();

    if (!viewResp.logList) {
      return [];
    }

    // Build span to manifest mapping
    const spanToManifest = new Map<string, string>();
    if (viewResp.logList.spans) {
      for (const [spanId, span] of Object.entries(viewResp.logList.spans)) {
        if (span) {
          spanToManifest.set(spanId, span.manifestName);
        }
      }
    }

    const entries: LogEntry[] = [];
    for (const seg of viewResp.logList.segments) {
      // Filter by resource if specified
      if (resourceName) {
        const manifest = spanToManifest.get(seg.spanId);
        if (manifest !== resourceName && manifest) {
          continue;
        }
      }

      entries.push({
        timestamp: new Date(seg.time),
        spanId: seg.spanId,
        level: seg.level,
        text: seg.text.replace(/\n$/, ""),
        source: spanToManifest.get(seg.spanId) ?? "",
      });
    }

    return entries;
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
   * @param button - The full UIButton object (includes resourceVersion needed for updates)
   * @param inputValues - Optional input values for buttons with inputs
   * @returns The updated UIButton with new resourceVersion
   */
  async clickButton(
    button: UIButton,
    inputValues: Record<string, any> = {},
    signal?: AbortSignal,
  ): Promise<UIButton> {
    // Build input statuses from the button's input specs and provided values
    const inputStatuses: UIInputStatus[] = [];
    for (const spec of button.spec.inputs ?? []) {
      const name = spec.name;
      const value = inputValues[name];
      const defined = value !== undefined;

      const status: UIInputStatus = { name };

      if (spec.text) {
        status.text = {
          value: defined ? value : (spec.text.defaultValue ?? ""),
        };
      } else if (spec.bool) {
        status.bool = {
          value: (defined ? value : spec.bool.defaultValue) === true,
        };
      } else if (spec.hidden) {
        status.hidden = { value: spec.hidden.value ?? "" };
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
    const updatedButton: UIButton = await response.json();
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
