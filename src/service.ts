import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "./config.js";
import { ToolError } from "./errors.js";
import type { Logger } from "./logger.js";
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
  SupportedLanguage,
} from "./schemas.js";
import { resolveWorkspacePath } from "./path-safety.js";
import type { TransactionSession } from "./transaction-store.js";
import { TransactionStore } from "./transaction-store.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  IdentityMetrics,
  MutationOperationResult,
  NodeDescriptorInput,
  ParsedNodeRecord,
  serializeSnapshot,
  TreeSnapshot,
  TreeStore,
} from "./tree-store.js";
import { QueryEngine } from "./query-engine.js";
import { IntentCompiler } from "./intent-compiler.js";
import { parseSourceText } from "./tree-sitter-parser.js";
import { generateDiff, type DiffOutput } from "./diff-generator.js";
import { paginate, type PaginationInfo } from "./pagination.js";

const EXTENSION_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  // Existing
  ".ts": "typescript", ".tsx": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".java": "java",
  ".dart": "dart",
  ".rs": "rust",

  // New
  ".md": "markdown", ".markdown": "markdown", ".mdx": "markdown",
  ".json": "json", ".jsonc": "json",
  ".yaml": "yaml", ".yml": "yaml",
  ".html": "html", ".htm": "html", ".xhtml": "html",
  ".css": "css", ".scss": "css", ".sass": "css", ".less": "css",
  ".py": "python", ".pyi": "python", ".pyx": "python",
  ".go": "go",
};

const FILENAME_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  // Markdown
  "README": "markdown",
  "CHANGELOG": "markdown",
  "CONTRIBUTING": "markdown",
  "LICENSE": "markdown",

  // JSON
  ".babelrc": "json",
  ".eslintrc": "json",
  ".prettierrc": "json",

  // YAML
  ".clang-format": "yaml",

  // Other (Python-like syntax or common extensionless)
  "Dockerfile": "python",
  "Makefile": "python",
};

const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  "typescript", "javascript", "java", "dart", "rust",
  "markdown", "json", "yaml", "html", "css", "python", "go"
];

export class ScalpelService {
  private readonly trees: TreeStore;
  private server?: Server;

