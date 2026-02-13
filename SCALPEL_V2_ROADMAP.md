# Scalpel MCP V2: The Tenfold Improvement Roadmap

This roadmap outlines the path to transforming Scalpel MCP into a "telepathic" structural editing engine for LLMs. The goal is a **10x improvement** in token efficiency, round-trip latency, and cognitive load for AI agents.

## 🎯 The Vision: "Mind-Meld" Editing

Current State:
> LLM: "I want to add a parameter."
> LLM: `read_file` (10k tokens)
> LLM: `list_nodes` (5k tokens) -> find parent ID
> LLM: `insert_child` (ID, JSON descriptor) (500 tokens)
> LLM: `commit`

Future State (V2):
> LLM: "Add `maxRetries` to `fetchData`."
> LLM: `scalpel_search_structure("function[name='fetchData']")` -> ID: `fn_123` (50 tokens)
> LLM: `scalpel_edit_intent("add_parameter", { parent: "fn_123", name: "maxRetries", type: "number", default: "3" })` (50 tokens)
> Server: Done.

---

## 🚀 Top 5 Breakthroughs

### 1. Structural Query Engine (SQE) & Telepathic Context
**Problem**: LLMs waste thousands of tokens reading file content just to find *where* to edit.
**Solution**: Expose a powerful query language (simplified Tree-sitter query or CSS-selector-like syntax) to find nodes without reading the file.

*   **Design Sketch**:
    *   New Tool: `scalpel_search_structure(selector: string, context_lines: number)`
    *   Selector: `function_declaration[name="fetchData"]`
    *   Returns: List of Node IDs + minimal signature/context.
*   **Token Savings**: **99% reduction** for navigation. (From 10k tokens to <100).
*   **Complexity**: Medium (Wrapper around Tree-sitter queries).
*   **Dependencies**: Tree-sitter.

### 2. Persistent "Soul" Identity (Semantic Anchors)
**Problem**: Node IDs (`i_123`) are transient. If the file changes or server restarts, knowledge is lost.
**Solution**: Implement **semantic, persistent IDs** that survive edits, renames, and restarts.
*   **Design Sketch**:
    *   IDs are hashes of `(file_path, semantic_path, content_hash)`.
    *   Maintain a sidecar database (`.scalpel/id-map.json`) mapping these stable hashes to current transient IDs.
    *   LLM can "remember" `node_fetch_data_fn` across sessions.
*   **Token Savings**: **Zero re-discovery**. If the LLM knows the ID from a previous turn, it works forever.
*   **Complexity**: High (Requires robust reconciliation logic).
*   **Dependencies**: SQLite or JSON store.

### 3. Intent-Based Macros (The "Surgeon's Hand")
**Problem**: Primitive ops (`insert_child`, `replace_node`) are too low-level. "Add a parameter" requires finding the parameter list node, calculating index, etc.
**Solution**: High-level "Intents" that compile to primitives server-side.
*   **Design Sketch**:
    *   `scalpel_edit_intent(intent: "add_parameter", target: "fn_123", args: { ... })`
    *   `scalpel_edit_intent(intent: "wrap", target: "stmt_456", template: "try { $node } catch (e) { ... }")`
    *   Server handles the AST traversal to find the exact insertion point (e.g., finding the `parameters` node inside `function_declaration`).
*   **Token Savings**: **5-10x reduction** in round trips and thought tokens.
*   **Complexity**: Medium (Language-specific logic maps).
*   **Dependencies**: None.

### 4. Smart Descriptor DSL (Compressed Syntax)
**Problem**: JSON descriptors are verbose (`{ "kind": "parameter", "fields": { "name": "x", "type": "string" } }`).
**Solution**: A micro-DSL for node creation.
*   **Design Sketch**:
    *   Instead of JSON, accept: `param(x,string,"default")`
    *   `import(fs,readFileSync)`
    *   Server parses this "shorthand" into the AST descriptor.
*   **Token Savings**: **50-70% reduction** in input tokens.
*   **Complexity**: Low (Simple parser).
*   **Dependencies**: None.

### 5. Transaction Batching & "Dry Run"
**Problem**: Every small edit is a round trip. Fear of breaking code leads to cautious, slow steps.
**Solution**: Allow submitting a *batch* of intents, and a `dry_run` flag to see the diff before committing.
*   **Design Sketch**:
    *   `scalpel_batch([ { tool: "edit", ... }, { tool: "move", ... } ], dry_run: true)`
    *   Returns: "This would modify lines 10-15. New signature: `function foo(x, y)`."
*   **Token Savings**: **10x reduction** in round trips for complex refactors.
*   **Complexity**: Low (Loop over existing logic).
*   **Dependencies**: None.

---

## 🛠 Revised API Surface (V2)

### Tools

1.  `scalpel_open(file_path)` -> `{ status: "ready", structural_summary: "..." }`
    *   Loads file, returns top-level structure (classes, functions) with IDs.
2.  `scalpel_search_structure(selector)` -> `[{ id: "...", type: "...", text_snippet: "..." }]`
    *   Finds nodes by pattern.
3.  `scalpel_edit_intent(intent, args)` -> `{ operations: [...] }`
    *   Compiles high-level intents into primitive operations.
4.  `scalpel_commit()` -> `{ status: "saved", new_version: "..." }`

### Removed/Deprecated
*   `scalpel_list_nodes` (replaced by `scalpel_search_structure`)
*   Low-level operations (`scalpel_insert_child`, etc.) can be replaced by `scalpel_edit_intent` for common tasks

---

## 📅 Migration Path

1.  **Phase 1: The Query Engine** (Week 1)
    *   Implement `scalpel_search_structure` using Tree-sitter queries.
    *   This delivers immediate value by removing the need to read full files.

2.  **Phase 2: The Batcher & Macros** (Week 2)
    *   Implement `scalpel_edit_intent` that accepts high-level intents.
    *   Add first 3 macros: `add_parameter`, `add_import`, `add_class_member`.

3.  **Phase 3: Persistent Identity** (Week 3)
    *   Implement the sidecar ID map.
    *   Update `open` to load/save this map.

4.  **Phase 4: DSL & Refinement** (Week 4)
    *   Implement the short-code parser.
    *   Finalize V2 API.

---

## ⚠️ Risks & Open Questions

*   **Ambiguity**: Structural queries might return multiple nodes. The UI/LLM needs to handle "Did you mean A or B?"
*   **Language Support**: Macros like `add_parameter` behave differently in Java vs TS. We need a robust "Language Adapter" layer.
*   **Persistence**: If the user edits the file manually (outside Scalpel), how do we reconcile IDs? We might need a "re-sync" step on `open`.
