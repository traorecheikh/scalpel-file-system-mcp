# Task Completion Checklist

## Before Committing Code
1. ✅ **Type Check**: Run `npm run typecheck` - must pass with no errors
2. ✅ **Build**: Run `npm run build` - must compile successfully
3. ✅ **Tests**: Run `npm test` - all tests must pass
4. ✅ **Code Review**: Check for:
   - No console.log statements (use logger)
   - No TODOs or FIXMEs
   - Proper error handling with ToolError
   - Zod schemas for validation
   - No hardcoded values
5. ✅ **Documentation**: Update README.md if API changes

## After Each Phase
1. ✅ **Manual Testing**: Test new tools with sample inputs
2. ✅ **Docker Build**: Verify `docker build` succeeds
3. ✅ **Integration Test**: Run end-to-end workflow
4. ✅ **Version Bump**: Update package.json version
5. ✅ **Git Commit**: Use conventional commit format
   - `feat:` for new features
   - `fix:` for bug fixes
   - `test:` for test additions
   - `docs:` for documentation

## Release Checklist
1. ✅ All tests passing
2. ✅ Docker image builds successfully
3. ✅ CHANGELOG.md updated
4. ✅ README.md reflects new features
5. ✅ Version tagged in git
6. ✅ No breaking changes (or documented)

## Quality Gates
- Zero TypeScript errors
- 100% test pass rate
- Docker image <500MB
- No security vulnerabilities
