#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  ScalpelBeginTransactionArgs,
  ScalpelCommitArgs,
  ScalpelGetNodeArgs,
  ScalpelInsertChildArgs,
  ScalpelListNodesArgs,
  ScalpelMoveSubtreeArgs,
  ScalpelRemoveNodeArgs,
  ScalpelReplaceNodeArgs,
  ScalpelRollbackArgs,
  ScalpelValidateTransactionArgs,
} from "./schemas.js";
import { loadConfig } from "./config.js";
import { Logger } from "./logger.js";
import { normalizeToolError } from "./errors.js";
import { buildErrorEnvelope, buildSuccessEnvelope, toMcpContent } from "./response.js";
import { ScalpelService } from "./service.js";
import { TOOL_SCHEMAS } from "./schemas.js";
import { TOOL_DEFINITIONS } from "./tool-definitions.js";
import type { ToolName } from "./tool-names.js";
import { TOOL_NAMES } from "./tool-names.js";
import { TransactionStore } from "./transaction-store.js";
import { RequestSecurityManager, extractTransactionId } from "./request-security.js";
import { AuditLogger } from "./audit-logger.js";
import { runStartupHardeningChecks } from "./runtime-hardening.js";

const config = loadConfig();
const logger = new Logger(config.logLevel);
const transactions = new TransactionStore(config.transactionTtlMs, logger);
const service = new ScalpelService(config, logger, transactions);
const requestSecurity = new RequestSecurityManager(config);
const auditLogger = new AuditLogger(logger, config.auditLogEnabled);
transactions.onClose((transactionId, reason) => {
  service.disposeTransaction(transactionId, reason);
});
let runtimeKeepAlive: NodeJS.Timeout | undefined;

const server = new Server(
  {
    name: config.serverName,
    version: config.serverVersion,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const { name, arguments: rawArgs } = request.params;

  logger.info("Tool call received", {
    requestId,
    tool: name,
  });

  if (!isToolName(name)) {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }

  try {
    const transactionId = extractTransactionId(rawArgs);
    requestSecurity.enforceRateLimits(
      transactionId
        ? {
            tool: name,
            transactionId,
          }
        : {
            tool: name,
          },
    );

    auditLogger.logMutationIntent(name, requestId, rawArgs);

    const schema = TOOL_SCHEMAS[name];
    const parsedArgs = schema.parse(rawArgs ?? {});

    const result = await executeTool(name, parsedArgs);
    const durationMs = Date.now() - startedAt;
    const envelope = buildSuccessEnvelope(
      requestId,
      durationMs,
      result,
      extractTreeVersion(result),
    );

    auditLogger.logMutationSuccess(name, requestId, result);
    logger.info("Tool call completed", {
      requestId,
      tool: name,
      durationMs,
    });
    return toMcpContent(envelope);
  } catch (error) {
    const normalized = normalizeToolError(error, {
      includeInternalMessage: config.nodeEnv !== "production",
    });
    auditLogger.logMutationFailure(name, requestId, normalized);
    logger.warn("Tool call failed", {
      requestId,
      tool: name,
      code: normalized.code,
      message: normalized.message,
    });

    const envelope = buildErrorEnvelope(
      requestId,
      normalized.code,
      normalized.message,
      normalized.details,
    );
    return toMcpContent(envelope);
  }
});

function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

async function executeTool(name: ToolName, args: unknown): Promise<unknown> {
  switch (name) {
    case "scalpel_begin_transaction":
      return service.beginTransaction(args as ScalpelBeginTransactionArgs);
    case "scalpel_list_nodes":
      return service.listNodes(args as ScalpelListNodesArgs);
    case "scalpel_get_node":
      return service.getNode(args as ScalpelGetNodeArgs);
    case "scalpel_insert_child":
      return service.insertChild(args as ScalpelInsertChildArgs);
    case "scalpel_replace_node":
      return service.replaceNode(args as ScalpelReplaceNodeArgs);
    case "scalpel_remove_node":
      return service.removeNode(args as ScalpelRemoveNodeArgs);
    case "scalpel_move_subtree":
      return service.moveSubtree(args as ScalpelMoveSubtreeArgs);
    case "scalpel_validate_transaction":
      return service.validateTransaction(args as ScalpelValidateTransactionArgs);
    case "scalpel_commit":
      return service.commit(args as ScalpelCommitArgs);
    case "scalpel_rollback":
      return service.rollback(args as ScalpelRollbackArgs);
    case "scalpel_health_check":
      return service.healthCheck();
  }
}

function extractTreeVersion(result: unknown): number | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  if ("treeVersion" in result && typeof result.treeVersion === "number") {
    return result.treeVersion;
  }

  return undefined;
}

function registerShutdownHandlers(): void {
  const shutdown = (signal: string) => {
    logger.info("Received shutdown signal", { signal });
    if (runtimeKeepAlive) {
      clearInterval(runtimeKeepAlive);
      runtimeKeepAlive = undefined;
    }
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function startServer(): Promise<void> {
  await runStartupHardeningChecks(config, logger);
  registerShutdownHandlers();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  runtimeKeepAlive = setInterval(() => {
    // Keeps process alive while waiting for stdio messages.
  }, 60_000);

  process.stdin.on("end", () => {
    logger.info("Stdin ended; shutting down");
    if (runtimeKeepAlive) {
      clearInterval(runtimeKeepAlive);
      runtimeKeepAlive = undefined;
    }
    process.exit(0);
  });

  logger.info("Scalpel MCP server started", {
    name: config.serverName,
    version: config.serverVersion,
    workspaceRoot: config.workspaceRoot,
  });
}

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { message: error.message });
});

void startServer().catch((error: unknown) => {
  logger.error("Failed to start server", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
