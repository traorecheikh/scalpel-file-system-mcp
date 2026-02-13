import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { TreeStore, type ParsedNodeRecord } from "../src/tree-store.js";
import { TransactionStore } from "../src/transaction-store.js";
import { Logger } from "../src/logger.js";

const TEST_DIR = "/tmp/scalpel-integration-tests";

async function setupTestFile(filename: string, content: string): Promise<string> {
  await mkdir(TEST_DIR, { recursive: true });
  const filePath = join(TEST_DIR, filename);
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

async function cleanup() {
  await rm(TEST_DIR, { recursive: true, force: true });
}

test("TypeScript - complete mutation workflow", async () => {
  const filePath = await setupTestFile(
    "test.ts",
    `function greet(name: string) {
  return "Hello " + name;
}
`
  );

  try {
    const logger = new Logger("error");
    const transactions = new TransactionStore(300_000, logger);
    const trees = new TreeStore();

    // Begin transaction
    const session = transactions.begin(filePath, filePath, "typescript");
    await trees.hydrate(session);

    // Get initial snapshot
    const snapshot1 = trees.require(session.transactionId);
    assert.equal(snapshot1.language, "typescript");

    // Find the string node containing "Hello"
    const stringNode = Array.from(snapshot1.nodesById.values()).find(
      (n: ParsedNodeRecord) => n.type === "string" && n.sourceSnippet?.includes("Hello")
    );
    assert.ok(stringNode, "Should find string node");

    // Replace the string literal
    const result1 = trees.replaceNode(session.transactionId, stringNode.nodeId, {
      type: "literal",
      value: 'Goodbye',
    });

    assert.ok(!result1.noOp, "Replace should not be no-op");
    assert.ok(result1.semanticChange, "Replace should be semantic change");

    // Commit transaction
    const commitResult = await trees.commit(session.transactionId, filePath);
    assert.ok(commitResult.semanticChangeFlag, "Should have semantic change");
    assert.ok(commitResult.fileHashBefore !== commitResult.fileHashAfter, "File hash should change");

    // Verify file was actually written
    const fileContent = await readFile(filePath, "utf-8");
    assert.ok(fileContent.includes("Goodbye"), "File on disk should contain Goodbye");
    assert.ok(!fileContent.includes("Hello"), "File on disk should not contain Hello");
  } finally {
    await cleanup();
  }
});

test("JavaScript - insert and remove nodes", async () => {
  const filePath = await setupTestFile(
    "test.js",
    `const x = 1;
`
  );

  try {
    const logger = new Logger("error");
    const transactions = new TransactionStore(300_000, logger);
    const trees = new TreeStore();

    const session = transactions.begin(filePath, filePath, "javascript");
    await trees.hydrate(session);
    const snapshot1 = trees.require(session.transactionId);

    // Find the program node (root)
    const programNode = Array.from(snapshot1.nodesById.values()).find(
      (n: ParsedNodeRecord) => n.type === "program"
    );
    assert.ok(programNode, "Should find program node");

    // Insert a new variable declaration after the first one
    const insertResult = trees.insertChild(
      session.transactionId,
      programNode.nodeId,
      1,
      {
        type: "raw_node",
        value: "const y = 2;",
        fields: {
          node_type: "lexical_declaration",
        },
      }
    );

    assert.ok(!insertResult.noOp, "Insert should not be no-op");

    const commitResult = await trees.commit(session.transactionId, filePath);
    
    assert.ok(commitResult.semanticChangeFlag, "Should have semantic change");
    
    // Verify file was actually written
    const fileContent = await readFile(filePath, "utf-8");
    assert.ok(fileContent.includes("const x = 1"), "Should contain original declaration");
    assert.ok(fileContent.includes("const y = 2"), "Should contain new declaration");
  } finally {
    await cleanup();
  }
});

test("Java - parse and mutate class", async () => {
  const filePath = await setupTestFile(
    "Greeter.java",
    `class Greeter {
  public String greet(String name) {
    return "Hello " + name;
  }
}
`
  );

  try {
    const logger = new Logger("error");
    const transactions = new TransactionStore(300_000, logger);
    const trees = new TreeStore();

    const session = transactions.begin(filePath, filePath, "java");
    await trees.hydrate(session);
    const snapshot1 = trees.require(session.transactionId);
    assert.equal(snapshot1.language, "java");

    // Find the class declaration
    const classNode = Array.from(snapshot1.nodesById.values()).find(
      (n: ParsedNodeRecord) => n.type === "class_declaration"
    );
    assert.ok(classNode, "Should find class_declaration node");

    // Find string literal
    const stringNode = Array.from(snapshot1.nodesById.values()).find(
      (n: ParsedNodeRecord) => n.type === "string_literal" && n.sourceSnippet?.includes("Hello")
    );
    assert.ok(stringNode, "Should find string_literal node");

    // Replace the string
    const result = trees.replaceNode(session.transactionId, stringNode.nodeId, {
      type: "literal",
      value: 'Bonjour ',
    });

    assert.ok(!result.noOp, "Replace should not be no-op");

    const commitResult = await trees.commit(session.transactionId, filePath);
    assert.ok(commitResult.semanticChangeFlag, "Should have semantic change");
    
    // Verify file was actually written
    const fileContent = await readFile(filePath, "utf-8");
    assert.ok(fileContent.includes("Bonjour"), "Output should contain Bonjour");
    assert.ok(!fileContent.includes("Hello"), "Output should not contain Hello");
  } finally {
    await cleanup();
  }
});

test("TypeScript - remove node", async () => {
  const filePath = await setupTestFile(
    "multi-func.ts",
    `function foo() {
  return 1;
}

function bar() {
  return 2;
}
`
  );

  try {
    const logger = new Logger("error");
    const transactions = new TransactionStore(300_000, logger);
    const trees = new TreeStore();

    const session = transactions.begin(filePath, filePath, "typescript");
    await trees.hydrate(session);
    const snapshot1 = trees.require(session.transactionId);

    // Find all function declarations
    const funcNodes = Array.from(snapshot1.nodesById.values()).filter(
      (n: ParsedNodeRecord) => n.type === "function_declaration"
    );
    assert.equal(funcNodes.length, 2, "Should have 2 function declarations");

    // Remove the second function
    const secondFunc = funcNodes[1];
    assert.ok(secondFunc);

    const removeResult = trees.removeNode(session.transactionId, secondFunc.nodeId);
    assert.ok(!removeResult.noOp, "Remove should not be no-op");

    const commitResult = await trees.commit(session.transactionId, filePath);
    assert.ok(commitResult.semanticChangeFlag, "Should have semantic change");
    
    // Verify file was actually written
    const fileContent = await readFile(filePath, "utf-8");
    assert.ok(fileContent.includes("foo"), "Should still have foo");
    assert.ok(!fileContent.includes("bar"), "Should not have bar");
  } finally {
    await cleanup();
  }
});
