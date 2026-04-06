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
  const warningDetails: AnalysisWarning[] = [];

  for (const [lineIndex, rawLine] of content.split(/\r?\n/u).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    if (unsupportedRequirementPrefixes.some((prefix) => line.startsWith(prefix))) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped unsupported requirements.txt directive on line ${lineIndex + 1} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    const parsedRequirement = parsePythonRequirement(line);

    if (!parsedRequirement) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped unsupported requirements.txt entry on line ${lineIndex + 1} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
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
    warningDetails
  };
}
