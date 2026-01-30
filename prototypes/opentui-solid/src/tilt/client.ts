// Tilt API Client - TypeScript translation from Go

import type {
  ViewResponse,
  Resource,
  LogEntry,
  LogSegment,
  resourceFromAPIResource,
  associateButtonsWithResources,
} from "./types"
import {
  resourceFromAPIResource as convertResource,
  associateButtonsWithResources as associateButtons,
} from "./types"

const DEFAULT_HOST = "localhost"
const DEFAULT_PORT = 10350

export interface TiltClientOptions {
  host?: string
  port?: number
}

export interface InitialData {
  resources: Resource[]
  buttons: any[]
}

export class TiltClient {
  private baseURL: string
  private wsURL: string

  constructor(options: TiltClientOptions = {}) {
    const host = options.host ?? DEFAULT_HOST
    const port = options.port ?? DEFAULT_PORT
    this.baseURL = `http://${host}:${port}`
    this.wsURL = `ws://${host}:${port}`
  }

  /**
   * Get the websocket token for authentication
   */
  private async getWebsocketToken(): Promise<string> {
    const response = await fetch(`${this.baseURL}/api/websocket_token`)
    if (!response.ok) {
      throw new Error(`Failed to get websocket token: ${response.status}`)
    }
    return response.text()
  }

  /**
   * Get initial data via websocket connection
   */
  async getInitialData(signal?: AbortSignal): Promise<InitialData> {
    const token = await this.getWebsocketToken()
    const wsURL = `${this.wsURL}/ws/view?csrf=${encodeURIComponent(token)}`

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsURL)

      if (signal) {
        signal.addEventListener("abort", () => {
          ws.close()
          reject(new Error("Aborted"))
        })
      }

      ws.onmessage = (event) => {
        try {
          const viewResp: ViewResponse = JSON.parse(event.data)

          if (!viewResp.isComplete) {
            return // Wait for complete message
          }

          const resources = viewResp.uiResources.map(convertResource)
          const withButtons = associateButtons(resources, viewResp.uiButtons)

          ws.close()
          resolve({
            resources: withButtons,
            buttons: viewResp.uiButtons,
          })
        } catch (err) {
          reject(err)
        }
      }

      ws.onerror = (event) => {
        reject(new Error("WebSocket error"))
      }

      ws.onclose = () => {
        // Connection closed
      }
    })
  }

  /**
   * Get resources via HTTP polling
   */
  async getResources(signal?: AbortSignal): Promise<Resource[]> {
    const response = await fetch(`${this.baseURL}/api/view`, { signal })
    if (!response.ok) {
      throw new Error(`Failed to fetch resources: ${response.status}`)
    }

    const viewResp: ViewResponse = await response.json()
    return viewResp.uiResources.map(convertResource)
  }

  /**
   * Get logs for a specific resource
   */
  async getLogs(resourceName: string, signal?: AbortSignal): Promise<LogEntry[]> {
    let path = "/api/view"
    if (resourceName && resourceName !== "(Tiltfile)") {
      path = `/api/view?name=${encodeURIComponent(resourceName)}`
    }

    const response = await fetch(`${this.baseURL}${path}`, { signal })
    if (!response.ok) {
      throw new Error(`Failed to fetch logs: ${response.status}`)
    }

    const viewResp: ViewResponse = await response.json()

    if (!viewResp.logList) {
      return []
    }

    // Build span to manifest mapping
    const spanToManifest = new Map<string, string>()
    if (viewResp.logList.spans) {
      for (const [spanId, span] of Object.entries(viewResp.logList.spans)) {
        if (span) {
          spanToManifest.set(spanId, span.manifestName)
        }
      }
    }

    const entries: LogEntry[] = []
    for (const seg of viewResp.logList.segments) {
      // Filter by resource if specified
      if (resourceName) {
        const manifest = spanToManifest.get(seg.spanId)
        if (manifest !== resourceName && manifest) {
          continue
        }
      }

      entries.push({
        timestamp: new Date(seg.time),
        spanId: seg.spanId,
        level: seg.level,
        text: seg.text.replace(/\n$/, ""),
        source: spanToManifest.get(seg.spanId) ?? "",
      })
    }

    return entries
  }

  /**
   * Trigger a resource rebuild
   */
  async triggerResource(resourceName: string, signal?: AbortSignal): Promise<void> {
    const body = JSON.stringify({
      manifest_names: [resourceName],
      build_reason: 16,
    })

    const response = await fetch(`${this.baseURL}/api/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    })

    if (!response.ok) {
      throw new Error(`Failed to trigger resource: ${response.status}`)
    }
  }

  /**
   * Click a UI button
   */
  async clickButton(buttonName: string, inputs: Record<string, string> = {}, signal?: AbortSignal): Promise<void> {
    const inputStatuses = Object.entries(inputs).map(([name, value]) => ({
      name,
      text: { value },
    }))

    const payload = {
      metadata: { name: buttonName },
      status: {
        lastClickedAt: new Date().toISOString(),
        inputs: inputStatuses,
      },
    }

    const response = await fetch(
      `${this.baseURL}/proxy/apis/tilt.dev/v1alpha1/uibuttons/${buttonName}/status`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      }
    )

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Failed to click button: ${response.status} - ${text}`)
    }
  }

  /**
   * Check if Tilt server is running
   */
  async checkHealth(signal?: AbortSignal): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/api/view`, { signal })
      return response.ok
    } catch {
      return false
    }
  }
}
