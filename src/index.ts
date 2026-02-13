#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  SetLevelRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  ScalpelBeginTransactionArgs,
  ScalpelCommitArgs,
  ScalpelCreateFileArgs,
  ScalpelEditIntentArgs,
  ScalpelGetNodeArgs,
  ScalpelInsertChildArgs,
  ScalpelListNodesArgs,
  ScalpelMoveSubtreeArgs,
  ScalpelRemoveNodeArgs,
  ScalpelReplaceNodeArgs,
  ScalpelRollbackArgs,
  ScalpelSearchStructureArgs,
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
import { validateAllParsers } from "./tree-sitter-parser.js";

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
      resources: {},
      prompts: {},
      logging: {},
      sampling: {},
    },
  },
);

service.setServer(server);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: `file://${config.workspaceRoot}`,
      name: "Workspace Root",
      description: "Root directory of the workspace",
      mimeType: "application/directory",
    },
  ],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  if (!uri.startsWith("file://")) {
    throw new McpError(ErrorCode.InvalidRequest, "Only file:// URIs supported");
  }

  const relativeOrAbsolutePath = uri.replace("file://", "");
  // Using path safety helper
  const absolutePath = relativeOrAbsolutePath.startsWith(config.workspaceRoot)
    ? relativeOrAbsolutePath
    : path.resolve(config.workspaceRoot, relativeOrAbsolutePath);

  const content = await readFile(absolutePath, "utf8");

  // MIME type inference
  const ext = path.extname(absolutePath).toLowerCase();
  const mimeTypeMap: Record<string, string> = {
    ".ts": "text/x-typescript",
    ".js": "text/javascript",
    ".json": "application/json",
    ".md": "text/markdown",
  };
  const mimeType = mimeTypeMap[ext] || "text/plain";

  return {
    contents: [
      {
        uri,
        mimeType,
        text: content,
      },
    ],
  };
});

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
  resourceTemplates: [
    {
      uriTemplate: "file://{path}",
      name: "File",
      description: "Read any file in the workspace by relative path",
      mimeType: "text/plain",
    },
  ],
}));

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "refactor_extract_function",
      description: "Extract selected code into a new function",
      arguments: [
        { name: "file", description: "File containing the code", required: true },
        { name: "node_id", description: "Node ID of the code to extract", required: true },
        { name: "function_name", description: "Name for the new function", required: true },
      ],
    },
    {
      name: "refactor_rename_symbol",
      description: "Rename a variable, function, or class",
      arguments: [
        { name: "file", description: "File containing the symbol", required: true },
        { name: "node_id", description: "Node ID of the symbol to rename", required: true },
        { name: "new_name", description: "New name for the symbol", required: true },
      ],
    },
    {
      name: "add_documentation",
      description: "Add JSDoc or comments to a node",
      arguments: [
        { name: "file", description: "File containing the node", required: true },
        { name: "node_id", description: "Node ID to document", required: true },
      ],
    },
    {
      name: "add_error_handling",
      description: "Wrap code in a try/catch block",
      arguments: [
        { name: "file", description: "File containing the code", required: true },
        { name: "node_id", description: "Node ID to wrap", required: true },
      ],
    },
    {
      name: "convert_to_async",
      description: "Convert a synchronous function to async/await",
      arguments: [
        { name: "file", description: "File containing the function", required: true },
        { name: "node_id", description: "Node ID of the function", required: true },
      ],
    },
    {
      name: "extract_to_module",
      description: "Extract selected code into a new file/module",
      arguments: [
        { name: "file", description: "Source file", required: true },
        { name: "node_id", description: "Node ID to extract", required: true },
        { name: "new_file", description: "Target file path", required: true },
      ],
    },
    {
      name: "optimize_imports",
      description: "Remove unused imports from a file",
      arguments: [
        { name: "file", description: "File to optimize", required: true },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "refactor_extract_function":
      return {
        description: "Extract code into a new function",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Extract the code at node ${args?.node_id} in ${args?.file} into a new function named ${args?.function_name}.

Steps:
1. Use scalpel_begin_transaction to start editing ${args?.file}
2. Use scalpel_get_node to inspect the code at ${args?.node_id}
3. Determine the function signature (parameters, return type)
4. Use scalpel_insert_child to add the new function declaration
5. Use scalpel_replace_node to replace the original code with a function call
6. Use scalpel_commit to save changes`,
            },
          },
        ],
      };
    case "refactor_rename_symbol":
      return {
        description: "Rename a symbol",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Rename the symbol at node ${args?.node_id} in ${args?.file} to ${args?.new_name}.

Steps:
1. Use scalpel_begin_transaction to start editing ${args?.file}
2. Use scalpel_search_structure to find all occurrences of the symbol
3. Use scalpel_replace_node for each occurrence to update the name
4. Use scalpel_commit to save changes`,
            },
          },
        ],
      };
    case "add_documentation":
      return {
        description: "Add documentation",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Add documentation to the node ${args?.node_id} in ${args?.file}.

Steps:
1. Use scalpel_begin_transaction to start editing ${args?.file}
2. Use scalpel_get_node to understand the node
3. Prepare appropriate JSDoc or comments
4. Use scalpel_insert_child or scalpel_replace_node to add the documentation
5. Use scalpel_commit to save changes`,
            },
          },
        ],
      };
    case "add_error_handling":
      return {
        description: "Add error handling",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Wrap the code at node ${args?.node_id} in ${args?.file} in a try/catch block.

Steps:
1. Use scalpel_begin_transaction to start editing ${args?.file}
2. Use scalpel_get_node to inspect the code
3. Use scalpel_replace_node to wrap the code in a try/catch structure
4. Use scalpel_commit to save changes`,
            },
          },
        ],
      };
    case "convert_to_async":
      return {
        description: "Convert to async",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Convert the function at node ${args?.node_id} in ${args?.file} to be asynchronous.

Steps:
1. Use scalpel_begin_transaction to start editing ${args?.file}
2. Add 'async' keyword to the function declaration
3. Update internal calls to use 'await' where necessary
4. Use scalpel_commit to save changes`,
            },
          },
        ],
      };
    case "extract_to_module":
      return {
        description: "Extract to module",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Extract the code at node ${args?.node_id} in ${args?.file} to a new file ${args?.new_file}.

Steps:
1. Use scalpel_create_file to create ${args?.new_file} with the extracted code
2. Use scalpel_begin_transaction to edit the original file ${args?.file}
3. Use scalpel_replace_node or scalpel_remove_node to update the original file
4. Use scalpel_insert_child to add necessary imports
5. Use scalpel_commit for both files`,
            },
          },
        ],
      };
    case "optimize_imports":
      return {
        description: "Optimize imports",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Remove unused imports from ${args?.file}.

Steps:
1. Use scalpel_begin_transaction to start editing ${args?.file}
2. Use scalpel_list_nodes to find all import declarations
3. Analyze usage of imported symbols in the rest of the file
4. Use scalpel_remove_node for unused imports
5. Use scalpel_commit to save changes`,
            },
          },
        ],
      };
    default:
      throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  }
});

server.setRequestHandler(SetLevelRequestSchema, async (request) => {
  const { level } = request.params;

  // Map MCP levels to internal levels
  const levelMap: Record<string, string> = {
    debug: "debug",
    info: "info",
    notice: "info",
    warning: "warn",
    error: "error",
    critical: "error",
    alert: "error",
    emergency: "error",
  };

  const internalLevel = levelMap[level] || "info";

  // Runtime mutation
  config.logLevel = internalLevel as any;
  logger.setLevel(internalLevel as any);

  return {};
});

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
    case "scalpel_create_file":
      return service.createFile(args as ScalpelCreateFileArgs);
    case "scalpel_list_nodes":
      return service.listNodes(args as ScalpelListNodesArgs);
    case "scalpel_get_node":
      return service.getNode(args as ScalpelGetNodeArgs);
    case "scalpel_search_structure":
      return service.searchStructure(args as ScalpelSearchStructureArgs);
    case "scalpel_edit_intent":
      return service.editIntent(args as ScalpelEditIntentArgs);
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
  // Validate all tree-sitter parsers at startup
  logger.info("Validating tree-sitter parsers...");
  const validation = validateAllParsers();
  
  if (!validation.success) {
    logger.error("❌ Parser validation failed:");
    validation.failures.forEach(f => {
      logger.error(`  - ${f.language}: ${f.error}`);
    });
    process.exit(1);  // Fail fast
  }
  
  logger.info(`✅ All ${10 - validation.failures.length} parsers validated`);
  
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
