// Header component - connection status and resource counts

import { createMemo } from "solid-js";
import { useTilt } from "../context/tilt";
import {
  defaultTheme,
  connectionStatusIcon,
  connectionStatusColor,
  connectionStatusText,
} from "../theme/theme";
import type { Resource } from "../tilt/types";

interface StatusCounts {
  healthy: number;
  totalEnabled: number;
  pending: number;
  unhealthy: number;
  warning: number;
  disabled: number;
}

function getCombinedStatus(r: Resource): string {
  const buildStat = getBuildStatus(r);
  const runtimeStat = getRuntimeStatus(r);

  if (buildStat !== "healthy" && buildStat !== "none") {
    return buildStat;
  }

  if (runtimeStat === "none") {
    return buildStat;
  }

  return runtimeStat;
}

function getBuildStatus(r: Resource): string {
  if (r.isDisabled) return "disabled";

  switch (r.updateStatus) {
    case "in_progress":
      return "building";
    case "pending":
      return "pending";
    case "not_applicable":
    case "none":
    case "":
      return "none";
    case "error":
      return "unhealthy";
    case "ok":
      return "healthy";
    default:
      return "none";
  }
}

function getRuntimeStatus(r: Resource): string {
  if (r.isDisabled) return "disabled";

  switch (r.runtimeStatus) {
    case "error":
      return "unhealthy";
    case "pending":
      return "pending";
    case "ok":
      return "healthy";
    case "not_applicable":
    case "none":
    case "":
      return "none";
    default:
      return "none";
  }
}

function hasWarning(r: Resource): boolean {
  if (!r.raw) return false;
  const buildHistory = r.raw.status.buildHistory;
  if (buildHistory && buildHistory.length > 0) {
    const lastBuild = buildHistory[0];
    return (lastBuild.warnings?.length ?? 0) > 0 && !lastBuild.error;
  }
  return false;
}

function calculateCounts(resources: Resource[]): StatusCounts {
  const counts: StatusCounts = {
    healthy: 0,
    totalEnabled: 0,
    pending: 0,
    unhealthy: 0,
    warning: 0,
    disabled: 0,
  };

  for (const r of resources) {
    if (r.isDisabled) {
      counts.disabled++;
      continue;
    }

    counts.totalEnabled++;

    if (hasWarning(r)) {
      counts.warning++;
    }

    const status = getCombinedStatus(r);
    switch (status) {
      case "unhealthy":
        counts.unhealthy++;
        break;
      case "pending":
      case "building":
        counts.pending++;
        break;
      case "healthy":
        counts.healthy++;
        break;
    }
  }

  return counts;
}

interface HeaderProps {
  narrow?: boolean;
}

export function Header(props: HeaderProps) {
  const { state } = useTilt();
  const theme = defaultTheme;

  const isNarrow = () => props.narrow ?? false;

  const counts = createMemo(() => calculateCounts(state.resources));

  const connectionIcon = createMemo(() =>
    connectionStatusIcon(state.connectionStatus),
  );
  const connectionColor = createMemo(() =>
    connectionStatusColor(theme, state.connectionStatus),
  );
  const connectionText = createMemo(() =>
    connectionStatusText(state.connectionStatus),
  );

  // Build connection status text
  const connectionStatusLine = createMemo(() => {
    let text = `${connectionIcon()} ${connectionText()}`;
    if (!isNarrow()) {
      text += ` · ${state.clusterContext}`;
      if (state.namespace) {
        text += `/${state.namespace}`;
      }
    }
    return text;
  });

  // Build context line (only for narrow mode)
  const contextLine = createMemo(() => {
    let text = state.clusterContext;
    if (state.namespace) {
      text += `/${state.namespace}`;
    }
    return text;
  });

  // Build status counts text
  const countsText = createMemo(() => {
    const parts: string[] = [];
    const c = counts();

    if (c.unhealthy > 0) {
      parts.push(`✗ ${c.unhealthy}`);
    }
    if (c.warning > 0) {
      parts.push(`⚠ ${c.warning}`);
    }
    if (c.pending > 0) {
      parts.push(`● ${c.pending}`);
    }
    if (c.totalEnabled > 0) {
      parts.push(`✓ ${c.healthy}/${c.totalEnabled}`);
    }
    if (c.disabled > 0) {
      parts.push(`⊘ ${c.disabled}`);
    }

    return parts.join(isNarrow() ? " " : "  ");
  });

  // Narrow mode: stacked vertical layout for sidebar
  if (isNarrow()) {
    return (
      <box
        flexDirection="row"
        padding={1}
        paddingLeft={2}
        paddingRight={2}
        flexShrink={0}
        justifyContent="space-between"
      >
        {/* Line 1: connection status */}
        <text fg={connectionColor()} attributes={1}>
          {connectionStatusLine()}
        </text>
        {/* Line 2: cluster context */}
        {/* <text fg={theme.textMuted}>{contextLine()}</text> */}
        {/* Line 3: status counts */}
        <text fg={theme.text}>{countsText()}</text>
      </box>
    );
  }

  // Wide mode: horizontal layout for full-width header
  return (
    <box
      backgroundColor={theme.contentPane}
      marginLeft={1}
      marginRight={1}
      padding={1}
      paddingLeft={2}
      paddingRight={2}
      flexShrink={0}
    >
      <box flexDirection="row" justifyContent="space-between" width="100%">
        {/* Left side: connection status */}
        <text fg={connectionColor()} attributes={1} flexShrink={0}>
          {connectionStatusLine()}
        </text>

        {/* Right side: status counts */}
        <text fg={theme.text} flexShrink={0}>
          {countsText()}
        </text>
      </box>
    </box>
  );
}
