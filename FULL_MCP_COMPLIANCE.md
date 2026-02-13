# FULL MCP COMPLIANCE IMPLEMENTATION GUIDE

**META-PROMPT FOR AI IMPLEMENTATION**

This document is a complete implementation guide for making Scalpel MCP Server **fully compliant** with the Model Context Protocol specification and addressing critical usability issues.

---

## 🚨 REPORTED ERROR FROM REAL USAGE

```
╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✓  scalpel_begin_transaction (scalpel MCP Server) {"file":"README.md"}                                                                                        │
│                                                                                                                                                               │
│ {                                                                                                                                                             │
│   "success": false,                                                                                                                                           │
│   "error": {                                                                                                                                                  │
│     "code": "INVALID_OPERATION",                                                                                                                              │
│     "message": "Unable to infer file language. Provide language explicitly."                                                                                  │
│   },                                                                                                                                                          │
│   "metadata": {                                                                                                                                               │
│     "requestId": "714d302a-b326-4ae1-9a55-12f45d66e9a8",                                                                                                      │
│     "timestamp": "2026-02-13T10:45:06.248Z"                                                                                                                   │
│   }                                                                                                                                                           │
│ }                                                                                                                                                             │
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**User Feedback**:
> "The tool should be able to modify text, markdown, files without extension otherwise it's stupid. Also I hope the tool can create new files with data in it?"

**Translation**: Scalpel MCP is currently **USELESS** for 90% of real-world files because it only supports 5 programming languages and cannot create files.

---

## 🚨 CRITICAL ISSUES DISCOVERED (NEW - Feb 13, 2026)

### Issue #1: `scalpel_search_structure` TSQuery Syntax Error

**Error Output**:
```
╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✓  scalpel_search_structure (scalpel MCP Server)                                                              │
│    {"selector":"property_identifier[text=\"quality\"]","transaction_id":"...","file":"..."}                    │
│                                                                                                                │
│ {                                                                                                              │
│   "success": false,                                                                                            │
│   "error": {                                                                                                   │
│     "code": "INVALID_OPERATION",                                                                               │
│     "message": "Invalid query: Query error of type TSQueryErrorField at position 21",                          │
│     "details": {                                                                                               │
│       "selector": "property_identifier[text=\"quality\"]",                                                     │
│       "queryString": "(property_identifier text: (_) @val (#eq? @val \"quality\")) @match"                     │
│     }                                                                                                           │
│   },                                                                                                           │
│   "metadata": {                                                                                                │
│     "requestId": "8b98b714-e63f-45bc-9941-3b363c20e2bb",                                                       │
│     "timestamp": "2026-02-13T10:46:57.460Z"                                                                    │
│   }                                                                                                            │
│ }                                                                                                              │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Root Cause**: The selector syntax `property_identifier[text="quality"]` is being transformed to an invalid tree-sitter query. The `text:` field syntax is invalid.

**Location**: `src/service.ts` - `selectorToQuery()` function

**Impact**: 
- CRITICAL - `scalpel_search_structure` tool is completely broken for attribute-based searches
- Users cannot find nodes by their text content
- Forces users to use `scalpel_list_nodes` and manually search through results

**Expected Behavior**:
```typescript
// User provides:
selector: 'property_identifier[text="quality"]'

// Should generate valid tree-sitter query:
(property_identifier) @match (#eq? @match "quality")

// NOT the invalid:
(property_identifier text: (_) @val (#eq? @val "quality")) @match  // ❌ WRONG
```

**Fix Required**: Update `selectorToQuery()` in `src/service.ts` to generate correct tree-sitter query syntax for attribute predicates.

---

### Issue #2: No Diff Output in Tool Responses

**User Feedback**:
> "The fact the MCP doesn't show diffs is bad"

**Current Behavior**:
When `scalpel_replace_node` or `scalpel_update_node` succeeds, the response only shows:
```json
{
  "success": true,
  "result": {
    "node_id": "abc123",
    "transaction_id": "xyz789"
  }
}
```

**Problem**: 
- Users have NO IDEA what actually changed
- Cannot verify the edit was correct without reading the entire file again
- Poor user experience - forces manual verification

**Expected Behavior**:
```json
{
  "success": true,
  "result": {
    "node_id": "abc123",
    "transaction_id": "xyz789",
    "diff": {
      "before": "quality: 80",
      "after": "quality: 90",
      "unified_diff": "- quality: 80\n+ quality: 90"
    }
  }
}
```

**Impact**: MEDIUM-HIGH - Severely impacts usability and debugging

**Fix Required**: 
1. Update `ScalpelReplaceNodeResultSchema` in `src/schemas.ts` to include optional `diff` field
2. Modify `replaceNode()` in `src/service.ts` to capture before/after text
3. Generate unified diff format output
4. Add `show_diff: boolean = true` parameter to tool schemas

---

### Issue #3: Node Listing Shows Only Subset of Results

**User Observation**:
> File has 491 total nodes but `scalpel_list_nodes` returns only a small truncated subset

**Current Behavior**:
- `scalpel_list_nodes` has `depth` parameter but no pagination
- Large files return incomplete results
- Users cannot navigate to nodes beyond the truncated output

**Impact**: HIGH - Makes large files extremely difficult to work with

**Fix Required**: See "PHASE 0: PAGINATION ENHANCEMENT" below

---

## 🎯 IMPLEMENTATION OBJECTIVES

### PRIMARY GOALS

