import assert from "node:assert";
import { test } from "node:test";
import { QueryEngine } from "../src/query-engine.js";
import { parseSourceText } from "../src/tree-sitter-parser.js";

test("QueryEngine can execute raw tree-sitter query", () => {
  const source = `
    function foo() { return 1; }
    function bar() { return 2; }
  `;
  const { tree } = parseSourceText("javascript", source);
  const nodeIdMap = new Map<string, string>();

  // Fake nodeIdMap for test
  // We need to match the start/end/type of nodes we expect to find.
  // Let's iterate the tree to populate it.

  const visit = (node: any) => {
    nodeIdMap.set(`${node.startIndex}:${node.endIndex}:${node.type}`, `id_${node.startIndex}`);
    for (const child of node.namedChildren) {
      visit(child);
    }
  };
  visit(tree.rootNode);

  const query = `(function_declaration name: (identifier) @name (#eq? @name "foo")) @match`;
  const results = QueryEngine.getInstance().runQuery("javascript", tree.rootNode, query, nodeIdMap);

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].type, "function_declaration");
  assert.strictEqual(results[0].textSnippet.includes("foo"), true);
});

test("QueryEngine can execute simplified selector", () => {
  const source = `
    function foo() { return 1; }
    function bar() { return 2; }
  `;
  const { tree } = parseSourceText("javascript", source);
  const nodeIdMap = new Map<string, string>();

  const visit = (node: any) => {
    nodeIdMap.set(`${node.startIndex}:${node.endIndex}:${node.type}`, `id_${node.startIndex}`);
    for (const child of node.namedChildren) {
      visit(child);
    }
  };
  visit(tree.rootNode);

  // Selector: function_declaration[name="bar"]
  const results = QueryEngine.getInstance().runQuery("javascript", tree.rootNode, 'function_declaration[name="bar"]', nodeIdMap);

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].type, "function_declaration");
  assert.strictEqual(results[0].textSnippet.includes("bar"), true);
});

test("QueryEngine returns empty for no match", () => {
    const source = `function foo() {}`;
    const { tree } = parseSourceText("javascript", source);
    const nodeIdMap = new Map<string, string>();
    const results = QueryEngine.getInstance().runQuery("javascript", tree.rootNode, 'function_declaration[name="baz"]', nodeIdMap);
    assert.strictEqual(results.length, 0);
});
