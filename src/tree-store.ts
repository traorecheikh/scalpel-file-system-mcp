import { createHash } from "node:crypto";
import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { ToolError } from "./errors.js";
import {
  compileDescriptorForInsert,
  compileDescriptorForReplace,
  type NodeDescriptorInput,
} from "./descriptor-compiler.js";
import type { SupportedLanguage } from "./schemas.js";
import type { TransactionSession } from "./transaction-store.js";
import {
  parseSourceText as treeSitterParse,
  extractIdentityAnchor as treeSitterExtractAnchor,
  getNodeChildren,
  type ParserLanguage,
  type TreeSitterNode,
} from "./tree-sitter-parser.js";

const MAX_VALIDATION_ISSUES = 256;

export type { NodeDescriptorInput } from "./descriptor-compiler.js";

interface RawNodeRecord {
  instanceId: string;
  type: string;
  parentInstanceId: string | undefined;
  indexPosition: number;
  structuralHash: string;
  anchorSignature: string;
  leafHash: string;
  childCount: number;
  startOffset: number;
  endOffset: number;
  childrenInstanceIds: string[];
}

interface RawTree {
  language: ParserLanguage;
  sourceText: string;
  sourceHash: string;
  rootInstanceId: string;
  nodesByInstanceId: Map<string, RawNodeRecord>;
  preorderInstanceIds: string[];
}

interface ReconciliationCounters {
  exactMatches: number;
  fallbackMatches: number;
}

export interface IdentityMetrics {
  reusedNodeIds: number;
  newNodeIds: number;
  removedNodeIds: number;
  exactMatches: number;
  fallbackMatches: number;
  stabilityScore: number;
}

export interface ParsedNodeRecord {
  nodeId: string;
  instanceId: string;
  type: string;
  parentNodeId: string | undefined;
  indexPosition: number;
  structuralHash: string;
  anchorSignature: string;
  leafHash: string;
  childCount: number;
  startOffset: number;
  endOffset: number;
  childrenNodeIds: string[];
  sourceBacked: boolean;
  sourceSnippet?: string;
  sourceLayoutValid: boolean;
  sourceChildLayout?: Array<{
    childNodeId: string;
    startOffset: number;
    endOffset: number;
  }>;
  generatedSnippet?: string;
}

export interface TreeSnapshot {
  transactionId: string;
  language: ParserLanguage;
  sourceText: string;
  sourceHash: string;
  rootNodeId: string;
  treeVersion: number;
  nodeCount: number;
  nodesById: Map<string, ParsedNodeRecord>;
  identityMetrics: IdentityMetrics;
  dirty: boolean;
  mutationCount: number;
  tombstones: Set<string>;
  changedNodeIds: Set<string>;
  cachedTree?: any; // Tree-sitter Tree object (cached to avoid re-parsing)
}

export interface MutationOperationResult {
  treeVersion: number;
  changedNodeIds: string[];
  semanticChange: boolean;
  noOp: boolean;
  newNodeId?: string;
  removedNodeIds?: string[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  nodeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  treeVersion: number;
}

export interface CommitResult {
  treeVersion: number;
  fileHashBefore: string;
  fileHashAfter: string;
  bytesChanged: number;
  semanticChangeFlag: boolean;
  changedNodeIds: string[];
}

export class TreeStore {
  private readonly snapshots = new Map<string, TreeSnapshot>();

  public async hydrate(session: TransactionSession): Promise<TreeSnapshot> {
    const language = ensureParserLanguage(session.language);
    const sourceText = await readFile(session.absoluteFilePath, "utf8");
    const sourceHash = hash(sourceText);
    const previous = this.snapshots.get(session.transactionId);

    if (previous && previous.sourceHash === sourceHash) {
      return previous;
    }

    if (previous && previous.dirty) {
      throw new ToolError(
        "INVALID_OPERATION",
        "File changed on disk while transaction has uncommitted mutations",
        { transaction_id: session.transactionId, file_hash_previous: previous.sourceHash },
      );
    }

    const parseResult = parseSourceText(language, session.absoluteFilePath, sourceText);
    const rawTree = buildRawTree(language, sourceText, sourceHash, parseResult.rootNode);

    const nextTreeVersion = previous ? previous.treeVersion + 1 : session.workingVersion;
    session.workingVersion = nextTreeVersion;
    session.updatedAt = new Date().toISOString();

    const snapshot = previous
      ? reconcileTree(session.transactionId, nextTreeVersion, previous, rawTree, parseResult.tree)
      : materializeInitialTree(session.transactionId, nextTreeVersion, rawTree, parseResult.tree);

    this.snapshots.set(session.transactionId, snapshot);
    return snapshot;
  }

  public get(transactionId: string): TreeSnapshot | undefined {
    return this.snapshots.get(transactionId);
  }

  public require(transactionId: string): TreeSnapshot {
    const snapshot = this.snapshots.get(transactionId);
    if (!snapshot) {
      throw new ToolError("NOT_FOUND", "Parsed tree snapshot not found", {
        transaction_id: transactionId,
      });
    }
    return snapshot;
  }

  public drop(transactionId: string): void {
    this.snapshots.delete(transactionId);
  }

  public countActive(): number {
    return this.snapshots.size;
  }

