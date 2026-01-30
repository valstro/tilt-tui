// Tree component - resource list with grouping

import { createSignal, createMemo, For, Show } from "solid-js"
import { createStore, produce } from "solid-js/store"
import { useKeyboard } from "@opentui/solid"
import { useTilt } from "../context/tilt"
import { useFocus } from "../context/focus"
import {
  defaultTheme,
  runtimeStatusIcon,
  runtimeStatusColor,
  buildStatusIcon,
  buildStatusColor,
  formatRelativeTime,
  formatBuildDuration,
} from "../theme/theme"
import type { Resource } from "../tilt/types"

interface TreeNode {
  type: "group" | "resource"
  groupName?: string
  resource?: Resource
  expanded?: boolean
  childCount?: number
  depth: number
}

// Group resources by labels
function getGroupKey(r: Resource): string {
  if (!r.raw) return "ungrouped"

  const labels = r.raw.metadata.labels ?? {}
  if (Object.keys(labels).length === 0) return "ungrouped"

  // Priority keys for grouping
  const priorityKeys = [
    "app",
    "app.kubernetes.io/name",
    "app.kubernetes.io/component",
    "component",
    "service",
    "tilt.dev/resource",
  ]

  for (const key of priorityKeys) {
    if (labels[key]) return labels[key]
  }

  // Fall back to first label value
  for (const val of Object.values(labels)) {
    if (val) return val
  }

  return "ungrouped"
}

function buildTreeNodes(
  resources: Resource[],
  expandedGroups: Record<string, boolean>
): TreeNode[] {
  const nodes: TreeNode[] = []
  const grouped = new Map<string, number[]>()
  const groupOrder: string[] = []

  // Group resources
  resources.forEach((r, i) => {
    const key = getGroupKey(r)
    if (!grouped.has(key)) {
      groupOrder.push(key)
      grouped.set(key, [])
    }
    grouped.get(key)!.push(i)
  })

  // Sort groups (ungrouped at end)
  groupOrder.sort((a, b) => {
    if (a === "ungrouped") return 1
    if (b === "ungrouped") return -1
    return a.localeCompare(b)
  })

  // Build nodes
  for (const groupKey of groupOrder) {
    const indices = grouped.get(groupKey)!
    const expanded = expandedGroups[groupKey] ?? true

    nodes.push({
      type: "group",
      groupName: groupKey,
      expanded,
      childCount: indices.length,
      depth: 0,
    })

    if (expanded) {
      for (const idx of indices) {
        nodes.push({
          type: "resource",
          resource: resources[idx],
          depth: 1,
        })
      }
    }
  }

  return nodes
}

export function Tree() {
  const { state, selectResource, triggerResource } = useTilt()
  const { state: focusState } = useFocus()
  const theme = defaultTheme

  const [cursor, setCursor] = createSignal(0)
  const [expandedGroups, setExpandedGroups] = createStore<Record<string, boolean>>({})

  const nodes = createMemo(() => buildTreeNodes(state.resources, expandedGroups))

  const isFocused = createMemo(() => focusState.activePane === "tree")
  const borderColor = createMemo(() => (isFocused() ? theme.borderFocused : theme.border))

  // Keyboard handling
  useKeyboard((key) => {
    if (!isFocused()) return

    switch (key.name) {
      case "j":
      case "down":
        setCursor((c) => Math.min(c + 1, nodes().length - 1))
        break
      case "k":
      case "up":
        setCursor((c) => Math.max(c - 1, 0))
        break
      case "g":
        if (key.shift) {
          // Shift+g (G) - go to end
          setCursor(nodes().length - 1)
        } else {
          // g - go to start
          setCursor(0)
        }
        break
      case "space":
      case "return":
        const node = nodes()[cursor()]
        if (node?.type === "group" && node.groupName) {
          setExpandedGroups(node.groupName, !node.expanded)
        } else if (node?.type === "resource" && node.resource) {
          selectResource(node.resource.name)
        }
        break
      case "r":
        const currentNode = nodes()[cursor()]
        if (currentNode?.type === "resource" && currentNode.resource) {
          triggerResource(currentNode.resource.name)
        }
        break
    }
  })

  return (
    <box
      flexDirection="column"
      border={true}
      borderStyle="single"
      borderColor={borderColor()}
      flexGrow={0}
      flexShrink={0}
      width={35}
    >
      {/* Title - fixed */}
      <box paddingLeft={1} paddingRight={1} flexShrink={0}>
        <text fg={theme.borderFocused} attributes={1}>
          Resources ({state.resources.length})
        </text>
      </box>

      {/* Separator - fixed */}
      <box flexShrink={0}>
        <text fg={borderColor()}>{"─".repeat(33)}</text>
      </box>

      {/* Tree content */}
      <scrollbox flexGrow={1} stickyScroll={false}>
        <For each={nodes()}>
          {(node, index) => {
            const isSelected = createMemo(() => index() === cursor() && isFocused())

            if (node.type === "group") {
              return (
                <GroupNode
                  node={node}
                  isSelected={isSelected()}
                  theme={theme}
                />
              )
            } else {
              return (
                <ResourceNode
                  node={node}
                  isSelected={isSelected()}
                  theme={theme}
                />
              )
            }
          }}
        </For>
      </scrollbox>
    </box>
  )
}

