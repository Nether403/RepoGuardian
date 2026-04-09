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

type ParsedCoordinate = {
  name: string;
  version: string | null;
};

type GradleDependencyStatement = {
  configuration: string;
  lineNumber: number;
  text: string;
};

function getGradleDependencyType(configuration: string): DependencyType {
  if (configuration.startsWith("test") || configuration === "developmentOnly") {
    return "development";
  }

  if (configuration === "compileOnly") {
    return "peer";
  }

  return "production";
}

function parseCoordinateNotation(notation: string): ParsedCoordinate | null {
  const match = /^([^:\s]+:[^:\s]+)(?::([^:\s][^\s]*))?$/u.exec(notation.trim());

  if (!match?.[1]) {
    return null;
  }

  return {
    name: match[1],
    version: match[2]?.trim() || null
  };
}

function stripGradleLineComment(line: string): string {
  return line.replace(/\/\/.*$/u, "");
}

function countOccurrences(text: string, character: string): number {
  return [...text].filter((value) => value === character).length;
}

function normalizeGradleStatementText(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function collectGradleDependencyStatements(content: string): GradleDependencyStatement[] {
  const statements: GradleDependencyStatement[] = [];
  const cleanedContent = content.replace(/\/\*[\s\S]*?\*\//gu, "");
  const lines = cleanedContent.split(/\r?\n/u);

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = stripGradleLineComment(lines[lineIndex] ?? "").trim();

    if (!line) {
      continue;
    }

    const configMatch = /^([A-Za-z][A-Za-z0-9_]*)\b/u.exec(line);
    const configuration = configMatch?.[1];

    if (!configuration || !gradleConfigurations.has(configuration)) {
      continue;
    }

    const statementLines = [line];
    let parenthesisDepth =
      countOccurrences(line, "(") - countOccurrences(line, ")");
    let shouldContinue = parenthesisDepth > 0 || /,\s*$/u.test(line);

    while (shouldContinue && lineIndex + 1 < lines.length) {
      lineIndex += 1;
      const continuationLine = stripGradleLineComment(lines[lineIndex] ?? "").trim();

      if (!continuationLine) {
        continue;
      }

      statementLines.push(continuationLine);
      parenthesisDepth +=
        countOccurrences(continuationLine, "(") -
        countOccurrences(continuationLine, ")");
      shouldContinue =
        parenthesisDepth > 0 || /,\s*$/u.test(continuationLine);
    }

    statements.push({
      configuration,
      lineNumber: lineIndex + 1 - (statementLines.length - 1),
      text: normalizeGradleStatementText(statementLines.join(" "))
    });
  }

  return statements;
}

function isExplicitlyUnsupportedGradleReference(statement: string): boolean {
  return /(?:project|fileTree|files|gradleApi|localGroovy)\s*\(/u.test(statement) ||
    /(?:^|[^\w])libs\./u.test(statement) ||
    /\{\s*$/u.test(statement);
}

function extractNamedArgumentValue(
  statement: string,
  argumentName: "group" | "name" | "version"
): string | null {
  const quotedMatch = new RegExp(
    `${argumentName}\\s*[:=]\\s*["']([^"']+)["']`,
    "u"
  ).exec(statement);

  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim();
  }

  const unquotedMatch = new RegExp(
    `${argumentName}\\s*[:=]\\s*([^,\\s)]+)`,
    "u"
  ).exec(statement);

  return unquotedMatch?.[1]?.trim() || null;
}

function parseNamedArgumentCoordinate(statement: string): ParsedCoordinate | null {
  const group = extractNamedArgumentValue(statement, "group");
  const name = extractNamedArgumentValue(statement, "name");

  if (!group || !name) {
    return null;
  }

  return {
    name: `${group}:${name}`,
    version: extractNamedArgumentValue(statement, "version")
  };
}

function parseStringNotationCoordinate(statement: string): ParsedCoordinate | null {
  const stringNotationMatch =
    /^\w+\s*(?:\(\s*)?(?:platform\(\s*)?["']([^"']+)["']\s*\)?\s*\)?/u.exec(statement);

  if (!stringNotationMatch?.[1]) {
    return null;
  }

  return parseCoordinateNotation(stringNotationMatch[1]);
}

function parseGradleStatementCoordinate(statement: string): ParsedCoordinate | null {
  return parseStringNotationCoordinate(statement) ?? parseNamedArgumentCoordinate(statement);
}

function hasUnresolvedGradleVersionPlaceholder(version: string | null): boolean {
  return version !== null && (/[$}{()]/u.test(version) || !/\d/u.test(version));
}

function createUnsupportedGradleWarning(
  file: DetectedManifest,
  lineNumber: number,
  statement: string
): AnalysisWarning {
  return createDependencyParseWarning({
    code: "FILE_PARSE_FAILED",
    message: `Skipped unsupported Gradle dependency declaration on line ${lineNumber} in ${file.path}: ${statement}.`,
    path: file.path,
    source: file.kind
  });
}

export function parseGradleBuildFile(
  file: DetectedManifest,
  content: string
): ParserResult {
  const dependencies: NormalizedDependency[] = [];
  const warningDetails: AnalysisWarning[] = [];
  const workspacePath = normalizeWorkspacePath(file.path);

  for (const statement of collectGradleDependencyStatements(content)) {
    if (isExplicitlyUnsupportedGradleReference(statement.text)) {
      warningDetails.push(
        createUnsupportedGradleWarning(file, statement.lineNumber, statement.text)
      );
      continue;
    }

    const parsedCoordinate = parseGradleStatementCoordinate(statement.text);

    if (!parsedCoordinate) {
      warningDetails.push(
        createUnsupportedGradleWarning(file, statement.lineNumber, statement.text)
      );
      continue;
    }

    const hasPlaceholderVersion = hasUnresolvedGradleVersionPlaceholder(
      parsedCoordinate.version
    );

    if (hasPlaceholderVersion && parsedCoordinate.version) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Parsed Gradle dependency ${parsedCoordinate.name} on line ${statement.lineNumber} in ${file.path} with unresolved version placeholder "${parsedCoordinate.version}".`,
          path: file.path,
          source: file.kind
        })
      );
    }

    dependencies.push(
      createDependency({
        dependencyType: getGradleDependencyType(statement.configuration),
        ecosystem: "jvm",
        isDirect: true,
        name: parsedCoordinate.name,
        packageManager: "gradle",
        parseConfidence:
          parsedCoordinate.version && !hasPlaceholderVersion ? "medium" : "low",
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
