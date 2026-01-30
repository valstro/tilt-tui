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
  refreshResources: () => Promise<void>
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

  let pollInterval: ReturnType<typeof setInterval> | null = null
  let abortController: AbortController | null = null

  async function fetchInitialData() {
    abortController = new AbortController()
    try {
      const data = await client.getInitialData(abortController.signal)
      setState(
        produce((s) => {
          s.connectionStatus = "connected"
          s.resources = data.resources

          // Extract cluster context and namespace from resources
          for (const r of data.resources) {
            if (r.raw?.metadata?.annotations?.["tilt.dev/cluster"]) {
              s.clusterContext = r.raw.metadata.annotations["tilt.dev/cluster"]
            }
            if (r.raw?.metadata?.labels?.["tilt.dev/namespace"]) {
              s.namespace = r.raw.metadata.labels["tilt.dev/namespace"]
            }
          }

          // Auto-select first resource if none selected
          if (!s.selectedResource && data.resources.length > 0) {
            s.selectedResource = data.resources[0].name
          }
        })
      )

      // Fetch logs for selected resource
      if (state.selectedResource) {
        await refreshLogs(state.selectedResource)
      }
    } catch (err) {
      console.error("Failed to fetch initial data:", err)
      setState("connectionStatus", "disconnected")
    }
  }

  async function refreshResources() {
    try {
      const resources = await client.getResources(abortController?.signal)
      setState("resources", reconcile(resources))
      setState("connectionStatus", "connected")
    } catch (err) {
      console.error("Failed to refresh resources:", err)
      setState("connectionStatus", "disconnected")
    }
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
      // Refresh after trigger
      setTimeout(refreshResources, 500)
    } catch (err) {
      console.error("Failed to trigger resource:", err)
    }
  }

  onMount(() => {
    fetchInitialData()

    // Poll for updates every 5 seconds
    pollInterval = setInterval(() => {
      refreshResources()
      if (state.selectedResource) {
        refreshLogs(state.selectedResource)
      }
    }, 5000)
  })

  onCleanup(() => {
    if (pollInterval) {
      clearInterval(pollInterval)
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
    refreshResources,
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
