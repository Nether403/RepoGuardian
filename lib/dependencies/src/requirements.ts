import type { DetectedManifest, NormalizedDependency } from "@repo-guardian/shared-types";
import type { ParserResult } from "./utils.js";
import { createDependency, dedupeDependencies, normalizeWorkspacePath } from "./utils.js";
import { parsePythonRequirement } from "./python-utils.js";

const unsupportedRequirementPrefixes = [
  "-c",
  "--constraint",
  "-e",
  "--editable",
  "-f",
  "--find-links",
  "-i",
  "--index-url",
  "-r",
  "--requirement",
  "--extra-index-url"
];

export function parseRequirementsTxt(
  file: DetectedManifest,
  content: string
): ParserResult {
  const workspacePath = normalizeWorkspacePath(file.path);
  const dependencies: NormalizedDependency[] = [];
  const warnings: string[] = [];

  for (const [lineIndex, rawLine] of content.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    if (unsupportedRequirementPrefixes.some((prefix) => line.startsWith(prefix))) {
      warnings.push(
        `Skipped unsupported requirements.txt directive on line ${lineIndex + 1} in ${file.path}.`
      );
      continue;
    }

    const parsedRequirement = parsePythonRequirement(line);

    if (!parsedRequirement) {
      warnings.push(
        `Skipped unsupported requirements.txt entry on line ${lineIndex + 1} in ${file.path}.`
      );
      continue;
    }

    dependencies.push(
      createDependency({
        dependencyType: "production",
        ecosystem: "python",
        isDirect: true,
        name: parsedRequirement.name,
        packageManager: "pip",
        parseConfidence: "medium",
        sourceFile: file.path,
        version: parsedRequirement.version,
        workspacePath
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "pip",
    warnings
  };
}
