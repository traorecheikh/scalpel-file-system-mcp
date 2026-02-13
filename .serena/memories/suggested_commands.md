# Essential Commands

## Development Workflow
```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Type checking (no emit)
npm run typecheck

# Build for production
npm run build

# Run built server
npm start
```

## Testing
```bash
# Run all tests
npm test

# Run with specific test file
npm test tests/query-engine.test.ts
```

## Docker
```bash
# Build Docker image
docker build -t scalpel-mcp:latest .

# Run Docker container
docker run --rm -i \
  --user $(id -u):$(id -g) \
  -v "$PWD:/workspace" \
  scalpel-mcp:latest

# Test with sample workspace
docker run --rm -i \
  -v "/tmp/test-workspace:/workspace" \
  scalpel-mcp:latest
```

## Git Workflow
```bash
# Create feature branch
git checkout -b feature/phase-X

# Stage and commit
git add [files]
git commit -m "feat: description"

# Push to remote
git push -u origin feature/phase-X
```

## Useful System Commands
- `ls -la` - List files with details
- `grep -r "pattern" src/` - Search in source
- `find . -name "*.ts"` - Find TypeScript files
- `cat file.ts` - View file contents
- `pwd` - Print working directory