  public constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly transactions: TransactionStore,
  ) {
    this.trees = new TreeStore();
  }

  public setServer(server: Server): void {
    this.server = server;
  }

  public async beginTransaction(args: ScalpelBeginTransactionArgs): Promise<{
    transactionId: string;
    file: string;
    language: SupportedLanguage;
    treeVersion: number;
    createdAt: string;
    rootNodeId?: string;
    nodeCount?: number;
  }> {
    const absoluteFilePath = resolveWorkspacePath(this.config.workspaceRoot, args.file);
    const inferredLanguage = inferLanguageFromPath(absoluteFilePath);
    const language = args.language ?? inferredLanguage;

    if (!language) {
      throw new ToolError(
        "INVALID_OPERATION",
        "Unable to infer file language. Provide language explicitly.",
      );
    }

    await assertFileIsReadable(absoluteFilePath);

    const session = this.transactions.begin(args.file, absoluteFilePath, language);
    
    // Always hydrate for all supported languages
    const snapshot = await this.trees.hydrate(session);
    const parsedRootNodeId = snapshot.rootNodeId;
    const parsedNodeCount = snapshot.nodeCount;

    this.logger.info("Transaction started", {
      transactionId: session.transactionId,
      file: args.file,
      language,
    });

    const result: {
      transactionId: string;
      file: string;
      language: SupportedLanguage;
      treeVersion: number;
      createdAt: string;
      rootNodeId?: string;
      nodeCount?: number;
    } = {
      transactionId: session.transactionId,
      file: args.file,
      language,
      treeVersion: session.workingVersion,
      createdAt: session.createdAt,
    };

    if (parsedRootNodeId !== undefined) {
      result.rootNodeId = parsedRootNodeId;
    }
    if (parsedNodeCount !== undefined) {
      result.nodeCount = parsedNodeCount;
    }

    return result;
  }

  public async createFile(args: ScalpelCreateFileArgs): Promise<{
    transactionId: string;
    file: string;
    language: SupportedLanguage;
    created: boolean;
    bytesWritten: number;
  }> {
    const absoluteFilePath = resolveWorkspacePath(this.config.workspaceRoot, args.file);

    // Check existence
    let fileExists = false;
    try {
      await access(absoluteFilePath, constants.F_OK);
      fileExists = true;
    } catch {
      // File doesn't exist - OK
    }

    if (fileExists && !args.overwrite) {
      throw new ToolError(
        "INVALID_OPERATION",
        `File already exists: ${args.file}. Use overwrite=true to replace.`,
      );
    }

    // Infer language
    const inferredLanguage = inferLanguageFromPath(absoluteFilePath);
    const language = args.language ?? inferredLanguage;

    if (!language) {
      throw new ToolError(
        "INVALID_OPERATION",
        "Unable to infer file language. Provide language explicitly.",
      );
    }

    // Create parent directories
    const parentDir = path.dirname(absoluteFilePath);
    await mkdir(parentDir, { recursive: true });

    // Write file
    const content = args.initial_content ?? "";
    await writeFile(absoluteFilePath, content, "utf8");

    // Auto-start transaction
    const session = this.transactions.begin(args.file, absoluteFilePath, language);

    // Pre-hydrate to ensure it's valid and get initial metrics
    await this.trees.hydrate(session);

    return {
      transactionId: session.transactionId,
      file: args.file,
      language,
      created: !fileExists,
      bytesWritten: Buffer.byteLength(content, "utf8"),
    };
  }

  public async listNodes(args: ScalpelListNodesArgs): Promise<{
    transactionId: string;
    file: string;
    treeVersion: number;
    rootNodeId: string;
    nodes: Array<{
      node_id: string;
      type: string;
      parent_node_id: string | null;
      index_position: number;
      child_count: number;
      structural_hash: string;
      offset_range: { start: number; end: number };
    }>;
    total_node_count: number;
    identity_metrics: IdentityMetrics;
    pagination: PaginationInfo;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);
    const snapshot = await this.ensureSnapshot(session);
    this.transactions.touch(session.transactionId);

    const filters = args.filter_by_type ? new Set(args.filter_by_type) : undefined;
    const startNodeId = args.filter_by_parent ?? snapshot.rootNodeId;
    
    const allNodes = traverseByDepth(startNodeId, snapshot, args.depth)
      .filter((record) => {
        if (!filters) {
          return true;
        }
        return filters.has(record.type);
      });

    const paginated = paginate(
      allNodes,
      args.limit ?? 100,
      args.cursor,
      snapshot.treeVersion,
    );
    const nodes = paginated.items.map((record) => mapNodeRecord(record));

    return {
      transactionId: session.transactionId,
      file: session.file,
      treeVersion: snapshot.treeVersion,
      rootNodeId: snapshot.rootNodeId,
      nodes,
      total_node_count: snapshot.nodeCount,
      identity_metrics: snapshot.identityMetrics,
      pagination: paginated.pagination,
    };
  }

  public async searchStructure(args: {
    transaction_id: string;
    file: string;
    selector: string;
  }): Promise<{
    transactionId: string;
    file: string;
    treeVersion: number;
    matches: Array<{
      node_id: string;
      type: string;
      text_snippet: string;
      start_index: number;
      end_index: number;
    }>;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);
    const snapshot = await this.ensureSnapshot(session);
    this.transactions.touch(session.transactionId);

    const nodeIdMap = new Map<string, string>();
    for (const [id, record] of snapshot.nodesById) {
      nodeIdMap.set(`${record.startOffset}:${record.endOffset}:${record.type}`, id);
    }

    // Use cached tree if available, otherwise re-parse
    let tree;
    if (snapshot.cachedTree) {
      tree = snapshot.cachedTree;
    } else {
      const parseResult = parseSourceText(snapshot.language, snapshot.sourceText);
      tree = parseResult.tree;
    }

    const results = QueryEngine.getInstance().runQuery(
      snapshot.language,
      tree.rootNode,
      args.selector,
      nodeIdMap,
    );

    return {
      transactionId: session.transactionId,
      file: session.file,
      treeVersion: snapshot.treeVersion,
      matches: results.map((r) => ({
        node_id: r.nodeId,
        type: r.type,
        text_snippet: r.textSnippet,
        start_index: r.startIndex,
        end_index: r.endIndex,
      })),
    };
  }

  public async editIntent(args: {
    transaction_id: string;
    file: string;
    intents: Array<{ intent: string; args: Record<string, unknown> }>;
    dry_run: boolean;
  }): Promise<{
    transactionId: string;
    file: string;
    results: Array<unknown>;
    treeVersion: number;
  }> {
    if (args.dry_run) {
      throw new ToolError(
        "NOT_IMPLEMENTED",
        "Dry run is not supported in this version.",
      );
    }

    const session = this.requireSessionForFile(args.transaction_id, args.file);
    const results: Array<unknown> = [];

    // Execute sequentially
    for (const intent of args.intents) {
      // Re-fetch snapshot as it updates after each op
      const snapshot = await this.ensureSnapshot(session);
      const compiler = new IntentCompiler(snapshot);
      const ops = compiler.compile(intent.intent, intent.args, {
        file: args.file,
        transaction_id: args.transaction_id,
      });

      for (const op of ops) {
        let result;
        if (op.tool === "scalpel_insert_child") {
          result = await this.insertChild(op.args as any);
        } else if (op.tool === "scalpel_replace_node") {
          result = await this.replaceNode(op.args as any);
        } else if (op.tool === "scalpel_remove_node") {
          result = await this.removeNode(op.args as any);
        } else if (op.tool === "scalpel_move_subtree") {
          result = await this.moveSubtree(op.args as any);
        } else {
          throw new ToolError("INTERNAL_ERROR", `Unknown tool op: ${op.tool}`);
        }
        results.push(result);
      }
    }

    // Get final version
    const finalSnapshot = this.trees.require(session.transactionId);

    return {
      transactionId: session.transactionId,
      file: session.file,
      results,
      treeVersion: finalSnapshot.treeVersion,
    };
  }

  public async getNode(args: ScalpelGetNodeArgs): Promise<{
    transactionId: string;
    file: string;
    treeVersion: number;
    node: {
      node_id: string;
      type: string;
      parent_node_id: string | null;
      index_position: number;
      child_count: number;
      structural_hash: string;
      offset_range: { start: number; end: number };
      children_node_ids: string[];
    };
    text_excerpt?: {
      text: string;
      truncated: boolean;
      returned_bytes: number;
      full_bytes: number;
    };
    identity_metrics: IdentityMetrics;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);
    const snapshot = await this.ensureSnapshot(session);
    const node = snapshot.nodesById.get(args.node_id);

    if (!node) {
      throw new ToolError("NOT_FOUND", "Node not found", {
        node_id: args.node_id,
      });
    }

    this.transactions.touch(session.transactionId);

    const response: {
      transactionId: string;
      file: string;
      treeVersion: number;
      node: {
        node_id: string;
        type: string;
        parent_node_id: string | null;
        index_position: number;
        child_count: number;
        structural_hash: string;
        offset_range: { start: number; end: number };
        children_node_ids: string[];
      };
      text_excerpt?: {
        text: string;
        truncated: boolean;
        returned_bytes: number;
        full_bytes: number;
      };
      identity_metrics: IdentityMetrics;
    } = {
      transactionId: session.transactionId,
      file: session.file,
      treeVersion: snapshot.treeVersion,
      node: {
        ...mapNodeRecord(node),
        children_node_ids: [...node.childrenNodeIds],
      },
      identity_metrics: snapshot.identityMetrics,
    };

    if (args.include_text) {
      response.text_excerpt = buildTextExcerpt(
        snapshot.sourceText,
        node.startOffset,
        node.endOffset,
        args.max_excerpt_bytes,
      );
    }

    return response;
  }

  public async insertChild(args: ScalpelInsertChildArgs): Promise<{
    transactionId: string;
    file: string;
    changed_node_ids: string[];
    new_tree_version: number;
    semantic_change: boolean;
    no_op: boolean;
    new_node_id?: string;
    removed_node_ids?: string[];
    diff?: DiffOutput;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);
    const snapshotBefore = await this.ensureSnapshot(session);
    const sourceTextBefore = serializeSnapshot(snapshotBefore);

    const result = this.trees.insertChild(
      session.transactionId,
      args.parent_node_id,
      args.position_index,
      args.node_descriptor as NodeDescriptorInput,
    );
    this.transactions.touch(session.transactionId);

    const snapshotAfter = this.trees.require(session.transactionId);
    const sourceTextAfter = serializeSnapshot(snapshotAfter);
    const affectedNodeBefore = snapshotAfter.nodesById.get(args.parent_node_id)!;
    
    const diff = result.noOp ? undefined : generateDiff({
        sourceTextBefore,
        sourceTextAfter,
        affectedNodeBefore,
        affectedNodeAfter: snapshotAfter.nodesById.get(args.parent_node_id)!,
        contextLines: 3
    });

    return mapMutationResponse(session, args.file, result, diff);
  }

  public async replaceNode(args: ScalpelReplaceNodeArgs): Promise<{
    transactionId: string;
    file: string;
    changed_node_ids: string[];
    new_tree_version: number;
    semantic_change: boolean;
    no_op: boolean;
    new_node_id?: string;
    removed_node_ids?: string[];
    diff?: DiffOutput;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);
    const snapshotBefore = await this.ensureSnapshot(session);
    const sourceTextBefore = serializeSnapshot(snapshotBefore);
    const nodeBefore = snapshotBefore.nodesById.get(args.node_id);
    if (!nodeBefore) throw new ToolError("NOT_FOUND", "Node not found", { node_id: args.node_id });
    const nodeBeforeCloned = { ...nodeBefore };

    const result = this.trees.replaceNode(
      session.transactionId,
      args.node_id,
      args.new_node_descriptor as NodeDescriptorInput,
    );
    this.transactions.touch(session.transactionId);

    const snapshotAfter = this.trees.require(session.transactionId);
    const sourceTextAfter = serializeSnapshot(snapshotAfter);
    
    let diff: DiffOutput | undefined;
    if (!result.noOp) {
      const affectedAfter = snapshotAfter.nodesById.get(args.node_id);
      diff = affectedAfter ? generateDiff({
        sourceTextBefore,
        sourceTextAfter,
        affectedNodeBefore: nodeBeforeCloned,
        affectedNodeAfter: affectedAfter,
        contextLines: 3
      }) : generateDiff({
        sourceTextBefore,
        sourceTextAfter,
        affectedNodeBefore: nodeBeforeCloned,
        contextLines: 3
      });
    }

    return mapMutationResponse(session, args.file, result, diff);
  }

  public async removeNode(args: ScalpelRemoveNodeArgs): Promise<{
    transactionId: string;
    file: string;
    changed_node_ids: string[];
    new_tree_version: number;
    semantic_change: boolean;
    no_op: boolean;
    new_node_id?: string;
    removed_node_ids?: string[];
    diff?: DiffOutput;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);
    const snapshotBefore = await this.ensureSnapshot(session);
    const sourceTextBefore = serializeSnapshot(snapshotBefore);
    const nodeBefore = snapshotBefore.nodesById.get(args.node_id);
    if (!nodeBefore) throw new ToolError("NOT_FOUND", "Node not found", { node_id: args.node_id });
    const nodeBeforeCloned = { ...nodeBefore };

    const result = this.trees.removeNode(session.transactionId, args.node_id);
    this.transactions.touch(session.transactionId);

    const snapshotAfter = this.trees.require(session.transactionId);
    const sourceTextAfter = serializeSnapshot(snapshotAfter);

    const diff = result.noOp ? undefined : generateDiff({
        sourceTextBefore,
        sourceTextAfter,
        affectedNodeBefore: nodeBeforeCloned,
        contextLines: 3
    });

    return mapMutationResponse(session, args.file, result, diff);
  }

  public async moveSubtree(args: ScalpelMoveSubtreeArgs): Promise<{
    transactionId: string;
    file: string;
    changed_node_ids: string[];
    new_tree_version: number;
    semantic_change: boolean;
    no_op: boolean;
    new_node_id?: string;
    removed_node_ids?: string[];
    diff?: DiffOutput;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);
    const snapshotBefore = await this.ensureSnapshot(session);
    const sourceTextBefore = serializeSnapshot(snapshotBefore);
    const nodeBefore = snapshotBefore.nodesById.get(args.node_id);
    if (!nodeBefore) throw new ToolError("NOT_FOUND", "Node not found", { node_id: args.node_id });
    const nodeBeforeCloned = { ...nodeBefore };

    const result = this.trees.moveSubtree(
      session.transactionId,
      args.node_id,
      args.new_parent_id,
      args.new_position,
    );
    this.transactions.touch(session.transactionId);

    const snapshotAfter = this.trees.require(session.transactionId);
    const sourceTextAfter = serializeSnapshot(snapshotAfter);

    let diff: DiffOutput | undefined;
    if (!result.noOp) {
      const affectedAfter = snapshotAfter.nodesById.get(args.node_id);
      diff = affectedAfter ? generateDiff({
        sourceTextBefore,
        sourceTextAfter,
        affectedNodeBefore: nodeBeforeCloned,
        affectedNodeAfter: affectedAfter,
        contextLines: 3
      }) : generateDiff({
        sourceTextBefore,
        sourceTextAfter,
        affectedNodeBefore: nodeBeforeCloned,
        contextLines: 3
      });
    }

    return mapMutationResponse(session, args.file, result, diff);
  }

  public async validateTransaction(
    args: ScalpelValidateTransactionArgs,
  ): Promise<{
    valid: boolean;
    issues: Array<{ code: string; message: string; node_id?: string }>;
    transactionId: string;
    treeVersion: number;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);
    await this.ensureSnapshot(session);
    const validation = this.trees.validate(session.transactionId);
    this.transactions.touch(session.transactionId);

    return {
      valid: validation.valid,
      issues: validation.issues.map((issue) =>
        issue.nodeId
          ? { code: issue.code, message: issue.message, node_id: issue.nodeId }
          : { code: issue.code, message: issue.message },
      ),
      transactionId: session.transactionId,
      treeVersion: validation.treeVersion,
    };
  }

  public async commit(args: ScalpelCommitArgs): Promise<{
    transactionId: string;
    file: string;
    file_hash_before: string;
    file_hash_after: string;
    bytes_changed: number;
    semantic_change_flag: boolean;
    changed_node_ids: string[];
    new_tree_version: number;
  }> {
    const session = this.requireSessionForFile(args.transaction_id, args.file);

    // 0% - Starting
    await this.server?.notification({
      method: "notifications/progress",
      params: {
        progressToken: args.transaction_id,
        progress: 0,
        total: 100,
      },
    });

    await this.ensureSnapshot(session);

    // 25% - Tree hydrated
    await this.server?.notification({
      method: "notifications/progress",
      params: {
        progressToken: args.transaction_id,
        progress: 25,
        total: 100,
      },
    });

    const result = await this.trees.commit(
      session.transactionId,
      session.absoluteFilePath,
    );

    // 75% - Tree committed
    await this.server?.notification({
      method: "notifications/progress",
      params: {
        progressToken: args.transaction_id,
        progress: 75,
        total: 100,
      },
    });

    session.workingVersion = result.treeVersion;
    session.committedVersion = result.treeVersion;
    this.transactions.touch(session.transactionId);

    // 100% - Complete
    await this.server?.notification({
      method: "notifications/progress",
      params: {
        progressToken: args.transaction_id,
        progress: 100,
        total: 100,
      },
    });

    return {
      transactionId: session.transactionId,
      file: args.file,
      file_hash_before: result.fileHashBefore,
      file_hash_after: result.fileHashAfter,
      bytes_changed: result.bytesChanged,
      semantic_change_flag: result.semanticChangeFlag,
      changed_node_ids: result.changedNodeIds,
      new_tree_version: result.treeVersion,
    };
  }

  public async rollback(
    args: ScalpelRollbackArgs,
  ): Promise<{ rolledBack: true; transactionId: string }> {
    this.requireSessionForFile(args.transaction_id, args.file);
    this.transactions.close(args.transaction_id);
    return {
      rolledBack: true,
      transactionId: args.transaction_id,
    };
  }

  public async healthCheck(): Promise<{
    status: "healthy";
    uptimeSeconds: number;
    activeTransactions: number;
    activeParsedTrees: number;
    supportedLanguages: readonly SupportedLanguage[];
    workspaceRoot: string;
  }> {
    return {
      status: "healthy",
      uptimeSeconds: Math.floor(process.uptime()),
      activeTransactions: this.transactions.countActive(),
      activeParsedTrees: this.trees.countActive(),
      supportedLanguages: SUPPORTED_LANGUAGES,
      workspaceRoot: this.config.workspaceRoot,
    };
  }

  public disposeTransaction(
    transactionId: string,
    reason: "closed" | "expired",
  ): void {
    this.trees.drop(transactionId);
    this.logger.info("Transaction disposed", { transactionId, reason });
  }

  private requireSessionForFile(
    transactionId: string,
    file: string,
  ): TransactionSession {
    const session = this.transactions.require(transactionId);
    if (session.file !== file) {
      throw new ToolError("INVALID_OPERATION", "Transaction/file mismatch", {
        expected_file: session.file,
        provided_file: file,
      });
    }
    return session;
  }

  private async ensureSnapshot(session: TransactionSession): Promise<TreeSnapshot> {
    return this.trees.hydrate(session);
  }
}