  public insertChild(
    transactionId: string,
    parentNodeId: string,
    positionIndex: number,
    descriptorInput: NodeDescriptorInput,
  ): MutationOperationResult {
    const snapshot = this.require(transactionId);
    const parent = requireNode(snapshot, parentNodeId);
    const descriptor = compileDescriptorForInsert(descriptorInput, parent.type);

    if (positionIndex < 0 || positionIndex > parent.childrenNodeIds.length) {
      throw new ToolError("INVALID_OPERATION", "position_index out of bounds", {
        parent_node_id: parentNodeId,
        position_index: positionIndex,
        child_count: parent.childrenNodeIds.length,
      });
    }

    const leafHash = descriptorLeafHash(descriptor);
    const generatedSnippet = renderDescriptorSnippet(descriptor);
    const existingIdAtPosition = parent.childrenNodeIds[positionIndex];
    if (existingIdAtPosition) {
      const existingNode = snapshot.nodesById.get(existingIdAtPosition);
      if (
        existingNode &&
        existingNode.type === descriptor.nodeType &&
        existingNode.leafHash === leafHash &&
        existingNode.childrenNodeIds.length === 0
      ) {
        return {
          treeVersion: snapshot.treeVersion,
          changedNodeIds: [],
          semanticChange: false,
          noOp: true,
        };
      }
    }

    const usedNodeIds = new Set(snapshot.nodesById.keys());
    const newNodeId = createFreshNodeId(
      `${transactionId}|insert|${parentNodeId}|${positionIndex}|${descriptor.nodeType}|${leafHash}|${snapshot.treeVersion + 1}`,
      usedNodeIds,
    );

    const newRecord: ParsedNodeRecord = {
      nodeId: newNodeId,
      instanceId: `s_${hash(newNodeId)}`,
      type: descriptor.nodeType,
      parentNodeId,
      indexPosition: positionIndex,
      structuralHash: "",
      anchorSignature: buildSyntheticAnchor(parent.anchorSignature, descriptor.nodeType),
      leafHash,
      childCount: 0,
      startOffset: 0,
      endOffset: 0,
      childrenNodeIds: [],
      sourceBacked: false,
      sourceLayoutValid: false,
      generatedSnippet,
    };

    snapshot.nodesById.set(newNodeId, newRecord);
    parent.childrenNodeIds.splice(positionIndex, 0, newNodeId);
    parent.sourceLayoutValid = false;
    reindexChildren(snapshot, parentNodeId);
    recomputeNodeStructuralHash(snapshot, newNodeId);

    const changed = new Set<string>([newNodeId]);
    updateHashesUpward(snapshot, parentNodeId).forEach((id) => changed.add(id));

    snapshot.nodeCount = snapshot.nodesById.size;
    changed.forEach((id) => snapshot.changedNodeIds.add(id));
    const treeVersion = bumpTreeVersion(snapshot);
    return {
      treeVersion,
      changedNodeIds: Array.from(changed),
      semanticChange: true,
      noOp: false,
      newNodeId,
    };
  }

  public replaceNode(
    transactionId: string,
    nodeId: string,
    descriptorInput: NodeDescriptorInput,
  ): MutationOperationResult {
    const snapshot = this.require(transactionId);
    const node = snapshot.nodesById.get(nodeId);

    if (!node) {
      if (snapshot.tombstones.has(nodeId)) {
        return {
          treeVersion: snapshot.treeVersion,
          changedNodeIds: [],
          semanticChange: false,
          noOp: true,
        };
      }
      throw new ToolError("NOT_FOUND", "Node not found", { node_id: nodeId });
    }

    if (nodeId === snapshot.rootNodeId) {
      throw new ToolError("INVALID_OPERATION", "Replacing the root node is not allowed");
    }

    const descriptor = compileDescriptorForReplace(descriptorInput, node.type);
    const leafHash = descriptorLeafHash(descriptor);
    const generatedSnippet = renderDescriptorSnippet(descriptor);
    const isNoOp =
      node.type === descriptor.nodeType &&
      node.leafHash === leafHash &&
      node.childrenNodeIds.length === 0;

    if (isNoOp) {
      return {
        treeVersion: snapshot.treeVersion,
        changedNodeIds: [],
        semanticChange: false,
        noOp: true,
      };
    }

    const removedNodeIds = collectDescendantNodeIds(snapshot, nodeId);
    removedNodeIds.forEach((descendantId) => {
      snapshot.nodesById.delete(descendantId);
      snapshot.tombstones.add(descendantId);
    });

    node.type = descriptor.nodeType;
    node.leafHash = leafHash;
    node.childrenNodeIds = [];
    node.childCount = 0;
    node.startOffset = 0;
    node.endOffset = 0;
    node.sourceBacked = false;
    node.sourceLayoutValid = false;
    node.generatedSnippet = generatedSnippet;
    delete node.sourceSnippet;
    delete node.sourceChildLayout;
    if (node.parentNodeId) {
      const parent = requireNode(snapshot, node.parentNodeId);
      node.anchorSignature = buildSyntheticAnchor(parent.anchorSignature, descriptor.nodeType);
    }

    const changed = new Set<string>();
    updateHashesUpward(snapshot, nodeId).forEach((id) => changed.add(id));

    snapshot.nodeCount = snapshot.nodesById.size;
    changed.forEach((id) => snapshot.changedNodeIds.add(id));
    removedNodeIds.forEach((id) => snapshot.changedNodeIds.add(id));
    const treeVersion = bumpTreeVersion(snapshot);
    return {
      treeVersion,
      changedNodeIds: Array.from(changed),
      semanticChange: true,
      noOp: false,
      removedNodeIds,
    };
  }

