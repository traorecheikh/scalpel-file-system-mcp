# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2026-02-13

### Added (Phase 3)
- **Full MCP Compliance**: Implemented all 5 MCP capabilities (Tools, Resources, Prompts, Logging, Sampling).
- **Resources Capability**: Workspace files exposed as discoverable `file://` URIs.
- **Prompts Capability**: 7 predefined refactoring prompts (extract function, rename symbol, etc.).
- **Logging Capability**: Dynamic log level control via MCP `logging/setLevel`.
- **Progress Notifications**: Real-time progress updates during `commit` operations.
- **Sampling Capability**: Declared support for client-driven sampling.

## [2.2.0] - 2026-02-13

### Added (Phase 2)
- **File Creation**: New `scalpel_create_file` tool.
- **Auto-Transaction**: Automatic mutation transaction start immediately after file creation.
- **Directory Creation**: Automatic recursive parent directory creation for new files.
- **Language Inference**: Automatic language detection for new files based on extension or filename.

## [2.1.0] - 2026-02-13

### Added (Phase 1)
- **Universal File Support**: Added 7 new native tree-sitter parsers (Markdown, JSON, YAML, HTML, CSS, Python, Go).
- **Rust Parser**: Implemented native Rust parser support.
- **Dual-Phase Parser Init**: Eager startup validation combined with lazy runtime access.
- **Filename-Based Detection**: Added support for extensionless files like `README`, `Dockerfile`, `Makefile`.
- **Expanded Extensions**: Support for 29+ file extensions across 12 languages.

## [2.0.1] - 2026-02-13

### Fixed (Phase 0)
- **TSQuery Syntax Error**: Corrected attribute selector compilation by adding field type inference.
- **Missing Diff Output**: Mutation operations now return comprehensive `before`, `after`, and `unified_diff` data.
- **Pagination Support**: Implemented cursor-based pagination for `scalpel_list_nodes` to handle large files (10,000+ nodes).
- **Attribute Queries**: Fixed broken structural searches for all attribute-based queries (e.g., `function_declaration[name="foo"]`).
