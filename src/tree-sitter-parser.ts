import Parser, { type SyntaxNode, type Tree } from "tree-sitter";
import TypeScript from "tree-sitter-typescript";
import JavaScript from "tree-sitter-javascript";
import Java from "tree-sitter-java";
import CSS from "tree-sitter-css";
import Go from "tree-sitter-go";
import HTML from "tree-sitter-html";
import JSON from "tree-sitter-json";
import Python from "tree-sitter-python";
import Rust from "tree-sitter-rust";
import Markdown from "@tree-sitter-grammars/tree-sitter-markdown";
import YAML from "@tree-sitter-grammars/tree-sitter-yaml";
import Dart from "@sengac/tree-sitter-dart";
import { ToolError } from "./errors.js";
import type { SupportedLanguage } from "./schemas.js";

// Tree-sitter uses 'any' for language type in some versions, but we treat it as an object with .language
type Language = any;

export type ParserLanguage = SupportedLanguage;

export type TreeSitterNode = SyntaxNode;

export interface ParseResult {
  tree: Tree;
  language: ParserLanguage;
}

const parsers = new Map<ParserLanguage, Parser>();

export function getLanguageGrammar(language: ParserLanguage): Language {
  switch (language) {
    case "typescript":
      return (TypeScript as any).typescript || (TypeScript as any).default?.typescript;
    case "javascript":
      return (JavaScript as any).default || JavaScript;
    case "java":
      return (Java as any).default || Java;
    case "css":
      return (CSS as any).default || CSS;
    case "go":
      return (Go as any).default || Go;
    case "html":
      return (HTML as any).default || HTML;
    case "json":
      return (JSON as any).default || JSON;
    case "python":
      return (Python as any).default || Python;
    case "rust":
      return (Rust as any).default || Rust;
    case "markdown":
      return (Markdown as any).default || Markdown;
    case "yaml":
      return (YAML as any).default || YAML;
    case "dart":
      return (Dart as any).default || Dart;
    default:
      throw new ToolError(
        "INVALID_OPERATION",
        `Language ${language satisfies never} is not supported`,
      );
  }
}

function getOrCreateParser(language: ParserLanguage): Parser {
  let parser = parsers.get(language);
  if (parser) {
    return parser;
  }

  parser = new Parser();
  parser.setLanguage(getLanguageGrammar(language));
  parsers.set(language, parser);
  return parser;
}

export function getLanguage(language: ParserLanguage): Language {
  return getLanguageGrammar(language);
}

export function validateAllParsers(): {
  success: boolean;
  failures: Array<{ language: string; error: string }>
} {
  const failures = [];
  const languages: SupportedLanguage[] = [
    "typescript", "javascript", "java", "dart", "rust",
    "markdown", "json", "yaml", "html", "css", "python", "go"
  ];

  for (const lang of languages) {
    try {
      const parser = new Parser();
      parser.setLanguage(getLanguageGrammar(lang));

      // Test with minimal code
      const testCode = getMinimalTestCode(lang);
      const tree = parser.parse(testCode);
      if (!tree.rootNode) throw new Error("No root node");

      // Cache successfully validated parser
      parsers.set(lang, parser);
    } catch (error) {
      failures.push({ language: lang, error: String(error) });
    }
  }

  return { success: failures.length === 0, failures };
}

function getMinimalTestCode(language: SupportedLanguage): string {
  switch (language) {
    case "typescript": return "const x: number = 1;";
    case "javascript": return "const x = 1;";
    case "java": return "class Test {}";
    case "dart": return "void main() {}";
    case "rust": return "fn main() {}";
    case "markdown": return "# Title";
    case "json": return '{"a":1}';
    case "yaml": return "a: 1";
    case "html": return "<div></div>";
    case "css": return "body {}";
    case "python": return "def f(): pass";
    case "go": return "package main";
    default: return "";
  }
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
