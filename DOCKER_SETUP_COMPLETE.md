# 🐳 Scalpel MCP - Docker Setup Guide

## ✅ Build Complete!

Your Scalpel MCP server is now containerized and ready to use!

```bash
✅ Docker Image: scalpel-mcp:latest (341MB)
✅ Docker Image: scalpel-mcp:v2.0 (same image, different tag)
✅ MCP Config: ~/.config/opencode/mcp.json
```

---

## 🎯 How It Works

### **The Container Setup:**

```
OpenCode/Claude Desktop
        ↓
Reads: ~/.config/opencode/mcp.json
        ↓
Launches: docker run scalpel-mcp:latest
        ↓
Container starts with:
  - Node.js 22 runtime
  - Scalpel MCP server
  - Workspace mounted at /workspace
        ↓
AI can now use scalpel tools!
```

---

## 📋 What Was Configured

### 1. **Global MCP Config** (`~/.config/opencode/mcp.json`)

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--init",
        "--user", "1000:1000",
        "-v", "${WORKSPACE_DIR}:/workspace:rw",
        "scalpel-mcp:latest"
      ],
      "env": {
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**What this means:**
- `--rm` - Container is removed after MCP session ends (clean)
- `-i` - Interactive mode (allows stdio communication)
- `--init` - Proper signal handling (clean shutdown)
- `--user 1000:1000` - Run as your host user (fixes permissions)
- `-v ${WORKSPACE_DIR}:/workspace:rw` - Mounts your project folder
- `scalpel-mcp:latest` - Uses the Docker image we just built

### 2. **Docker Image Details**

```dockerfile
Base: gcr.io/distroless/nodejs22-debian12:nonroot
Size: 341MB (optimized with distroless)
Security: Runs as non-root user
Workspace: /workspace (volume mount point)
```

---

## 🗂️ Using with Multiple Projects

### **The Beauty of Docker + Workspace Mounting:**

When you open different projects, OpenCode/Claude automatically:

1. **Mounts the current project folder** to `/workspace` in the container
2. **AI provides paths** relative to `/workspace`
3. **Container accesses files** through the mounted volume

### **Example:**

```bash
# Project 1
cd /home/cheikh/projects/ecommerce-app
code .  # Opens in OpenCode

# Behind the scenes:
docker run -v /home/cheikh/projects/ecommerce-app:/workspace scalpel-mcp:latest

# AI calls:
scalpel_search_structure({
  file_path: "/workspace/src/cart.js",
  ...
})

---

# Project 2
cd /home/cheikh/work/blog-platform
code .  # Opens in OpenCode

# Behind the scenes:
docker run -v /home/cheikh/work/blog-platform:/workspace scalpel-mcp:latest

# AI calls:
scalpel_search_structure({
  file_path: "/workspace/lib/api.ts",
  ...
})
```

**Each project gets its own container instance!**

---

## 🚀 Verification Steps

### 1. **Test the Docker Image**

```bash
# Test that the image runs
docker run --rm scalpel-mcp:latest

# You should see MCP server initialization logs
# Press Ctrl+C to stop
```

### 2. **Check MCP Config**

```bash
cat ~/.config/opencode/mcp.json
```

### 3. **Test in OpenCode**

```bash
# Open any project
cd /home/cheikh/projects/my-app
code .

# In OpenCode, ask:
"List available MCP tools"

# Should show:
# - scalpel_search_structure
# - scalpel_insert_child
# - scalpel_replace_node
# - scalpel_remove_node
# - scalpel_move_subtree
# - scalpel_execute_intents
# - scalpel_get_node
# - scalpel_begin_transaction
# - scalpel_commit_transaction
# - scalpel_rollback_transaction
```

---

## 🎨 Advanced Docker Configurations

### **Option 1: Debug Mode (Verbose Logging)**

Edit `~/.config/opencode/mcp.json`:

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--init",
        "--user", "1000:1000",
        "-v", "${WORKSPACE_DIR}:/workspace:rw",
        "scalpel-mcp:latest"
      ],
      "env": {
        "LOG_LEVEL": "debug",
        "NODE_ENV": "development"
      }
    }
  }
}
```

### **Option 2: Resource Limits**

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--init",
        "--user", "1000:1000",
        "--memory=512m",
        "--cpus=1.0",
        "-v", "${WORKSPACE_DIR}:/workspace:rw",
        "scalpel-mcp:latest"
      ]
    }
  }
}
```

### **Option 3: Custom Network (For Multi-Container Setups)**

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--init",
        "--user", "1000:1000",
        "--network=mcp-network",
        "-v", "${WORKSPACE_DIR}:/workspace:rw",
        "scalpel-mcp:latest"
      ]
    }
  }
}
```

---

## 🔄 Updating the MCP Server

When you make changes to scalpel:

```bash
# 1. Rebuild the Docker image
cd /home/cheikh/Playgroung/scalpel
docker build -t scalpel-mcp:latest -t scalpel-mcp:v2.1 .

