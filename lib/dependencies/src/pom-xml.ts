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

function stripXmlComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/gu, "");
}

function stripXmlSections(content: string, tagName: string): string {
  return content.replace(new RegExp(`<${tagName}>[\\s\\S]*?<\\/${tagName}>`, "gu"), "");
}

function extractFirstTag(block: string, tagName: string): string | null {
  const match = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "u").exec(block);
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function extractPomProperties(content: string): Map<string, string> {
  const properties = new Map<string, string>();
  const propertiesBlock = /<properties>([\s\S]*?)<\/properties>/u.exec(content)?.[1];

  if (!propertiesBlock) {
    return properties;
  }

  for (const match of propertiesBlock.matchAll(/<([^/][^>]*)>([\s\S]*?)<\/\1>/gu)) {
    const key = match[1]?.trim();
    const value = match[2]?.trim();

    if (key && value) {
      properties.set(key, value);
    }
  }

  return properties;
}

function resolvePomVersion(
  value: string | null,
  properties: Map<string, string>
): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/\$\{([^}]+)\}/gu, (_match, propertyName: string) => {
    return properties.get(propertyName) ?? `\${${propertyName}}`;
  });
}

function getPomDependencyType(scope: string | null, optional: boolean): DependencyType {
  if (optional) {
    return "optional";
  }

  if (scope === "provided") {
    return "peer";
  }

  if (scope === "test") {
    return "development";
  }

  return "production";
}

export function parsePomXml(
  file: DetectedManifest,
  content: string
): ParserResult {
  const workspacePath = normalizeWorkspacePath(file.path);
  const warningDetails: AnalysisWarning[] = [];
  const dependencies: NormalizedDependency[] = [];
  const cleanedContent = stripXmlSections(
    stripXmlSections(
      stripXmlSections(stripXmlComments(content), "dependencyManagement"),
      "pluginManagement"
    ),
    "plugins"
  );
  const properties = extractPomProperties(cleanedContent);

  for (const dependencyMatch of cleanedContent.matchAll(/<dependency>([\s\S]*?)<\/dependency>/gu)) {
    const dependencyBlock = dependencyMatch[1];

    if (!dependencyBlock) {
      continue;
    }

    const groupId = extractFirstTag(dependencyBlock, "groupId");
    const artifactId = extractFirstTag(dependencyBlock, "artifactId");
    const version = resolvePomVersion(extractFirstTag(dependencyBlock, "version"), properties);
    const scope = extractFirstTag(dependencyBlock, "scope");
    const typeValue = extractFirstTag(dependencyBlock, "type");
    const optional = extractFirstTag(dependencyBlock, "optional") === "true";

    if (!groupId || !artifactId) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Skipped pom.xml dependency in ${file.path}.`,
          path: file.path,
          source: file.kind
        })
      );
      continue;
    }

    if (scope === "import" && typeValue === "pom") {
      continue;
    }

    dependencies.push(
      createDependency({
        dependencyType: getPomDependencyType(scope, optional),
        ecosystem: "jvm",
        isDirect: true,
        name: `${groupId}:${artifactId}`,
        packageManager: "maven",
        parseConfidence: version ? "medium" : "low",
        sourceFile: file.path,
        version,
        workspacePath
      })
    );
  }

  if (dependencies.length === 0) {
    warningDetails.push(
      createDependencyParseWarning({
        code: "FILE_PARSE_FAILED",
        message: `No supported dependency sections parsed from ${file.path}.`,
        path: file.path,
        source: file.kind
      })
    );
  }

  return {
    dependencies: dedupeDependencies(dependencies),
    packageManager: "maven",
    warningDetails
  };
}
