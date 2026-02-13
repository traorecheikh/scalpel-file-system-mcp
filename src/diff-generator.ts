import type { ParsedNodeRecord } from "./tree-store.js";

export interface DiffOutput {
  before: string;
  after: string;
  unified_diff: string;
  changed_lines: {
    start: number;
    end: number;
  };
}

export function generateDiff(ctx: {
  sourceTextBefore: string;
  sourceTextAfter: string;
  affectedNodeBefore: ParsedNodeRecord;
  affectedNodeAfter?: ParsedNodeRecord;
  contextLines: number;
}): DiffOutput {
  const { sourceTextBefore, sourceTextAfter, affectedNodeBefore, contextLines } = ctx;

  // 1. Get line numbers for the affected area in the BEFORE text
  const beforeLines = sourceTextBefore.split("\n");
  const startLine = sourceTextBefore.substring(0, affectedNodeBefore.startOffset).split("\n").length;
  const endLine = sourceTextBefore.substring(0, affectedNodeBefore.endOffset).split("\n").length;

  // 2. Extract context
  const contextStart = Math.max(1, startLine - contextLines);
  const contextEnd = Math.min(beforeLines.length, endLine + contextLines);

  const beforeSnippet = beforeLines.slice(contextStart - 1, contextEnd).join("\n");

  // 3. For the AFTER text, it's a bit trickier because offsets changed.
  // If affectedNodeAfter is provided, we use its offsets.
  let afterSnippet = "";
  if (ctx.affectedNodeAfter) {
    const afterLines = sourceTextAfter.split("\n");
    const aStartLine = sourceTextAfter.substring(0, ctx.affectedNodeAfter.startOffset).split("\n").length;
    const aEndLine = sourceTextAfter.substring(0, ctx.affectedNodeAfter.endOffset).split("\n").length;
    const aContextStart = Math.max(1, aStartLine - contextLines);
    const aContextEnd = Math.min(afterLines.length, aEndLine + contextLines);
    afterSnippet = afterLines.slice(aContextStart - 1, aContextEnd).join("\n");
  }

  // Generate a basic unified diff
  const unified_diff = createSimpleUnifiedDiff(
    beforeLines.slice(startLine - 1, endLine),
    ctx.affectedNodeAfter 
        ? sourceTextAfter.split("\n").slice(
            sourceTextAfter.substring(0, ctx.affectedNodeAfter.startOffset).split("\n").length - 1,
            sourceTextAfter.substring(0, ctx.affectedNodeAfter.endOffset).split("\n").length
          )
        : [],
    startLine
  );

  return {
    before: beforeSnippet,
    after: afterSnippet,
    unified_diff,
    changed_lines: {
      start: startLine,
      end: endLine,
    },
  };
}

function createSimpleUnifiedDiff(beforeLines: string[], afterLines: string[], startLine: number): string {
  const diff = [`@@ -${startLine},${beforeLines.length} +${startLine},${afterLines.length} @@`];
  
  for (const line of beforeLines) {
    diff.push(`-${line}`);
  }
  for (const line of afterLines) {
    diff.push(`+${line}`);
  }
  
  return diff.join("\n");
}
