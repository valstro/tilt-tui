// Tilt data context provider

import { createContext, useContext, onMount, onCleanup, type ParentProps } from "solid-js"
import { createStore, produce, reconcile } from "solid-js/store"
import { TiltClient } from "../tilt/client"
import type { Resource, LogEntry } from "../tilt/types"
import type { ConnectionStatus } from "../theme/theme"

interface TiltState {
  connectionStatus: ConnectionStatus
  clusterContext: string
  namespace: string
  resources: Resource[]
  logs: Record<string, LogEntry[]>
  selectedResource: string | null
}

interface TiltContextValue {
  state: TiltState
  client: TiltClient
  selectResource: (name: string) => void
  triggerResource: (name: string) => Promise<void>
  refreshLogs: (resourceName: string) => Promise<void>
}

const TiltContext = createContext<TiltContextValue>()

export function TiltProvider(props: ParentProps<{ host?: string; port?: number }>) {
  const client = new TiltClient({ host: props.host, port: props.port })

  const [state, setState] = createStore<TiltState>({
    connectionStatus: "connecting",
    clusterContext: "docker-desktop",
    namespace: "",
    resources: [],
    logs: {},
    selectedResource: null,
  })

  let subscription: { close: () => void } | null = null
  let abortController: AbortController | null = null
  let logPollInterval: ReturnType<typeof setInterval> | null = null
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  function updateResources(resources: Resource[]) {
    setState(
      produce((s) => {
        s.connectionStatus = "connected"
        s.resources = resources

        // Extract cluster context and namespace from resources
        for (const r of resources) {
          if (r.raw?.metadata?.annotations?.["tilt.dev/cluster"]) {
            s.clusterContext = r.raw.metadata.annotations["tilt.dev/cluster"]
          }
          if (r.raw?.metadata?.labels?.["tilt.dev/namespace"]) {
            s.namespace = r.raw.metadata.labels["tilt.dev/namespace"]
          }
        }

        // Auto-select first resource if none selected
        if (!s.selectedResource && resources.length > 0) {
          s.selectedResource = resources[0].name
        }
      })
    )
  }

  async function connect() {
    abortController = new AbortController()
    setState("connectionStatus", "connecting")

    try {
      subscription = await client.subscribe(
        // onData - called whenever Tilt sends an update
        (data) => {
          updateResources(data.resources)
        },
        // onError
        (error) => {
          console.error("WebSocket error:", error)
          setState("connectionStatus", "disconnected")
          scheduleReconnect()
        },
        // onClose
        () => {
          if (state.connectionStatus === "connected") {
            setState("connectionStatus", "disconnected")
            scheduleReconnect()
          }
        },
        abortController.signal,
      )
    } catch (err) {
      console.error("Failed to connect:", err)
      setState("connectionStatus", "disconnected")
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeout) return // Already scheduled
    reconnectTimeout = setTimeout(() => {
      reconnectTimeout = null
      connect()
    }, 3000)
  }

  async function refreshLogs(resourceName: string) {
    try {
      const logs = await client.getLogs(resourceName, abortController?.signal)
      setState("logs", resourceName, logs)
    } catch (err) {
      console.error("Failed to fetch logs:", err)
    }
  }

  function selectResource(name: string) {
    setState("selectedResource", name)
    refreshLogs(name)
  }

  async function triggerResource(name: string) {
    try {
      await client.triggerResource(name, abortController?.signal)
    } catch (err) {
      console.error("Failed to trigger resource:", err)
    }
  }

  onMount(() => {
    connect()

    // Poll for logs every 2 seconds (websocket handles resource updates)
    logPollInterval = setInterval(() => {
      if (state.selectedResource) {
        refreshLogs(state.selectedResource)
      }
    }, 2000)
  })

  onCleanup(() => {
    if (subscription) {
      subscription.close()
    }
    if (logPollInterval) {
      clearInterval(logPollInterval)
    }
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }
    if (abortController) {
      abortController.abort()
    }
  })

  const value: TiltContextValue = {
    state,
    client,
    selectResource,
    triggerResource,
    refreshLogs,
  }

  return <TiltContext.Provider value={value}>{props.children}</TiltContext.Provider>
}

export function useTilt() {
  const context = useContext(TiltContext)
  if (!context) {
    throw new Error("useTilt must be used within a TiltProvider")
  }
  return context
}
