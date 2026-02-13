# Scalpel MCP Server

Universal structural code editing server implementing Model Context Protocol (MCP).

## Current Status

**✅ Supported Languages**: 10 languages with full AST support (TypeScript, JavaScript, Java, Dart, Rust, JSON, HTML, CSS, Python, Go)
**🔄 Coming in v3.1**: Line-based editing for Markdown, YAML, and plain text files via custom wrappers
**✅ Features**: Cursor-based pagination, before/after diffs, file creation, full MCP compliance

Scalpel provides deterministic syntax tree mutations through persistent node identities and transactional editing. Instead of text diffs, Scalpel operates on stable AST nodes with structural validation.

## Language Support

### ✅ Fully Supported (Tree-Sitter AST)

| Language | Status | Parser | Extensions |
|----------|--------|--------|------------|
| TypeScript | ✅ Production | `tree-sitter-typescript` | `.ts`, `.tsx` |
| JavaScript | ✅ Production | `tree-sitter-javascript` | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Java | ✅ Production | `tree-sitter-java` | `.java` |
| Dart | ✅ Production | `@sengac/tree-sitter-dart` | `.dart` |
| Rust | ✅ Production | `tree-sitter-rust` | `.rs` |
| JSON | ✅ Production | `tree-sitter-json` | `.json`, `.jsonc`, `.babelrc`, `.eslintrc` |
| HTML | ✅ Production | `tree-sitter-html` | `.html`, `.htm`, `.xhtml` |
| CSS | ✅ Production | `tree-sitter-css` | `.css`, `.scss`, `.sass`, `.less` |
| Python | ✅ Production | `tree-sitter-python` | `.py`, `.pyi`, `.pyx` |
| Go | ✅ Production | `tree-sitter-go` | `.go` |

### 🔄 Planned for v3.1 (Line-Based Custom Wrappers)

| Language | Status | Approach | Extensions |
|----------|--------|----------|------------|
| Markdown | 📋 Planned | Custom line/block wrapper | `.md`, `.markdown`, `.mdx`, `README`, `CHANGELOG` |
| YAML | 📋 Planned | Custom structure wrapper | `.yaml`, `.yml`, `.clang-format` |
| Plain Text | 📋 Planned | Line-based operations | `.txt`, `.log` |

**Note**: All AST-based languages share the same mutation API. Special filenames like `README`, `Dockerfile`, `Makefile` are automatically detected. Line-based formats will use a simplified API optimized for text editing.

## Features

- **Persistent Node Identity** — AST nodes maintain stable IDs across reparses (>99.5% stability target)
- **Structural Mutations** — Insert, replace, remove, and move nodes with grammar validation
- **Transactional Editing** — Begin, validate, commit, or rollback with atomic file writes
- **Format Preservation** — Maintains original formatting where unchanged; generates canonical syntax for mutations
- **Security Hardened** — Rate limiting, audit logging, path traversal protection, input validation
- **Universal File Support** — 10 production-ready tree-sitter parsers covering ~90% of code files
- **File Creation** — Create new files and automatically start editing transactions
- **Pagination & Diffs** — Handle 10,000+ node files efficiently with cursor-based pagination and see before/after diffs for every edit
- **Full MCP Compliance** — Implements Tools, Resources, Prompts, Logging, and Sampling capabilities

## Architecture

Scalpel stores each file as an in-memory syntax tree with:

- **Instance IDs** — Unique, stable identifiers for every node
- **Structural Hashes** — Content-based fingerprints for identity reconciliation
- **Descriptor Compiler** — Converts high-level node specifications to AST insertions
- **Validation Engine** — Prevents orphaned nodes, cycles, and type mismatches
- **Serialization** — Source layout preservation + generated snippets for mutated regions

### Parser Architecture

Scalpel uses tree-sitter for multi-language parsing with dual-phase initialization (startup validation + lazy runtime access).

Tree-sitter provides:
- Fast, incremental parsing
- Error recovery for malformed code
- Consistent AST structure across languages
- Rich syntax node metadata

## Installation

### NPX

```bash
npx -y scalpel-mcp
```

### Docker

```bash
docker pull scalpel-mcp:latest
docker run --rm -i \
  --user $(id -u):$(id -g) \
  -v "$PWD:/workspace" \
  scalpel-mcp:latest
```

## Configuration

