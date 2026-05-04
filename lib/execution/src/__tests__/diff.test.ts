import { describe, expect, it } from "vitest";
import { buildDiffPreview, buildUnifiedDiff } from "../diff.js";

describe("buildUnifiedDiff", () => {
  it("emits a unified diff header and a single hunk for a small change", () => {
    const before = ["line 1", "line 2", "line 3"].join("\n");
    const after = ["line 1", "line two", "line 3"].join("\n");
    const result = buildUnifiedDiff({ after, before, path: "file.txt" });

    expect(result.diff).toContain("--- a/file.txt");
    expect(result.diff).toContain("+++ b/file.txt");
    expect(result.diff).toContain("-line 2");
    expect(result.diff).toContain("+line two");
    expect(result.truncated).toBe(false);
  });

  it("truncates very large diffs", () => {
    const beforeLines = Array.from({ length: 200 }, (_value, index) => `before ${index}`);
    const afterLines = Array.from({ length: 200 }, (_value, index) => `after ${index}`);
    const result = buildUnifiedDiff({
      after: afterLines.join("\n"),
      before: beforeLines.join("\n"),
      maxLines: 50,
      path: "large.txt"
    });

    expect(result.truncated).toBe(true);
    expect(result.diff.split("\n").length).toBeLessThanOrEqual(51);
  });
});

describe("buildDiffPreview", () => {
  it("creates per-file previews with metadata", () => {
    const preview = buildDiffPreview({
      files: [
        {
          after: "alpha\nbeta\n",
          before: "alpha\n",
          path: "notes.txt"
        }
      ]
    });

    expect(preview.files).toHaveLength(1);
    expect(preview.files[0]!.path).toBe("notes.txt");
    expect(preview.files[0]!.unifiedDiff).toContain("+beta");
    expect(preview.files[0]!.before).toBe("alpha\n");
    expect(preview.files[0]!.after).toBe("alpha\nbeta\n");
    expect(preview.files[0]!.beforeTruncated).toBe(false);
    expect(preview.files[0]!.afterTruncated).toBe(false);
    expect(preview.synthesisError).toBeNull();
  });

  it("flags overall truncation when more than maxFiles are provided", () => {
    const preview = buildDiffPreview({
      files: Array.from({ length: 5 }, (_value, index) => ({
        after: `after ${index}\n`,
        before: `before ${index}\n`,
        path: `file-${index}.txt`
      })),
      maxFiles: 2
    });

    expect(preview.files).toHaveLength(2);
    expect(preview.truncated).toBe(true);
  });
});
