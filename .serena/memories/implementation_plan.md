# Scalpel v2.0 → v3.0 Implementation Plan

## Overview
Transform Scalpel from supporting 5 languages to 12 languages with full MCP compliance through 4 incremental releases.

## Phases
- **Phase 0 (v2.0.1)**: Critical bug fixes (2-3 hours)
  - TSQuery syntax error in compileSelector()
  - Missing diff output in edit operations
  - Missing pagination in listNodes()

- **Phase 1 (v2.1)**: Universal file support (12-15 hours)
  - Add 7 new tree-sitter parsers (Markdown, JSON, YAML, HTML, CSS, Python, Go)
  - Implement Rust parser
  - Extend to 29+ file extensions
  - Startup validation for all parsers

- **Phase 2 (v2.2)**: File creation (2-3 hours)
  - New scalpel_create_file tool
  - Auto-start transaction after creation

- **Phase 3 (v3.0)**: Full MCP compliance (6-8 hours)
  - Resources capability (file:// URIs)
  - Prompts capability (7 refactoring prompts)
  - Logging capability (dynamic log levels)
  - Sampling capability
  - Progress notifications

## Total Effort
34-45 hours across 4 releases

## Execution Model
All-at-once implementation with review at end (post-v3.0)
