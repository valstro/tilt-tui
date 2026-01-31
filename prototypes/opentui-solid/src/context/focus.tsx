// Focus management context provider

import { createContext, useContext, createSignal, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"

export type Pane = "tree" | "resource"

interface FocusState {
  activePane: Pane
}

interface FocusContextValue {
  state: FocusState
  setActivePane: (pane: Pane) => void
  cyclePane: () => void
  cyclePaneReverse: () => void
  sidebarVisible: () => boolean
  toggleSidebar: () => void
}

const FocusContext = createContext<FocusContextValue>()

export function FocusProvider(props: ParentProps) {
  const [state, setState] = createStore<FocusState>({
    activePane: "tree",
  })

  // Sidebar visibility state - starts open
  const [sidebarOpen, setSidebarOpen] = createSignal(true)

  function setActivePane(pane: Pane) {
    setState("activePane", pane)
  }

  function cyclePane() {
    setState("activePane", (current) => (current === "tree" ? "resource" : "tree"))
  }

  function cyclePaneReverse() {
    setState("activePane", (current) => (current === "tree" ? "resource" : "tree"))
  }

  function sidebarVisible() {
    return sidebarOpen()
  }

  function toggleSidebar() {
    setSidebarOpen((prev) => !prev)
  }

  const value: FocusContextValue = {
    state,
    setActivePane,
    cyclePane,
    cyclePaneReverse,
    sidebarVisible,
    toggleSidebar,
  }

  return <FocusContext.Provider value={value}>{props.children}</FocusContext.Provider>
}

export function useFocus() {
  const context = useContext(FocusContext)
  if (!context) {
    throw new Error("useFocus must be used within a FocusProvider")
  }
  return context
}
