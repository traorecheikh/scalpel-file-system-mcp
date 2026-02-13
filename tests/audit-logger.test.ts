import assert from "node:assert/strict";
import test from "node:test";
import { AuditLogger } from "../src/audit-logger.ts";
import { ToolError } from "../src/errors.ts";
import type { Logger } from "../src/logger.ts";

interface LogEntry {
  level: "info" | "warn";
  message: string;
  context: Record<string, unknown>;
}

class CaptureLogger {
  public readonly entries: LogEntry[] = [];

  public debug(): void {}

  public info(message: string, context: Record<string, unknown> = {}): void {
    this.entries.push({ level: "info", message, context });
  }

  public warn(message: string, context: Record<string, unknown> = {}): void {
    this.entries.push({ level: "warn", message, context });
  }

  public error(): void {}
}

test("logs mutation intent without descriptor payload values", () => {
  const capture = new CaptureLogger();
  const logger = capture as unknown as Logger;
  const audit = new AuditLogger(logger, true);

  audit.logMutationIntent("scalpel_insert_child", "req-1", {
    file: "src/file.ts",
    transaction_id: "tx-1",
    parent_node_id: "node-parent",
    position_index: 2,
    node_descriptor: {
      type: "literal",
      value: "super-secret-inline-code",
    },
  });

  assert.equal(capture.entries.length, 1);
  const [entry] = capture.entries;
  assert.equal(entry.level, "info");
  assert.equal(entry.message, "Mutation audit intent");

  const args = entry.context.args as Record<string, unknown>;
  assert.equal(args.descriptor_type, "literal");
  assert.equal("value" in args, false);
});

test("logs mutation failures with structured error fields", () => {
  const capture = new CaptureLogger();
  const logger = capture as unknown as Logger;
  const audit = new AuditLogger(logger, true);

  audit.logMutationFailure(
    "scalpel_commit",
    "req-2",
    new ToolError("INVALID_OPERATION", "Commit failed"),
  );

  assert.equal(capture.entries.length, 1);
  const [entry] = capture.entries;
  assert.equal(entry.level, "warn");
  assert.equal(entry.message, "Mutation audit result");
  assert.equal(entry.context.outcome, "failure");

  const error = entry.context.error as Record<string, unknown>;
  assert.equal(error.code, "INVALID_OPERATION");
  assert.equal(error.message, "Commit failed");
});

test("does not log when audit logger is disabled", () => {
  const capture = new CaptureLogger();
  const logger = capture as unknown as Logger;
  const audit = new AuditLogger(logger, false);

  audit.logMutationIntent("scalpel_commit", "req-3", {
    file: "src/file.ts",
    transaction_id: "tx-3",
  });
  audit.logMutationSuccess("scalpel_commit", "req-3", {
    transactionId: "tx-3",
    file: "src/file.ts",
  });
  audit.logMutationFailure(
    "scalpel_commit",
    "req-3",
    new ToolError("INVALID_OPERATION", "Commit failed"),
  );

  assert.equal(capture.entries.length, 0);
});
