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

const pomVersionPlaceholderPattern = /\$\{([^}]+)\}/gu;

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

function extractParentVersion(content: string): string | null {
  const parentBlock = /<parent>([\s\S]*?)<\/parent>/u.exec(content)?.[1];
  return parentBlock ? extractFirstTag(parentBlock, "version") : null;
}

function extractProjectVersion(content: string): string | null {
  const strippedContent = [
    "parent",
    "properties",
    "dependencies",
    "dependencyManagement",
    "build",
    "profiles",
    "repositories",
    "pluginRepositories",
    "reporting"
  ].reduce((currentContent, tagName) => stripXmlSections(currentContent, tagName), content);

  return extractFirstTag(strippedContent, "version");
}

function buildPomPropertyMap(content: string): Map<string, string> {
  const strippedContent = stripXmlSections(
    stripXmlSections(
      stripXmlSections(stripXmlComments(content), "dependencyManagement"),
      "pluginManagement"
    ),
    "plugins"
  );
  const properties = extractPomProperties(content);
  const projectVersion = extractProjectVersion(strippedContent);
  const parentVersion = extractParentVersion(content);

  if (projectVersion) {
    properties.set("project.version", projectVersion);
  }

  if (parentVersion) {
    properties.set("parent.version", parentVersion);
    properties.set("project.parent.version", parentVersion);
  }

  return properties;
}

function resolvePomValue(
  value: string | null,
  properties: Map<string, string>,
  seen = new Set<string>()
): { unresolvedPlaceholders: string[]; value: string | null } {
  if (!value) {
    return {
      unresolvedPlaceholders: [],
      value: null
    };
  }

  const unresolvedPlaceholders = new Set<string>();
  const resolvedValue = value.replace(
    pomVersionPlaceholderPattern,
    (_match, propertyName: string) => {
      if (seen.has(propertyName)) {
        unresolvedPlaceholders.add(propertyName);
        return `\${${propertyName}}`;
      }

      const propertyValue = properties.get(propertyName);

      if (!propertyValue) {
        unresolvedPlaceholders.add(propertyName);
        return `\${${propertyName}}`;
      }

      const nestedResolution = resolvePomValue(
        propertyValue,
        properties,
        new Set([...seen, propertyName])
      );

      for (const nestedPlaceholder of nestedResolution.unresolvedPlaceholders) {
        unresolvedPlaceholders.add(nestedPlaceholder);
      }

      return nestedResolution.value ?? `\${${propertyName}}`;
    }
  );

  return {
    unresolvedPlaceholders: [...unresolvedPlaceholders].sort((left, right) =>
      left.localeCompare(right)
    ),
    value: resolvedValue
  };
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

function buildManagedVersionMap(
  content: string,
  properties: Map<string, string>
): Map<string, string> {
  const managedVersions = new Map<string, string>();
  const managementBlock = /<dependencyManagement>([\s\S]*?)<\/dependencyManagement>/u.exec(content)?.[1];

  if (!managementBlock) {
    return managedVersions;
  }

  for (const dependencyMatch of managementBlock.matchAll(/<dependency>([\s\S]*?)<\/dependency>/gu)) {
    const block = dependencyMatch[1];

    if (!block) {
      continue;
    }

    const groupId = extractFirstTag(block, "groupId");
    const artifactId = extractFirstTag(block, "artifactId");
    const rawVersion = extractFirstTag(block, "version");
    const typeValue = extractFirstTag(block, "type");
    const scope = extractFirstTag(block, "scope");

    if (!groupId || !artifactId || !rawVersion) {
      continue;
    }

    if (scope === "import" && typeValue === "pom") {
      continue;
    }

    const resolved = resolvePomValue(rawVersion, properties);

    if (resolved.value && resolved.unresolvedPlaceholders.length === 0) {
      managedVersions.set(`${groupId}:${artifactId}`, resolved.value);
    }
  }

  return managedVersions;
}

export function parsePomXml(
  file: DetectedManifest,
  content: string
): ParserResult {
  const workspacePath = normalizeWorkspacePath(file.path);
  const warningDetails: AnalysisWarning[] = [];
  const dependencies: NormalizedDependency[] = [];
  const properties = buildPomPropertyMap(content);
  const managedVersions = buildManagedVersionMap(stripXmlComments(content), properties);
  const cleanedContent = stripXmlSections(
    stripXmlSections(
      stripXmlSections(stripXmlComments(content), "dependencyManagement"),
      "pluginManagement"
    ),
    "plugins"
  );

  for (const dependencyMatch of cleanedContent.matchAll(/<dependency>([\s\S]*?)<\/dependency>/gu)) {
    const dependencyBlock = dependencyMatch[1];

    if (!dependencyBlock) {
      continue;
    }

    const groupId = extractFirstTag(dependencyBlock, "groupId");
    const artifactId = extractFirstTag(dependencyBlock, "artifactId");
    const rawVersion = extractFirstTag(dependencyBlock, "version");
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

    const coordinateName = `${groupId}:${artifactId}`;
    let resolvedVersion = resolvePomValue(rawVersion, properties);
    let isManagedVersion = false;

    if (!resolvedVersion.value) {
      const managedVersion = managedVersions.get(coordinateName);

      if (managedVersion) {
        resolvedVersion = { unresolvedPlaceholders: [], value: managedVersion };
        isManagedVersion = true;
      } else {
        warningDetails.push(
          createDependencyParseWarning({
            code: "FILE_PARSE_FAILED",
            message: `Maven dependency ${coordinateName} in ${file.path} has no explicit version and no locally resolvable managed version.`,
            path: file.path,
            source: file.kind
          })
        );
      }
    }

    if (resolvedVersion.unresolvedPlaceholders.length > 0) {
      warningDetails.push(
        createDependencyParseWarning({
          code: "FILE_PARSE_FAILED",
          message: `Parsed Maven dependency ${coordinateName} in ${file.path} with unresolved version placeholder(s): ${resolvedVersion.unresolvedPlaceholders.join(", ")}.`,
          path: file.path,
          source: file.kind
        })
      );
    }

    dependencies.push(
      createDependency({
        dependencyType: getPomDependencyType(scope, optional),
        ecosystem: "jvm",
        isDirect: true,
        name: coordinateName,
        packageManager: "maven",
        parseConfidence:
          resolvedVersion.value && resolvedVersion.unresolvedPlaceholders.length === 0
            ? isManagedVersion ? "low" : "medium"
            : "low",
        sourceFile: file.path,
        version: resolvedVersion.value,
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
