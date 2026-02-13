import type { ToolEnvelope } from "./types.js";

export function buildSuccessEnvelope<TData>(
  requestId: string,
  durationMs: number,
  data: TData,
  treeVersion?: number,
): ToolEnvelope<TData> {
  const metadata: {
    requestId: string;
    timestamp: string;
    durationMs: number;
    treeVersion?: number;
  } = {
    requestId,
    timestamp: new Date().toISOString(),
    durationMs,
  };

  if (treeVersion !== undefined) {
    metadata.treeVersion = treeVersion;
  }

  return {
    success: true,
    data,
    metadata,
  };
}

export function buildErrorEnvelope(
  requestId: string,
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ToolEnvelope {
  const errorPayload: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } = {
    code,
    message,
  };

  if (details !== undefined) {
    errorPayload.details = details;
  }

  return {
    success: false,
    error: errorPayload,
    metadata: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}

export function toMcpContent(envelope: ToolEnvelope): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(envelope, null, 2),
      },
    ],
  };
}
