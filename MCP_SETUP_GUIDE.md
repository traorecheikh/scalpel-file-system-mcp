# Scalpel MCP Setup Guide

## Quick Start

### 1. Build the MCP Server

```bash
cd /home/cheikh/Playgroung/scalpel
npm run build
# Creates: dist/index.js (the MCP server)
```

### 2. Test the Server Works

```bash
node dist/index.js
# Should start and wait for MCP protocol messages
# Press Ctrl+C to exit
```

---

## Setup Options

### Option A: Global Installation (Use Anywhere)

```bash
# Add to package.json first
npm install -g .

# Now you can use "scalpel" command from anywhere
```

### Option B: Direct Path (Recommended for Testing)

Use the absolute path in MCP config:
```
/home/cheikh/Playgroung/scalpel/dist/index.js
```

---

## MCP Client Configuration

### For OpenCode

Create: `~/.config/opencode/mcp.json`

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "node",
      "args": ["/home/cheikh/Playgroung/scalpel/dist/index.js"],
      "transport": "stdio"
    }
  }
}
```

### For Claude Desktop

Create/Edit: `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac)
Or: `%APPDATA%/Claude/claude_desktop_config.json` (Windows)
Or: `~/.config/Claude/claude_desktop_config.json` (Linux)

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "node",
      "args": ["/home/cheikh/Playgroung/scalpel/dist/index.js"]
    }
  }
}
```

### For Project-Specific Setup

In your project folder: `.mcp.json`

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "node",
      "args": ["/home/cheikh/Playgroung/scalpel/dist/index.js"]
    }
  }
}
```

---

## Multiple Projects Setup

### Scenario: You have 10 different projects

```
/home/cheikh/projects/
├── ecommerce-app/
├── blog-platform/
├── api-gateway/
├── mobile-app/
├── data-pipeline/
├── admin-dashboard/
├── analytics-service/
├── payment-processor/
├── notification-system/
└── user-service/
```

### Strategy 1: One Global MCP Config

**Setup once:**
```bash
# Edit global config
nano ~/.config/opencode/mcp.json
```

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "node",
      "args": ["/home/cheikh/Playgroung/scalpel/dist/index.js"]
    }
  }
}
```

**How it works:**
- Open ANY project folder in OpenCode
- AI can use scalpel tools on any file
- The AI provides the full path: `/home/cheikh/projects/ecommerce-app/src/cart.js`
- Scalpel's TreeStore manages each file separately

**Example conversation:**

```
You: "cd /home/cheikh/projects/ecommerce-app"
You: "Add a discount parameter to calculateTotal function in src/cart.js"

AI internally calls:
scalpel_search_structure({
  file_path: "/home/cheikh/projects/ecommerce-app/src/cart.js",
  ...
})

You: "cd /home/cheikh/projects/blog-platform"
You: "Fix the getPost function in lib/api.ts"

AI internally calls:
scalpel_search_structure({
  file_path: "/home/cheikh/projects/blog-platform/lib/api.ts",
  ...
})
```

Both calls go to the **same MCP server instance**, but it keeps them separate!

### Strategy 2: Per-Project Config (More Control)

Add `.mcp.json` to each project:

```bash
# In each project
cd /home/cheikh/projects/ecommerce-app
cat > .mcp.json << 'EOF'
{
  "mcpServers": {
    "scalpel": {
      "command": "node",
      "args": ["/home/cheikh/Playgroung/scalpel/dist/index.js"],
      "env": {
        "PROJECT_ROOT": "/home/cheikh/projects/ecommerce-app"
      }
    }
  }
}
EOF
```

**Benefits:**
- Override MCP config per project
- Set project-specific environment variables
- Use different MCP server versions per project

---

## How File Paths Work

### The AI Always Provides Full Paths

```javascript
// Your TreeStore uses file_path as the key
class TreeStore {
  private snapshots = new Map<string, Snapshot>();
  