function inferLanguageFromPath(filePath: string): SupportedLanguage | undefined {
  const extension = path.extname(filePath).toLowerCase();

  // Try extension first
  if (extension && EXTENSION_LANGUAGE_MAP[extension]) {
    return EXTENSION_LANGUAGE_MAP[extension];
  }

  // Try filename (extensionless files)
  const basename = path.basename(filePath);
  if (FILENAME_LANGUAGE_MAP[basename]) {
    return FILENAME_LANGUAGE_MAP[basename];
  }

  return undefined;
}

async function assertFileIsReadable(filePath: string): Promise<void> {
  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new ToolError("NOT_FOUND", "File does not exist or is not readable", {
      file: filePath,
    });
  }
}

function traverseByDepth(
  rootNodeId: string,
  snapshot: { nodesById: Map<string, ParsedNodeRecord> },
  maxDepth: number,
): ParsedNodeRecord[] {
  const output: ParsedNodeRecord[] = [];
  const queue: Array<{ nodeId: string; depth: number }> = [
    { nodeId: rootNodeId, depth: 0 },
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const node = snapshot.nodesById.get(current.nodeId);
    if (!node) {
      continue;
    }

    output.push(node);

    if (current.depth >= maxDepth) {
      continue;
    }

    node.childrenNodeIds.forEach((childNodeId) => {
      queue.push({ nodeId: childNodeId, depth: current.depth + 1 });
    });
  }

  return output;
}

