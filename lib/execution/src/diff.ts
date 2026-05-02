import type {
  DiffPreview,
  DiffPreviewFile
} from "@repo-guardian/shared-types";

const DEFAULT_MAX_LINES_PER_FILE = 400;
const DEFAULT_MAX_FILES = 8;
const DEFAULT_CONTEXT_LINES = 3;

export type BuildDiffPreviewInput = {
  files: Array<{
    path: string;
    before: string;
    after: string;
  }>;
  generatedAt?: string;
  maxFiles?: number;
  maxLinesPerFile?: number;
  contextLines?: number;
  synthesisError?: string | null;
};

type LcsCommand = "equal" | "delete" | "insert";

type LcsHunk = {
  command: LcsCommand;
  beforeStart: number;
  beforeLength: number;
  afterStart: number;
  afterLength: number;
  lines: string[];
};

function splitLines(value: string): string[] {
  if (value.length === 0) {
    return [];
  }

  return value.split(/\r?\n/u);
}

function buildLcsCommands(beforeLines: string[], afterLines: string[]): LcsCommand[] {
  const m = beforeLines.length;
  const n = afterLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i]![j]! =
        beforeLines[i] === afterLines[j]
          ? (dp[i + 1]![j + 1]! + 1)
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  const commands: LcsCommand[] = [];
  let i = 0;
  let j = 0;

  while (i < m && j < n) {
    if (beforeLines[i] === afterLines[j]) {
      commands.push("equal");
      i += 1;
      j += 1;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      commands.push("delete");
      i += 1;
    } else {
      commands.push("insert");
      j += 1;
    }
  }

  while (i < m) {
    commands.push("delete");
    i += 1;
  }

  while (j < n) {
    commands.push("insert");
    j += 1;
  }

  return commands;
}

