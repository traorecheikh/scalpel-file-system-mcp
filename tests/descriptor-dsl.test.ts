import assert from "node:assert";
import { test } from "node:test";
import { compileDescriptorForInsert } from "../src/descriptor-compiler.js";

test("Smart DSL: parses param shorthand", () => {
    // We pass "FunctionDeclaration" as parent type to satisfy compatibility check
    const result = compileDescriptorForInsert("param(taxRate,number,0.2)", "FunctionDeclaration");

    assert.strictEqual(result.kind, "parameter");
    assert.strictEqual(result.fields?.name, "taxRate");
    assert.strictEqual(result.fields?.datatype, "number");
    assert.strictEqual(result.fields?.value, 0.2);
});

test("Smart DSL: parses param shorthand with string literal", () => {
    const result = compileDescriptorForInsert('param(msg,string,"hello")', "FunctionDeclaration");

    assert.strictEqual(result.kind, "parameter");
    assert.strictEqual(result.fields?.name, "msg");
    assert.strictEqual(result.fields?.datatype, "string");
    assert.strictEqual(result.fields?.value, "hello");
});

test("Smart DSL: parses import shorthand", () => {
    const result = compileDescriptorForInsert("import(fs,fs)", "ImportDeclaration");

    assert.strictEqual(result.kind, "import_specifier");
    assert.strictEqual(result.fields?.name, "fs");
    assert.strictEqual(result.fields?.alias, "fs");
});

test("Smart DSL: throws on invalid syntax", () => {
    assert.throws(() => {
        compileDescriptorForInsert("invalid(", "FunctionDeclaration");
    });
});