  hydrate(file_path: string, language: string, source_text: string) {
    // file_path = "/home/cheikh/projects/ecommerce-app/src/cart.js"
    
    if (this.snapshots.has(file_path)) {
      return this.snapshots.get(file_path);  // Reuse existing
    }
    
    // Create new snapshot for this file
    const snapshot = this.createSnapshot(file_path, language, source_text);
    this.snapshots.set(file_path, snapshot);
    return snapshot;
  }
}
```

### Example with Multiple Projects

```typescript
// User works on Project A
scalpel_insert_child({
  file_path: "/home/cheikh/projects/project-A/src/main.js",
  ...
})
// TreeStore now has: 
// Map { "/home/cheikh/projects/project-A/src/main.js" => Snapshot }

// User works on Project B (same MCP server!)
scalpel_search_structure({
  file_path: "/home/cheikh/projects/project-B/lib/utils.ts",
  ...
})
// TreeStore now has:
// Map {
//   "/home/cheikh/projects/project-A/src/main.js" => Snapshot,
//   "/home/cheikh/projects/project-B/lib/utils.ts" => Snapshot
// }

// Files are completely separate!
```

---

## Verification Steps

### 1. Check MCP Server Starts

```bash
node /home/cheikh/Playgroung/scalpel/dist/index.js
# Should print initialization logs and wait
# Ctrl+C to exit
```

### 2. Check Client Can Find It

```bash
# For OpenCode
cat ~/.config/opencode/mcp.json

# For Claude Desktop  
cat ~/.config/Claude/claude_desktop_config.json
```

### 3. Test from AI

In OpenCode or Claude Desktop:

```
You: "List available MCP tools"
AI: Should show scalpel_search_structure, scalpel_insert_child, etc.

You: "Use scalpel to search for functions in /tmp/test.js"
AI: Should attempt to use the tool
```

---

## Common Issues

### Issue 1: "MCP server not found"

**Fix:** Check the path in config is correct
```bash
# Verify path exists
ls -la /home/cheikh/Playgroung/scalpel/dist/index.js
```

### Issue 2: "Server crashes on start"

**Fix:** Check for syntax errors
```bash
node /home/cheikh/Playgroung/scalpel/dist/index.js
# See error messages
```

### Issue 3: "Tools not showing up"

**Fix:** Check server registration
```javascript
// In src/index.ts - make sure you have:
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [/* your tools */]
}));
```

### Issue 4: "Can't edit files in different projects"

**Fix:** Make sure you're passing **absolute paths**, not relative
```javascript
// ❌ Wrong
file_path: "src/main.js"

// ✅ Correct
file_path: "/home/cheikh/projects/my-app/src/main.js"
```

---

## Advanced: Multiple MCP Server Instances

If you want **completely separate** MCP instances per project:

```json
{
  "mcpServers": {
    "scalpel-project-a": {
      "command": "node",
      "args": ["/home/cheikh/Playgroung/scalpel/dist/index.js"],
      "cwd": "/home/cheikh/projects/project-A"
    },
    "scalpel-project-b": {
      "command": "node", 
      "args": ["/home/cheikh/Playgroung/scalpel/dist/index.js"],
      "cwd": "/home/cheikh/projects/project-B"
    }
  }
}
```

Each one runs as a **separate process** with its own TreeStore state.

---

## Memory Management

With 10+ projects, you might worry about memory:

```typescript
// Add to ScalpelService
private MAX_SNAPSHOTS = 100;

async hydrate(file_path: string, ...) {
  // Evict old snapshots if too many
  if (this.treeStore.snapshotCount > this.MAX_SNAPSHOTS) {
    this.treeStore.evictOldest();
  }
  
  return this.treeStore.hydrate(file_path, ...);
}
```

Or add a cleanup tool:

```typescript
{
  name: "scalpel_clear_cache",
  description: "Clear all cached file snapshots to free memory",
  inputSchema: { type: "object", properties: {} }
}
```

---

## Summary

**For 10 Different Projects:**

1. ✅ Build scalpel once: `npm run build`
2. ✅ Add to global MCP config (or per-project)
3. ✅ Use the **same MCP server** for all projects
4. ✅ AI provides full file paths automatically
5. ✅ TreeStore keeps each file's state separate
6. ✅ No conflicts between projects

**You don't need 10 different MCP servers!** One server handles everything because:
- File paths are unique across projects
- In-memory snapshots are keyed by full path
- No shared state between files

Simple as that! 🎉