  public removeNode(transactionId: string, nodeId: string): MutationOperationResult {
    const snapshot = this.require(transactionId);
    const node = snapshot.nodesById.get(nodeId);

    if (!node) {
      if (snapshot.tombstones.has(nodeId)) {
        return {
          treeVersion: snapshot.treeVersion,
          changedNodeIds: [],
          semanticChange: false,
          noOp: true,
        };
      }
      throw new ToolError("NOT_FOUND", "Node not found", { node_id: nodeId });
    }

    if (nodeId === snapshot.rootNodeId) {
      throw new ToolError("INVALID_OPERATION", "Removing the root node is not allowed");
    }

    const parentNodeId = node.parentNodeId;
    if (!parentNodeId) {
      throw new ToolError("INVALID_OPERATION", "Node has no parent and cannot be removed");
    }

    const removedNodeIds = collectSubtreeNodeIds(snapshot, nodeId);
    removedNodeIds.forEach((removedId) => {
      snapshot.nodesById.delete(removedId);
      snapshot.tombstones.add(removedId);
    });

    const parent = requireNode(snapshot, parentNodeId);
    parent.childrenNodeIds = parent.childrenNodeIds.filter((childId) => childId !== nodeId);
    parent.sourceLayoutValid = false;
    reindexChildren(snapshot, parentNodeId);

    const changed = new Set<string>();
    updateHashesUpward(snapshot, parentNodeId).forEach((id) => changed.add(id));

    snapshot.nodeCount = snapshot.nodesById.size;
    changed.forEach((id) => snapshot.changedNodeIds.add(id));
    removedNodeIds.forEach((id) => snapshot.changedNodeIds.add(id));
    const treeVersion = bumpTreeVersion(snapshot);
    return {
      treeVersion,
      changedNodeIds: Array.from(changed),
      semanticChange: true,
      noOp: false,
      removedNodeIds,
    };
  }

  public moveSubtree(
    transactionId: string,
    nodeId: string,
    newParentId: string,
    newPosition: number,
  ): MutationOperationResult {
    const snapshot = this.require(transactionId);
    const node = snapshot.nodesById.get(nodeId);

    if (!node) {
      if (snapshot.tombstones.has(nodeId)) {
        return {
          treeVersion: snapshot.treeVersion,
          changedNodeIds: [],
          semanticChange: false,
          noOp: true,
        };
      }
      throw new ToolError("NOT_FOUND", "Node not found", { node_id: nodeId });
    }

    if (nodeId === snapshot.rootNodeId) {
      throw new ToolError("INVALID_OPERATION", "Moving the root node is not allowed");
    }

    const newParent = requireNode(snapshot, newParentId);
    const oldParentId = node.parentNodeId;
    if (!oldParentId) {
      throw new ToolError("INVALID_OPERATION", "Node has no parent and cannot be moved");
    }

    if (nodeId === newParentId) {
      throw new ToolError("INVALID_OPERATION", "Cannot move a node under itself");
    }

    if (isDescendant(snapshot, newParentId, nodeId)) {
      throw new ToolError("INVALID_OPERATION", "Cannot move a node into its own subtree");
    }

    const oldParent = requireNode(snapshot, oldParentId);
    const oldIndex = oldParent.childrenNodeIds.indexOf(nodeId);
    if (oldIndex < 0) {
      throw new ToolError("INVALID_OPERATION", "Parent-child relationship is inconsistent", {
        node_id: nodeId,
        parent_node_id: oldParentId,
      });
    }

    if (newPosition < 0 || newPosition > newParent.childrenNodeIds.length) {
      throw new ToolError("INVALID_OPERATION", "new_position out of bounds", {
        new_parent_id: newParentId,
        new_position: newPosition,
        child_count: newParent.childrenNodeIds.length,
      });
    }

    if (oldParentId === newParentId && oldIndex === newPosition) {
      return {
        treeVersion: snapshot.treeVersion,
        changedNodeIds: [],
        semanticChange: false,
        noOp: true,
      };
    }

    oldParent.childrenNodeIds.splice(oldIndex, 1);
    oldParent.sourceLayoutValid = false;

    let insertionIndex = newPosition;
    if (oldParentId === newParentId && newPosition > oldIndex) {
      insertionIndex = newPosition - 1;
    }

    if (insertionIndex < 0 || insertionIndex > newParent.childrenNodeIds.length) {
      throw new ToolError("INVALID_OPERATION", "Adjusted new_position is out of bounds", {
        new_parent_id: newParentId,
        new_position: insertionIndex,
        child_count: newParent.childrenNodeIds.length,
      });
    }

    newParent.childrenNodeIds.splice(insertionIndex, 0, nodeId);
    newParent.sourceLayoutValid = false;
    node.parentNodeId = newParentId;

    if (oldParentId === newParentId) {
      reindexChildren(snapshot, oldParentId);
    } else {
      reindexChildren(snapshot, oldParentId);
      reindexChildren(snapshot, newParentId);
    }

    const changed = new Set<string>([nodeId]);
    updateHashesUpward(snapshot, oldParentId).forEach((id) => changed.add(id));
    if (newParentId !== oldParentId) {
      updateHashesUpward(snapshot, newParentId).forEach((id) => changed.add(id));
    }

    snapshot.nodeCount = snapshot.nodesById.size;
    changed.forEach((id) => snapshot.changedNodeIds.add(id));
    const treeVersion = bumpTreeVersion(snapshot);
    return {
      treeVersion,
      changedNodeIds: Array.from(changed),
      semanticChange: true,
      noOp: false,
    };
  }