function GroupNode(props: { node: TreeNode; isSelected: boolean; theme: typeof defaultTheme }) {
  const expandIcon = () => (props.node.expanded ? "▼" : "▶")
  const displayText = () => `${expandIcon()} ${props.node.groupName} (${props.node.childCount})`

  return (
    <box
      paddingLeft={1}
      flexDirection="row"
      backgroundColor={props.isSelected ? props.theme.borderFocused : undefined}
    >
      <text
        fg={props.isSelected ? props.theme.foreground : props.theme.borderFocused}
        attributes={1}
      >
        {displayText()}
      </text>
    </box>
  )
}

function ResourceNode(props: { node: TreeNode; isSelected: boolean; theme: typeof defaultTheme }) {
  const r = () => props.node.resource!
  const indent = () => "  ".repeat(props.node.depth)

  const runtimeIcon = createMemo(() => runtimeStatusIcon(r().runtimeStatus))
  const runtimeColor = createMemo(() => runtimeStatusColor(props.theme, r().runtimeStatus))
  const buildIcon = createMemo(() => buildStatusIcon(r().updateStatus))
  const buildColor = createMemo(() => buildStatusColor(props.theme, r().updateStatus))

  const lastUpdate = createMemo(() => formatRelativeTime(r().lastDeployAt))
  const buildDuration = createMemo(() => {
    if (!r().raw?.status.buildHistory?.length) return ""
    const lastBuild = r().raw!.status.buildHistory![0]
    return formatBuildDuration(lastBuild.startTime, lastBuild.finishTime)
  })

  const subheading = createMemo(() => {
    const parts: string[] = []
    if (lastUpdate()) parts.push(lastUpdate())
    if (buildDuration()) parts.push(buildDuration())
    return parts.join(" · ") || "—"
  })

  const line1 = () => `${indent()}${runtimeIcon()} ${r().name}${r().hasPending ? " ⟳" : ""}`
  const line2 = () => `${indent()}  ${buildIcon()} ${subheading()}`

  return (
    <box flexDirection="column">
      {/* Line 1: Runtime icon + name */}
      <box
        paddingLeft={1}
        flexDirection="row"
        backgroundColor={props.isSelected ? props.theme.borderFocused : undefined}
      >
        <text fg={runtimeColor()} attributes={1}>
          {indent()}{runtimeIcon()}
        </text>
        <text fg={props.theme.foreground} attributes={props.isSelected ? 1 : 0}>
          {" "}{r().name}
        </text>
        <Show when={r().hasPending}>
          <text fg={props.theme.statusPending}> ⟳</text>
        </Show>
      </box>

      {/* Line 2: Build icon + timestamp + duration */}
      <box paddingLeft={1} flexDirection="row">
        <text fg={buildColor()}>
          {indent()}  {buildIcon()}
        </text>
        <text fg={props.theme.muted}> {subheading()}</text>
      </box>
    </box>
  )
}