# 2. Tag with new version
docker tag scalpel-mcp:latest scalpel-mcp:v2.1

# 3. Restart OpenCode
# The new container will be used automatically!
```

---

## 🐛 Troubleshooting

### Issue 1: "Permission denied" when accessing files

**Cause:** Container user doesn't have permission to access workspace

**Fix:** Add user mapping:

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--init",
        "--user", "$(id -u):$(id -g)",
        "-v", "${WORKSPACE_DIR}:/workspace:rw",
        "scalpel-mcp:latest"
      ]
    }
  }
}
```

### Issue 2: "Container not found"

**Cause:** Image name mismatch

**Fix:** Verify image name:

```bash
docker images | grep scalpel-mcp
# Make sure it shows: scalpel-mcp:latest
```

### Issue 3: "Volume mount failed"

**Cause:** `${WORKSPACE_DIR}` not being expanded

**Fix:** Use absolute path or check OpenCode version:

```json
{
  "mcpServers": {
    "scalpel": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--init",
        "-v", "/absolute/path/to/project:/workspace:rw",
        "scalpel-mcp:latest"
      ]
    }
  }
}
```

### Issue 4: "Container keeps running after OpenCode closes"

**Cause:** Missing `--rm` flag

**Fix:** Already included! The `--rm` flag automatically removes the container when the session ends.

---

## 📊 Container Resource Usage

```bash
# Check running containers
docker ps | grep scalpel-mcp

# Check container resource usage
docker stats $(docker ps -q --filter ancestor=scalpel-mcp:latest)

# View container logs
docker logs <container-id>
```

---

## 🎁 Benefits of Docker Setup

### ✅ **Isolation**
- Each project gets a fresh container
- No dependency conflicts
- Clean state every session

### ✅ **Portability**
- Same image works on any machine
- Easy to share with team members
- No "works on my machine" issues

### ✅ **Version Control**
- Easy to roll back to previous versions
- Multiple versions can coexist
- Tag releases: `v2.0`, `v2.1`, etc.

### ✅ **Security**
- Runs as non-root user
- Isolated filesystem
- Limited access to host system

### ✅ **Resource Management**
- CPU and memory limits
- No runaway processes
- Automatic cleanup with `--rm`

---

## 🚢 Pushing to Docker Registry (Optional)

If you want to share with team or use on multiple machines:

```bash
# 1. Tag for Docker Hub
docker tag scalpel-mcp:latest your-username/scalpel-mcp:latest
docker tag scalpel-mcp:latest your-username/scalpel-mcp:v2.0

# 2. Login to Docker Hub
docker login

# 3. Push
docker push your-username/scalpel-mcp:latest
docker push your-username/scalpel-mcp:v2.0

# 4. Update MCP config on other machines:
{
  "mcpServers": {
    "scalpel": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--init",
        "-v", "${WORKSPACE_DIR}:/workspace:rw",
        "your-username/scalpel-mcp:latest"
      ]
    }
  }
}

# 5. Others just need to pull:
docker pull your-username/scalpel-mcp:latest
```

---

## 📝 Summary

**You're all set!**

1. ✅ Docker image built: `scalpel-mcp:latest` & `scalpel-mcp:v2.0`
2. ✅ Global MCP config created: `~/.config/opencode/mcp.json`
3. ✅ Works with **ALL projects** - just open any folder in OpenCode
4. ✅ Each project gets isolated container with workspace mounted
5. ✅ No Node.js installation needed on host
6. ✅ Automatic cleanup after each session

**Next steps:**
1. Restart OpenCode
2. Open any project
3. Ask AI to use scalpel tools
4. Profit! 🎉

---

## 🆚 Docker vs Node.js Setup Comparison

| Feature | Node.js Setup | Docker Setup |
|---------|---------------|--------------|
| Installation | Requires Node.js on host | Only Docker needed |
| Isolation | Shares host environment | Fully isolated |
| Version management | Manual with nvm/volta | Easy with image tags |
| Resource limits | None | Configurable |
| Cleanup | Manual | Automatic with `--rm` |
| Portability | Depends on Node version | Works anywhere |
| Security | Host permissions | Containerized sandbox |
| Performance | Slightly faster | Minimal overhead |
| Disk space | ~100MB (node_modules) | ~341MB (full image) |

**Recommendation:** Docker is better for production, teams, and multiple projects!

---

**Questions?** Check the logs:

```bash
# View container logs while running
docker logs -f $(docker ps -q --filter ancestor=scalpel-mcp:latest)
```