1. ✅ **Fix Critical Bugs** - TSQuery syntax, diff output, pagination (PHASE 0)
2. ✅ **Fix Language Inference Failure** - Support markdown, text files, and files without extensions
3. ✅ **Add File Creation Capability** - Allow creating new files with initial content
4. ✅ **Full MCP Protocol Compliance** - Implement all missing MCP capabilities
5. ✅ **Universal File Support** - Edit ANY file type, not just programming languages

### NEW CRITICAL BUGS TO FIX (Feb 13, 2026)

1. **`scalpel_search_structure` broken** - TSQuery syntax error with `text:` field
2. **No diff output** - Cannot see what changed after edits
3. **Node pagination missing** - Large files (491+ nodes) show incomplete results

### ORIGINAL CRITICAL BUG TO FIX

```
╭───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✓  scalpel_begin_transaction (scalpel MCP Server) {"file":"README.md"}                                                                                        │
│                                                                                                                                                               │
│ {                                                                                                                                                             │
│   "success": false,                                                                                                                                           │
│   "error": {                                                                                                                                                  │
│     "code": "INVALID_OPERATION",                                                                                                                              │
│     "message": "Unable to infer file language. Provide language explicitly."                                                                                  │
│   },                                                                                                                                                          │
│   "metadata": {                                                                                                                                               │
│     "requestId": "714d302a-b326-4ae1-9a55-12f45d66e9a8",                                                                                                      │
│     "timestamp": "2026-02-13T10:45:06.248Z"                                                                                                                   │
│   }                                                                                                                                                           │
│ }                                                                                                                                                             │
╰───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

**Root Cause**: `service.ts:76-84` only supports 5 programming languages (TypeScript, JavaScript, Dart, Java, Rust) and fails for markdown, text, and other file types.

---

## 📋 IMPLEMENTATION ROADMAP

### PHASE 0: CRITICAL BUG FIXES (DO THESE FIRST - 2-3 hours)

**Priority**: CRITICAL - These bugs break basic functionality and must be fixed before v2.1 release.

---

#### 0.1 Fix `scalpel_search_structure` TSQuery Syntax

**Issue**: `property_identifier[text="quality"]` generates invalid tree-sitter query `text: (_)` syntax.

**File**: `src/service.ts`

**Current Implementation** (BROKEN):
```typescript
// Line ~150-200 in src/service.ts
function selectorToQuery(selector: string): string {
  // Current code generates: (property_identifier text: (_) @val (#eq? @val "quality")) @match
  // This is INVALID tree-sitter syntax
}
```

**Fix Required**:
```typescript
// src/service.ts - Update selectorToQuery()
function selectorToQuery(selector: string): string {
  // Match attribute syntax: node_type[attribute="value"]
  const attributeMatch = selector.match(/^(\w+)\[text="([^"]+)"\]$/);
  
  if (attributeMatch) {
    const [, nodeType, textValue] = attributeMatch;
    // Generate correct syntax: (node_type) @match (#eq? @match "value")
    return `(${nodeType}) @match (#eq? @match "${textValue}")`;
  }
  
  // Handle other selector types (existing logic)
  // ... rest of function
}
```

**Test Case**:
```typescript
// Input selector:
"property_identifier[text=\"quality\"]"

// Expected tree-sitter query:
"(property_identifier) @match (#eq? @match \"quality\")"

// NOT:
"(property_identifier text: (_) @val (#eq? @val \"quality\")) @match"  // ❌ WRONG
```

**Validation**:
```bash
# After fix, test with:
scalpel_search_structure({
  file: "nuxt.config.ts",
  transaction_id: "...",
  selector: 'property_identifier[text="quality"]'
})

# Should return nodes, not TSQueryErrorField
```

**Effort**: 1 hour

---

#### 0.2 Add Diff Output to Edit Operations

**Issue**: Users cannot see what changed after edits - poor UX.

**Files**: 
- `src/schemas.ts` (add diff field)
- `src/service.ts` (capture before/after, generate diff)

**Step 1 - Update Schemas** (`src/schemas.ts`):
```typescript
// Add diff schema
export const DiffOutputSchema = z.object({
  before: z.string().describe("Original text"),
  after: z.string().describe("New text"),
  unified_diff: z.string().describe("Unified diff format (- old, + new)"),
}).strict();

// Update result schemas to include diff
export const ScalpelReplaceNodeResultSchema = z.object({
  node_id: NodeIdSchema,
  transaction_id: TransactionIdSchema,
  diff: DiffOutputSchema.optional().describe("Visual diff of the change"),
}).strict();

export const ScalpelUpdateNodeResultSchema = z.object({
  node_id: NodeIdSchema,
  transaction_id: TransactionIdSchema,
  diff: DiffOutputSchema.optional().describe("Visual diff of the change"),
}).strict();
```

**Step 2 - Update Tool Args** (`src/schemas.ts`):
```typescript
export const ScalpelReplaceNodeArgsSchema = z.object({
  file: FilePathSchema,
  node_id: NodeIdSchema,
  new_text: NewTextSchema,
  transaction_id: TransactionIdSchema,
  show_diff: z.boolean().default(true).describe("Include diff in response"),
}).strict();

