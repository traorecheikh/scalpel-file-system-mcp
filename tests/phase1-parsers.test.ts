import assert from "node:assert";
import { test } from "node:test";
import { validateAllParsers, parseSourceText } from "../src/tree-sitter-parser.js";

test("Phase 1: All 12 parsers validate at startup", () => {
  const validation = validateAllParsers();
  assert.strictEqual(validation.success, true, `Validation failed: ${JSON.stringify(validation.failures)}`);
});

test("Phase 1: Can parse all supported languages", () => {
  const testCases = [
    { lang: "typescript", code: "const x: number = 1;" },
    { lang: "javascript", code: "const x = 1;" },
    { lang: "java", code: "class T {}" },
    { lang: "dart", code: "void main() {}" },
    { lang: "rust", code: "fn main() {}" },
    { lang: "markdown", code: "# Hello\n" },
    { lang: "json", code: '{"a": 1}' },
    { lang: "yaml", code: "a: 1" },
    { lang: "html", code: "<div></div>" },
    { lang: "css", code: "body { color: red; }" },
    { lang: "python", code: "def f(): pass" },
    { lang: "go", code: "package main" },
  ];

  for (const { lang, code } of testCases) {
    try {
      const result = parseSourceText(lang as any, code);
      assert.ok(result.tree.rootNode, `Failed to parse ${lang}`);
      assert.strictEqual(result.language, lang);
    } catch (e) {
      console.error(`Failing language: ${lang}`);
      throw e;
    }
  }
});
