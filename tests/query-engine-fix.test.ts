import assert from "node:assert";
import { test } from "node:test";
import { QueryEngine } from "../src/query-engine.js";
import { parseSourceText } from "../src/tree-sitter-parser.js";

test("QueryEngine fix: correctly infers field types", () => {
  const source = `
    function beta() { return 1; }
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

  // Selector: function_declaration[name="beta"]
  // Previously would have failed if name field required identifier type and got (_)
  const results = QueryEngine.getInstance().runQuery("javascript", tree.rootNode, 'function_declaration[name="beta"]', nodeIdMap);

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].type, "function_declaration");
  assert.strictEqual(results[0].textSnippet.includes("beta"), true);
});