export const ScalpelUpdateNodeArgsSchema = z.object({
  file: FilePathSchema,
  node_id: NodeIdSchema,
  field_name: FieldNameSchema,
  new_value: NewValueSchema,
  transaction_id: TransactionIdSchema,
  show_diff: z.boolean().default(true).describe("Include diff in response"),
}).strict();
```

**Step 3 - Generate Diff** (`src/service.ts`):
```typescript
// Add utility function
function generateUnifiedDiff(before: string, after: string): string {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  
  let diff = '';
  const maxLines = Math.max(beforeLines.length, afterLines.length);
  
  for (let i = 0; i < maxLines; i++) {
    const beforeLine = beforeLines[i] || '';
    const afterLine = afterLines[i] || '';
    
    if (beforeLine !== afterLine) {
      if (beforeLine) diff += `- ${beforeLine}\n`;
      if (afterLine) diff += `+ ${afterLine}\n`;
    }
  }
  
  return diff.trim();
}

// Update replaceNode() method
async replaceNode(
  filePath: string,
  nodeId: string,
  newText: string,
  transactionId: string,
  showDiff: boolean = true
): Promise<ScalpelReplaceNodeResult> {
  const snapshot = this.treeStore.getSnapshot(transactionId);
  
  // Capture before text
  const node = snapshot.getNodeById(nodeId);
  const beforeText = node.text;
  
  // Perform replacement
  this.treeStore.replaceNode(transactionId, nodeId, newText);
  
  // Generate diff if requested
  let diff = undefined;
  if (showDiff) {
    diff = {
      before: beforeText,
      after: newText,
      unified_diff: generateUnifiedDiff(beforeText, newText),
    };
  }
  
  return {
    node_id: nodeId,
    transaction_id: transactionId,
    diff,
  };
}
```

**Example Output**:
```json
{
  "success": true,
  "result": {
    "node_id": "abc123",
    "transaction_id": "xyz789",
    "diff": {
      "before": "quality: 80",
      "after": "quality: 90",
      "unified_diff": "- quality: 80\n+ quality: 90"
    }
  }
}
```

**Effort**: 1-1.5 hours

---

#### 0.3 Add Pagination to `scalpel_list_nodes`

**Issue**: Large files (491+ nodes) show only truncated results.

**Files**:
- `src/schemas.ts` (add pagination params)
- `src/service.ts` (implement pagination logic)

**Step 1 - Update Schema** (`src/schemas.ts`):
```typescript
export const ScalpelListNodesArgsSchema = z.object({
  file: FilePathSchema,
  transaction_id: TransactionIdSchema,
  depth: z.number().int().min(0).max(32).default(2)
    .describe("Depth of children to include (0 = only specified node)"),
  filter_by_type: z.array(z.string().min(1).max(128)).max(64).optional()
    .describe("Only return nodes of these types"),
  filter_by_parent: NodeIdSchema.optional()
    .describe("Only return children of this node ID"),
  offset: z.number().int().min(0).default(0)
    .describe("Skip this many nodes (for pagination)"),
  limit: z.number().int().min(1).max(1000).default(100)
    .describe("Maximum nodes to return"),
}).strict();

export const ScalpelListNodesResultSchema = z.object({
  nodes: z.array(NodeInfoSchema).describe("Array of nodes"),
  transaction_id: TransactionIdSchema,
  pagination: z.object({
    total_count: z.number().int().describe("Total nodes matching criteria"),
    offset: z.number().int().describe("Current offset"),
    limit: z.number().int().describe("Current limit"),
    has_more: z.boolean().describe("True if more nodes available"),
  }).describe("Pagination metadata"),
}).strict();
```

**Step 2 - Implement Pagination** (`src/service.ts`):
```typescript
async listNodes(
  filePath: string,
  transactionId: string,
  depth: number = 2,
  filterByType?: string[],
  filterByParent?: string,
  offset: number = 0,
  limit: number = 100
): Promise<ScalpelListNodesResult> {
  const snapshot = this.treeStore.getSnapshot(transactionId);
  
  // Get starting node
  const rootNode = filterByParent 
    ? snapshot.getNodeById(filterByParent)
    : snapshot.tree.rootNode;
  
  // Collect all matching nodes
  const allNodes: NodeInfo[] = [];
  
  function collectNodes(node: any, currentDepth: number) {
    if (currentDepth > depth) return;
    
    // Apply type filter
    if (filterByType && !filterByType.includes(node.type)) {
      return;
    }
    
    allNodes.push({
      id: node.id,
      type: node.type,
      text: node.text.substring(0, 200), // Truncate for display
      start_position: node.startPosition,
      end_position: node.endPosition,
      children_count: node.childCount,
    });
    
    // Recurse to children
    for (const child of node.children) {
      collectNodes(child, currentDepth + 1);
    }
  }
  
  collectNodes(rootNode, 0);
  
  // Apply pagination
  const totalCount = allNodes.length;
  const paginatedNodes = allNodes.slice(offset, offset + limit);
  const hasMore = (offset + limit) < totalCount;
  
  return {
    nodes: paginatedNodes,
    transaction_id: transactionId,
    pagination: {
      total_count: totalCount,
      offset,
      limit,
      has_more: hasMore,
    },
  };
}
```

**Usage Example**:
```typescript
// First page (nodes 0-99)
scalpel_list_nodes({ file: "large.ts", transaction_id: "...", offset: 0, limit: 100 })

// Second page (nodes 100-199)
scalpel_list_nodes({ file: "large.ts", transaction_id: "...", offset: 100, limit: 100 })

