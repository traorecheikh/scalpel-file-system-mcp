# Tech Stack

## Core Technologies
- **Runtime**: Node.js >=20.0.0
- **Language**: TypeScript 5.7.2
- **Build System**: tsc (TypeScript compiler)
- **Module System**: ES Modules (NodeNext)
- **Test Runner**: Node.js native test runner

## Key Dependencies
- **@modelcontextprotocol/sdk**: ^1.0.0 - MCP protocol implementation
- **tree-sitter**: ^0.25.0 - Parser runtime
- **tree-sitter-typescript**: ^0.23.2
- **tree-sitter-javascript**: ^0.25.0
- **tree-sitter-java**: ^0.23.5
- **tree-sitter-dart**: ^1.0.0 (experimental)
- **zod**: ^3.23.8 - Runtime schema validation

## TypeScript Configuration
- Target: ES2022
- Module: NodeNext
- Strict mode enabled
- noUncheckedIndexedAccess: true
- exactOptionalPropertyTypes: true
- Source maps enabled