  public validate(transactionId: string): ValidationResult {
    const snapshot = this.require(transactionId);
    const issues: ValidationIssue[] = [];
    const pushIssue = (issue: ValidationIssue): void => {
      if (issues.length < MAX_VALIDATION_ISSUES) {
        issues.push(issue);
      }
    };

    const root = snapshot.nodesById.get(snapshot.rootNodeId);
    if (!root) {
      pushIssue({
        code: "ROOT_MISSING",
        message: "Root node is missing from tree",
        nodeId: snapshot.rootNodeId,
      });
      return {
        valid: false,
        issues,
        treeVersion: snapshot.treeVersion,
      };
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const walk = (nodeId: string): void => {
      if (issues.length >= MAX_VALIDATION_ISSUES) {
        return;
      }
      if (visiting.has(nodeId)) {
        pushIssue({
          code: "CYCLE_DETECTED",
          message: "Cycle detected in parent-child graph",
          nodeId,
        });
        return;
      }
      if (visited.has(nodeId)) {
        return;
      }

      const node = snapshot.nodesById.get(nodeId);
      if (!node) {
        pushIssue({
          code: "MISSING_NODE",
          message: "Referenced node does not exist",
          nodeId,
        });
        return;
      }

      visited.add(nodeId);
      visiting.add(nodeId);

      const childSeen = new Set<string>();
      node.childrenNodeIds.forEach((childId, index) => {
        if (childSeen.has(childId)) {
          pushIssue({
            code: "DUPLICATE_CHILD",
            message: "Parent references same child more than once",
            nodeId,
          });
        }
        childSeen.add(childId);

        const child = snapshot.nodesById.get(childId);
        if (!child) {
          pushIssue({
            code: "MISSING_CHILD",
            message: "Parent references missing child",
            nodeId: childId,
          });
          return;
        }
        if (child.parentNodeId !== nodeId) {
          pushIssue({
            code: "PARENT_MISMATCH",
            message: "Child parent reference does not match parent",
            nodeId: childId,
          });
        }
        if (child.indexPosition !== index) {
          pushIssue({
            code: "INDEX_MISMATCH",
            message: "Child index_position does not match sibling index",
            nodeId: childId,
          });
        }

        walk(childId);
      });

      if (node.childCount !== node.childrenNodeIds.length) {
        pushIssue({
          code: "CHILD_COUNT_MISMATCH",
          message: "child_count does not match children array length",
          nodeId,
        });
      }

      if (node.parentNodeId) {
        const parent = snapshot.nodesById.get(node.parentNodeId);
        if (!parent) {
          pushIssue({
            code: "MISSING_PARENT",
            message: "Node references a missing parent",
            nodeId,
          });
        } else if (!parent.childrenNodeIds.includes(nodeId)) {
          pushIssue({
            code: "PARENT_CHILD_LINK_MISSING",
            message: "Parent does not include node in children list",
            nodeId,
          });
        }
      }

      visiting.delete(nodeId);
    };

    walk(snapshot.rootNodeId);

    for (const nodeId of snapshot.nodesById.keys()) {
      if (!visited.has(nodeId)) {
        pushIssue({
          code: "ORPHAN_NODE",
          message: "Node is unreachable from root",
          nodeId,
        });
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      treeVersion: snapshot.treeVersion,
    };
  }

  public async commit(
    transactionId: string,
    absoluteFilePath: string,
  ): Promise<CommitResult> {
    const snapshot = this.require(transactionId);
    const validation = this.validate(transactionId);
    if (!validation.valid) {
      throw new ToolError("INVALID_OPERATION", "Transaction validation failed", {
        issues: validation.issues.slice(0, 25),
      });
    }

    const fileTextBefore = await readFile(absoluteFilePath, "utf8");
    const fileHashBefore = hash(fileTextBefore);

    if (fileHashBefore !== snapshot.sourceHash) {
      throw new ToolError(
        "INVALID_OPERATION",
        "File changed on disk since transaction snapshot",
        {
          file_hash_snapshot: snapshot.sourceHash,
          file_hash_current: fileHashBefore,
        },
      );
    }

    const projectedText = serializeSnapshot(snapshot);
    const projectedHash = hash(projectedText);

    // Ensure projected output remains parseable before writing to disk.
    const sourceFile = parseSourceText(snapshot.language, absoluteFilePath, projectedText);
    const rawTree = buildRawTree(snapshot.language, projectedText, projectedHash, sourceFile);

    if (projectedText !== fileTextBefore) {
      await atomicWriteFile(absoluteFilePath, projectedText);
    }

    const semanticChangeFlag = snapshot.changedNodeIds.size > 0;
    const commitTreeVersion = semanticChangeFlag
      ? snapshot.treeVersion + 1
      : snapshot.treeVersion;
    const rebuilt = reconcileTree(transactionId, commitTreeVersion, snapshot, rawTree);
    rebuilt.dirty = false;
    rebuilt.mutationCount = 0;
    rebuilt.tombstones.clear();
    rebuilt.changedNodeIds.clear();
    this.snapshots.set(transactionId, rebuilt);

    return {
      treeVersion: rebuilt.treeVersion,
      fileHashBefore,
      fileHashAfter: projectedHash,
      bytesChanged: computeByteDelta(fileTextBefore, projectedText),
      semanticChangeFlag,
      changedNodeIds: Array.from(snapshot.changedNodeIds),
    };
  }
}

function ensureParserLanguage(language: SupportedLanguage): ParserLanguage {
  if (language === "typescript" || language === "javascript" || language === "java") {
    return language;
  }

  throw new ToolError(
    "NOT_IMPLEMENTED",
    `Language ${language} parser is not implemented yet.`,
  );
}

function parseSourceText(
  language: ParserLanguage,
  filePath: string,
  sourceText: string,
): { rootNode: TreeSitterNode; tree: any } {
  const parseResult = treeSitterParse(language, sourceText);
  return { rootNode: parseResult.tree.rootNode, tree: parseResult.tree };
}

function buildRawTree(
  language: ParserLanguage,
  sourceText: string,
  sourceHash: string,
  rootNode: TreeSitterNode,
): RawTree {
  const nodesByInstanceId = new Map<string, RawNodeRecord>();
  const preorderInstanceIds: string[] = [];

  const visit = (
    node: TreeSitterNode,
    parentInstanceId: string | undefined,
    pathKey: string,
    indexPosition: number,
    anchorScope: string[],
  ): string => {
    const childNodes = getNodeChildren(node);
    const type = node.type;
    const ownAnchor = treeSitterExtractAnchor(node);
    const nextAnchorScope = ownAnchor
      ? [...anchorScope, `${type}:${ownAnchor}`].slice(-5)
      : anchorScope;
    const anchorSignature = nextAnchorScope.length > 0 ? nextAnchorScope.join(">") : "root";
    const instanceId = `i_${hash(`${type}|${pathKey}`)}`;
    const startOffset = node.startIndex;
    const endOffset = node.endIndex;

    const leafHash = computeLeafHash(node, sourceText, childNodes.length);
    const structuralHash = buildStructuralHash(type, childNodes, leafHash);

    const record: RawNodeRecord = {
      instanceId,
      type,
      parentInstanceId,
      indexPosition,
      structuralHash,
      anchorSignature,
      leafHash,
      childCount: childNodes.length,
      startOffset,
      endOffset,
      childrenInstanceIds: [],
    };

    nodesByInstanceId.set(instanceId, record);
    preorderInstanceIds.push(instanceId);

    childNodes.forEach((child, childIndex) => {
      const childPathKey = `${pathKey}.${childIndex}`;
      const childId = visit(
        child,
        instanceId,
        childPathKey,
        childIndex,
        nextAnchorScope,
      );
      record.childrenInstanceIds.push(childId);
    });

    return instanceId;
  };

  const rootInstanceId = visit(rootNode, undefined, "0", 0, []);

  return {
    language,
    sourceText,
    sourceHash,
    rootInstanceId,
    nodesByInstanceId,
    preorderInstanceIds,
  };
}

function materializeInitialTree(
  transactionId: string,
  treeVersion: number,
  rawTree: RawTree,
  cachedTree?: any,
): TreeSnapshot {
  const usedNodeIds = new Set<string>();
  const instanceToNodeId = new Map<string, string>();

  rawTree.preorderInstanceIds.forEach((instanceId) => {
    const rawNode = rawTree.nodesByInstanceId.get(instanceId);
    if (!rawNode) {
      return;
    }
    instanceToNodeId.set(
      instanceId,
      createFreshNodeId(
        `${rawNode.instanceId}|${rawNode.type}|${rawNode.anchorSignature}|${rawNode.structuralHash}`,
        usedNodeIds,
      ),
    );
  });

  return materializeSnapshotFromRaw(
    transactionId,
    treeVersion,
    rawTree,
    instanceToNodeId,
    {
      reusedNodeIds: 0,
      newNodeIds: rawTree.preorderInstanceIds.length,
      removedNodeIds: 0,
      exactMatches: 0,
      fallbackMatches: 0,
      stabilityScore: 1,
    },
    cachedTree,
  );
}

function reconcileTree(
  transactionId: string,
  treeVersion: number,
  previous: TreeSnapshot,
  rawTree: RawTree,
  cachedTree?: any,
): TreeSnapshot {
  const usedOldNodeIds = new Set<string>();
  const instanceToNodeId = new Map<string, string>();
  const counters: ReconciliationCounters = { exactMatches: 0, fallbackMatches: 0 };

  const exactBuckets = bucketPreviousNodes(previous, (node) =>
    buildExactKey(node.type, node.structuralHash, node.anchorSignature),
  );

  for (const instanceId of rawTree.preorderInstanceIds) {
    const rawNode = rawTree.nodesByInstanceId.get(instanceId);
    if (!rawNode) {
      continue;
    }

    const exactKey = buildExactKey(
      rawNode.type,
      rawNode.structuralHash,
      rawNode.anchorSignature,
    );
    const candidate = pickBestCandidate(
      exactBuckets.get(exactKey) ?? [],
      rawNode,
      usedOldNodeIds,
    );

    if (candidate) {
      instanceToNodeId.set(instanceId, candidate.nodeId);
      usedOldNodeIds.add(candidate.nodeId);
      counters.exactMatches += 1;
    }
  }

  const fallbackBuckets = bucketPreviousNodes(previous, (node) =>
    buildFallbackKey(node.type, node.anchorSignature, node.childCount, node.leafHash),
  );

  for (const instanceId of rawTree.preorderInstanceIds) {
    if (instanceToNodeId.has(instanceId)) {
      continue;
    }
    const rawNode = rawTree.nodesByInstanceId.get(instanceId);
    if (!rawNode) {
      continue;
    }

    const fallbackKey = buildFallbackKey(
      rawNode.type,
      rawNode.anchorSignature,
      rawNode.childCount,
      rawNode.leafHash,
    );
    const candidate = pickBestCandidate(
      fallbackBuckets.get(fallbackKey) ?? [],
      rawNode,
      usedOldNodeIds,
    );

    if (candidate) {
      instanceToNodeId.set(instanceId, candidate.nodeId);
      usedOldNodeIds.add(candidate.nodeId);
      counters.fallbackMatches += 1;
    }
  }

  const freshIdSet = new Set(usedOldNodeIds);
  for (const instanceId of rawTree.preorderInstanceIds) {
    if (instanceToNodeId.has(instanceId)) {
      continue;
    }
    const rawNode = rawTree.nodesByInstanceId.get(instanceId);
    if (!rawNode) {
      continue;
    }
    const nodeId = createFreshNodeId(
      `${rawNode.instanceId}|${rawNode.type}|${rawNode.anchorSignature}|${rawNode.structuralHash}`,
      freshIdSet,
    );
    instanceToNodeId.set(instanceId, nodeId);
  }

  const reusedNodeIds = usedOldNodeIds.size;
  const newNodeIds = rawTree.preorderInstanceIds.length - reusedNodeIds;
  const removedNodeIds = Math.max(previous.nodesById.size - reusedNodeIds, 0);
  const stabilityScore =
    rawTree.preorderInstanceIds.length === 0
      ? 1
      : reusedNodeIds / rawTree.preorderInstanceIds.length;

  return materializeSnapshotFromRaw(
    transactionId,
    treeVersion,
    rawTree,
    instanceToNodeId,
    {
      reusedNodeIds,
      newNodeIds,
      removedNodeIds,
      exactMatches: counters.exactMatches,
      fallbackMatches: counters.fallbackMatches,
      stabilityScore,
    },
    cachedTree,
  );
}

function materializeSnapshotFromRaw(
  transactionId: string,
  treeVersion: number,
  rawTree: RawTree,
  instanceToNodeId: Map<string, string>,
  identityMetrics: IdentityMetrics,
  cachedTree?: any,
): TreeSnapshot {
  const nodesById = new Map<string, ParsedNodeRecord>();

  rawTree.preorderInstanceIds.forEach((instanceId) => {
    const rawNode = rawTree.nodesByInstanceId.get(instanceId);
    if (!rawNode) {
      return;
    }

    const nodeId = instanceToNodeId.get(instanceId);
    if (!nodeId) {
      return;
    }

    const parentNodeId = rawNode.parentInstanceId
      ? instanceToNodeId.get(rawNode.parentInstanceId)
      : undefined;

    const childrenNodeIds = rawNode.childrenInstanceIds
      .map((childInstanceId) => instanceToNodeId.get(childInstanceId))
      .filter((value): value is string => typeof value === "string");

    const sourceSnippet = rawTree.sourceText.slice(rawNode.startOffset, rawNode.endOffset);
    const sourceChildLayout = rawNode.childrenInstanceIds
      .map((childInstanceId) => {
        const childNodeId = instanceToNodeId.get(childInstanceId);
        const childRaw = rawTree.nodesByInstanceId.get(childInstanceId);
        if (!childNodeId || !childRaw) {
          return undefined;
        }
        return {
          childNodeId,
          startOffset: childRaw.startOffset,
          endOffset: childRaw.endOffset,
        };
      })
      .filter(
        (value): value is { childNodeId: string; startOffset: number; endOffset: number } =>
          value !== undefined,
      );

    nodesById.set(nodeId, {
      nodeId,
      instanceId: rawNode.instanceId,
      type: rawNode.type,
      parentNodeId,
      indexPosition: rawNode.indexPosition,
      structuralHash: rawNode.structuralHash,
      anchorSignature: rawNode.anchorSignature,
      leafHash: rawNode.leafHash,
      childCount: rawNode.childCount,
      startOffset: rawNode.startOffset,
      endOffset: rawNode.endOffset,
      childrenNodeIds,
      sourceBacked: true,
      sourceSnippet,
      sourceLayoutValid: true,
      sourceChildLayout,
    });
  });

  const rootNodeId = instanceToNodeId.get(rawTree.rootInstanceId);
  if (!rootNodeId) {
    throw new ToolError("INTERNAL_ERROR", "Unable to resolve root node ID");
  }

  return {
    transactionId,
    language: rawTree.language,
    sourceText: rawTree.sourceText,
    sourceHash: rawTree.sourceHash,
    rootNodeId,
    treeVersion,
    nodeCount: nodesById.size,
    nodesById,
    identityMetrics,
    dirty: false,
    mutationCount: 0,
    tombstones: new Set<string>(),
    changedNodeIds: new Set<string>(),
    cachedTree,
  };
}

function bucketPreviousNodes(
  snapshot: TreeSnapshot,
  makeKey: (node: ParsedNodeRecord) => string,
): Map<string, ParsedNodeRecord[]> {
  const buckets = new Map<string, ParsedNodeRecord[]>();
  for (const node of snapshot.nodesById.values()) {
    const key = makeKey(node);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(node);
      continue;
    }
    buckets.set(key, [node]);
  }
  return buckets;
}

function pickBestCandidate(
  candidates: ParsedNodeRecord[],
  rawNode: RawNodeRecord,
  usedOldNodeIds: Set<string>,
): ParsedNodeRecord | undefined {
  let winner: ParsedNodeRecord | undefined;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (usedOldNodeIds.has(candidate.nodeId)) {
      continue;
    }

    const distance = Math.abs(candidate.startOffset - rawNode.startOffset);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      winner = candidate;
    }
  }

