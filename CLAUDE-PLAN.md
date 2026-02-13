

  ★ YOUR IMPLEMENTATION PROFILE ─────────────────────────────────
  Scope: v2.0 → v3.0 (4 incremental releases)
  Parsers: 7 tree-sitter parsers (MD, JSON, YAML, HTML, CSS, Python, Go)
  Testing: Comprehensive (manual + Jest + integration + MCP protocol)
  Delivery: Incremental (v2.0.1 → v2.1 → v2.2 → v3.0)
  Timeline: 34-45 hours, quality over speed
  Review: Autonomous execution, review at end
  ─────────────────────────────────────────────────────────────────

● 3 Plan agents finished (ctrl+o to expand)
   ├─ Design Phase 0 architecture · 14 tool uses · 53.3k tokens
   │  ⎿  Done
   ├─ Design Phase 1 architecture · 13 tool uses · 50.4k tokens
   │  ⎿  Done
   └─ Design Phase 2+3 architecture · 14 tool uses · 76.1k tokens
      ⎿  Done

● Excellent work! The Plan agents have provided comprehensive architecture designs for all phases. Now let me synthesize this into a final implementation plan.

● Updated plan
  ⎿  /plan to preview

● Perfect! I've created a comprehensive implementation plan that synthesizes all the insights from the Plan agents. The plan covers:

  ✅ Complete Architecture Design:
  - Phase 0: Critical bug fixes (TSQuery, diff, pagination)
  - Phase 1: Universal file support with 7 tree-sitter parsers
  - Phase 2: File creation capability
  - Phase 3: Full MCP compliance (all 5 capabilities)

  ✅ Key Decisions Incorporated:
  - Sequential phased approach (0→1→2→3)
  - 7 aggressive tree-sitter parsers (MD, JSON, YAML, HTML, CSS, Python, Go)
  - Breaking change for TSQuery fix (clean approach)
  - Full context diffs (before + after + unified)
  - Cursor-based pagination for large files
  - Pre-validated parsers at startup (fail-fast)
  - 4 incremental releases (v2.0.1 → v2.1 → v2.2 → v3.0)
  - Comprehensive testing (manual + Jest + integration + MCP protocol)
  - Essential documentation (README + CHANGELOG)

  ✅ Detailed Implementation Guidance:
  - 34-45 hour timeline broken down by phase
  - Critical files for each phase
  - Code examples for all major changes
  - Testing strategy with specific test cases
  - Success criteria for each release
  - Risk mitigation strategies

  The plan is ready for autonomous execution with quality over speed. Let me exit plan mode for your approval.

