import type { LogLevel } from "./config.js";

const LOG_PRIORITIES: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};
const REDACTED_VALUE = "[REDACTED]";
const TRUNCATED_VALUE = "[TRUNCATED]";
const CIRCULAR_VALUE = "[CIRCULAR]";
const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /api[-_]?key/i,
  /authorization/i,
  /cookie/i,
];
const MAX_CONTEXT_DEPTH = 6;

export class Logger {
  private readonly minPriority: number;

  public constructor(private readonly level: LogLevel) {
    this.minPriority = LOG_PRIORITIES[level];
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log("debug", message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log("info", message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log("warn", message, context);
  }

  public error(message: string, context?: Record<string, unknown>): void {
    this.log("error", message, context);
  }

  private log(
    level: LogLevel,
    message: string,
    context: Record<string, unknown> = {},
  ): void {
    if (LOG_PRIORITIES[level] < this.minPriority) {
      return;
    }

    const sanitizedContext = sanitizeForLogging(
      context,
      undefined,
      0,
      new WeakSet(),
    );
    const contextPayload =
      sanitizedContext && typeof sanitizedContext === "object"
        ? (sanitizedContext as Record<string, unknown>)
        : {};
    const line = JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...contextPayload,
    });

    process.stderr.write(`${line}\n`);
  }
}

function sanitizeForLogging(
  value: unknown,
  key: string | undefined,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (key && isSensitiveKey(key)) {
    return REDACTED_VALUE;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (depth > MAX_CONTEXT_DEPTH) {
    return TRUNCATED_VALUE;
  }

  if (Array.isArray(value)) {
    return value.map((entry) =>
      sanitizeForLogging(entry, undefined, depth + 1, seen),
    );
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return CIRCULAR_VALUE;
    }
    seen.add(value);

    const objectValue = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(objectValue)) {
      output[entryKey] = sanitizeForLogging(
        entryValue,
        entryKey,
        depth + 1,
        seen,
      );
    }
    return output;
  }

  return value;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}
