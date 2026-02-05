// Tree component - resource list with grouping (sidebar)

import {
  createSignal,
  createMemo,
  createEffect,
  on,
  For,
  Show,
} from "solid-js";
import {
  blink,
  hexToRgb,
  parseColor,
  RGBA,
  type ScrollBoxRenderable,
} from "@opentui/core";
import { createStore } from "solid-js/store";
import { useTilt } from "../context/tilt";
import { useFocus } from "../context/focus";
import { useKeyHandler } from "../keyboard/useKeyHandler";
import {
  defaultTheme,
  type Theme,
  statusColor,
  formatRelativeTime,
  formatBuildDuration,
  focusBorder,
} from "../theme/theme";
import { Header } from "./header";
import { PaneHeader } from "./pane-header";
import { ResourceStatus, type Resource } from "../tilt/types";
import { Commands } from "@/commands";
import { getEffectiveStatus } from "@/tilt/status-utils";
import { useTimeline } from "@opentui/solid";

interface TreeNode {
  type: "group" | "resource";
  groupName?: string;
  resource?: Resource;
  expanded?: boolean;
  childCount?: number;
  depth: number;
}

// Group resources by labels
function getGroupKey(r: Resource): string {
  if (!r.raw) return "ungrouped";

  const labels = r.raw.metadata.labels ?? {};
  if (Object.keys(labels).length === 0) return "ungrouped";

  // Priority keys for grouping
  const priorityKeys = [
    "app",
    "app.kubernetes.io/name",
    "app.kubernetes.io/component",
    "component",
    "service",
    "tilt.dev/resource",
  ];

  for (const key of priorityKeys) {
    if (labels[key]) return labels[key];
  }

  // Fall back to first label value
  for (const val of Object.values(labels)) {
    if (val) return val;
  }

  return "ungrouped";
}

function buildTreeNodes(
  resources: Resource[],
  expandedGroups: Record<string, boolean>,
): TreeNode[] {
  const nodes: TreeNode[] = [];
  const grouped = new Map<string, number[]>();
  const groupOrder: string[] = [];

  // Group resources
  resources.forEach((r, i) => {
    const key = getGroupKey(r);
    if (!grouped.has(key)) {
      groupOrder.push(key);
      grouped.set(key, []);
    }
    grouped.get(key)!.push(i);
  });

  // Sort groups (ungrouped at end)
  groupOrder.sort((a, b) => {
    if (a === "ungrouped") return 1;
    if (b === "ungrouped") return -1;
    return a.localeCompare(b);
  });

  // Build nodes
  for (const groupKey of groupOrder) {
    const indices = grouped.get(groupKey)!;
    const expanded = expandedGroups[groupKey] ?? true;

    nodes.push({
      type: "group",
      groupName: groupKey,
      expanded,
      childCount: indices.length,
      depth: 0,
    });

    if (expanded) {
      for (const idx of indices) {
        nodes.push({
          type: "resource",
          resource: resources[idx],
          depth: 1,
        });
      }
    }
  }

  return nodes;
}

// Export getGroupKey for use by resource picker
export { getGroupKey };