// Filter by parent node
scalpel_list_nodes({ 
  file: "large.ts", 
  transaction_id: "...", 
  filter_by_parent: "node_123", 
  depth: 1 
})
```

**Effort**: 1 hour

---

### PHASE 1: UNIVERSAL FILE SUPPORT (4-6 hours)

#### 1.1 Add Plain Text Language Support

**File**: `src/schemas.ts`

**Current**:
```typescript
export const SupportedLanguageSchema = z.enum([
  "typescript",
  "javascript",
  "dart",
  "java",
  "rust",
]);
```

**Required Change**:
```typescript
export const SupportedLanguageSchema = z.enum([
  "typescript",
  "javascript",
  "dart",
  "java",
  "rust",
  "markdown",      // NEW
  "text",          // NEW - Generic text files
  "json",          // NEW
  "yaml",          // NEW
  "html",          // NEW
  "css",           // NEW
  "python",        // NEW
  "go",            // NEW
  "cpp",           // NEW
  "c",             // NEW
]);

export type SupportedLanguage = z.infer<typeof SupportedLanguageSchema>;
```

#### 1.2 Extend Extension-to-Language Mapping

**File**: `src/service.ts`

**Current** (line 35-45):
```typescript
const EXTENSION_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".dart": "dart",
  ".java": "java",
  ".rs": "rust",
};
```

**Required Change**:
```typescript
const EXTENSION_LANGUAGE_MAP: Record<string, SupportedLanguage> = {
  // Existing
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".dart": "dart",
  ".java": "java",
  ".rs": "rust",
  
  // NEW - Documentation & Config
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "text",
  ".text": "text",
  ".json": "json",
  ".jsonc": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "yaml",  // Treat TOML as YAML structurally
  
  // NEW - Web
  ".html": "html",
  ".htm": "html",
  ".css": "css",
  ".scss": "css",
  ".sass": "css",
  
  // NEW - Other languages
  ".py": "python",
  ".pyi": "python",
  ".go": "go",
  ".cpp": "cpp",
  ".cc": "cpp",
  ".cxx": "cpp",
  ".c": "c",
  ".h": "c",
  
  // NEW - Shell & Config
  ".sh": "text",
  ".bash": "text",
  ".zsh": "text",
  ".env": "text",
  ".gitignore": "text",
  ".dockerignore": "text",
  
  // NEW - Fallback for extensionless files
  "": "text",  // Files without extension
};
```

#### 1.3 Add Intelligent Language Inference

**File**: `src/service.ts` (add new function around line 260)

**Required Addition**:
```typescript
/**
 * Infer language from file path with multiple fallback strategies
 */
function inferLanguageFromPath(filePath: string): SupportedLanguage | undefined {
  const ext = path.extname(filePath).toLowerCase();
  
  // Strategy 1: Extension mapping
  if (EXTENSION_LANGUAGE_MAP[ext]) {
    return EXTENSION_LANGUAGE_MAP[ext];
  }
  
  // Strategy 2: Known filenames without extensions
  const basename = path.basename(filePath).toLowerCase();
  const KNOWN_FILES: Record<string, SupportedLanguage> = {
    "dockerfile": "text",
    "makefile": "text",
    "readme": "markdown",
    "changelog": "markdown",
    "license": "text",
    "authors": "text",
    "contributing": "markdown",
    "gemfile": "text",
    "rakefile": "text",
    "vagrantfile": "text",
  };
  
  if (KNOWN_FILES[basename]) {
    return KNOWN_FILES[basename];
  }
  
  // Strategy 3: No extension = assume text
  if (!ext) {
    return "text";
  }
  
  // Strategy 4: Unknown extension = assume text
  return "text";
}
```

**CRITICAL**: Replace the old `inferLanguageFromPath` function with this version.

#### 1.4 Implement Text-Mode Editing

**File**: `src/tree-store.ts`

**Current Issue**: Lines 92-96 only hydrate TypeScript/JavaScript trees. Other languages fail.

**Required Change** (around line 135-150):

```typescript
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

  // NEW: Check if language has tree-sitter support
  const TREE_SITTER_LANGUAGES = ["typescript", "javascript", "dart", "java", "rust"];
  const hasTreeSitterSupport = TREE_SITTER_LANGUAGES.includes(language);

  let rawTree: RawTree | undefined;
  let snapshot: TreeSnapshot;

  if (hasTreeSitterSupport) {
    // Existing AST parsing logic
    const treeSitterResult = await treeSitterParse(sourceText, language);
    rawTree = buildRawTree(sourceText, sourceHash, language, treeSitterResult.tree);
    snapshot = this.reconcile(session.transactionId, rawTree, previous);
  } else {
    // NEW: Line-based mode for markdown, text, etc.
    snapshot = this.buildLineBasedSnapshot(
      session.transactionId,
      sourceText,
      sourceHash,
      language,
      previous
    );
  }

  this.snapshots.set(session.transactionId, snapshot);
  return snapshot;
}
```

**Add new method** to `TreeStore` class:

```typescript
/**
 * Build a line-based snapshot for non-AST languages (markdown, text, etc.)
 * Each line becomes a "node" for editing purposes
 */
