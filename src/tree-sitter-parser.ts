import Parser, { type SyntaxNode, type Tree, type Language } from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import JavaScript from "tree-sitter-javascript";
import Java from "tree-sitter-java";
import { ToolError } from "./errors.js";
import type { SupportedLanguage } from "./schemas.js";
import { createHash } from "node:crypto";

export type ParserLanguage = Extract<
  SupportedLanguage,
  "typescript" | "javascript" | "java"
>;

export type TreeSitterNode = SyntaxNode;

export interface ParseResult {
  tree: Tree;
  language: ParserLanguage;
}

const parsers = new Map<ParserLanguage, Parser>();

function getOrCreateParser(language: ParserLanguage): Parser {
  let parser = parsers.get(language);
  if (parser) {
    return parser;
  }

  parser = new Parser();

  switch (language) {
    case "typescript":
      parser.setLanguage(TypeScript.typescript as Language);
      break;
    case "javascript":
      parser.setLanguage(JavaScript as Language);
      break;
    case "java":
      parser.setLanguage(Java as Language);
      break;
    default:
      throw new ToolError(
        "INVALID_OPERATION",
        `Language ${language satisfies never} is not supported`,
      );
  }

  parsers.set(language, parser);
  return parser;
}

export function parseSourceText(
  language: ParserLanguage,
  sourceText: string,
): ParseResult {
  const parser = getOrCreateParser(language);
  const tree = parser.parse(sourceText);

  if (tree.rootNode.hasError) {
    const errorNodes = findErrorNodes(tree.rootNode);
    throw new ToolError("INVALID_OPERATION", "Source file contains parser errors", {
      errorCount: errorNodes.length,
      errors: errorNodes.slice(0, 10).map((node) => ({
        type: node.type,
        startIndex: node.startIndex,
        endIndex: node.endIndex,
        text: node.text.slice(0, 100),
      })),
    });
  }

  return {
    tree,
    language,
  };
}

function findErrorNodes(node: TreeSitterNode): TreeSitterNode[] {
  const errors: TreeSitterNode[] = [];

  if (node.type === "ERROR" || node.isMissing) {
    errors.push(node);
  }

  for (const child of node.children) {
    errors.push(...findErrorNodes(child));
  }

  return errors;
}

export function extractIdentityAnchor(node: TreeSitterNode): string | undefined {
  // Try common identifier field names across languages
  const identifierFields = [
    "name",
    "identifier",
    "declarator",
    "property",
    "field",
    "method",
    "function",
  ];

  for (const fieldName of identifierFields) {
    const child = node.childForFieldName(fieldName);
    if (child && child.isNamed) {
      return child.text.trim();
    }
  }

  // For variable/field declarations, check for identifier child
  for (const child of node.namedChildren) {
    if (
      child.type === "identifier" ||
      child.type === "simple_identifier" ||
      child.type === "property_identifier" ||
      child.type === "field_identifier"
    ) {
      return child.text.trim();
    }
  }

  return undefined;
}

export function getNodeText(node: TreeSitterNode, sourceText: string): string {
  return sourceText.slice(node.startIndex, node.endIndex);
}

export function getNodeChildren(node: TreeSitterNode): TreeSitterNode[] {
  return node.namedChildren;
}
