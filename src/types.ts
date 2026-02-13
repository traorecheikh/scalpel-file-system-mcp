export interface ToolMetadata {
  requestId: string;
  timestamp: string;
  durationMs: number;
  treeVersion?: number;
}

export interface ToolSuccess<TData> {
  success: true;
  data: TData;
  metadata: ToolMetadata;
}

export interface ToolFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  metadata: Pick<ToolMetadata, "requestId" | "timestamp">;
}

export type ToolEnvelope<TData = unknown> = ToolSuccess<TData> | ToolFailure;