export function Tree() {
  const {
    state,
    selectResource,
    triggerResource,
    toggleResourceDisable,
    cycleStatusFilter,
    resetStatusFilter,
  } = useTilt();
  const { state: focusState, setActivePane } = useFocus();
  const theme = defaultTheme;

  const [cursor, setCursor] = createSignal(0);
  const [expandedGroups, setExpandedGroups] = createStore<
    Record<string, boolean>
  >({});

  let scrollRef: ScrollBoxRenderable | undefined;

  // Filter resources by status
  const filteredResources = createMemo(() => {
    const filter = state.statusFilter;
    if (filter === "all") return state.resources;
    return state.resources.filter((r) => getEffectiveStatus(r) === filter);
  });

  // Reset cursor when filter changes
  createEffect(
    on(
      () => state.statusFilter,
      () => {
        setCursor(0);
      },
    ),
  );

  const nodes = createMemo(() =>
    buildTreeNodes(filteredResources(), expandedGroups),
  );

  // Auto-expand group and set cursor when resource is selected externally (e.g., from picker)
  createEffect(
    on(
      () => state.selectedResource,
      (name) => {
        if (!name) return;
        const resource = state.resources.find((r) => r.name === name);
        if (resource) {
          const groupKey = getGroupKey(resource);
          // Expand the group first
          setExpandedGroups(groupKey, true);

          // Find the cursor position for this resource in the nodes list
          // Need to rebuild nodes with the expanded group to find correct index
          const updatedNodes = buildTreeNodes(filteredResources(), {
            ...expandedGroups,
            [groupKey]: true,
          });
          const nodeIndex = updatedNodes.findIndex(
            (n) => n.type === "resource" && n.resource?.name === name,
          );
          if (nodeIndex !== -1) {
            setCursor(nodeIndex);
          }
        }
      },
    ),
  );

  const isFocused = createMemo(() => focusState.activePane === "tree");

  // Calculate the row position for a given cursor index
  // Groups take 1 row, resources take 2 rows
  function getRowPosition(cursorIndex: number): {
    top: number;
    height: number;
  } {
    const nodeList = nodes();
    let row = 0;
    for (let i = 0; i < cursorIndex && i < nodeList.length; i++) {
      row += nodeList[i].type === "group" ? 1 : 2;
    }
    const height = nodeList[cursorIndex]?.type === "group" ? 1 : 2;
    return { top: row, height };
  }

  // Scroll to keep cursor visible when it changes
  createEffect(
    on(cursor, (cursorIndex) => {
      if (!scrollRef) return;

      const { top: itemTop, height: itemHeight } = getRowPosition(cursorIndex);
      const scrollTop = scrollRef.scrollTop;
      const visibleRows = scrollRef.height ?? 10;

      // Scroll up if item is above viewport
      if (itemTop < scrollTop) {
        scrollRef.scrollTo(itemTop);
      }
      // Scroll down if item is below viewport
      else if (itemTop + itemHeight > scrollTop + visibleRows) {
        scrollRef.scrollTo(itemTop + itemHeight - visibleRows);
      }
    }),
  );

  const toggleGroup = () => {
    const node = nodes()[cursor()];
    if (node?.type === "group" && node.groupName) {
      setExpandedGroups(node.groupName, !node.expanded);
    }
  };

  const selectResourceAtCursor = (switchToResourcePane: boolean) => {
    const node = nodes()[cursor()];
    if (node?.type === "resource" && node.resource) {
      selectResource(node.resource.name);

      if (switchToResourcePane) {
        setActivePane("resource");
      }
    }
  };

  // Keyboard handling - only active when focused
  useKeyHandler(
    "tree",
    (command) => {
      switch (command) {
        case Commands.NAV_DOWN:
          setCursor((c) => Math.min(c + 1, nodes().length - 1));
          selectResourceAtCursor(false);
          break;
        case Commands.NAV_UP:
          setCursor((c) => Math.max(c - 1, 0));
          selectResourceAtCursor(false);
          break;
        case Commands.NAV_TOP:
          setCursor(0);
          selectResourceAtCursor(false);
          break;
        case Commands.NAV_BOTTOM:
          setCursor(nodes().length - 1);
          selectResourceAtCursor(false);
          break;
        case Commands.TREE_SELECT: {
          toggleGroup();
          selectResourceAtCursor(true);
          break;
        }
        case Commands.RELOAD_RESOURCE: {
          const currentNode = nodes()[cursor()];
          if (currentNode?.type === "resource" && currentNode.resource) {
            triggerResource(currentNode.resource.name);
          }
          selectResourceAtCursor(false);
          break;
        }
        case Commands.RESOURCE_DISABLE_TOGGLE: {
          const currentNode = nodes()[cursor()];
          if (currentNode?.type === "resource" && currentNode.resource) {
            toggleResourceDisable(currentNode.resource.name);
          }
          break;
        }
        case Commands.STATUS_FILTER_CYCLE:
          cycleStatusFilter();
          break;
        case Commands.STATUS_FILTER_RESET:
          if (state.statusFilter !== "all") {
            resetStatusFilter();
          }
          break;
      }
    },
    isFocused,
  );

  return (
    <box
      flexDirection="column"
      backgroundColor={theme.contentPane}
      flexGrow={0}
      flexShrink={0}
      marginTop={1}
      marginBottom={1}
      marginLeft={1}
      width={42}
      paddingLeft={isFocused() ? 0 : 1}
      {...focusBorder(theme, isFocused())}
    >
      <PaneHeader title={`Resources (${filteredResources().length})`}>
        <Show when={state.statusFilter !== "all"}>
          <text fg={statusColor(theme, state.statusFilter)}>
            {" "}
            [{state.statusFilter}]
          </text>
        </Show>
      </PaneHeader>

      {/* Tree content */}
      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scrollRef = r)}
        paddingLeft={1}
        flexGrow={1}
        stickyScroll={false}
      >
        <For each={nodes()}>
          {(node, index) => {
            const isSelected = createMemo(() => index() === cursor());

            if (node.type === "group") {
              return (
                <GroupNode
                  node={node}
                  isSelected={isSelected()}
                  theme={theme}
                />
              );
            } else {
              return (
                <ResourceNode
                  node={node}
                  isSelected={isSelected()}
                  isFocused={isFocused()}
                  theme={theme}
                />
              );
            }
          }}
        </For>
      </scrollbox>

      {/* Status legend */}
      <box
        alignSelf="center"
        flexShrink={0}
        paddingLeft={1}
        paddingTop={1}
        flexDirection="row"
        gap={1}
      >
        <text fg={theme.success}>●</text>
        <text fg={theme.textMuted}>ok</text>
        <text fg={theme.warning}>●</text>
        <text fg={theme.textMuted}>pending</text>
        <text fg={theme.error}>●</text>
        <text fg={theme.textMuted}>error</text>
      </box>

      {/* Header at bottom of sidebar */}
      <Header narrow={true} />
    </box>
  );
}

