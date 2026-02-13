import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSourceText, getNodeChildren, extractIdentityAnchor } from "../src/tree-sitter-parser.js";

test("TypeScript - parses function declaration", () => {
  const code = `function hello(name: string) {
  return "Hello " + name;
}`;

  const result = parseSourceText("typescript", code);
  const root = result.tree.rootNode;

  assert.equal(root.type, "program");
  assert.equal(root.namedChildren.length, 1);

  const funcDecl = root.namedChildren[0];
  assert.ok(funcDecl);
  assert.equal(funcDecl.type, "function_declaration");

  const anchor = extractIdentityAnchor(funcDecl);
  assert.equal(anchor, "hello");
});

test("TypeScript - parses class with method", () => {
  const code = `class Greeter {
  greet(name: string) {
    return "Hello " + name;
  }
}`;

  const result = parseSourceText("typescript", code);
  const root = result.tree.rootNode;

  const classDecl = root.namedChildren[0];
  assert.ok(classDecl);
  assert.equal(classDecl.type, "class_declaration");

  const className = extractIdentityAnchor(classDecl);
  assert.equal(className, "Greeter");
});

test("JavaScript - parses arrow function", () => {
  const code = `const add = (a, b) => a + b;`;

  const result = parseSourceText("javascript", code);
  const root = result.tree.rootNode;

  assert.equal(root.type, "program");
  const lexicalDecl = root.namedChildren[0];
  assert.ok(lexicalDecl);
  assert.equal(lexicalDecl.type, "lexical_declaration");
});

test("Java - parses class declaration", () => {
  const code = `class HelloWorld {
  public String greet(String name) {
    return "Hello " + name;
  }
}`;

  const result = parseSourceText("java", code);
  const root = result.tree.rootNode;

  const classDecl = root.namedChildren[0];
  assert.ok(classDecl);
  assert.equal(classDecl.type, "class_declaration");

  const className = extractIdentityAnchor(classDecl);
  assert.equal(className, "HelloWorld");
});

test("Parser errors are detected", () => {
  const code = `function hello( {`; // Intentional syntax error

  assert.throws(
    () => parseSourceText("typescript", code),
    /contains parser errors/
  );
});
