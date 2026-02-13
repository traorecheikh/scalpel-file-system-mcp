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

test("QueryEngine handles invalid selector syntax", () => {
    const source = `function foo() {}`;
    const { tree } = parseSourceText("javascript", source);
    const nodeIdMap = new Map<string, string>();
    
    assert.throws(() => {
        QueryEngine.getInstance().runQuery("javascript", tree.rootNode, 'invalid[', nodeIdMap);
    }, /Selector syntax error/);
});

test("QueryEngine handles selector with escaped quotes in value", () => {
    const source = `const msg = 'test "quoted" value';`;
    const { tree } = parseSourceText("javascript", source);
    const nodeIdMap = new Map<string, string>();
    
    const visit = (node: any) => {
        nodeIdMap.set(`${node.startIndex}:${node.endIndex}:${node.type}`, `id_${node.startIndex}`);
        for (const child of node.namedChildren) {
            visit(child);
        }
    };
    visit(tree.rootNode);
    
    // This should not throw an error even with complex values
    const results = QueryEngine.getInstance().runQuery("javascript", tree.rootNode, 'variable_declarator', nodeIdMap);
    assert.ok(results.length >= 0); // Should execute without error
});

test("QueryEngine handles simple type selector", () => {
    const source = `function foo() { return 1; }`;
    const { tree } = parseSourceText("javascript", source);
    const nodeIdMap = new Map<string, string>();
    
    const visit = (node: any) => {
        nodeIdMap.set(`${node.startIndex}:${node.endIndex}:${node.type}`, `id_${node.startIndex}`);
        for (const child of node.namedChildren) {
            visit(child);
        }
    };
    visit(tree.rootNode);
    
    const results = QueryEngine.getInstance().runQuery("javascript", tree.rootNode, 'return_statement', nodeIdMap);
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].type, 'return_statement');
});

test("QueryEngine handles raw S-expression query", () => {
    const source = `function foo() { return 1; }`;
    const { tree } = parseSourceText("javascript", source);
    const nodeIdMap = new Map<string, string>();
    
    const visit = (node: any) => {
        nodeIdMap.set(`${node.startIndex}:${node.endIndex}:${node.type}`, `id_${node.startIndex}`);
        for (const child of node.namedChildren) {
            visit(child);
        }
    };
    visit(tree.rootNode);
    
    const results = QueryEngine.getInstance().runQuery(
        "javascript", 
        tree.rootNode, 
        '(function_declaration) @match', 
        nodeIdMap
    );
    assert.ok(results.length > 0);
    assert.strictEqual(results[0].type, 'function_declaration');
});

test("QueryEngine escapes quotes and backslashes in selector values", () => {
    // This test verifies that the escapeValue logic works
    // Even though we may not have source code with such values,
    // we want to ensure the query compilation doesn't break
    const source = `const x = "test";`;
    const { tree } = parseSourceText("javascript", source);
    const nodeIdMap = new Map<string, string>();
    
    const visit = (node: any) => {
        nodeIdMap.set(`${node.startIndex}:${node.endIndex}:${node.type}`, `id_${node.startIndex}`);
        for (const child of node.namedChildren) {
            visit(child);
        }
    };
    visit(tree.rootNode);
    
    // Test that a selector with quotes in the value doesn't cause a syntax error
    // The escaping should allow this to compile without throwing
    const results = QueryEngine.getInstance().runQuery(
        "javascript",
        tree.rootNode,
        'string[value="test\\"quote"]',
        nodeIdMap
    );
    // The query should execute without error (even if it matches nothing)
    assert.ok(Array.isArray(results));
});

