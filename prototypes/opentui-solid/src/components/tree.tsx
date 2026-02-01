// Tree component - resource list with grouping (sidebar)

import { createSignal, createMemo, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import { useTilt } from "../context/tilt";
import { useFocus } from "../context/focus";
import { useKeyHandler } from "../keyboard/useKeyHandler";
import {
  defaultTheme,
  type Theme,
  runtimeStatusColor,
  buildStatusColor,
  formatRelativeTime,
  formatBuildDuration,
  focusBorder,
} from "../theme/theme";
import { Header } from "./header";
import { PaneHeader } from "./pane-header";
import type { Resource } from "../tilt/types";
import { Commands } from "@/commands";

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

export function Tree() {
  const { state, selectResource, triggerResource, toggleResourceDisable } = useTilt();
  const { state: focusState, setActivePane } = useFocus();
  const theme = defaultTheme;

  const [cursor, setCursor] = createSignal(0);
  const [expandedGroups, setExpandedGroups] = createStore<
    Record<string, boolean>
  >({});

  const nodes = createMemo(() =>
    buildTreeNodes(state.resources, expandedGroups),
  );

  const isFocused = createMemo(() => focusState.activePane === "tree");

  // Keyboard handling - only active when focused
  useKeyHandler(
    "tree",
    (command) => {
      switch (command) {
        case Commands.NAV_DOWN:
          setCursor((c) => Math.min(c + 1, nodes().length - 1));
          break;
        case Commands.NAV_UP:
          setCursor((c) => Math.max(c - 1, 0));
          break;
        case Commands.NAV_TOP:
          setCursor(0);
          break;
        case Commands.NAV_BOTTOM:
          setCursor(nodes().length - 1);
          break;
        case Commands.TREE_SELECT: {
          const node = nodes()[cursor()];
          if (node?.type === "group" && node.groupName) {
            setExpandedGroups(node.groupName, !node.expanded);
          } else if (node?.type === "resource" && node.resource) {
            selectResource(node.resource.name);
            setActivePane("resource"); // Focus logs view after selecting resource
          }
          break;
        }
        case Commands.RELOAD_RESOURCE: {
          const currentNode = nodes()[cursor()];
          if (currentNode?.type === "resource" && currentNode.resource) {
            triggerResource(currentNode.resource.name);
          }
          break;
        }
        case Commands.RESOURCE_DISABLE_TOGGLE: {
          const currentNode = nodes()[cursor()];
          if (currentNode?.type === "resource" && currentNode.resource) {
            toggleResourceDisable(currentNode.resource.name);
          }
          break;
        }
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
      <PaneHeader title={`Resources (${state.resources.length})`} />

      {/* Tree content */}
      <scrollbox paddingLeft={1} flexGrow={1} stickyScroll={false}>
        <For each={nodes()}>
          {(node, index) => {
            const isSelected = createMemo(
              () => index() === cursor() && isFocused(),
            );

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
  theme: Theme;
}) {
  const r = () => props.node.resource!;
  const isDisabled = createMemo(() => r().isDisabled);

  // Runtime status color for line 1 border (muted if disabled)
  const runtimeColor = createMemo(() =>
    isDisabled()
      ? props.theme.textMuted
      : runtimeStatusColor(props.theme, r().runtimeStatus),
  );

  // Build status color for line 2 border (muted if disabled)
  const buildColor = createMemo(() =>
    isDisabled()
      ? props.theme.textMuted
      : buildStatusColor(props.theme, r().updateStatus),
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

  return (
    <box flexDirection="column" marginLeft={1}>
      {/* Line 1: Resource name - runtime status border */}
      <box
        flexDirection="row"
        backgroundColor={props.isSelected ? props.theme.primary : undefined}
        border={["left"]}
        borderStyle="heavy"
        borderColor={runtimeColor()}
        paddingLeft={1}
      >
        <text
          fg={nameColor()}
          attributes={props.isSelected ? 1 : 0}
        >
          {r().name}
        </text>
        <Show when={r().hasPending}>
          <text fg={props.theme.warning}> ⟳</text>
        </Show>
      </box>

      {/* Line 2: Timestamp + duration - build status border */}
      <box
        flexDirection="row"
        backgroundColor={props.isSelected ? props.theme.primary : undefined}
        border={["left"]}
        borderStyle="heavy"
        borderColor={buildColor()}
        paddingLeft={1}
      >
        <text fg={subheadingColor()}>
          {subheading()}
        </text>
      </box>
    </box>
  );
}