function buildHunks(
  beforeLines: string[],
  afterLines: string[],
  contextLines: number
): LcsHunk[] {
  const commands = buildLcsCommands(beforeLines, afterLines);
  const hunks: LcsHunk[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;

  type Diff = {
    command: LcsCommand;
    line: string;
    beforeLine: number;
    afterLine: number;
  };
  const diffs: Diff[] = [];

  for (const command of commands) {
    if (command === "equal") {
      diffs.push({
        afterLine: afterIndex,
        beforeLine: beforeIndex,
        command,
        line: beforeLines[beforeIndex] ?? ""
      });
      beforeIndex += 1;
      afterIndex += 1;
    } else if (command === "delete") {
      diffs.push({
        afterLine: afterIndex,
        beforeLine: beforeIndex,
        command,
        line: beforeLines[beforeIndex] ?? ""
      });
      beforeIndex += 1;
    } else {
      diffs.push({
        afterLine: afterIndex,
        beforeLine: beforeIndex,
        command,
        line: afterLines[afterIndex] ?? ""
      });
      afterIndex += 1;
    }
  }

  let cursor = 0;

  while (cursor < diffs.length) {
    const diff = diffs[cursor]!;

    if (diff.command === "equal") {
      cursor += 1;
      continue;
    }

    const hunkStart = Math.max(0, cursor - contextLines);
    let hunkEnd = cursor;

    while (hunkEnd < diffs.length) {
      const candidate = diffs[hunkEnd]!;
      if (candidate.command !== "equal") {
        hunkEnd += 1;
        continue;
      }

      // Look ahead: do we have another change within 2*contextLines?
      let nextChange = -1;
      for (let lookahead = hunkEnd + 1; lookahead < diffs.length; lookahead += 1) {
        if (diffs[lookahead]!.command !== "equal") {
          nextChange = lookahead;
          break;
        }
      }

      if (nextChange !== -1 && nextChange - hunkEnd <= contextLines * 2) {
        hunkEnd = nextChange + 1;
      } else {
        break;
      }
    }

    const trailingEnd = Math.min(diffs.length, hunkEnd + contextLines);
    const sliced = diffs.slice(hunkStart, trailingEnd);

    if (sliced.length === 0) {
      cursor = hunkEnd;
      continue;
    }

    const firstSlice = sliced[0]!;
    const beforeStartLine = firstSlice.beforeLine + 1;
    const afterStartLine = firstSlice.afterLine + 1;
    let beforeLength = 0;
    let afterLength = 0;
    const lines: string[] = [];

    for (const item of sliced) {
      if (item.command === "equal") {
        lines.push(` ${item.line}`);
        beforeLength += 1;
        afterLength += 1;
      } else if (item.command === "delete") {
        lines.push(`-${item.line}`);
        beforeLength += 1;
      } else {
        lines.push(`+${item.line}`);
        afterLength += 1;
      }
    }

    hunks.push({
      afterLength,
      afterStart: afterStartLine,
      beforeLength,
      beforeStart: beforeStartLine,
      command: "equal",
      lines
    });

    cursor = trailingEnd;
  }

  return hunks;
}

export function buildUnifiedDiff(input: {
  before: string;
  after: string;
  path: string;
  contextLines?: number;
  maxLines?: number;
}): { diff: string; truncated: boolean } {
  const contextLines = input.contextLines ?? DEFAULT_CONTEXT_LINES;
  const maxLines = input.maxLines ?? DEFAULT_MAX_LINES_PER_FILE;
  const beforeLines = splitLines(input.before);
  const afterLines = splitLines(input.after);
  const hunks = buildHunks(beforeLines, afterLines, contextLines);
  const lines: string[] = [`--- a/${input.path}`, `+++ b/${input.path}`];

  for (const hunk of hunks) {
    lines.push(
      `@@ -${hunk.beforeStart},${hunk.beforeLength} +${hunk.afterStart},${hunk.afterLength} @@`
    );
    for (const line of hunk.lines) {
      lines.push(line);
    }
  }

  let truncated = false;
  let outputLines = lines;

  if (lines.length > maxLines) {
    truncated = true;
    outputLines = [
      ...lines.slice(0, maxLines),
      `... diff truncated to ${maxLines} of ${lines.length} lines for preview ...`
    ];
  }

  return { diff: outputLines.join("\n"), truncated };
}

export function buildDiffPreview(input: BuildDiffPreviewInput): DiffPreview {
  const maxFiles = input.maxFiles ?? DEFAULT_MAX_FILES;
  const maxLinesPerFile = input.maxLinesPerFile ?? DEFAULT_MAX_LINES_PER_FILE;
  const contextLines = input.contextLines ?? DEFAULT_CONTEXT_LINES;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const filesIncluded = input.files.slice(0, maxFiles);
  const overallTruncated = input.files.length > filesIncluded.length;
  const previewFiles: DiffPreviewFile[] = [];

  for (const file of filesIncluded) {
    const beforeLines = splitLines(file.before);
    const afterLines = splitLines(file.after);
    const beforeTruncated = beforeLines.length > maxLinesPerFile;
    const afterTruncated = afterLines.length > maxLinesPerFile;
    const before = beforeTruncated
      ? beforeLines.slice(0, maxLinesPerFile).join("\n")
      : file.before;
    const after = afterTruncated
      ? afterLines.slice(0, maxLinesPerFile).join("\n")
      : file.after;
    const built = buildUnifiedDiff({
      after,
      before,
      contextLines,
      maxLines: maxLinesPerFile,
      path: file.path
    });

    previewFiles.push({
      after,
      afterTruncated,
      before,
      beforeTruncated,
      diffTruncated: built.truncated,
      path: file.path,
      unifiedDiff: built.diff
    });
  }

  return {
    files: previewFiles,
    generatedAt,
    synthesisError: input.synthesisError ?? null,
    truncated:
      overallTruncated ||
      previewFiles.some(
        (file) => file.beforeTruncated || file.afterTruncated || file.diffTruncated
      )
  };
}

export function buildDiffPreviewError(input: {
  error: unknown;
  generatedAt?: string;
}): DiffPreview {
  const message =
    input.error instanceof Error ? input.error.message : String(input.error);

  return {
    files: [],
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    synthesisError: message.length > 0 ? message : "Patch synthesis failed.",
    truncated: false
  };
}
