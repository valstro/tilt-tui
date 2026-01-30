// Theme and styling utilities - matching Bubbletea prototype

export interface Theme {
  // Base colors
  background: string
  foreground: string
  muted: string
  border: string
  borderFocused: string

  // Status colors
  statusOk: string
  statusPending: string
  statusError: string
  statusDisabled: string

  // Log level colors
  logError: string
  logWarning: string
  logInfo: string
}

export const defaultTheme: Theme = {
  // Base colors
  background: "#1F2937",
  foreground: "#F9FAFB",
  muted: "#6B7280",
  border: "#374151",
  borderFocused: "#7C3AED",

  // Status colors
  statusOk: "#10B981", // green
  statusPending: "#F59E0B", // yellow
  statusError: "#EF4444", // red
  statusDisabled: "#6B7280", // gray

  // Log level colors
  logError: "#EF4444",
  logWarning: "#F59E0B",
  logInfo: "#F9FAFB",
}

// Status icons

export function runtimeStatusIcon(status: string): string {
  switch (status) {
    case "ok":
      return "●"
    case "pending":
    case "in_progress":
      return "◐"
    case "error":
      return "✗"
    case "not_applicable":
      return "○"
    default:
      return "○"
  }
}

export function buildStatusIcon(status: string): string {
  switch (status) {
    case "ok":
      return "✓"
    case "pending":
    case "in_progress":
      return "⟳"
    case "error":
      return "✗"
    case "not_applicable":
      return "−"
    default:
      return "−"
  }
}

export function statusIcon(status: string): string {
  switch (status) {
    case "ok":
      return "✓"
    case "pending":
      return "●"
    case "error":
      return "✗"
    default:
      return "•"
  }
}

// Status colors

export function runtimeStatusColor(theme: Theme, status: string): string {
  switch (status) {
    case "ok":
      return theme.statusOk
    case "pending":
    case "in_progress":
      return theme.statusPending
    case "error":
      return theme.statusError
    default:
      return theme.statusDisabled
  }
}

export function buildStatusColor(theme: Theme, status: string): string {
  switch (status) {
    case "ok":
      return theme.statusOk
    case "pending":
    case "in_progress":
      return theme.statusPending
    case "error":
      return theme.statusError
    default:
      return theme.statusDisabled
  }
}

export function statusColor(theme: Theme, status: string): string {
  switch (status) {
    case "ok":
      return theme.statusOk
    case "pending":
      return theme.statusPending
    case "error":
      return theme.statusError
    default:
      return theme.statusDisabled
  }
}

export function logLevelColor(theme: Theme, level: string): string {
  switch (level) {
    case "ERROR":
      return theme.logError
    case "WARN":
    case "WARNING":
      return theme.logWarning
    default:
      return theme.foreground
  }
}

// Connection status

export type ConnectionStatus = "connected" | "connecting" | "disconnected"

export function connectionStatusIcon(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "●"
    case "connecting":
      return "◐"
    case "disconnected":
      return "○"
  }
}

export function connectionStatusColor(theme: Theme, status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return theme.statusOk
    case "connecting":
      return theme.statusPending
    case "disconnected":
      return theme.statusError
  }
}

export function connectionStatusText(status: ConnectionStatus): string {
  switch (status) {
    case "connected":
      return "Connected"
    case "connecting":
      return "Connecting"
    case "disconnected":
      return "Disconnected"
  }
}

// Time formatting

export function formatRelativeTime(timestamp: string): string {
  if (!timestamp) return ""

  const t = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - t.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return "just now"
  if (minutes === 1) return "1m ago"
  if (minutes < 60) return `${minutes}m ago`
  if (hours === 1) return "1h ago"
  if (hours < 24) return `${hours}h ago`
  if (days === 1) return "1d ago"
  if (days < 7) return `${days}d ago`

  return t.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function formatBuildDuration(startTime?: string, finishTime?: string): string {
  if (!startTime || !finishTime) return ""

  const start = new Date(startTime)
  const finish = new Date(finishTime)
  const duration = finish.getTime() - start.getTime()

  if (duration < 1000) return `${duration}ms`
  if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`

  const mins = Math.floor(duration / 60000)
  const secs = Math.floor((duration % 60000) / 1000)
  if (duration < 3600000) return `${mins}m${secs}s`

  const hours = Math.floor(duration / 3600000)
  const remainingMins = Math.floor((duration % 3600000) / 60000)
  return `${hours}h${remainingMins}m`
}