private buildLineBasedSnapshot(
  transactionId: string,
  sourceText: string,
  sourceHash: string,
  language: ParserLanguage,
  previous: TreeSnapshot | undefined
): TreeSnapshot {
  const lines = sourceText.split('\n');
  const nodesById = new Map<string, ParsedNodeRecord>();
  const rootNodeId = `line_root_${transactionId}`;
  
  // Create root node
  const rootNode: ParsedNodeRecord = {
    nodeId: rootNodeId,
    instanceId: rootNodeId,
    type: 'document',
    parentNodeId: undefined,
    indexPosition: 0,
    structuralHash: hash(`document:${sourceHash}`),
    anchorSignature: 'document_root',
    leafHash: sourceHash,
    childCount: lines.length,
    startOffset: 0,
    endOffset: sourceText.length,
    childrenNodeIds: [],
    sourceBacked: true,
    sourceSnippet: sourceText.substring(0, 200),
    sourceLayoutValid: true,
    sourceChildLayout: [],
  };
  
  nodesById.set(rootNodeId, rootNode);
  
  // Create line nodes
  let currentOffset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNodeId = `line_${i}_${hash(line).substring(0, 8)}`;
    const endOffset = currentOffset + line.length + (i < lines.length - 1 ? 1 : 0); // +1 for \n
    
    const lineNode: ParsedNodeRecord = {
      nodeId: lineNodeId,
      instanceId: lineNodeId,
      type: 'line',
      parentNodeId: rootNodeId,
      indexPosition: i,
      structuralHash: hash(`line:${i}:${line}`),
      anchorSignature: `line_${i}`,
      leafHash: hash(line),
      childCount: 0,
      startOffset: currentOffset,
      endOffset: endOffset,
      childrenNodeIds: [],
      sourceBacked: true,
      sourceSnippet: line,
      sourceLayoutValid: true,
    };
    
    nodesById.set(lineNodeId, lineNode);
    rootNode.childrenNodeIds.push(lineNodeId);
    
    currentOffset = endOffset;
  }
  
  return {
    transactionId,
    language,
    sourceText,
    sourceHash,
    rootNodeId,
    treeVersion: previous ? previous.treeVersion + 1 : 1,
    nodeCount: nodesById.size,
    nodesById,
    identityMetrics: {
      reusedNodeIds: 0,
      newNodeIds: nodesById.size,
      removedNodeIds: 0,
      exactMatches: 0,
      fallbackMatches: 0,
      stabilityScore: 1.0,
    },
    dirty: false,
    mutationCount: 0,
    tombstones: new Set(),
    changedNodeIds: new Set(),
  };
}
```

#### 1.5 Update Parser Language Mapping

**File**: `src/tree-store.ts` (around line 1520)

**Find the function** `ensureParserLanguage` and update:

```typescript
function ensureParserLanguage(lang: SupportedLanguage): ParserLanguage {
  // Tree-sitter supported languages
  if (["typescript", "javascript", "dart", "java", "rust"].includes(lang)) {
    return lang as ParserLanguage;
  }
  
  // NEW: Non-AST languages map to themselves for line-based editing
  if (["markdown", "text", "json", "yaml", "html", "css", "python", "go", "cpp", "c"].includes(lang)) {
    return lang as ParserLanguage;
  }
  
  throw new ToolError("INVALID_OPERATION", `Language not supported: ${lang}`);
}
```

**Update `ParserLanguage` type** in `src/tree-sitter-parser.ts`:

```typescript
export type ParserLanguage = 
  | "typescript" 
  | "javascript" 
  | "dart" 
  | "java" 
  | "rust"
  | "markdown"    // NEW
  | "text"        // NEW
  | "json"        // NEW
  | "yaml"        // NEW
  | "html"        // NEW
  | "css"         // NEW
  | "python"      // NEW
  | "go"          // NEW
  | "cpp"         // NEW
  | "c";          // NEW
```

---

### PHASE 2: FILE CREATION CAPABILITY

#### 2.1 Add New Tool: `scalpel_create_file`

**File**: `src/tool-names.ts`

**Add to the array**:
```typescript
export const TOOL_NAMES = [
  // ... existing tools
  "scalpel_create_file",  // NEW
] as const;
```

#### 2.2 Define Schema

**File**: `src/schemas.ts`

**Add new schema**:
```typescript
export const ScalpelCreateFileArgsSchema = z
  .object({
    file: FilePathSchema,
    language: SupportedLanguageSchema.optional(),
    initial_content: z.string().max(10_000_000).default(""),
    overwrite: z.boolean().default(false),
  })
  .strict();

