# Code Style & Conventions

## TypeScript Style
- **Strict Mode**: All strict TypeScript checks enabled
- **Naming**: 
  - camelCase for variables and functions
  - PascalCase for classes and types
  - UPPER_SNAKE_CASE for constants
- **Imports**: ES modules with .js extension (NodeNext)
- **Error Handling**: Custom ToolError class with error codes

## File Organization
- **Config**: config.ts - Environment variable loading
- **Errors**: errors.ts - Custom error classes
- **Types**: types.ts - Shared type definitions
- **Schemas**: schemas.ts - Zod validation schemas
- **Service Layer**: service.ts - Business logic
- **Tool Definitions**: tool-definitions.ts - MCP tool specifications

## Patterns Used
- **Dependency Injection**: Pass logger, config as constructor params
- **Validation**: Zod schemas for all inputs
- **Immutability**: Prefer const, readonly where applicable
- **Error Propagation**: Throw ToolError, catch at handler boundary
- **Transaction Pattern**: Begin → Mutate → Validate → Commit

## Testing Conventions
- Test files: `*.test.ts` in tests/ directory
- Use Node.js native test runner
- Test structure: arrange → act → assert
- Mock external dependencies
- Integration tests for end-to-end workflows

## Comments
- Minimal comments (code should be self-documenting)
- TSDoc for public APIs
- Inline comments only for complex logic
