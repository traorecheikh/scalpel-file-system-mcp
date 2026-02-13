import { ToolError } from "./errors.js";

const DESCRIPTOR_KINDS = [
  "identifier",
  "literal",
  "parameter",
  "field",
  "import_specifier",
  "raw_node",
] as const;

type DescriptorKind = (typeof DESCRIPTOR_KINDS)[number];

const FUNCTION_PARENT_TYPES = new Set([
  "FunctionDeclaration",
  "MethodDeclaration",
  "Constructor",
  "ArrowFunction",
  "FunctionExpression",
  "function_declaration",
  "method_declaration",
  "constructor_declaration",
  "arrow_function",
  "function",
]);

const FIELD_PARENT_TYPES = new Set([
  "ClassDeclaration",
  "InterfaceDeclaration",
  "TypeLiteral",
  "ObjectLiteralExpression",
  "class_declaration",
  "interface_declaration",
  "object",
  "class_body",
]);

const IMPORT_PARENT_TYPES = new Set([
  "NamedImports",
  "ImportClause",
  "ImportDeclaration",
  "named_imports",
  "import_clause",
  "import_statement",
]);

const IDENTIFIER_PARENT_TYPES = new Set([
  "VariableDeclaration",
  "Parameter",
  "PropertyAssignment",
  "ShorthandPropertyAssignment",
  "PropertyDeclaration",
  "PropertySignature",
  "ImportSpecifier",
  "BindingElement",
  "TypeReference",
  "FunctionDeclaration",
  "ClassDeclaration",
  "InterfaceDeclaration",
  "variable_declarator",
  "required_parameter",
  "formal_parameter",
  "pair",
  "property_declaration",
  "field_declaration",
  "import_specifier",
  "function_declaration",
  "class_declaration",
]);

const LITERAL_PARENT_TYPES = new Set([
  "VariableDeclaration",
  "PropertyAssignment",
  "ReturnStatement",
  "ExpressionStatement",
  "CallExpression",
  "BinaryExpression",
  "ArrayLiteralExpression",
  "TemplateSpan",
  "CaseClause",
  "ComputedPropertyName",
  "variable_declarator",
  "pair",
  "return_statement",
  "expression_statement",
  "call_expression",
  "binary_expression",
  "array",
]);

const TARGET_KIND_BY_NODE_TYPE: Record<string, DescriptorKind> = {
  Identifier: "identifier",
  StringLiteral: "literal",
  NumericLiteral: "literal",
  TrueKeyword: "literal",
  FalseKeyword: "literal",
  NullKeyword: "literal",
  NoSubstitutionTemplateLiteral: "literal",
  Parameter: "parameter",
  PropertyDeclaration: "field",
  PropertySignature: "field",
  ImportSpecifier: "import_specifier",
  identifier: "identifier",
  string: "literal",
  string_fragment: "literal",
  string_literal: "literal",
  number: "literal",
  true: "literal",
  false: "literal",
  null: "literal",
  required_parameter: "parameter",
  formal_parameter: "parameter",
  property_declaration: "field",
  field_declaration: "field",
  public_field_definition: "field",
  import_specifier: "import_specifier",
};

export type NodeDescriptorInput =
  | {
      type: string;
      value?: unknown;
      fields?: Record<string, unknown>;
    }
  | string;

export interface CompiledDescriptor {
  kind: DescriptorKind;
  nodeType: string;
  value?: unknown;
  fields?: Record<string, unknown>;
}

interface NormalizedDescriptor {
  kind: DescriptorKind;
  value: unknown;
  fields: Record<string, unknown>;
}

export function compileDescriptorForInsert(
  input: NodeDescriptorInput,
  parentNodeType: string,
): CompiledDescriptor {
  const normalized = normalizeDescriptor(input);
  const compiled = compileDescriptor(normalized);

  if (!isInsertCompatible(compiled.kind, parentNodeType)) {
    throw new ToolError(
      "INVALID_OPERATION",
      `Descriptor kind ${compiled.kind} cannot be inserted under parent type ${parentNodeType}`,
      {
        descriptor_kind: compiled.kind,
        parent_node_type: parentNodeType,
      },
    );
  }

  return compiled;
}

export function compileDescriptorForReplace(
  input: NodeDescriptorInput,
  targetNodeType: string,
): CompiledDescriptor {
  const normalized = normalizeDescriptor(input);
  const compiled = compileDescriptor(normalized);

  if (compiled.kind === "raw_node") {
    return compiled;
  }

  const expectedKind = TARGET_KIND_BY_NODE_TYPE[targetNodeType];
  if (!expectedKind) {
    throw new ToolError(
      "INVALID_OPERATION",
      `Target node type ${targetNodeType} is not supported for typed descriptor replacement`,
      {
        target_node_type: targetNodeType,
        descriptor_kind: compiled.kind,
      },
    );
  }

  if (expectedKind !== compiled.kind) {
    throw new ToolError(
      "INVALID_OPERATION",
      `Descriptor kind ${compiled.kind} is incompatible with target node type ${targetNodeType}`,
      {
        descriptor_kind: compiled.kind,
        target_node_type: targetNodeType,
        expected_kind: expectedKind,
      },
    );
  }

  return compiled;
}

