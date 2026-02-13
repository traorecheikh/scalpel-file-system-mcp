# 🚀 Scalpel MCP - Quick Start

## ✅ Setup Complete!

Your Scalpel MCP server is ready to use. Here's everything you need to know in 60 seconds.

---

## 📋 What You Have

```
✅ Docker Image: scalpel-mcp:latest (346MB)
✅ MCP Config: ~/.config/opencode/mcp.json
✅ 13 Structural Editing Tools
✅ Works across ALL projects
```

---

## 🎯 How To Use (3 Steps)

### 1️⃣ **Restart OpenCode**
```bash
# Close and reopen OpenCode
# The MCP server will auto-load
```

### 2️⃣ **Open Any Project**
```bash
# Navigate to any codebase
cd ~/my-project
code .  # or open in your IDE
```

### 3️⃣ **Ask AI to Use Scalpel**
```
Examples:
- "Use scalpel to rename function authenticate to login"
- "Use scalpel to extract this code into a helper function"
- "Use scalpel to add error handling to this function"
- "Use scalpel to refactor this class"
```

---

## 🧪 Test It Now

Run this command to verify everything works:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | \
  docker run --rm -i --user 1000:1000 \
  -v $(pwd):/workspace:rw scalpel-mcp:latest
```

**Expected output:** JSON response with `"serverInfo":{"name":"scalpel-mcp"}`

---

## 🛠️ Available Tools

| Tool | Purpose |
|------|---------|
| `scalpel_begin_transaction` | Start editing a file |
| `scalpel_search_structure` | Find code patterns |
| `scalpel_edit_intent` | Make structural changes |
| `scalpel_replace_node` | Replace code nodes |
| `scalpel_commit` | Save changes |
| ... and 8 more | See SETUP_COMPLETE.md |

**Supported Languages:** TypeScript, JavaScript, Dart, Java, Rust

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `~/.config/opencode/mcp.json` | Global MCP configuration |
| `SETUP_COMPLETE.md` | Full setup documentation |
| `DOCKER_SETUP_COMPLETE.md` | Docker-specific guide |
| `MCP_SETUP_GUIDE.md` | General MCP integration |

---

## 🔄 Updating

When you change scalpel code:

```bash
cd /home/cheikh/Playgroung/scalpel
docker build -t scalpel-mcp:latest .
# Restart OpenCode - that's it!
```

---

## 🐛 Troubleshooting

**Container not starting?**
```bash
docker images | grep scalpel-mcp  # Verify image exists
```

**Permission errors?**
- Already fixed with `--user 1000:1000` in config
- Check `~/.config/opencode/mcp.json` has the flag

**Want debug logs?**
Edit `~/.config/opencode/mcp.json`:
```json
"env": {
  "LOG_LEVEL": "debug"
}
```

---

## 🎉 That's It!

**You're ready to go!** Restart OpenCode and start using scalpel for precise structural code edits.

**Need help?** Check `SETUP_COMPLETE.md` for detailed docs.

---

*Setup Date: 2026-02-13*  
*Status: ✅ Fully Operational*