function mapNodeRecord(record: ParsedNodeRecord): {
  node_id: string;
  type: string;
  parent_node_id: string | null;
  index_position: number;
  child_count: number;
  structural_hash: string;
  offset_range: { start: number; end: number };
} {
  return {
    node_id: record.nodeId,
    type: record.type,
    parent_node_id: record.parentNodeId ?? null,
    index_position: record.indexPosition,
    child_count: record.childCount,
    structural_hash: record.structuralHash,
    offset_range: {
      start: record.startOffset,
      end: record.endOffset,
    },
  };
}

function mapMutationResponse(
  session: TransactionSession,
  file: string,
  result: MutationOperationResult,
  diff?: DiffOutput,
): {
  transactionId: string;
  file: string;
  changed_node_ids: string[];
  new_tree_version: number;
  semantic_change: boolean;
  no_op: boolean;
  new_node_id?: string;
  removed_node_ids?: string[];
  diff?: DiffOutput;
} {
  const response: {
    transactionId: string;
    file: string;
    changed_node_ids: string[];
    new_tree_version: number;
    semantic_change: boolean;
    no_op: boolean;
    new_node_id?: string;
    removed_node_ids?: string[];
    diff?: DiffOutput;
  } = {
    transactionId: session.transactionId,
    file,
    changed_node_ids: result.changedNodeIds,
    new_tree_version: result.treeVersion,
    semantic_change: result.semanticChange,
    no_op: result.noOp,
  };

  if (diff) {
    response.diff = diff;
  }

  if (result.newNodeId) {
    response.new_node_id = result.newNodeId;
  }
  if (result.removedNodeIds) {
    response.removed_node_ids = result.removedNodeIds;
  }

  return response;
}

function buildTextExcerpt(
  sourceText: string,
  startOffset: number,
  endOffset: number,
  maxBytes: number,
): {
  text: string;
  truncated: boolean;
  returned_bytes: number;
  full_bytes: number;
} {
  const nodeText = sourceText.slice(startOffset, endOffset);
  const fullBytes = Buffer.byteLength(nodeText, "utf8");
  if (fullBytes <= maxBytes) {
    return {
      text: nodeText,
      truncated: false,
      returned_bytes: fullBytes,
      full_bytes: fullBytes,
    };
  }

  const truncatedBuffer = Buffer.from(nodeText, "utf8").subarray(0, maxBytes);
  const truncatedText = truncatedBuffer.toString("utf8");
  return {
    text: truncatedText,
    truncated: true,
    returned_bytes: Buffer.byteLength(truncatedText, "utf8"),
    full_bytes: fullBytes,
  };
}