function normalizeDescriptor(input: NodeDescriptorInput): NormalizedDescriptor {
  if (typeof input === "string") {
    return parseShorthand(input);
  }

  const rawType = typeof input.type === "string" ? input.type.trim() : "";
  if (!rawType) {
    throw new ToolError("VALIDATION_ERROR", "node descriptor type is required");
  }

  if (!isDescriptorKind(rawType)) {
    throw new ToolError("VALIDATION_ERROR", "unsupported descriptor type", {
      type: rawType,
      supported_types: [...DESCRIPTOR_KINDS],
    });
  }

  if (input.fields !== undefined && !isRecord(input.fields)) {
    throw new ToolError("VALIDATION_ERROR", "descriptor fields must be an object");
  }

  return {
    kind: rawType,
    value: input.value,
    fields: input.fields ?? {},
  };
}

/**
 * Parse CSV-like arguments, handling commas within quoted strings.
 * Examples:
 *   "a,b,c" -> ["a", "b", "c"]
 *   'x,"hello, world",z' -> ["x", "hello, world", "z"]
 *   "name,string,null" -> ["name", "string", "null"]
 */
function parseCSVArgs(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let inQuotes = false;
  let quoteChar = "";
  let i = 0;
  
  while (i < input.length) {
    const char = input[i];
    
    if ((char === '"' || char === "'") && !inQuotes) {
      // Opening quote
      inQuotes = true;
      quoteChar = char;
      i++;
    } else if (char === quoteChar && inQuotes) {
      // Check if this quote is escaped
      const prevChar = i > 0 ? input[i - 1] : "";
      if (prevChar === "\\") {
        // Escaped quote: remove the backslash we just added, add the quote
        current = current.slice(0, -1) + char;
        i++;
      } else {
        // Closing quote
        inQuotes = false;
        quoteChar = "";
        i++;
      }
    } else if (char === "," && !inQuotes) {
      args.push(current.trim());
      current = "";
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  if (current || args.length > 0) {
    args.push(current.trim());
  }
  
  return args;
}

function parseShorthand(input: string): NormalizedDescriptor {
  // +param(name,type,val) or param(name,type,val)
  const match = input.match(/^([+]?)([a-zA-Z_]+)\((.*)\)$/);
  if (!match) {
    throw new ToolError(
      "VALIDATION_ERROR",
      `Invalid shorthand descriptor syntax: ${input}`,
    );
  }

  const kindAlias = match[2];
  const argsStr = match[3] ?? "";

  // Parse CSV-like arguments, handling commas within quoted strings
  const args = parseCSVArgs(argsStr);

  if (kindAlias === "param" || kindAlias === "parameter") {
    const name = args[0];
    const type = args[1];
    const val = args[2];

    const fields: Record<string, any> = { name };
    if (type) fields.datatype = type;
    if (val !== undefined) fields.value = parseLiteralValue(val);

    return { kind: "parameter", value: undefined, fields };
  }

  if (kindAlias === "import") {
    const name = args[0];
    const alias = args[1];
    const fields: Record<string, any> = { name };
    if (alias) fields.alias = alias;
    return { kind: "import_specifier", value: undefined, fields };
  }

  if (kindAlias === "field") {
    const name = args[0];
    const type = args[1];
    const val = args[2];
    const fields: Record<string, any> = { name };
    if (type) fields.datatype = type;
    if (val !== undefined) fields.value = parseLiteralValue(val);
    return { kind: "field", value: undefined, fields };
  }

  throw new ToolError("VALIDATION_ERROR", `Unknown shorthand kind: ${kindAlias}`);
}

function parseLiteralValue(val: string): any {
  if (val === "true") return true;
  if (val === "false") return false;
  if (val === "null") return null;
  const trimmed = val.trim();
  if (!isNaN(Number(trimmed)) && trimmed !== "") return Number(trimmed);
  // quoted string
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

function compileDescriptor(descriptor: NormalizedDescriptor): CompiledDescriptor {
  switch (descriptor.kind) {
    case "identifier":
      return compileIdentifier(descriptor);
    case "literal":
      return compileLiteral(descriptor);
    case "parameter":
      return compileParameter(descriptor);
    case "field":
      return compileField(descriptor);
    case "import_specifier":
      return compileImportSpecifier(descriptor);
    case "raw_node":
      return compileRawNode(descriptor);
  }
}

function compileIdentifier(descriptor: NormalizedDescriptor): CompiledDescriptor {
  const name =
    typeof descriptor.value === "string"
      ? descriptor.value.trim()
      : getOptionalString(descriptor.fields.name);

  if (!name) {
    throw new ToolError(
      "VALIDATION_ERROR",
      "identifier descriptor requires string value or fields.name",
    );
  }

  const compiled: CompiledDescriptor = {
    kind: "identifier",
    nodeType: "Identifier",
    value: name,
  };
  return compiled;
}

function compileLiteral(descriptor: NormalizedDescriptor): CompiledDescriptor {
  const candidate =
    descriptor.value !== undefined ? descriptor.value : descriptor.fields.value;

  if (candidate === undefined) {
    throw new ToolError(
      "VALIDATION_ERROR",
      "literal descriptor requires value or fields.value",
    );
  }

  let nodeType: string;
  if (typeof candidate === "string") {
    nodeType = "StringLiteral";
  } else if (typeof candidate === "number" && Number.isFinite(candidate)) {
    nodeType = "NumericLiteral";
  } else if (candidate === true) {
    nodeType = "TrueKeyword";
  } else if (candidate === false) {
    nodeType = "FalseKeyword";
  } else if (candidate === null) {
    nodeType = "NullKeyword";
  } else {
    throw new ToolError(
      "VALIDATION_ERROR",
      "literal descriptor value must be string, number, boolean, or null",
    );
  }

  const compiled: CompiledDescriptor = {
    kind: "literal",
    nodeType,
    value: candidate,
  };
  return compiled;
}

function compileParameter(descriptor: NormalizedDescriptor): CompiledDescriptor {
  const name = getRequiredString(descriptor.fields, "name", "parameter descriptor");
  const datatype = getOptionalString(descriptor.fields.datatype);
  const optional = getOptionalBoolean(descriptor.fields.optional, false);

  const fields: Record<string, unknown> = { name, optional };
  if (datatype) {
    fields.datatype = datatype;
  }
  if (descriptor.fields.value !== undefined) {
    fields.value = descriptor.fields.value;
  }

  const compiled: CompiledDescriptor = {
    kind: "parameter",
    nodeType: "Parameter",
    fields,
  };
  return compiled;
}

function compileField(descriptor: NormalizedDescriptor): CompiledDescriptor {
  const name = getRequiredString(descriptor.fields, "name", "field descriptor");
  const datatype = getOptionalString(descriptor.fields.datatype);
  const readonly = getOptionalBoolean(descriptor.fields.readonly, false);
  const optional = getOptionalBoolean(descriptor.fields.optional, false);
  const classField = getOptionalBoolean(descriptor.fields.class_field, false);

  const fields: Record<string, unknown> = {
    name,
    readonly,
    optional,
  };
  if (datatype) {
    fields.datatype = datatype;
  }
  if (descriptor.fields.value !== undefined) {
    fields.value = descriptor.fields.value;
  }

  const compiled: CompiledDescriptor = {
    kind: "field",
    nodeType: classField ? "PropertyDeclaration" : "PropertySignature",
    fields,
  };
  return compiled;
}

function compileImportSpecifier(descriptor: NormalizedDescriptor): CompiledDescriptor {
  const name = getRequiredString(
    descriptor.fields,
    "name",
    "import_specifier descriptor",
  );
  const alias = getOptionalString(descriptor.fields.alias);

  const fields: Record<string, unknown> = { name };
  if (alias) {
    fields.alias = alias;
  }

  const compiled: CompiledDescriptor = {
    kind: "import_specifier",
    nodeType: "ImportSpecifier",
    fields,
  };
  return compiled;
}

function compileRawNode(descriptor: NormalizedDescriptor): CompiledDescriptor {
  const nodeType = getRequiredString(descriptor.fields, "node_type", "raw_node descriptor");

  const compiled: CompiledDescriptor = {
    kind: "raw_node",
    nodeType,
  };

  if (descriptor.value !== undefined) {
    compiled.value = descriptor.value;
  }

  const fieldPayload: Record<string, unknown> = {};
  Object.entries(descriptor.fields).forEach(([key, value]) => {
    if (key === "node_type") {
      return;
    }
    fieldPayload[key] = value;
  });
  if (Object.keys(fieldPayload).length > 0) {
    compiled.fields = fieldPayload;
  }

  return compiled;
}

function isInsertCompatible(kind: DescriptorKind, parentNodeType: string): boolean {
  switch (kind) {
    case "identifier":
      return IDENTIFIER_PARENT_TYPES.has(parentNodeType);
    case "literal":
      return LITERAL_PARENT_TYPES.has(parentNodeType);
    case "parameter":
      return FUNCTION_PARENT_TYPES.has(parentNodeType);
    case "field":
      return FIELD_PARENT_TYPES.has(parentNodeType);
    case "import_specifier":
      return IMPORT_PARENT_TYPES.has(parentNodeType);
    case "raw_node":
      return true;
  }
}

function isDescriptorKind(value: string): value is DescriptorKind {
  return (DESCRIPTOR_KINDS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRequiredString(
  fields: Record<string, unknown>,
  key: string,
  descriptorName: string,
): string {
  const value = fields[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new ToolError(
      "VALIDATION_ERROR",
      `${descriptorName} requires fields.${key} as non-empty string`,
    );
  }
  return value.trim();
}

function getOptionalString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ToolError("VALIDATION_ERROR", "optional string field must be a string");
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function getOptionalBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "boolean") {
    throw new ToolError("VALIDATION_ERROR", "optional boolean field must be a boolean");
  }
  return value;
}