export type ScalpelCreateFileArgs = z.infer<typeof ScalpelCreateFileArgsSchema>;
```

**Update exports**:
```typescript
export const TOOL_SCHEMAS: Record<ToolName, z.ZodSchema> = {
  // ... existing tools
  scalpel_create_file: ScalpelCreateFileArgsSchema,  // NEW
};
```

#### 2.3 Add Tool Definition

**File**: `src/tool-definitions.ts`

**Add to array**:
```typescript
{
  name: "scalpel_create_file",
  description: "Create a new file with optional initial content. Supports all file types (code, markdown, text, config files, etc.). Automatically begins a transaction for the new file.",
  inputSchema: {
    type: "object",
    properties: {
      file: {
        type: "string",
        description: "Path to the file to create (relative to workspace root)",
      },
      language: {
        type: "string",
        enum: ["typescript", "javascript", "dart", "java", "rust", "markdown", "text", "json", "yaml", "html", "css", "python", "go", "cpp", "c"],
        description: "Programming/markup language (auto-detected from extension if not provided)",
      },
      initial_content: {
        type: "string",
        description: "Initial file content (default: empty file)",
        default: "",
      },
      overwrite: {
        type: "boolean",
        description: "If true, overwrite existing file. If false (default), fail if file exists.",
        default: false,
      },
    },
    required: ["file"],
  },
},
```

#### 2.4 Implement Service Method

**File**: `src/service.ts`

**Add import**:
```typescript
import { mkdir, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
```

**Add method to `ScalpelService` class**:
```typescript
public async createFile(args: ScalpelCreateFileArgs): Promise<{
  transactionId: string;
  file: string;
  language: SupportedLanguage;
  created: boolean;
  bytesWritten: number;
}> {
  const absoluteFilePath = resolveWorkspacePath(this.config.workspaceRoot, args.file);
  
  // Check if file exists
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
      `File already exists: ${args.file}. Use overwrite=true to replace.`
    );
  }
  
  // Infer language
  const inferredLanguage = inferLanguageFromPath(absoluteFilePath);
  const language = args.language ?? inferredLanguage ?? "text";
  
  // Create parent directories
  const parentDir = path.dirname(absoluteFilePath);
  await mkdir(parentDir, { recursive: true });
  
  // Write file
  const content = args.initial_content;
  await writeFile(absoluteFilePath, content, "utf8");
  
  // Begin transaction automatically
  const session = this.transactions.begin(args.file, absoluteFilePath, language);
  
  this.logger.info("File created", {
    file: args.file,
    language,
    bytes: Buffer.byteLength(content, "utf8"),
  });
  
  return {
    transactionId: session.transactionId,
    file: args.file,
    language,
    created: !fileExists,
    bytesWritten: Buffer.byteLength(content, "utf8"),
  };
}
```

#### 2.5 Wire Up Tool Handler

**File**: `src/index.ts`

**Add import**:
```typescript
import type {
  // ... existing imports
  ScalpelCreateFileArgs,  // NEW
} from "./schemas.js";
```

**Update `executeTool` function** (add case):
```typescript
async function executeTool(name: ToolName, args: unknown): Promise<unknown> {
  switch (name) {
    // ... existing cases
    case "scalpel_create_file":  // NEW
      return service.createFile(args as ScalpelCreateFileArgs);
    // ... rest of cases
  }
}
```

---

### PHASE 3: FULL MCP PROTOCOL COMPLIANCE

#### 3.1 Add Resources Capability

**Purpose**: Expose workspace files as MCP resources so clients can discover and read them.

**File**: `src/index.ts`

**Update capabilities** (line 56):
```typescript
capabilities: {
  tools: {},
  resources: {},  // NEW
},
```

**Add resource handlers**:
```typescript
import { 
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Add after ListToolsRequestSchema handler
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
  
  const filePath = uri.replace("file://", "");
  const absolutePath = resolveWorkspacePath(config.workspaceRoot, filePath);
  
  const content = await readFile(absolutePath, "utf8");
  
  return {
    contents: [
      {
        uri,
        mimeType: "text/plain",
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
      description: "Read any file in the workspace",
      mimeType: "text/plain",
    },
  ],
}));
```

#### 3.2 Add Prompts Capability

**Purpose**: Provide predefined prompts for common refactoring operations.

**File**: `src/index.ts`

**Update capabilities**:
```typescript
capabilities: {
  tools: {},
  resources: {},
  prompts: {},  // NEW
},
```

**Add prompt handlers**:
```typescript
import { 
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "refactor_extract_function",
      description: "Extract selected code into a new function",
      arguments: [
        {
          name: "file",
          description: "File containing the code",
          required: true,
        },
        {
          name: "node_id",
          description: "Node ID of the code to extract",
          required: true,
        },
        {
          name: "function_name",
          description: "Name for the new function",
          required: true,
        },
      ],
    },
    {
      name: "refactor_rename_symbol",
      description: "Rename a symbol throughout the file",
      arguments: [
        {
          name: "file",
          description: "File containing the symbol",
          required: true,
        },
        {
          name: "old_name",
          description: "Current symbol name",
          required: true,
        },
        {
          name: "new_name",
          description: "New symbol name",
          required: true,
        },
      ],
    },
    {
      name: "add_documentation",
      description: "Add JSDoc/documentation comments to a function or class",
      arguments: [
        {
          name: "file",
          description: "File containing the symbol",
          required: true,
        },
        {
          name: "node_id",
          description: "Node ID to document",
          required: true,
        },
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
              text: `Extract the code at node ${args?.node_id} in ${args?.file} into a new function named ${args?.function_name}. Use scalpel_get_node to inspect the code, then use scalpel_insert_child and scalpel_replace_node to perform the extraction.`,
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
              text: `Rename all occurrences of ${args?.old_name} to ${args?.new_name} in ${args?.file}. Use scalpel_search_structure to find all references, then use scalpel_replace_node for each occurrence.`,
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
              text: `Add JSDoc documentation to the node ${args?.node_id} in ${args?.file}. Use scalpel_get_node to understand the signature, then use scalpel_insert_child to add a comment node.`,
            },
          },
        ],
      };
    
    default:
      throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  }
});
```

#### 3.3 Add Progress Notifications

**File**: `src/service.ts`

**Add progress tracking to long operations**:
```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

// Modify commit method to send progress
public async commit(args: ScalpelCommitArgs): Promise<{
  // ... existing return type
}> {
  // ... existing validation
  
  // NEW: Send progress notification
  if (this.server) {
    await this.server.sendProgress({
      progressToken: args.transaction_id,
      progress: 0,
      total: 100,
    });
  }
  
  // ... parse tree
  
  if (this.server) {
    await this.server.sendProgress({
      progressToken: args.transaction_id,
      progress: 50,
      total: 100,
    });
  }
  
  // ... write file
  
  if (this.server) {
    await this.server.sendProgress({
      progressToken: args.transaction_id,
      progress: 100,
      total: 100,
    });
  }
  
  // ... return result
}
```

**Inject server instance** into `ScalpelService`:

**File**: `src/index.ts` (line 42):
```typescript
const service = new ScalpelService(config, logger, transactions, server);  // Pass server
```

**File**: `src/service.ts` (constructor):
```typescript
export class ScalpelService {
  private readonly trees: TreeStore;