─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Ready to code?

 Here is Claude's plan:
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
 Scalpel MCP Server: v2.0 → v3.0 Full Implementation Plan

 Context

 The Scalpel MCP Server currently supports only 5 programming languages (TypeScript, JavaScript, Dart, Java, Rust) and has 3 critical bugs blocking usability.
 This limits the tool to ~10% of real-world files, making it impractical for documentation, configuration, and most project files.

 Problems Being Solved:
 1. Critical Bugs - TSQuery syntax error, missing diff output, no pagination
 2. Limited File Support - Cannot edit markdown, JSON, YAML, HTML, CSS, Python, Go files
 3. Missing File Creation - Users cannot create new files, only edit existing ones
 4. Incomplete MCP Compliance - Only 1 of 5 MCP capabilities implemented

 Intended Outcome:
 Transform Scalpel from a specialized TypeScript/JavaScript tool into a universal code editor supporting 12 languages with full MCP protocol compliance,
 delivered as 4 incremental releases (v2.0.1 → v2.1 → v2.2 → v3.0).

 ---
 Implementation Strategy

 Delivery Model: Incremental Releases

 v2.0.1 (Phase 0) - Critical bug fixes (2-3 hours)
 v2.1 (Phase 1) - Universal file support with 7 new parsers (12-15 hours)
 v2.2 (Phase 2) - File creation capability (2-3 hours)
 v3.0 (Phase 3) - Full MCP compliance (6-8 hours)

 Total Effort: 34-45 hours across 4 releases

 Architecture Decisions

 1. Tree-Sitter Parsers - Add 7 native parsers (not line-based editing)
 2. Fail-Fast Validation - Pre-validate all parsers at server startup
 3. Breaking Change - Fix TSQuery syntax cleanly (no backward compat)
 4. Full Context Diffs - Show before + after + unified diff for all edits
 5. Cursor-Based Pagination - Handle 10,000+ node files efficiently
 6. Auto-Transaction - File creation immediately starts transaction
 7. Complete MCP Spec - All 5 capabilities (tools, resources, prompts, logging, sampling)

 ---
 PHASE 0: Critical Bug Fixes → v2.0.1

 Estimated Time: 2-3 hours
 Priority: 🔴 CRITICAL

 Bug 1: TSQuery Syntax Error in compileSelector()

 Location: src/query-engine.ts:116

 Current (Broken):
 return `(${type} ${field}: (_) @val (#eq? @val "${escapedValue}")) @match`;

 Problem: Generates invalid tree-sitter query syntax. The _ wildcard is not valid in field positions.

 Fix: Add field type inference
 private compileSelector(selector: string): string {
   // ... existing parsing ...

   if (field && value !== undefined) {
     const fieldType = this.inferFieldType(type, field);
     return `(${type} ${field}: (${fieldType}) @val (#eq? @val "${escapedValue}")) @match`;
   }
 }

 private inferFieldType(nodeType: string, fieldName: string): string {
   // Most name/key fields are identifiers
   if (fieldName === 'name' || fieldName === 'key') return 'identifier';
   if (fieldName === 'value' || fieldName === 'initializer') return '_';
   return 'identifier'; // Safe default
 }

 Impact: Fixes broken scalpel_search_structure for all attribute queries

 ---
 Bug 2: Missing Diff Output in Edit Operations

 Locations:
 - src/service.ts - replaceNode() (line 385), updateNode(), etc.
 - src/schemas.ts - Result schemas

 Current: Returns only {node_id, transaction_id} - forces re-reading entire file

 Fix: Add comprehensive diff output

 New Schema:
 // src/schemas.ts
 export const DiffOutputSchema = z.object({
   before: z.string().describe("Original text"),
   after: z.string().describe("New text"),
   unified_diff: z.string().describe("Unified diff format (- old, + new)"),
   changed_lines: z.object({
     start: z.number(),
     end: z.number()
   })
 }).strict();

 // Update result schemas
 export const ScalpelReplaceNodeResultSchema = z.object({
   node_id: NodeIdSchema,
   transaction_id: TransactionIdSchema,
   diff: DiffOutputSchema.optional()
 }).strict();

 New Utility (src/diff-generator.ts):
 export function generateDiff(ctx: {
   sourceTextBefore: string;
   sourceTextAfter: string;
   affectedNodeBefore: ParsedNodeRecord;
   affectedNodeAfter?: ParsedNodeRecord;
   contextLines: number;
 }): DiffOutput {
   // 1. Convert byte offsets to line numbers
   // 2. Add context lines
   // 3. Extract snippets
   // 4. Generate unified diff

   const unified_diff = createUnifiedDiff(before, after, startLine);
   return { before, after, unified_diff, changed_lines };
 }

 Integration: Modify all 5 mutation methods in tree-store.ts to capture before/after state

 Token Savings: 98% reduction (from 10k tokens to 50-200 tokens per edit)

 ---
 Bug 3: Missing Pagination in listNodes()

 Location: src/service.ts:129-169

 Current: Returns ALL nodes, causing truncation for 491+ node files

 Fix: Cursor-based pagination

 New Schema Parameters:
 export const ScalpelListNodesArgsSchema = z.object({
   // ... existing ...
   limit: z.number().int().min(1).max(1000).default(100),
   cursor: z.string().optional().describe("Opaque pagination cursor"),
   filter_by_parent: NodeIdSchema.optional()
 }).strict();

 Cursor Design:
 Cursor := Base64({
   lastNodeId: string,
   depth: number,
   treeVersion: number
 })

 New Response:
 {
   nodes: [...],
   pagination: {
     has_more: boolean,
     next_cursor?: string,
     returned_count: number,
     total_count: number
   }
 }

 Why Cursor-Based:
 - Cursors remain valid even if tree mutates
 - O(1) lookup vs O(n) offset skip
 - No duplicate/missing nodes during pagination

 ---
 Phase 0 Testing Strategy

 Unit Tests (20 new tests):
 1. tests/query-engine.test.ts - 5 TSQuery tests with field selectors
 2. tests/diff-generator.test.ts - 6 diff generation tests (replacement, removal, multi-line)
 3. tests/pagination.test.ts - 7 pagination tests (cursor, stale detection, filter_by_parent)
 4. tests/integration-bugs.test.ts - 3 end-to-end tests

 Manual Testing:
 # Test TSQuery fix
 scalpel_search_structure({
   selector: 'function_declaration[name="beta"]',
   ...
 })

 # Test diff output
 scalpel_replace_node({..., show_diff: true})

 # Test pagination
 scalpel_list_nodes({limit: 100, cursor: "..."})

 ---
 PHASE 1: Universal File Support → v2.1

 Estimated Time: 12-15 hours
 Priority: 🔴 HIGHEST

 NPM Dependencies

 Add 8 tree-sitter parsers to package.json:

 {
   "dependencies": {
     "tree-sitter-rust": "^0.23.2",
     "tree-sitter-markdown": "^0.3.2",
     "tree-sitter-json": "^0.24.6",
     "tree-sitter-yaml": "^0.6.1",
     "tree-sitter-html": "^0.23.0",
     "tree-sitter-css": "^0.23.0",
     "tree-sitter-python": "^0.23.6",
     "tree-sitter-go": "^0.23.1"
   }
 }

 Note: Rust parser exists but needs implementation (currently only declared in schema)

 ---
 Architecture: Dual-Phase Parser Initialization

 Phase A: Startup Validation (Eager)

 New function in src/tree-sitter-parser.ts:
 export function validateAllParsers(): {
   success: boolean;
   failures: Array<{ language: string; error: string }>
 } {
   const failures = [];
   const languages = [
     "typescript", "javascript", "java", "dart", "rust",
     "markdown", "json", "yaml", "html", "css", "python", "go"
   ];

   for (const lang of languages) {
     try {
       const parser = new Parser();
       parser.setLanguage(getLanguageGrammar(lang));

       // Test with minimal code
       const tree = parser.parse(getMinimalTestCode(lang));
       if (!tree.rootNode) throw new Error("No root node");

       // Cache successfully validated parser
       parsers.set(lang, parser);
     } catch (error) {
       failures.push({ language: lang, error: String(error) });
     }
   }

   return { success: failures.length === 0, failures };
 }

 Phase B: Runtime Access (Cached)
 function getOrCreateParser(language: ParserLanguage): Parser {
   const parser = parsers.get(language);
   if (!parser) {
     throw new ToolError(
       "INTERNAL_ERROR",
       `Parser not initialized at startup for ${language}`
     );
   }
   return parser;
 }

 ---
 Language Grammar Loader

 Centralized Import Strategy:
 import TypeScript from "tree-sitter-typescript";
 import JavaScript from "tree-sitter-javascript";
 import Java from "tree-sitter-java";
 import Dart from "tree-sitter-dart";
 import Rust from "tree-sitter-rust";
 import Markdown from "tree-sitter-markdown";
 import JSON from "tree-sitter-json";
 import YAML from "tree-sitter-yaml";
 import HTML from "tree-sitter-html";
 import CSS from "tree-sitter-css";
 import Python from "tree-sitter-python";
 import Go from "tree-sitter-go";

 function getLanguageGrammar(language: ParserLanguage): Language {
   switch (language) {
     case "typescript": return TypeScript.typescript as Language;
     case "javascript": return JavaScript as Language;
     case "java": return Java as Language;
     case "dart": return Dart as Language;
     case "rust": return Rust as Language;
     case "markdown": return Markdown as Language;
     case "json": return JSON as Language;
     case "yaml": return YAML as Language;
     case "html": return HTML as Language;
     case "css": return CSS as Language;
     case "python": return Python as Language;
     case "go": return Go as Language;
     default: throw new ToolError("INVALID_OPERATION", `Unsupported: ${language}`);
   }
 }

 ---
 Extended Extension Mapping

 29 Extensions:
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

 Filename-Based Detection (NEW):
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

   // Other (Python-like syntax)
   "Dockerfile": "python",
   "Makefile": "python",
 };

 Updated Inference Logic:
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

 ---
 Server Startup Integration

 Entry Point (src/index.ts):
 import { validateAllParsers } from "./tree-sitter-parser.js";

 async function main() {
   // Load config, create logger...

   // NEW: Validate parsers before starting server
   logger.info("Validating tree-sitter parsers...");
   const validation = validateAllParsers();

   if (!validation.success) {
     logger.error("❌ Parser validation failed:");
     validation.failures.forEach(f => {
       logger.error(`  - ${f.language}: ${f.error}`);
     });
     process.exit(1);  // Fail fast
   }

   logger.info("✅ All 12 parsers validated");

   // Continue with MCP server initialization...
 }

 ---
 Service Layer Updates

 Remove Language Restriction:
 // In src/service.ts - ensureSnapshot() method
 private async ensureSnapshot(session: TransactionSession): Promise<TreeSnapshot> {
   // REMOVE the TS/JS-only check (lines 554-562)
   // All languages now supported
   return this.trees.hydrate(session);
 }

 Update Schema:
 // src/schemas.ts
 export const SupportedLanguageSchema = z.enum([
   "css",
   "dart",
   "go",
   "html",
   "java",
   "javascript",
   "json",
   "markdown",
   "python",
   "rust",
   "typescript",
   "yaml",
 ]);

 ---
 Phase 1 Testing Strategy

 Test Fixtures (tests/fixtures/):
 - sample.md - Markdown with headings and code blocks
 - config.json - JSON object with nested structure
 - app.yaml - YAML with nested mappings
 - index.html - HTML with elements and attributes
 - style.css - CSS with rules and selectors
 - script.py - Python with functions and classes
 - main.go - Go with package and functions
 - main.rs - Rust with functions and match statements

 Unit Tests:
 1. tests/parser-validation.test.ts - All 12 parsers validate
 2. tests/multi-language.test.ts - Parse each language (8 tests)

 Integration Tests:
 test("Multi-language transaction lifecycle", async () => {
   const files = [
     { path: "test.md", lang: "markdown", content: "# Title" },
     { path: "config.json", lang: "json", content: '{"key":"value"}' },
     // ... 6 more
   ];

   for (const file of files) {
     const tx = await service.beginTransaction({...});
     const nodes = await service.listNodes({...});
     await service.commit({...});
   }
 });

 ---
 Docker Build Compatibility

 No Dockerfile changes needed - existing multi-stage build handles native modules:
 - Build tools installed (python3, make, g++)
 - npm rebuild in prod-deps stage
 - Distroless runtime for security

 Expected Impact:
 - Size: +36MB (12 parsers × 3MB avg)
 - Build time: +6 minutes (native compilation)
 - Final image: ~380MB (within <500MB target)

 ---
 PHASE 2: File Creation → v2.2

 Estimated Time: 2-3 hours
 Priority: 🟡 HIGH

 New Tool: scalpel_create_file

 Schema (src/schemas.ts):
 export const ScalpelCreateFileArgsSchema = z.object({
   file: FilePathSchema,
   language: SupportedLanguageSchema.optional(),
   initial_content: z.string().max(10_000_000).default(""),
   overwrite: z.boolean().default(false)
 }).strict();

 Service Method (src/service.ts):
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
       `File already exists: ${args.file}. Use overwrite=true to replace.`
     );
   }

   // Infer language
   const inferredLanguage = inferLanguageFromPath(absoluteFilePath);
   const language = args.language ?? inferredLanguage;

   if (!language) {
     throw new ToolError(
       "INVALID_OPERATION",
       "Unable to infer file language. Provide language explicitly."
     );
   }

   // Create parent directories
   const parentDir = path.dirname(absoluteFilePath);
   await mkdir(parentDir, { recursive: true });

   // Write file
   await writeFile(absoluteFilePath, args.initial_content, "utf8");

   // Auto-start transaction
   const session = this.transactions.begin(args.file, absoluteFilePath, language);

   return {
     transactionId: session.transactionId,
     file: args.file,
     language,
     created: !fileExists,
     bytesWritten: Buffer.byteLength(args.initial_content, "utf8"),
   };
 }

 Key Features:
 - ✅ Auto-starts transaction for immediate editing
 - ✅ Overwrite protection (default: fail if exists)
 - ✅ Auto-creates parent directories
 - ✅ 10MB content limit
 - ✅ Language inference from extension or filename
 - ✅ Path traversal protection via resolveWorkspacePath()

 ---
 Integration Points

 Files to Modify:
 1. src/tool-names.ts - Add "scalpel_create_file"
 2. src/schemas.ts - Add schema + TOOL_SCHEMAS entry
 3. src/tool-definitions.ts - Add MCP definition
 4. src/service.ts - Add createFile() method
 5. src/index.ts - Add case to executeTool() switch

 ---
 Phase 2 Testing

 Unit Tests (10 tests):
 1. Create file with valid content
 2. Create file with empty content
 3. Overwrite protection (fail if exists)
 4. Overwrite with flag (success)
 5. Parent directory creation (nested paths)
 6. Language inference from extension
 7. Language inference from explicit parameter
 8. Max content size enforcement (10MB)
 9. Transaction auto-start verification
 10. Path traversal prevention

 Integration Test:
 # Create → Edit → Commit workflow
 scalpel_create_file → scalpel_insert_child → scalpel_commit

 ---
 PHASE 3: Full MCP Compliance → v3.0

 Estimated Time: 6-8 hours
 Priority: 🟢 MEDIUM

 Current vs Target State

 Current:
 capabilities: { tools: {} }

 Target:
 capabilities: {
   tools: {},
   resources: {},
   prompts: {},
   logging: {},
   sampling: {},
 }

 ---
 1. Resources Capability

 Purpose: Expose workspace files as discoverable MCP resources

 Implementation (src/index.ts):
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
   const absolutePath = relativeOrAbsolutePath.startsWith(config.workspaceRoot)
     ? relativeOrAbsolutePath
     : resolveWorkspacePath(config.workspaceRoot, relativeOrAbsolutePath);

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
     contents: [{
       uri,
       mimeType,
       text: content,
     }],
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

 Security: Path traversal protection via resolveWorkspacePath()

 ---
 2. Prompts Capability

 Purpose: Provide predefined refactoring workflow prompts

 7 Comprehensive Prompts:
 1. refactor_extract_function - Extract code to new function
 2. refactor_rename_symbol - Rename variable/function/class
 3. add_documentation - Add JSDoc/comments
 4. add_error_handling - Wrap code in try/catch (NEW)
 5. convert_to_async - Convert sync to async/await (NEW)
 6. extract_to_module - Extract code to new file (NEW)
 7. optimize_imports - Remove unused imports (NEW)

 Implementation (src/index.ts):
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
     // ... 6 more prompts
   ],
 }));

 server.setRequestHandler(GetPromptRequestSchema, async (request) => {
   const { name, arguments: args } = request.params;

   switch (name) {
     case "refactor_extract_function":
       return {
         description: "Extract code into a new function",
         messages: [{
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
         }],
       };

     // ... 6 more prompt implementations
   }
 });

 Design Principles:
 - Step-by-step instructions
 - References specific Scalpel tools
 - Shows typical workflow patterns
 - Educational value for users

 ---
 3. Logging Capability

 Purpose: Dynamic log level control without restart

 Implementation (src/index.ts):
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
   logger.setLevel(internalLevel);

   return {};
 });

 Logger Enhancement (src/logger.ts):
 export class Logger {
   public setLevel(level: string): void {
     this.logger.level = level;
   }
 }

 ---
 4. Progress Notifications

 Purpose: Show commit operation progress to users

 Service Constructor Update (src/service.ts):
 export class ScalpelService {
   private readonly trees: TreeStore;

   public constructor(
     private readonly config: AppConfig,
     private readonly logger: Logger,
     private readonly transactions: TransactionStore,
     private readonly server?: Server,  // NEW - Optional for progress
   ) {
     this.trees = new TreeStore();
   }
 }

 Commit Method Enhancement:
 public async commit(args: ScalpelCommitArgs): Promise<{...}> {
   const session = this.requireSessionForFile(args.transaction_id, args.file);

   // 0% - Starting
   await this.server?.sendProgress({
     progressToken: args.transaction_id,
     progress: 0,
     total: 100,
   });

   await this.ensureSnapshot(session);

   // 25% - Tree hydrated
   await this.server?.sendProgress({
     progressToken: args.transaction_id,
     progress: 25,
     total: 100,
   });

   const result = await this.trees.commit(
     session.transactionId,
     session.absoluteFilePath,
   );

   // 75% - Tree committed
   await this.server?.sendProgress({
     progressToken: args.transaction_id,
     progress: 75,
     total: 100,
   });

   session.workingVersion = result.treeVersion;
   session.committedVersion = result.treeVersion;
   this.transactions.touch(session.transactionId);

   // 100% - Complete
   await this.server?.sendProgress({
     progressToken: args.transaction_id,
     progress: 100,
     total: 100,
   });

   return { ... };
 }

 Server Injection (src/index.ts):
 // CRITICAL: Server must be created BEFORE service
 const server = new Server({ ... }, { capabilities: { ... } });

 // Now inject server reference
 const service = new ScalpelService(config, logger, transactions, server);

 ---
 5. Sampling Capability

 Implementation: Declaration only (client-driven)
 capabilities: {
   tools: {},
   resources: {},
   prompts: {},
   logging: {},
   sampling: {},  // No handler needed
 }

 ---
 Phase 3 Testing

 MCP Protocol Tests:
 1. resources/list returns workspace root
 2. resources/read returns file contents with correct MIME type
 3. resources/templates returns file:// template
 4. prompts/list returns 7 prompts
 5. prompts/get for each prompt type (7 tests)
 6. logging/setLevel changes logger level
 7. Progress notifications during commit (4 updates)
 8. Invalid resource URI error handling
 9. Unknown prompt name error handling

 End-to-End Test:
 # Use prompt to extract function
 prompts/get → scalpel_begin_transaction → scalpel_search_structure →
 scalpel_insert_child → scalpel_replace_node → scalpel_commit

 ---
 Critical Files to Modify

 Phase 0 (7 files)

 - src/query-engine.ts - Fix compileSelector(), add inferFieldType()
 - src/schemas.ts - Add DiffOutputSchema, update result schemas, add pagination params
 - src/diff-generator.ts - NEW FILE - Diff generation utility
 - src/pagination.ts - NEW FILE - Cursor-based pagination
 - src/service.ts - Integrate diffs and pagination
 - src/tree-store.ts - Capture before/after state in mutations
 - tests/ - Add 20 new tests across 4 test files

 Phase 1 (5 files)

 - package.json - Add 8 tree-sitter parser dependencies
 - src/tree-sitter-parser.ts - Add imports, validateAllParsers(), getLanguageGrammar()
 - src/schemas.ts - Extend SupportedLanguageSchema to 12 languages
 - src/service.ts - Extend EXTENSION_LANGUAGE_MAP, add FILENAME_LANGUAGE_MAP, remove restrictions
 - src/index.ts - Add startup validation hook

 Phase 2 (5 files)

 - src/tool-names.ts - Add "scalpel_create_file"
 - src/schemas.ts - Add ScalpelCreateFileArgsSchema
 - src/tool-definitions.ts - Add tool definition
 - src/service.ts - Implement createFile() method
 - src/index.ts - Wire to executeTool()

 Phase 3 (3 files)

 - src/index.ts - Add all MCP request handlers (~300 lines), update capabilities, reorder initialization
 - src/service.ts - Add server parameter to constructor, add progress notifications
 - src/logger.ts - Add setLevel() method

 ---
 Verification & Testing

 Manual Testing After Each Phase

 Phase 0:
 # Build Docker
 docker build -t scalpel-v2.0.1 .

 # Test TSQuery fix
 echo '{"file":"test.ts","selector":"function_declaration[name=\"foo\"]"}' | docker run --rm -i scalpel-v2.0.1

 # Test diff output
 # (requires transaction setup)

 # Test pagination
 # (test with large file, 491+ nodes)

 Phase 1:
 docker build -t scalpel-v2.1 .

 # Test each language
 for ext in md json yaml html css py go; do
   echo "Testing $ext..."
   echo "{\"file\":\"test.$ext\"}" | docker run --rm -i scalpel-v2.1
 done

 Phase 2:
 docker build -t scalpel-v2.2 .

 # Test file creation
 echo '{"file":"new.ts","initial_content":"const x = 1;"}' | docker run --rm -i scalpel-v2.2

 Phase 3:
 docker build -t scalpel-v3.0 .

 # Test MCP capabilities
 echo '{"jsonrpc":"2.0","method":"resources/list","id":1}' | docker run --rm -i scalpel-v3.0

 ---
 Automated Test Suite

 Run after each phase:
 npm test

 # Expected results:
 # Phase 0: 36 existing + 20 new = 56 tests
 # Phase 1: 56 + 10 new = 66 tests
 # Phase 2: 66 + 10 new = 76 tests
 # Phase 3: 76 + 9 new = 85 tests

 ---
 Documentation Updates

 Essential Docs (Per User Request)

 README.md Updates:
 - Add language support table (12 languages)
 - Add extension mapping table (29+ extensions)
 - Add example for each language
 - Update tool list (14 tools)
 - Add MCP capabilities section

 CHANGELOG.md Creation:
 # Changelog

 ## [3.0.0] - 2026-02-XX

 ### Added (Phase 3)
 - Resources capability (file:// URIs)
 - Prompts capability (7 refactoring prompts)
 - Logging capability (dynamic log levels)
 - Sampling capability (client-driven)
 - Progress notifications for commit operations

 ## [2.2.0] - 2026-02-XX

 ### Added (Phase 2)
 - `scalpel_create_file` tool
 - Auto-transaction start after file creation
 - Parent directory auto-creation

 ## [2.1.0] - 2026-02-XX

 ### Added (Phase 1)
 - 7 new languages: Markdown, JSON, YAML, HTML, CSS, Python, Go
 - Rust parser implementation
 - Startup validation for all 12 parsers
 - 29 file extensions + special filename detection

 ## [2.0.1] - 2026-02-XX

 ### Fixed (Phase 0)
 - TSQuery syntax error in attribute selectors
 - Missing diff output in edit operations
 - No pagination for large node lists

 ---
 Risk Mitigation

 High Impact Risks: None Identified

 All changes are additive (no breaking changes except TSQuery fix which is fixing broken functionality)

 Medium Impact Risks

 1. Tree-sitter parser compilation failures
   - Mitigation: Existing Docker build has proper toolchain
   - Startup validation catches issues early
 2. Prompt instruction quality
   - Mitigation: Test each prompt with real LLM, iterate
   - Clear step-by-step instructions
 3. Progress notification performance
   - Mitigation: Benchmark before/after, optimize if needed
   - Limited to commit operation only

 ---
 Success Criteria

 Phase 0 (v2.0.1)

 - ✅ All attribute-based queries work (function_declaration[name="foo"])
 - ✅ Edit operations return before/after diffs
 - ✅ Files with 10,000 nodes paginate successfully
 - ✅ All 56 tests pass
 - ✅ Diff generation adds <100ms latency

 Phase 1 (v2.1)

 - ✅ All 12 parsers validate at startup
 - ✅ Server fails fast with clear errors if parser missing
 - ✅ All 29 extensions map correctly
 - ✅ Special filenames detected (README, Dockerfile, etc.)
 - ✅ Transaction lifecycle works for all languages
 - ✅ Docker image <500MB
 - ✅ All 66 tests pass

 Phase 2 (v2.2)

 - ✅ scalpel_create_file works for all supported languages
 - ✅ Auto-starts transaction for immediate editing
 - ✅ Overwrite protection prevents accidents
 - ✅ Parent directories created automatically
 - ✅ 10MB content limit enforced
 - ✅ Path traversal protection works
 - ✅ All 76 tests pass

 Phase 3 (v3.0)

 - ✅ All 5 MCP capabilities declared
 - ✅ Resources handlers work correctly (list, read, templates)
 - ✅ 7 prompts with clear step-by-step instructions
 - ✅ Dynamic log level changes work
 - ✅ Commit shows 4 progress updates
 - ✅ No breaking changes to existing tools
 - ✅ All 85 tests pass

 ---
 Estimated Timeline

 Total Implementation Time: 34-45 hours
 ┌───────────────┬────────┬────────────┬─────────────┐
 │     Phase     │  Time  │ Complexity │  Priority   │
 ├───────────────┼────────┼────────────┼─────────────┤
 │ Phase 0       │ 2-3h   │ Low-Medium │ 🔴 Critical │
 ├───────────────┼────────┼────────────┼─────────────┤
 │ Phase 1       │ 12-15h │ High       │ 🔴 Critical │
 ├───────────────┼────────┼────────────┼─────────────┤
 │ Phase 2       │ 2-3h   │ Low        │ 🟡 High     │
 ├───────────────┼────────┼────────────┼─────────────┤
 │ Phase 3       │ 6-8h   │ Medium     │ 🟢 Medium   │
 ├───────────────┼────────┼────────────┼─────────────┤
 │ Documentation │ 2.5h   │ Low        │ 🟢 Medium   │
 ├───────────────┼────────┼────────────┼─────────────┤
 │ Testing       │ 10-12h │ Medium     │ 🔴 Critical │
 └───────────────┴────────┴────────────┴─────────────┘
 Delivery Model: 4 incremental releases over flexible timeline (quality over speed)

 ---
 Implementation Notes

 Key Architectural Patterns to Follow

 1. Scalpel's 5-File Pattern (for new tools):
   - tool-names.ts → schemas.ts → tool-definitions.ts → service.ts → index.ts
 2. Error Handling:
   - Use ToolError class with standard error codes
   - Path traversal protection via resolveWorkspacePath()
   - Validation via Zod schemas
 3. Transaction Model:
   - All operations require active transaction
   - Auto-cleanup via TTL (default: 5 minutes)
   - Mutations tracked in TreeSnapshot
 4. Testing Strategy:
   - Unit tests for new utilities (diff, pagination)
   - Integration tests for end-to-end workflows
   - MCP protocol compliance tests
   - Manual Docker testing after each phase

 Existing Utilities to Reuse

 - resolveWorkspacePath() - Path safety (src/path-safety.ts)
 - ToolError - Structured errors (src/errors.ts)
 - parseSourceText() - Tree-sitter parsing (src/tree-store.ts)
 - TransactionStore - Transaction management (src/transaction-store.ts)
 - TreeStore - AST management (src/tree-store.ts)

 ---
 Next Steps

 After plan approval:
 1. Execute Phase 0 → v2.0.1 release
 2. Execute Phase 1 → v2.1 release
 3. Execute Phase 2 → v2.2 release
 4. Execute Phase 3 → v3.0 release
 5. Update README + create CHANGELOG
 6. Final verification and deployment

 ---
 Plan Status: COMPLETE ✅
 Ready for: Autonomous execution
 Review Model: Review at end (post-v3.0)
 Quality Focus: Comprehensive testing, clean implementation, proper error handling
╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
