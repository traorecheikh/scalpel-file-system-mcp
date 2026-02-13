# Scalpel MCP Server - Project Overview

## Purpose
Multi-language structural code editing server implementing Model Context Protocol (MCP). Provides deterministic syntax tree mutations through persistent node identities and transactional editing. Instead of text diffs, Scalpel operates on stable AST nodes with structural validation.

## Current Status
- **Version**: 0.1.0
- **Supported Languages**: TypeScript, JavaScript, Java
- **Experimental**: Dart (compatibility issues)
- **Planned**: Rust, Python, Go, Markdown, JSON, YAML, HTML, CSS

## Architecture
- Tree-sitter-based parsing for multi-language support
- In-memory AST storage with persistent node IDs
- Transactional editing model (begin → mutate → validate → commit)
- Rate limiting, audit logging, security hardening

## Key Features
- Persistent Node Identity (>99.5% stability target)
- Structural Mutations (insert, replace, remove, move)
- Transactional Editing with atomic file writes
- Format Preservation
- Multi-Language Support via tree-sitter parsers
