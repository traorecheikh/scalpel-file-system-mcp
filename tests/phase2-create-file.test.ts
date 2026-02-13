import assert from "node:assert";
import { test, after } from "node:test";
import { ScalpelService } from "../src/service.js";
import { loadConfig } from "../src/config.js";
import { Logger } from "../src/logger.js";
import { TransactionStore } from "../src/transaction-store.js";
import { rm } from "node:fs/promises";
import path from "node:path";

const config = loadConfig();
const logger = new Logger("error");
const transactions = new TransactionStore(60000, logger);
const service = new ScalpelService(config, logger, transactions);

test("Phase 2: Can create a new file", async () => {
  const filePath = "test-new-file.ts";
  const absolutePath = path.join(config.workspaceRoot, filePath);
  
  // Cleanup if exists
  await rm(absolutePath, { force: true });

  const result = await service.createFile({
    file: filePath,
    initial_content: "const x = 1;",
    overwrite: true
  });

  assert.strictEqual(result.file, filePath);
  assert.strictEqual(result.language, "typescript");
  assert.strictEqual(result.created, true);
  assert.ok(result.transactionId);

  // Verify transaction is active
  const session = transactions.require(result.transactionId);
  assert.strictEqual(session.file, filePath);

  // Cleanup
  await rm(absolutePath, { force: true });
});

test("Phase 2: Fails if file exists without overwrite", async () => {
    const filePath = "existing.ts";
    const absolutePath = path.join(config.workspaceRoot, filePath);
    
    // Create it first
    await service.createFile({
        file: filePath,
        initial_content: "const x = 1;",
        overwrite: true
    });

    // Try to create again without overwrite
    await assert.rejects(async () => {
        await service.createFile({
            file: filePath,
            initial_content: "const y = 2;",
            overwrite: false
        });
    }, /File already exists/);

    // Cleanup
    await rm(absolutePath, { force: true });
});