  return winner;
}

function buildExactKey(
  type: string,
  structuralHash: string,
  anchorSignature: string,
): string {
  return `${type}|${structuralHash}|${anchorSignature}`;
}

function buildFallbackKey(
  type: string,
  anchorSignature: string,
  childCount: number,
  leafHash: string,
): string {
  return `${type}|${anchorSignature}|${childCount}|${leafHash}`;
}

function buildStructuralHash(
  type: string,
  childNodes: TreeSitterNode[],
  leafHash: string,
): string {
  const childTypes = childNodes.map((child) => child.type).join(",");
  return hash(`${type}|${childTypes}|${leafHash}`);
}

function computeLeafHash(
  node: TreeSitterNode,
  sourceText: string,
  childCount: number,
): string {
  if (childCount > 0) {
    return "";
  }
  const rawLeafText = sourceText.slice(node.startIndex, node.endIndex);
  const normalized = normalizeLeafText(rawLeafText).slice(0, 256);
  return hash(normalized);
}

function normalizeLeafText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function createFreshNodeId(seed: string, usedNodeIds: Set<string>): string {
  let attempt = 0;
  while (attempt < 1000) {
    const nodeId = `n_${hash(`${seed}|${attempt}`)}`;
    if (!usedNodeIds.has(nodeId)) {
      usedNodeIds.add(nodeId);
      return nodeId;
    }
    attempt += 1;
  }
  throw new ToolError("INTERNAL_ERROR", "Unable to allocate unique node ID");
}

