import { ZodError } from "zod";

export type ToolErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "NOT_IMPLEMENTED"
  | "INVALID_OPERATION"
  | "INTERNAL_ERROR"
  | "UNAUTHORIZED"
  | "RATE_LIMITED";

export class ToolError extends Error {
  public readonly code: ToolErrorCode;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(
    code: ToolErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.code = code;
    this.details = details;
    this.name = "ToolError";
  }
}

export interface NormalizeToolErrorOptions {
  includeInternalMessage?: boolean;
}

export function normalizeToolError(
  error: unknown,
  options: NormalizeToolErrorOptions = {},
): ToolError {
  const includeInternalMessage = options.includeInternalMessage ?? true;

  if (error instanceof ToolError) {
    if (error.code === "INTERNAL_ERROR" && !includeInternalMessage) {
      return new ToolError("INTERNAL_ERROR", "Internal server error");
    }
    return error;
  }

  if (error instanceof ZodError) {
    return new ToolError("VALIDATION_ERROR", "Invalid input parameters", {
      issues: error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (error instanceof Error) {
    if (includeInternalMessage && error.message.trim().length > 0) {
      return new ToolError("INTERNAL_ERROR", error.message);
    }
    return new ToolError("INTERNAL_ERROR", "Internal server error");
  }

  if (includeInternalMessage) {
    return new ToolError("INTERNAL_ERROR", "Unknown internal error");
  }
  return new ToolError("INTERNAL_ERROR", "Internal server error");
}
