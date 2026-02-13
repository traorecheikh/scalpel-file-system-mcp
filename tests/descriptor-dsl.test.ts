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

test("Smart DSL: parses param shorthand with comma in string value", () => {
    const result = compileDescriptorForInsert('param(message,string,"Hello, world")', "FunctionDeclaration");

    assert.strictEqual(result.kind, "parameter");
    assert.strictEqual(result.fields?.name, "message");
    assert.strictEqual(result.fields?.datatype, "string");
    assert.strictEqual(result.fields?.value, "Hello, world");
});

test("Smart DSL: parses param shorthand with optional value omitted", () => {
    const result = compileDescriptorForInsert("param(optionalRate,number)", "FunctionDeclaration");

    assert.strictEqual(result.kind, "parameter");
    assert.strictEqual(result.fields?.name, "optionalRate");
    assert.strictEqual(result.fields?.datatype, "number");
    assert.strictEqual(result.fields?.value, undefined);
});

test("Smart DSL: parses param shorthand with empty string value", () => {
    const result = compileDescriptorForInsert('param(emptyMsg,string,"")', "FunctionDeclaration");

    assert.strictEqual(result.kind, "parameter");
    assert.strictEqual(result.fields?.name, "emptyMsg");
    assert.strictEqual(result.fields?.datatype, "string");
    assert.strictEqual(result.fields?.value, "");
});

test("Smart DSL: parses param shorthand with null value", () => {
    const result = compileDescriptorForInsert("param(nullableParam,string,null)", "FunctionDeclaration");

    assert.strictEqual(result.kind, "parameter");
    assert.strictEqual(result.fields?.name, "nullableParam");
    assert.strictEqual(result.fields?.datatype, "string");
    assert.strictEqual(result.fields?.value, null);
});

test("Smart DSL: parses param shorthand with single quotes", () => {
    const result = compileDescriptorForInsert("param(msg,string,'hello')", "FunctionDeclaration");

    assert.strictEqual(result.kind, "parameter");
    assert.strictEqual(result.fields?.name, "msg");
    assert.strictEqual(result.fields?.datatype, "string");
    assert.strictEqual(result.fields?.value, "hello");
});

test("Smart DSL: handles parameters with special characters in names", () => {
    const result = compileDescriptorForInsert("param(_privateVar,number,42)", "FunctionDeclaration");

    assert.strictEqual(result.kind, "parameter");
    assert.strictEqual(result.fields?.name, "_privateVar");
    assert.strictEqual(result.fields?.datatype, "number");
    assert.strictEqual(result.fields?.value, 42);
});