function hash(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }

  const objectValue = value as Record<string, unknown>;
  const keys = Object.keys(objectValue).sort();
  const serializedEntries = keys.map(
    (key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`,
  );
  return `{${serializedEntries.join(",")}}`;
}

function descriptorLeafHash(descriptor: {
  kind: string;
  nodeType: string;
  value?: unknown;
  fields?: Record<string, unknown>;
}): string {
  const payload: Record<string, unknown> = {
    kind: descriptor.kind,
    node_type: descriptor.nodeType,
  };

  if (descriptor.value !== undefined) {
    payload.value = descriptor.value;
  }
  if (descriptor.fields !== undefined) {
    payload.fields = descriptor.fields;
  }

  return hash(stableSerialize(payload));
}

function serializeSnapshot(snapshot: TreeSnapshot): string {
  const text = serializeNode(snapshot, snapshot.rootNodeId, new Set<string>());
  if (text.length === 0) {
    return "";
  }
  return text.endsWith("\n") ? text : `${text}\n`;
}

function serializeNode(
  snapshot: TreeSnapshot,
  nodeId: string,
  stack: Set<string>,
): string {
  if (stack.has(nodeId)) {
    throw new ToolError("INVALID_OPERATION", "Cycle detected during serialization", {
      node_id: nodeId,
    });
  }

  const node = requireNode(snapshot, nodeId);
  stack.add(nodeId);

  try {
    if (node.type === "SourceFile" || node.type === "program") {
      if (canUseSourceLayout(node)) {
        return renderFromSourceLayout(snapshot, node, stack);
      }

      const childTexts = node.childrenNodeIds
        .map((childId) => serializeNode(snapshot, childId, stack))
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      if (childTexts.length === 0) {
        return "";
      }
      return `${childTexts.join("\n")}\n`;
    }

    if (canUseSourceLayout(node)) {
      return renderFromSourceLayout(snapshot, node, stack);
    }

    if (node.generatedSnippet !== undefined) {
      if (node.childrenNodeIds.length === 0) {
        return node.generatedSnippet;
      }
      const childTexts = node.childrenNodeIds
        .map((childId) => serializeNode(snapshot, childId, stack))
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      if (childTexts.length === 0) {
        return node.generatedSnippet;
      }
      return `${node.generatedSnippet} ${childTexts.join(" ")}`.trim();
    }

    if (node.sourceBacked && node.sourceSnippet !== undefined && node.childrenNodeIds.length === 0) {
      return node.sourceSnippet;
    }

    throw new ToolError(
      "INVALID_OPERATION",
      `Cannot serialize node ${node.nodeId} (${node.type}) after structural mutation`,
      {
        node_id: node.nodeId,
        node_type: node.type,
      },
    );
  } finally {
    stack.delete(nodeId);
  }
}

function canUseSourceLayout(node: ParsedNodeRecord): boolean {
  if (!node.sourceBacked || !node.sourceLayoutValid || node.sourceSnippet === undefined) {
    return false;
  }
  if (!node.sourceChildLayout) {
    return node.childrenNodeIds.length === 0;
  }
  if (node.sourceChildLayout.length !== node.childrenNodeIds.length) {
    return false;
  }
  for (let i = 0; i < node.sourceChildLayout.length; i += 1) {
    if (node.sourceChildLayout[i]?.childNodeId !== node.childrenNodeIds[i]) {
      return false;
    }
  }
  return true;
}

function renderFromSourceLayout(
  snapshot: TreeSnapshot,
  node: ParsedNodeRecord,
  stack: Set<string>,
): string {
  const sourceSnippet = node.sourceSnippet ?? "";
  if (!node.sourceChildLayout || node.sourceChildLayout.length === 0) {
    return sourceSnippet;
  }

  let cursor = 0;
  let output = "";

  for (let i = 0; i < node.sourceChildLayout.length; i += 1) {
    const entry = node.sourceChildLayout[i];
    if (!entry) {
      continue;
    }
    const childNodeId = node.childrenNodeIds[i];
    if (!childNodeId) {
      throw new ToolError("INVALID_OPERATION", "Source layout/children mismatch during render", {
        node_id: node.nodeId,
      });
    }

    const relStart = entry.startOffset - node.startOffset;
    const relEnd = entry.endOffset - node.startOffset;

    if (
      relStart < cursor ||
      relEnd < relStart ||
      relEnd > sourceSnippet.length
    ) {
      throw new ToolError("INVALID_OPERATION", "Invalid source layout boundaries", {
        node_id: node.nodeId,
        rel_start: relStart,
        rel_end: relEnd,
      });
    }

    output += sourceSnippet.slice(cursor, relStart);
    output += serializeNode(snapshot, childNodeId, stack);
    cursor = relEnd;
  }

  output += sourceSnippet.slice(cursor);
  return output;
}

function renderDescriptorSnippet(descriptor: {
  kind: string;
  nodeType: string;
  value?: unknown;
  fields?: Record<string, unknown>;
}): string {
  switch (descriptor.kind) {
    case "identifier": {
      const name =
        typeof descriptor.value === "string"
          ? descriptor.value
          : typeof descriptor.fields?.name === "string"
            ? descriptor.fields.name
            : "identifier";
      return name;
    }
    case "literal":
      return renderLiteral(descriptor.value, descriptor.nodeType);
    case "parameter": {
      const name =
        typeof descriptor.fields?.name === "string"
          ? descriptor.fields.name
          : "param";
      const optional = descriptor.fields?.optional === true ? "?" : "";
      const datatype =
        typeof descriptor.fields?.datatype === "string"
          ? `: ${descriptor.fields.datatype}`
          : "";
      const initializer =
        descriptor.fields?.value !== undefined
          ? ` = ${renderLiteral(descriptor.fields.value)}`
          : "";
      return `${name}${optional}${datatype}${initializer}`;
    }
    case "field": {
      const name =
        typeof descriptor.fields?.name === "string"
          ? descriptor.fields.name
          : "field";
      const readonly = descriptor.fields?.readonly === true ? "readonly " : "";
      const optional = descriptor.fields?.optional === true ? "?" : "";
      const datatype =
        typeof descriptor.fields?.datatype === "string"
          ? `: ${descriptor.fields.datatype}`
          : "";
      const assignment =
        descriptor.fields?.value !== undefined
          ? ` = ${renderLiteral(descriptor.fields.value)}`
          : "";
      return `${readonly}${name}${optional}${datatype}${assignment}`;
    }
    case "import_specifier": {
      const name =
        typeof descriptor.fields?.name === "string"
          ? descriptor.fields.name
          : "symbol";
      const alias =
        typeof descriptor.fields?.alias === "string"
          ? ` as ${descriptor.fields.alias}`
          : "";
      return `${name}${alias}`;
    }
    case "raw_node":
      if (typeof descriptor.value === "string" && descriptor.value.trim().length > 0) {
        return descriptor.value;
      }
      return `/* ${descriptor.nodeType} */`;
    default:
      return `/* ${descriptor.nodeType} */`;
  }
}

function renderLiteral(value: unknown, nodeType?: string): string {
  if (nodeType === "TrueKeyword") {
    return "true";
  }
  if (nodeType === "FalseKeyword") {
    return "false";
  }
  if (nodeType === "NullKeyword") {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (value === true) {
    return "true";
  }
  if (value === false) {
    return "false";
  }
  if (value === null) {
    return "null";
  }
  return "undefined";
}

async function atomicWriteFile(targetFilePath: string, contents: string): Promise<void> {
  const tmpFilePath = `${targetFilePath}.scalpel-tmp-${process.pid}-${Date.now()}`;

  try {
    await writeFile(tmpFilePath, contents, "utf8");
    await rename(tmpFilePath, targetFilePath);
  } catch (error) {
    await unlink(tmpFilePath).catch(() => undefined);
    throw error;
  }
}

function computeByteDelta(beforeText: string, afterText: string): number {
  const before = Buffer.from(beforeText, "utf8");
  const after = Buffer.from(afterText, "utf8");
  const min = Math.min(before.length, after.length);

  let delta = Math.abs(before.length - after.length);
  for (let i = 0; i < min; i += 1) {
    if (before[i] !== after[i]) {
      delta += 1;
    }
  }

  return delta;
}

function buildSyntheticAnchor(parentAnchorSignature: string, type: string): string {
  const base = parentAnchorSignature === "root" ? [] : parentAnchorSignature.split(">");
  return [...base, `synthetic:${type}`].slice(-5).join(">") || "root";
}

function requireNode(snapshot: TreeSnapshot, nodeId: string): ParsedNodeRecord {
  const node = snapshot.nodesById.get(nodeId);
  if (!node) {
    throw new ToolError("NOT_FOUND", "Node not found", { node_id: nodeId });
  }
  return node;
}

function reindexChildren(snapshot: TreeSnapshot, parentNodeId: string): void {
  const parent = requireNode(snapshot, parentNodeId);
  parent.childrenNodeIds.forEach((childId, index) => {
    const child = requireNode(snapshot, childId);
    child.indexPosition = index;
    child.parentNodeId = parentNodeId;
  });
  parent.childCount = parent.childrenNodeIds.length;
}

function recomputeNodeStructuralHash(snapshot: TreeSnapshot, nodeId: string): boolean {
  const node = requireNode(snapshot, nodeId);
  const childTypeSignature = node.childrenNodeIds
    .map((childId) => {
      const child = requireNode(snapshot, childId);
      return child.type;
    })
    .join(",");
  const nextHash = hash(`${node.type}|${childTypeSignature}|${node.leafHash}`);
  const changed = nextHash !== node.structuralHash;
  node.structuralHash = nextHash;
  node.childCount = node.childrenNodeIds.length;
  return changed;
}

function updateHashesUpward(snapshot: TreeSnapshot, startNodeId: string): string[] {
  const changed: string[] = [];
  let currentNodeId: string | undefined = startNodeId;

  while (currentNodeId) {
    const node = requireNode(snapshot, currentNodeId);
    const wasChanged = recomputeNodeStructuralHash(snapshot, currentNodeId);
    if (wasChanged || changed.length === 0) {
      changed.push(currentNodeId);
    }
    currentNodeId = node.parentNodeId;
  }

  return changed;
}

function collectSubtreeNodeIds(snapshot: TreeSnapshot, nodeId: string): string[] {
  const ids: string[] = [];
  const stack = [nodeId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const node = requireNode(snapshot, current);
    ids.push(current);
    node.childrenNodeIds.forEach((childId) => {
      stack.push(childId);
    });
  }

  return ids;
}

function collectDescendantNodeIds(snapshot: TreeSnapshot, nodeId: string): string[] {
  const node = requireNode(snapshot, nodeId);
  const ids: string[] = [];
  const stack = [...node.childrenNodeIds];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }
    const currentNode = requireNode(snapshot, current);
    ids.push(current);
    currentNode.childrenNodeIds.forEach((childId) => {
      stack.push(childId);
    });
  }

  return ids;
}

function isDescendant(snapshot: TreeSnapshot, candidateNodeId: string, ancestorNodeId: string): boolean {
  let current: string | undefined = candidateNodeId;
  while (current) {
    if (current === ancestorNodeId) {
      return true;
    }
    const node = snapshot.nodesById.get(current);
    current = node?.parentNodeId;
  }
  return false;
}

function bumpTreeVersion(snapshot: TreeSnapshot): number {
  snapshot.treeVersion += 1;
  snapshot.dirty = true;
  snapshot.mutationCount += 1;
  return snapshot.treeVersion;
}
