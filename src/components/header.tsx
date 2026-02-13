import { createMemo, For, Show } from "solid-js";
import { useTilt } from "../context/tilt";
import {
  defaultTheme,
  connectionStatusIcon,
  connectionStatusColor,
  connectionStatusText,
} from "../theme/theme";
import { ResourceStatus, type Resource } from "../tilt/types";
import { getEffectiveStatus } from "@/tilt/status-utils";

interface StatusCounts {
  healthy: number;
  totalEnabled: number;
  pending: number;
  unhealthy: number;
  warning: number;
  disabled: number;
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

    if (hasWarning(r)) {
      counts.warning++;
      counts.totalEnabled++;
    }

    const status = getEffectiveStatus(r);
    switch (status) {
      case ResourceStatus.Unhealthy:
        counts.unhealthy++;
        counts.totalEnabled++;
        break;
      case ResourceStatus.Pending:
      case ResourceStatus.Building:
        counts.pending++;
        counts.totalEnabled++;
        break;
      case ResourceStatus.Healthy:
        counts.healthy++;
        counts.totalEnabled++;
        break;
    }
  }

  return counts;
}

interface StatusItem {
  icon: string;
  text: string;
  color: string;
}

interface StatusCountsProps {
  narrow: boolean;
  items: StatusItem[];
  theme: typeof defaultTheme;
}

// Moved outside Header to avoid recreation on every render
function StatusCounts(props: StatusCountsProps) {
  const separator = () => (props.narrow ? " " : "  ");
  return (
    <box flexDirection="row" flexShrink={0}>
      <For each={props.items}>
        {(item, index) => (
          <>
            <Show when={index() > 0}>
              <text fg={props.theme.textMuted}>{separator()}</text>
            </Show>
            <text fg={item.color}>{item.icon}</text>
            <text fg={props.theme.text}> {item.text}</text>
          </>
        )}
      </For>
    </box>
  );
}

interface HeaderProps {
  narrow?: boolean;
}

export function Header(props: HeaderProps) {
  const { state, client } = useTilt();
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
    return `${connectionIcon()} ${state.connectionStatus === "connected" ? (state.namespace ?? connectionText()) : connectionText()}`;
  });

  // Build status count items with colors
  const statusItems = createMemo((): StatusItem[] => {
    const items: StatusItem[] = [];
    const c = counts();

    if (c.unhealthy > 0) {
      items.push({ icon: "✗", text: `${c.unhealthy}`, color: theme.error });
    }
    if (c.warning > 0) {
      items.push({ icon: "⚠", text: `${c.warning}`, color: theme.warning });
    }
    if (c.pending > 0) {
      items.push({ icon: "●", text: `${c.pending}`, color: theme.textMuted });
    }
    if (c.totalEnabled > 0) {
      items.push({
        icon: "✓",
        text: `${c.healthy}/${c.totalEnabled}`,
        color: theme.success,
      });
    }
    if (c.disabled > 0) {
      items.push({ icon: "⊘", text: `${c.disabled}`, color: theme.textMuted });
    }

    return items;
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
        <text fg={connectionColor()} attributes={1}>
          {connectionStatusLine()}
        </text>
        <StatusCounts narrow={true} items={statusItems()} theme={theme} />
      </box>
    );
  }

  // Wide mode: horizontal layout for full-width header
  return (
    <box
      backgroundColor={theme.contentPane}
      marginLeft={1}
      marginRight={1}
      marginTop={0}
      marginBottom={1}
      padding={1}
      paddingLeft={2}
      paddingRight={2}
      flexShrink={0}
    >
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <text fg={connectionColor()} attributes={1} flexShrink={0}>
          {connectionStatusLine()}
        </text>

        <StatusCounts narrow={false} items={statusItems()} theme={theme} />
      </box>
    </box>
  );
}
