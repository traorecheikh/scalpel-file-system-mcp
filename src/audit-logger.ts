import type { ToolError } from "./errors.js";
import type { Logger } from "./logger.js";
import { isMutatingToolName } from "./request-security.js";
import type { ToolName } from "./tool-names.js";

export class AuditLogger {
  public constructor(
    private readonly logger: Logger,
    private readonly enabled: boolean,
  ) {}

  public logMutationIntent(
    tool: ToolName,
    requestId: string,
    args: unknown,
  ): void {
    if (!this.enabled || !isMutatingToolName(tool)) {
      return;
    }

    this.logger.info("Mutation audit intent", {
      requestId,
      tool,
      args: summarizeMutationArgs(tool, args),
    });
  }

  public logMutationSuccess(
    tool: ToolName,
    requestId: string,
    result: unknown,
  ): void {
    if (!this.enabled || !isMutatingToolName(tool)) {
      return;
    }

    this.logger.info("Mutation audit result", {
      requestId,
      tool,
      outcome: "success",
      result: summarizeMutationResult(tool, result),
    });
  }

  public logMutationFailure(
    tool: ToolName,
    requestId: string,
    error: ToolError,
  ): void {
    if (!this.enabled || !isMutatingToolName(tool)) {
      return;
    }

    this.logger.warn("Mutation audit result", {
      requestId,
      tool,
      outcome: "failure",
      error: compactRecord({
        code: error.code,
        message: error.message,
      }),
    });
  }
}

function summarizeMutationArgs(
  tool: ToolName,
  args: unknown,
): Record<string, unknown> {
  const source = asRecord(args);

  switch (tool) {
    case "scalpel_insert_child": {
      const descriptor = asRecord(source?.node_descriptor);
      return compactRecord({
        file: asString(source?.file),
        transaction_id: asString(source?.transaction_id),
        parent_node_id: asString(source?.parent_node_id),
        position_index: asNumber(source?.position_index),
        descriptor_type: asString(descriptor?.type),
      });
    }
    case "scalpel_replace_node": {
      const descriptor = asRecord(source?.new_node_descriptor);
      return compactRecord({
        file: asString(source?.file),
        transaction_id: asString(source?.transaction_id),
        node_id: asString(source?.node_id),
        descriptor_type: asString(descriptor?.type),
      });
    }
    case "scalpel_remove_node":
      return compactRecord({
        file: asString(source?.file),
        transaction_id: asString(source?.transaction_id),
        node_id: asString(source?.node_id),
      });
    case "scalpel_move_subtree":
      return compactRecord({
        file: asString(source?.file),
        transaction_id: asString(source?.transaction_id),
        node_id: asString(source?.node_id),
        new_parent_id: asString(source?.new_parent_id),
        new_position: asNumber(source?.new_position),
      });
    case "scalpel_commit":
      return compactRecord({
        file: asString(source?.file),
        transaction_id: asString(source?.transaction_id),
      });
    case "scalpel_rollback":
      return compactRecord({
        file: asString(source?.file),
        transaction_id: asString(source?.transaction_id),
      });
    default:
      return {};
  }
}

function summarizeMutationResult(
  tool: ToolName,
  result: unknown,
): Record<string, unknown> {
  const source = asRecord(result);

  switch (tool) {
    case "scalpel_commit":
      return compactRecord({
        transactionId: asString(source?.transactionId),
        file: asString(source?.file),
        file_hash_before: asString(source?.file_hash_before),
        file_hash_after: asString(source?.file_hash_after),
        bytes_changed: asNumber(source?.bytes_changed),
        semantic_change_flag: asBoolean(source?.semantic_change_flag),
        changed_node_count: countArrayItems(source?.changed_node_ids),
        new_tree_version: asNumber(source?.new_tree_version),
      });
    case "scalpel_rollback":
      return compactRecord({
        transactionId: asString(source?.transactionId),
        rolledBack: asBoolean(source?.rolledBack),
      });
    default:
      return compactRecord({
        transactionId: asString(source?.transactionId),
        file: asString(source?.file),
        changed_node_count: countArrayItems(source?.changed_node_ids),
        removed_node_count: countArrayItems(source?.removed_node_ids),
        new_node_id: asString(source?.new_node_id),
        semantic_change: asBoolean(source?.semantic_change),
        no_op: asBoolean(source?.no_op),
        new_tree_version: asNumber(source?.new_tree_version),
      });
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return value;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

function asBoolean(value: unknown): boolean | undefined {
  if (typeof value !== "boolean") {
    return undefined;
  }
  return value;
}

function countArrayItems(value: unknown): number | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.length;
}

function compactRecord(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}