  public constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly transactions: TransactionStore,
    private readonly server?: Server,  // NEW - Optional for progress notifications
  ) {
    this.trees = new TreeStore();
  }
  // ...
}
```

#### 3.4 Add Logging Capability

**File**: `src/index.ts`

**Update capabilities**:
```typescript
capabilities: {
  tools: {},
  resources: {},
  prompts: {},
  logging: {},  // NEW
},
```

**Add log message handler**:
```typescript
import { SetLevelRequestSchema } from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(SetLevelRequestSchema, async (request) => {
  const { level } = request.params;
  
  // Map MCP log levels to internal log levels
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
  config.logLevel = internalLevel as any;
  logger.setLevel(internalLevel);
  
  return {};
});
```

---

### PHASE 4: ENHANCED FEATURES (OPTIONAL BUT RECOMMENDED)

#### 4.1 Add Rich Content Responses

**Purpose**: Return syntax-highlighted code snippets as images for better visualization.

**File**: `src/response.ts`

**Add image generation for code**:
```typescript
import type { ImageContent, TextContent, EmbeddedResource } from "@modelcontextprotocol/sdk/types.js";

export function buildRichCodeResponse(
  code: string,
  language: string,
  nodeId: string
): ImageContent | TextContent {
  // Option 1: Return as text with language annotation
  return {
    type: "text",
    text: code,
    annotations: {
      audience: ["user"],
      priority: 1.0,
    },
  };
  
  // Option 2: TODO - Generate syntax-highlighted PNG using canvas
  // (requires canvas library and syntax highlighter)
}
```

#### 4.2 Add Sampling Support

**Purpose**: Allow LLM to request human approval for destructive operations.

**File**: `src/index.ts`

**Update capabilities**:
```typescript
capabilities: {
  tools: {},
  resources: {},
  prompts: {},
  logging: {},
  sampling: {},  // NEW
},
```

**Note**: Sampling is client-driven, so server just needs to declare capability. Clients can use `sampling/createMessage` to request approval.

---

## 🧪 TESTING STRATEGY

### Test 1: Markdown File Editing
```bash
# Should succeed now
echo '{"file": "README.md"}' | docker run --rm -i -v "$PWD:/workspace:rw" --user 1000:1000 scalpel-mcp:latest
```

**Expected**: Transaction begins successfully with `language: "markdown"`.

### Test 2: File Without Extension
```bash
# Should succeed with text mode
echo '{"file": "Dockerfile"}' | docker run --rm -i -v "$PWD:/workspace:rw" --user 1000:1000 scalpel-mcp:latest
```

**Expected**: Transaction begins with `language: "text"`.

### Test 3: File Creation
```bash
# Create new markdown file
echo '{"file": "NEW_FILE.md", "initial_content": "# Hello World\n\nThis is a test."}' | docker run --rm -i -v "$PWD:/workspace:rw" --user 1000:1000 scalpel-mcp:latest
```

**Expected**: File created and transaction started.

### Test 4: MCP Resources
```bash
# List resources
echo '{"jsonrpc":"2.0","id":1,"method":"resources/list"}' | docker run --rm -i -v "$PWD:/workspace:rw" --user 1000:1000 scalpel-mcp:latest
```

**Expected**: Returns workspace root resource.

### Test 5: MCP Prompts
```bash
# List prompts
echo '{"jsonrpc":"2.0","id":1,"method":"prompts/list"}' | docker run --rm -i -v "$PWD:/workspace:rw" --user 1000:1000 scalpel-mcp:latest
```

**Expected**: Returns refactoring prompts.

---

## 📚 IMPLEMENTATION CHECKLIST

Use this checklist to track progress:

### Phase 0: Critical Bug Fixes (NEW - Feb 13, 2026)
- [ ] Fix `selectorToQuery()` TSQuery syntax in `src/service.ts`
- [ ] Add unit tests for attribute-based selectors
- [ ] Add `DiffOutputSchema` to `src/schemas.ts`
- [ ] Update `ScalpelReplaceNodeResultSchema` with diff field
- [ ] Update `ScalpelUpdateNodeResultSchema` with diff field
- [ ] Add `show_diff` parameter to tool args schemas
- [ ] Implement `generateUnifiedDiff()` utility in `src/service.ts`
- [ ] Update `replaceNode()` to capture before/after and generate diff
- [ ] Update `updateNode()` to capture before/after and generate diff
- [ ] Add pagination params to `ScalpelListNodesArgsSchema`
- [ ] Add pagination metadata to `ScalpelListNodesResultSchema`
- [ ] Implement pagination logic in `listNodes()` method
- [ ] Add `filter_by_parent` support for hierarchical navigation
- [ ] Test `scalpel_search_structure` with attribute selectors
- [ ] Test diff output for replace and update operations
- [ ] Test pagination with large files (491+ nodes)

### Phase 1: Universal File Support
- [ ] Update `SupportedLanguageSchema` in `src/schemas.ts`
- [ ] Extend `EXTENSION_LANGUAGE_MAP` in `src/service.ts`
- [ ] Implement intelligent `inferLanguageFromPath()` in `src/service.ts`
- [ ] Add `buildLineBasedSnapshot()` to `src/tree-store.ts`
- [ ] Update `hydrate()` to use line-based mode for non-AST languages
- [ ] Update `ensureParserLanguage()` in `src/tree-store.ts`
- [ ] Update `ParserLanguage` type in `src/tree-sitter-parser.ts`
- [ ] Test markdown file editing
- [ ] Test text file editing
- [ ] Test files without extensions

### Phase 2: File Creation
- [ ] Add `scalpel_create_file` to `TOOL_NAMES`
- [ ] Add `ScalpelCreateFileArgsSchema` to `src/schemas.ts`
- [ ] Add tool definition to `src/tool-definitions.ts`
- [ ] Implement `createFile()` method in `src/service.ts`
- [ ] Wire up tool handler in `src/index.ts`
- [ ] Test creating new files
- [ ] Test overwrite protection
- [ ] Test auto-transaction start

### Phase 3: MCP Compliance
- [ ] Add `resources` capability
- [ ] Implement `resources/list` handler
- [ ] Implement `resources/read` handler
- [ ] Implement `resources/templates` handler
- [ ] Add `prompts` capability
- [ ] Implement `prompts/list` handler
- [ ] Implement `prompts/get` handler
- [ ] Add `logging` capability
- [ ] Implement `logging/setLevel` handler
- [ ] Add progress notifications to `commit()`
- [ ] Test all MCP protocol features

### Phase 4: Enhanced Features (Optional)
- [ ] Implement rich content responses
- [ ] Add `sampling` capability
- [ ] Add syntax highlighting for code responses
- [ ] Implement image generation for code snippets

---

## 🚀 DEPLOYMENT

After implementation:

1. **Rebuild Docker image**:
```bash
docker build -t scalpel-mcp:latest -t scalpel-mcp:v2.1 .
```

2. **Test with Gemini CLI**:
```bash
# Should work now
gemini "Use scalpel to edit README.md"
```

3. **Verify all capabilities**:
```bash
# Check MCP capabilities response
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | docker run --rm -i scalpel-mcp:latest 2>/dev/null
```

---

## 📖 DOCUMENTATION UPDATES

After implementation, update:

1. **README.md** - Add supported file types section
2. **DOCKER_SETUP_COMPLETE.md** - Update examples with markdown files
3. **MCP_SETUP_GUIDE.md** - Document new capabilities
4. **Add CHANGELOG.md** - Document v2.1 changes

---

## ✅ SUCCESS CRITERIA

This implementation is complete when:

1. ✅ **Critical bugs fixed** (Phase 0):
   - `scalpel_search_structure` works with attribute selectors
   - Edit operations show diff output
   - `scalpel_list_nodes` supports pagination for large files
2. ✅ **Markdown files work**: `scalpel_begin_transaction` succeeds for `.md` files
3. ✅ **Text files work**: Works for `.txt`, `Dockerfile`, `LICENSE`, etc.
4. ✅ **File creation works**: Can create new files with `scalpel_create_file`
5. ✅ **All MCP capabilities declared**: Resources, prompts, logging, tools
6. ✅ **MCP protocol handlers work**: All handlers return valid responses
7. ✅ **Tests pass**: All test scenarios succeed
8. ✅ **Documentation updated**: All docs reflect new capabilities

---

## 🎓 IMPLEMENTATION NOTES FOR AI

**Dear AI Implementer**,

This guide is designed for you to execute autonomously. Follow these principles:

### 1. **Work in Order**
- Complete Phase 0 FIRST - it fixes critical bugs blocking usability
- Then Phase 1 - it fixes the language inference failure
- Then Phase 2 - it enables file creation
- Then Phase 3 - it adds MCP compliance
- Phase 4 is optional enhancement

### 2. **Test After Each Phase**
- Run the test commands after each phase
- Don't proceed if tests fail
- Fix issues before moving forward

### 3. **Estimated Timeline**
- Phase 0: 2-3 hours (CRITICAL - do this first)
- Phase 1: 4-6 hours
- Phase 2: 2-3 hours
- Phase 3: 6-8 hours
- **Total**: 14-20 hours for full implementation

### 3. **Preserve Existing Functionality**
- Don't break TypeScript/JavaScript editing
- Keep all existing tools working
- Only ADD new features, don't REMOVE

### 4. **Use Proper Types**
- Update all TypeScript types to match new schemas
- Add proper error handling
- Maintain type safety throughout

### 5. **Documentation**
- Add JSDoc comments to new functions
- Update inline comments
- Keep code readable

### 6. **Commit Strategy**
- Commit after each phase
- Use descriptive commit messages
- Follow conventional commits format

**Example Commits**:
```
feat(core): add universal file type support for markdown and text files
feat(tools): add scalpel_create_file tool for creating new files
feat(mcp): implement resources and prompts capabilities
feat(mcp): add progress notifications and logging support
docs: update documentation for v2.1 features
```

---

## 🔗 RELATED FILES

Key files you'll need to modify:

- `src/schemas.ts` - Type definitions and validation schemas
- `src/service.ts` - Core business logic and language inference
- `src/tree-store.ts` - Tree storage and line-based editing
- `src/tree-sitter-parser.ts` - Parser language types
- `src/index.ts` - MCP server and request handlers
- `src/tool-names.ts` - Tool name constants
- `src/tool-definitions.ts` - Tool metadata for MCP
- `src/response.ts` - Response formatting (for rich content)

---

## 💡 TIPS FOR SUCCESS

1. **Start with the critical bug** - Fix language inference FIRST
2. **Use existing patterns** - Follow how TypeScript/JavaScript are handled
3. **Keep it simple** - Line-based editing for non-AST files is OK
4. **Test incrementally** - Don't wait until the end
5. **Maintain backwards compatibility** - Existing tools must keep working

---

**Good luck! 🚀**

This implementation will make Scalpel the most versatile MCP code editing server available.