All configuration via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `SCALPEL_WORKSPACE_ROOT` | `/workspace` (Docker)<br>`process.cwd()` (Node) | Root directory for file operations |
| `SCALPEL_TRANSACTION_TTL_MS` | `900000` (15 min) | Transaction expiration time |
| `SCALPEL_RATE_LIMIT_GLOBAL` | `600` | Max requests per 60s (all sessions) |
| `SCALPEL_RATE_LIMIT_SESSION` | `300` | Max requests per 60s (per session) |
| `SCALPEL_RATE_LIMIT_MUTATION` | `120` | Max mutations per 60s (per session) |
| `SCALPEL_AUDIT_LOG_ENABLED` | `true` | Enable mutation audit logs |
| `LOG_LEVEL` | `info` | Winston log level (`error`, `warn`, `info`, `debug`) |
| `NODE_ENV` | `development` | Set to `production` for hardened error messages |

## Usage with Claude Desktop

### Docker

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--user",
        "$(id -u):$(id -g)",
        "--mount",
        "type=bind,src=/path/to/project,dst=/workspace",
        "scalpel-mcp:latest"
      ],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### NPX

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "npx",
      "args": [
        "-y",
        "scalpel-mcp"
      ],
      "env": {
        "SCALPEL_WORKSPACE_ROOT": "/path/to/project",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

## API

### Tools

- **scalpel_create_file**
  - Create a new file and automatically start a mutation transaction
  - Inputs: `file`, `language` (optional), `initial_content` (optional), `overwrite` (boolean)

- **scalpel_begin_transaction**
  - Parse a file and start a new transaction
  - Inputs: `file`, `language` (optional)

- **scalpel_list_nodes**
  - Traverse tree and list node metadata with **cursor-based pagination**
  - Inputs: `transaction_id`, `depth`, `filter_by_type`, `limit`, `cursor`, `filter_by_parent`

- **scalpel_get_node**
  - Retrieve single node metadata and optional source text excerpt

- **scalpel_search_structure**
  - Search for nodes using simplified selector (e.g. `function_declaration[name="foo"]`) or raw tree-sitter queries

- **scalpel_insert_child**, **scalpel_replace_node**, **scalpel_remove_node**, **scalpel_move_subtree**
  - Structural mutations that return **before/after diffs** and updated identity metrics

- **scalpel_validate_transaction**, **scalpel_commit**, **scalpel_rollback**
  - Transaction management with atomic writes and validation

- **scalpel_health_check**
  - Server status, active transactions, and supported languages

### Resources (MCP)

Exposes workspace files as `file://` URIs. Allows clients to discover and read files directly through the MCP protocol.

### Prompts (MCP)

Provides 7 predefined refactoring workflow prompts:
1. `refactor_extract_function`
2. `refactor_rename_symbol`
3. `add_documentation`
4. `add_error_handling`
5. `convert_to_async`
6. `extract_to_module`
7. `optimize_imports`

### Logging & Progress (MCP)

- **Dynamic Log Levels**: Update server log level at runtime via MCP `logging/setLevel`
- **Progress Notifications**: See real-time progress updates during long-running `commit` operations

## Roadmap

### v3.1 - Line-Based Text File Support (Planned)

Custom wrappers for text-based formats that don't require full AST parsing:

- **Markdown**: Line/block-based operations for documentation files
- **YAML**: Structure-aware editing with custom parser wrapper
- **Plain Text**: Simple line-based insert/replace/delete for `.txt`, `.log` files
- **Enhanced JSON**: Fallback to line-based editing for malformed JSON files

These will use a simplified API optimized for text manipulation while maintaining Scalpel's transactional integrity and diff capabilities.

## Descriptor Types

Descriptors specify new nodes to insert/replace. Scalpel compiles these high-level specifications into AST nodes.

### Supported Kinds

| Kind | Fields | Example |
|------|--------|---------|
| `identifier` | `name` | `{type: "identifier", value: "userId"}` |
| `literal` | `value` | `{type: "literal", value: 42}` |
| `parameter` | `name`, `datatype`, `optional`, `value` | `{type: "parameter", fields: {name: "id", datatype: "string"}}` |
| `field` | `name`, `readonly`, `optional`, `datatype`, `value` | `{type: "field", fields: {name: "status", value: "'active'"}}` |
| `import_specifier` | `name`, `alias` | `{type: "import_specifier", fields: {name: "useState", alias: "useStateHook"}}` |
| `raw_node` | `value` | `{type: "raw_node", value: "console.log('hello')"}` |

## License

MIT License - see LICENSE file for details.

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Implementation Plan](./SCALPEL_MCP_IMPLEMENTATION_PLAN.md)
- [Claude Implementation Plan](./CLAUDE-PLAN.md)
