// Theme and styling utilities - using OpenCode theme structure

import { StatusFilter } from "@/context/tilt";
import { ResourceStatus } from "@/tilt/types";
import { BorderStyle, BorderSides, RGBA } from "@opentui/core";

// OpenCode theme color definitions (dark mode from opencode.json)
const opencodeTheme = {
  // Step colors (gray scale)
  step1: "#0a0a0a", // darkest - background
  step2: "#141414", // panel background
  step3: "#1e1e1e", // element background
  step4: "#282828",
  step5: "#323232",
  step6: "#3c3c3c",
  step7: "#484848", // border
  step8: "#606060", // border active
  step9: "#fab283", // primary (orange/peach)
  step10: "#ffc09f",
  step11: "#808080", // muted text
  step12: "#eeeeee", // text

  // Semantic colors
  secondary: "#5c9cf5", // blue
  accent: "#9d7cd8", // purple
  red: "#e06c75",
  orange: "#f5a742",
  green: "#7fd88f",
  cyan: "#56b6c2",
  yellow: "#e5c07b",
};

export interface Theme {
  // Base colors
  background: string;
  contentPane: string; // For pane backgrounds (lighter gray)
  text: string;
  textMuted: string;

  // Border colors (kept for separators if needed)
  border: string;
  borderActive: string;
  borderSubtle: string;

  // Selection colors
  selectionFg: string;
  selectionBg: string;

  // Semantic colors
  primary: string;
  secondary: string;
  accent: string;
  error: string;
  warning: string;
  success: string;
  info: string;
}

export const defaultTheme: Theme = {
  // Base colors
  background: opencodeTheme.step1,
  contentPane: opencodeTheme.step3,
  text: opencodeTheme.step12,
  textMuted: opencodeTheme.step11,

  // Border colors
  border: opencodeTheme.step5,
  borderActive: opencodeTheme.secondary,
  borderSubtle: opencodeTheme.step4,

  // Selection colors
  selectionFg: "#ffffff",
  selectionBg: "#264f78",

  // Semantic colors
  primary: opencodeTheme.step9,
  secondary: opencodeTheme.secondary,
  accent: opencodeTheme.accent,
  error: opencodeTheme.red,
  warning: opencodeTheme.orange,
  success: opencodeTheme.green,
  info: opencodeTheme.cyan,
};

// Border props for focused panes - returns props object to spread
export type FocusBorderProps = {
  borderStyle?: BorderStyle;
  border?: boolean | BorderSides[];
  borderColor?: string | RGBA;
};

export function focusBorder(
  theme: Theme,
  isFocused: boolean,
): FocusBorderProps {
  if (!isFocused) {
    return { border: false };
  }
  return {
    border: ["left"],
    borderColor: theme.secondary,
    borderStyle: "heavy",
  };
}

export function statusColor(theme: Theme, status: StatusFilter): string {
  switch (status) {
    case ResourceStatus.Healthy:
      return theme.success;
    case ResourceStatus.Pending:
    case ResourceStatus.Building:
      return theme.textMuted;
    case ResourceStatus.Unhealthy:
      return theme.error;
    case ResourceStatus.Warning:
      return theme.warning;
    case ResourceStatus.Disabled:
    case ResourceStatus.None:
      return theme.textMuted;
    default:
      // title color for all resources
      return theme.primary;
  }
}

export function logLevelColor(theme: Theme, level: string): string {
  switch (level) {
    case "ERROR":
      return theme.error;
    case "WARN":
    case "WARNING":
      return theme.warning;
    default:
      return theme.text;
  }
}

// Connection status

export type ConnectionStatus = "connected" | "connecting" | "disconnected";

export function connectionStatusIcon(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "●";
    case "connecting":
      return "◐";
    case "disconnected":
      return "○";
  }
}

export function connectionStatusColor(
  theme: Theme,
  status: ConnectionStatus,
): string {
  switch (status) {
    case "connected":
      return theme.success;
    case "connecting":
      return theme.warning;
    case "disconnected":
      return theme.error;
  }
}

export function connectionStatusText(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "connecting":
      return "Connecting";
    case "disconnected":
      return "Disconnected";
  }
}

// Time formatting

export function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return "";

  const t = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - t.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes === 1) return "1m ago";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours === 1) return "1h ago";
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;

  return t.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDuration(durationMs: number): string {
  if (durationMs < 0) return "";

  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;

  const mins = Math.floor(durationMs / 60000);
  const secs = Math.floor((durationMs % 60000) / 1000);
  if (durationMs < 3600000) return `${mins}m${secs}s`;

  const hours = Math.floor(durationMs / 3600000);
  const remainingMins = Math.floor((durationMs % 3600000) / 60000);
  return `${hours}h${remainingMins}m`;
}

export function formatBuildDuration(
  startTime?: string,
  finishTime?: string,
): string {
  if (!startTime || !finishTime) return "";

  const start = new Date(startTime);
  const finish = new Date(finishTime);
  return formatDuration(finish.getTime() - start.getTime());
}
