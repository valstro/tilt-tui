// Focus management context provider

import { createContext, useContext, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"

export type Pane = "tree" | "logs"

interface FocusState {
  activePane: Pane
}

interface FocusContextValue {
  state: FocusState
  setActivePane: (pane: Pane) => void
  cyclePane: () => void
  cyclePaneReverse: () => void
}

const FocusContext = createContext<FocusContextValue>()

export function FocusProvider(props: ParentProps) {
  const [state, setState] = createStore<FocusState>({
    activePane: "tree",
  })

  function setActivePane(pane: Pane) {
    setState("activePane", pane)
  }

  function cyclePane() {
    setState("activePane", (current) => (current === "tree" ? "logs" : "tree"))
  }

  function cyclePaneReverse() {
    setState("activePane", (current) => (current === "tree" ? "logs" : "tree"))
  }

  const value: FocusContextValue = {
    state,
    setActivePane,
    cyclePane,
    cyclePaneReverse,
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
