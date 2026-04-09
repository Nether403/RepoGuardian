import type {
  AnalysisWarning,
  DependencyType,
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

const gradleConfigurations = new Set([
  "annotationProcessor",
  "api",
  "classpath",
  "compileOnly",
  "developmentOnly",
  "implementation",
  "kapt",
  "ksp",
  "runtimeOnly",
  "testAnnotationProcessor",
  "testCompileOnly",
  "testImplementation",
  "testRuntimeOnly"
]);

function getGradleDependencyType(configuration: string): DependencyType {
  if (configuration.startsWith("test") || configuration === "developmentOnly") {
    return "development";
  }

  if (configuration === "compileOnly") {
    return "peer";
  }

  return "production";
}

function parseCoordinateNotation(
  notation: string
): { name: string; version: string | null } | null {
  const match = /^([^:\s]+:[^:\s]+)(?::([^:\s][^\s]*))?$/u.exec(notation.trim());

  if (!match?.[1]) {
    return null;
  }

  return {
    name: match[1],
    version: match[2]?.trim() || null
  };
}

function isSkippableGradleReference(line: string): boolean {
  return /(?:project|fileTree|files|gradleApi|localGroovy)\s*\(/u.test(line) ||
    /libs\./u.test(line);
}

export function parseGradleBuildFile(
  file: DetectedManifest,
  content: string
): ParserResult {
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);
  const cleanedContent = content.replace(/\/\*[\s\S]*?\*\//gu, "");

  for (const [lineIndex, rawLine] of cleanedContent.split(/\r?\n/u).entries()) {
    const line = rawLine.replace(/\/\/.*$/u, "").trim();

    if (!line) {
      continue;
    }

    const configMatch = /^([A-Za-z][A-Za-z0-9_]*)\b/u.exec(line);
    const configuration = configMatch?.[1];

    if (!configuration || !gradleConfigurations.has(configuration)) {
      continue;
    }

    if (isSkippableGradleReference(line)) {
      continue;
    }

    let parsedCoordinate: { name: string; version: string | null } | null = null;

    const stringNotationMatch =
      /^\w+\s*(?:\(\s*)?(?:platform\(\s*)?["']([^"']+)["']\s*\)?\s*\)?/u.exec(line);
    if (stringNotationMatch?.[1]) {
      parsedCoordinate = parseCoordinateNotation(stringNotationMatch[1]);
    }

    if (!parsedCoordinate) {
      const groovyMapMatch =
        /^\w+\s+group:\s*["']([^"']+)["']\s*,\s*name:\s*["']([^"']+)["'](?:\s*,\s*version:\s*["']([^"']+)["'])?/u.exec(
          line
        );
      if (groovyMapMatch?.[1] && groovyMapMatch[2]) {
        parsedCoordinate = {
          name: `${groovyMapMatch[1]}:${groovyMapMatch[2]}`,
          version: groovyMapMatch[3]?.trim() || null
        };
      }
    }

    if (!parsedCoordinate) {
      const kotlinMapMatch =
        /^\w+\s*\(\s*group\s*=\s*"([^"]+)"\s*,\s*name\s*=\s*"([^"]+)"(?:\s*,\s*version\s*=\s*"([^"]+)")?/u.exec(
          line
        );
      if (kotlinMapMatch?.[1] && kotlinMapMatch[2]) {
        parsedCoordinate = {
          name: `${kotlinMapMatch[1]}:${kotlinMapMatch[2]}`,
          version: kotlinMapMatch[3]?.trim() || null
        };
      }
    }

    if (!parsedCoordinate) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped unsupported Gradle dependency declaration on line ${lineIndex + 1} in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    dependencies.push(
      createDependency({
        dependencyType: getGradleDependencyType(configuration),
        ecosystem: "jvm",
        isDirect: true,
        name: parsedCoordinate.name,
        packageManager: "gradle",
        parseConfidence: parsedCoordinate.version ? "medium" : "low",
        sourceFile: file.path,
        version: parsedCoordinate.version,
        workspacePath
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "gradle",
    warningDetails
  };
}
