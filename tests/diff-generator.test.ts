import assert from "node:assert";
import { test } from "node:test";
import { generateDiff } from "../src/diff-generator.js";

test("Diff Generator: generates simple diff", () => {
  const sourceBefore = `line1
line2
line3
line4`;
  const sourceAfter = `line1
line2_modified
line3
line4`;
  
  const affectedNodeBefore: any = {
    startOffset: 6, // start of line2
    endOffset: 11,   // end of line2
  };
  
  const affectedNodeAfter: any = {
    startOffset: 6,
    endOffset: 20,
  };
  
  const diff = generateDiff({
    sourceTextBefore: sourceBefore,
    sourceTextAfter: sourceAfter,
    affectedNodeBefore,
    affectedNodeAfter,
    contextLines: 1
  });
  
  assert.ok(diff.unified_diff.includes("-line2"));
  assert.ok(diff.unified_diff.includes("+line2_modified"));
  assert.strictEqual(diff.changed_lines.start, 2);
});