function GroupNode(props: {
  node: TreeNode;
  isSelected: boolean;
  theme: Theme;
}) {
  const expandIcon = () => (props.node.expanded ? "▼" : "▶");
  const displayText = () =>
    `${expandIcon()} ${props.node.groupName} (${props.node.childCount})`;

  return (
    <box
      paddingLeft={1}
      flexDirection="row"
      backgroundColor={props.isSelected ? props.theme.primary : undefined}
    >
      <text
        fg={props.isSelected ? props.theme.background : props.theme.primary}
        attributes={1}
      >
        {displayText()}
      </text>
    </box>
  );
}

function ResourceNode(props: {
  node: TreeNode;
  isSelected: boolean;
  isFocused: boolean;
  theme: Theme;
}) {
  const r = () => props.node.resource!;
  const isDisabled = createMemo(() => r().isDisabled);

  const [inProgressOpacity, setInProgressOpacity] = createSignal(0);
  const timeline = useTimeline({
    duration: 2000,
    loop: true,
  });

  timeline.add(
    { opacity: 0 },
    {
      opacity: 100,
      duration: 2000,
      ease: "inOutCirc",
      onUpdate: ({ currentTime }) => {
        const opacity = currentTime < 1000 ? currentTime : 2000 - currentTime;
        // console.log(opacity, opacity * 0.001);
        setInProgressOpacity(opacity * 0.001);
      },
    },
    0,
  );

  const blinkWhenBuilding = (status: ResourceStatus, isBuilding: boolean) => {
    if (isDisabled()) {
      return props.theme.textMuted;
    }

    const hex = statusColor(props.theme, status);
    if (!isBuilding) {
      return hex;
    }

    const rgb = parseColor(hex);
    return RGBA.fromValues(rgb.r, rgb.g, rgb.b, inProgressOpacity());
  };

  // Runtime status color for line 1 border (muted if disabled)
  const runtimeColor = createMemo(() =>
    blinkWhenBuilding(r().runtimeStatus, r().isBuilding),
  );

  // Build status color for line 2 border (muted if disabled)
  const buildColor = createMemo(() =>
    blinkWhenBuilding(r().updateStatus, r().isBuilding),
  );

  const lastUpdate = createMemo(() => formatRelativeTime(r().lastDeployAt));
  const buildDuration = createMemo(() => {
    if (!r().raw?.status.buildHistory?.length) return "";
    const lastBuild = r().raw!.status.buildHistory![0];
    return formatBuildDuration(lastBuild.startTime, lastBuild.finishTime);
  });

  const subheading = createMemo(() => {
    const parts: string[] = [];
    if (lastUpdate()) parts.push(lastUpdate());
    if (buildDuration()) parts.push(buildDuration());
    return parts.join(" · ") || "—";
  });

  // Text color: muted when disabled, otherwise normal
  const nameColor = createMemo(() => {
    if (props.isSelected) return props.theme.background;
    return isDisabled() ? props.theme.textMuted : props.theme.text;
  });

  const subheadingColor = createMemo(() => {
    if (props.isSelected) return props.theme.background;
    return props.theme.textMuted; // Always muted for subheading
  });

  const backgroundColor = createMemo(() => {
    if (props.isSelected && props.isFocused) {
      return props.theme.primary;
    }

    if (props.isSelected) {
      return props.theme.secondary;
    }

    return undefined;
  });

  return (
    <box
      flexDirection="column"
      marginLeft={1}
      backgroundColor={backgroundColor()}
    >
      {/* Line 1: Resource name - runtime status border */}
      <box
        flexDirection="row"
        border={["left"]}
        borderStyle="heavy"
        borderColor={runtimeColor()}
        paddingLeft={1}
      >
        <text fg={nameColor()} attributes={props.isSelected ? 1 : 0}>
          {r().name}
        </text>
        <Show when={r().isBuilding}>
          <text
            style={{ opacity: inProgressOpacity() }}
            fg={props.theme.warning}
          >
            {" "}
            ⟳
          </text>
        </Show>
      </box>

      {/* Line 2: Timestamp + duration - build status border */}
      <box
        flexDirection="row"
        border={["left"]}
        borderStyle="heavy"
        borderColor={buildColor()}
        paddingLeft={1}
      >
        <text fg={subheadingColor()}>{subheading()}</text>
      </box>
    </box>
  );
}
