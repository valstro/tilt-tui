import type { LogsConfig } from "../cli";
import type { APIViewResponse, APILogList, APILogSegment } from "./api-types";

interface SpanInfo {
  manifestName: string;
}

export async function dumpLogs(config: LogsConfig): Promise<void> {
  const baseURL = `http://${config.host}:${config.port}`;
  const wsURL = `ws://${config.host}:${config.port}`;

  let token: string;
  try {
    const resp = await fetch(`${baseURL}/api/websocket_token`);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    token = await resp.text();
  } catch (err) {
    console.error(
      `Failed to connect to Tilt at ${baseURL} — is Tilt running?`,
    );
    process.exit(1);
  }

  const url = `${wsURL}/ws/view?csrf=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);

  const allSpans = new Map<string, SpanInfo>();
  let gotInitialLogs = false;

  ws.onmessage = (event) => {
    try {
      const viewResp: APIViewResponse = JSON.parse(event.data);

      if (viewResp.logList) {
        mergeSpans(allSpans, viewResp.logList);
        const lines = formatSegments(
          viewResp.logList,
          allSpans,
          config.resource,
        );
        if (lines.length > 0) {
          process.stdout.write(lines.join("\n") + "\n");
        }
      }

      // In non-follow mode, the first complete response is enough.
      // Tilt sends isComplete=true when the initial snapshot is done.
      if (!config.follow && viewResp.isComplete && !gotInitialLogs) {
        gotInitialLogs = true;
        ws.close();
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  };

  ws.onerror = () => {
    console.error(`WebSocket error connecting to ${wsURL}`);
    process.exit(1);
  };

  return new Promise<void>((resolve) => {
    ws.onclose = () => {
      resolve();
    };

    if (config.follow) {
      const onSignal = () => {
        ws.close();
      };
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
    }
  });
}

function mergeSpans(
  allSpans: Map<string, SpanInfo>,
  logList: APILogList,
): void {
  if (!logList.spans) return;
  for (const [spanId, span] of Object.entries(logList.spans)) {
    if (span?.manifestName) {
      allSpans.set(spanId, { manifestName: span.manifestName });
    }
  }
}

function formatSegments(
  logList: APILogList,
  allSpans: Map<string, SpanInfo>,
  resourceFilter: string,
): string[] {
  if (!logList.segments) return [];

  const lines: string[] = [];
  for (const seg of logList.segments) {
    const manifestName = seg.spanId
      ? (allSpans.get(seg.spanId)?.manifestName ?? "")
      : "";

    if (resourceFilter && manifestName !== resourceFilter) continue;

    let text = seg.text;
    if (text.endsWith("\n")) text = text.slice(0, -1);
    if (!text) continue;

    // Handle carriage returns like the LogStore does
    if (text.includes("\r")) {
      const lastCR = text.lastIndexOf("\r");
      text = text.substring(lastCR + 1);
    }

    lines.push(text);
  }

  return lines;
}
