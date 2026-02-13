import Parser, { type SyntaxNode, type Query, type QueryCapture } from "tree-sitter";
import { ToolError } from "./errors.js";
import { getLanguage, type ParserLanguage } from "./tree-sitter-parser.js";

export interface QueryResult {
  nodeId: string;
  type: string;
  textSnippet: string;
  startIndex: number;
  endIndex: number;
}

export class QueryEngine {
  private static instance: QueryEngine;

  private constructor() {}

  public static getInstance(): QueryEngine {
    if (!QueryEngine.instance) {
      QueryEngine.instance = new QueryEngine();
    }
    return QueryEngine.instance;
  }

  public runQuery(
    language: ParserLanguage,
    rootNode: SyntaxNode,
    selector: string,
    nodeIdMap: Map<string, string>
  ): QueryResult[] {
    const lang = getLanguage(language);

    let queryString = selector;
    if (!selector.trim().startsWith("(")) {
      queryString = this.compileSelector(selector);
    }

    let query: Query;
    try {
      query = new Parser.Query(lang, queryString);
    } catch (e: any) {
      throw new ToolError("INVALID_OPERATION", `Invalid query: ${e.message}`, { selector, queryString });
    }

    const matches = query.matches(rootNode);
    const results: QueryResult[] = [];
    const seenNodes = new Set<number>();

    for (const match of matches) {
      // If the query has a capture named "match", use only that.
      // Otherwise use all captures.
      const interestingCaptures = match.captures.some((c) => c.name === "match")
        ? match.captures.filter((c) => c.name === "match")
        : match.captures;

      for (const capture of interestingCaptures) {
        if (seenNodes.has(capture.node.id)) continue;

        const key = `${capture.node.startIndex}:${capture.node.endIndex}:${capture.node.type}`;
        const instanceId = nodeIdMap.get(key);

        if (instanceId) {
          seenNodes.add(capture.node.id);
          results.push({
            nodeId: instanceId,
            type: capture.node.type,
            textSnippet:
              capture.node.text.slice(0, 100) +
              (capture.node.text.length > 100 ? "..." : ""),
            startIndex: capture.node.startIndex,
            endIndex: capture.node.endIndex,
          });
        }
      }
    }

    return results;
  }

  private compileSelector(selector: string): string {
    // Simple selector compiler:
    // type[field="value"] -> (type field: (_) @val (#eq? @val "value")) @match

    const parts = selector.match(/^([a-zA-Z_]+)(?:\[([a-zA-Z_]+)=['"](.+?)['"]\])?$/);
    if (!parts) {
      // Fallback: wrap in generic match if it looks like a type
      if (/^[a-zA-Z_]+$/.test(selector)) {
        return `(${selector}) @match`;
      }
      // If it looks like a raw query but without outer parens?
      // No, just error for now.
      throw new ToolError("INVALID_OPERATION", "Selector syntax error. Use 'type' or 'type[field=\"value\"]' or raw S-expression '(type ...)'");
    }

    const type = parts[1];
    const field = parts[2];
    const value = parts[3];

    if (field && value) {
        return `(${type} ${field}: (_) @val (#eq? @val "${value}")) @match`;
    } else {
        return `(${type}) @match`;
    }
  }
}
