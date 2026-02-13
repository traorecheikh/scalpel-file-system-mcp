import assert from "node:assert";
import { test } from "node:test";
import { IntentCompiler } from "../src/intent-compiler.js";
import { TreeSnapshot, ParsedNodeRecord } from "../src/tree-store.js";

function createMockSnapshot(nodes: Record<string, ParsedNodeRecord>): TreeSnapshot {
  const nodesById = new Map<string, ParsedNodeRecord>();
  for (const [id, node] of Object.entries(nodes)) {
    nodesById.set(id, node);
  }
  return {
    nodesById,
    transactionId: "test_txn",
  } as unknown as TreeSnapshot;
}

test("IntentCompiler compiles primitive intents", () => {
  const snapshot = createMockSnapshot({});
  const compiler = new IntentCompiler(snapshot);

  const result = compiler.compile("insert_child", {
      parent_node_id: "p1",
      position_index: 0,
      node_descriptor: { type: "literal", value: 1 }
  }, { file: "f.ts", transaction_id: "txn" });

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].tool, "scalpel_insert_child");
  assert.strictEqual(result[0].args.parent_node_id, "p1");
});

test("IntentCompiler compiles add_parameter macro", () => {
  const functionNode: ParsedNodeRecord = {
    nodeId: "fn1",
    type: "function_declaration",
    childrenNodeIds: ["id1", "params1", "body1"],
    childCount: 3,
  } as ParsedNodeRecord;

  const paramsNode: ParsedNodeRecord = {
    nodeId: "params1",
    type: "formal_parameters",
    childrenNodeIds: [],
    childCount: 0,
  } as ParsedNodeRecord;

  const snapshot = createMockSnapshot({
    "fn1": functionNode,
    "params1": paramsNode,
  });

  const compiler = new IntentCompiler(snapshot);

  const result = compiler.compile("add_parameter", {
      parent_node_id: "fn1",
      name: "x",
      type: "number"
  }, { file: "f.ts", transaction_id: "txn" });

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].tool, "scalpel_insert_child");
  assert.strictEqual(result[0].args.parent_node_id, "params1");
  assert.strictEqual(result[0].args.position_index, 0);
  assert.deepStrictEqual(result[0].args.node_descriptor, {
      type: "parameter",
      fields: {
          name: "x",
          datatype: "number",
          optional: undefined,
          value: undefined
      }
  });
});
