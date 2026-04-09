import type {
  AnalysisWarning,
  DetectedManifest,
  NormalizedDependency
} from "@repo-guardian/shared-types";
import type { ParserResult } from "./utils.js";
import {
  createDependency,
  createDependencyParseWarning,
  dedupeDependencies,
  normalizeWorkspacePath
} from "./utils.js";

type GemfileBlock =
  | {
      groups: string[];
      type: "group";
    }
  | {
      type: "install_if" | "path" | "platforms" | "source" | "git" | "unknown";
    };

function extractInlineGroups(line: string): string[] {
  const groups: string[] = [];
  const singleGroupMatch = /group:\s*:([A-Za-z_][A-Za-z0-9_]*)/u.exec(line);

  if (singleGroupMatch?.[1]) {
    groups.push(singleGroupMatch[1]);
  }

  const groupsMatch = /groups?:\s*\[([^\]]+)\]/u.exec(line);

  if (groupsMatch?.[1]) {
    for (const match of groupsMatch[1].matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/gu)) {
      if (match[1]) {
        groups.push(match[1]);
      }
    }
  }

  return groups;
}

function isDevelopmentGroup(group: string): boolean {
  return group === "development" || group === "test";
}

function detectGemfileBlockStart(line: string): GemfileBlock | null {
  const groupMatch = /^group\s+(.+?)\s+do$/u.exec(line);

  if (groupMatch?.[1]) {
    return {
      groups: [...groupMatch[1].matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/gu)].flatMap(
        (match) => (match[1] ? [match[1]] : [])
      ),
      type: "group"
    };
  }

  if (/^source\s+.+\s+do$/u.test(line)) {
    return { type: "source" };
  }

  if (/^git\s+.+\s+do$/u.test(line)) {
    return { type: "git" };
  }

  if (/^path\s+.+\s+do$/u.test(line)) {
    return { type: "path" };
  }

  if (/^platforms?\s+.+\s+do$/u.test(line)) {
    return { type: "platforms" };
  }

  if (/^install_if\s+.+\s+do$/u.test(line)) {
    return { type: "install_if" };
  }

  if (/\bdo$/u.test(line)) {
    return { type: "unknown" };
  }

  return null;
}

function getActiveGemfileGroups(blockStack: GemfileBlock[]): string[] {
  return blockStack.flatMap((block) => (block.type === "group" ? block.groups : []));
}

export function parseGemfile(
  file: DetectedManifest,
  content: string
): ParserResult {
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);
  const blockStack: GemfileBlock[] = [];

  for (const [lineIndex, rawLine] of content.split(/\r?\n/u).entries()) {
    const line = rawLine.replace(/#.*$/u, "").trim();

    if (!line) {
      continue;
    }

    const blockStart = detectGemfileBlockStart(line);

    if (blockStart) {
      blockStack.push(blockStart);
      continue;
    }

    if (line === "end") {
      blockStack.pop();
      continue;
    }

    const gemMatch = /^gem\s+["']([^"']+)["'](?:\s*,\s*["']([^"']+)["'])?(.*)$/u.exec(line);

    if (!gemMatch) {
      if (line.startsWith("gem ")) {
        warningDetails.push(
          createDependencyParseWarning({
            code: "FILE_PARSE_FAILED",
            message: `Skipped unsupported Gemfile entry on line ${lineIndex + 1} in ${file.path}.`,
            path: file.path,
            source: file.kind
          })
        );
      }

      continue;
    }

    const [, name, version, remainder] = gemMatch;
    const inlineGroups = extractInlineGroups(remainder ?? "");
    const activeGroups = [...getActiveGemfileGroups(blockStack), ...inlineGroups];
    const dependencyType = activeGroups.some(isDevelopmentGroup)
      ? "development"
      : "production";

    if (!name) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped Gemfile entry on line ${lineIndex + 1} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    dependencies.push(
      createDependency({
        dependencyType,
        ecosystem: "ruby",
        isDirect: true,
        name,
        packageManager: "bundler",
        parseConfidence: version ? "medium" : "low",
        sourceFile: file.path,
        version: version?.trim() || null,
        workspacePath
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "bundler",
    warningDetails
  };
}
