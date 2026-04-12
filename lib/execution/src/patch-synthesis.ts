import type {
  CodeReviewFinding,
  DependencyFinding,
  ExecutionPlanningContext,
  PRCandidate,
  PRPatchPlan,
  PRWriteBackEligibility
} from "@repo-guardian/shared-types";

type ExecutionReadClient = {
  fetchRepositoryFileText(request: {
    owner: string;
    path: string;
    ref: string;
    repo: string;
  }): Promise<string>;
};

export type PRExecutionSupport =
  | {
      supported: false;
      reason: string;
    }
  | {
      executionKind: "dependency";
      dependencyFinding: DependencyFinding;
      packageName: string;
      remediationVersion: string;
      supported: true;
    }
  | {
      executionKind: "workflow";
      findingCategories: string[];
      supported: true;
    };

export type SynthesizedPRPatch = {
  branchName: string;
  commitMessage: string;
  fileChanges: Array<{
    content: string;
    path: string;
  }>;
  pullRequestBody: string;
};

const supportedWorkflowFindingCategories = new Set([
  "workflow-hardening",
  "workflow-permissions"
]);
const supportedDependencyFiles = ["package-lock.json", "package.json"] as const;
const supportedManifestSections = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies"
] as const;
const supportedPackageLockVersions = new Set([2, 3]);

type JsonObject = Record<string, unknown>;
type ManifestSection = (typeof supportedManifestSections)[number];
type FileContentsByPath = Readonly<Record<string, string>>;

type PreparedDeterministicDependencyUpdate = {
  currentManifestSpecifier: string;
  newline: string;
  nextManifestSpecifier: string;
  packageJson: JsonObject;
  packageJsonIndentation: string;
  packageJsonSection: ManifestSection;
  packageLock: JsonObject;
  packageLockIndentation: string;
  sourcePackageEntry: JsonObject;
};
type WorkflowPermissionRewritePattern =
  | "permissions: write-all"
  | "block-style contents: write"
  | "inline permissions: { contents: write }"
  | "missing permissions block";

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function sanitizeBranchSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-")
    .slice(0, 48);
}

function createBranchName(candidate: PRCandidate): string {
  const candidateSegment = sanitizeBranchSegment(candidate.id) || "candidate";
  const pathSegment =
    sanitizeBranchSegment(candidate.affectedPaths[0] ?? "") || "change";

  return `repo-guardian/${candidateSegment}-${pathSegment}-${Date.now().toString(36)}`;
}

function collectLinkedWorkflowFindings(
  analysis: ExecutionPlanningContext,
  candidate: PRCandidate
): CodeReviewFinding[] {
  const candidatePath = candidate.affectedPaths[0];

  if (!candidatePath) {
    return [];
  }

  return analysis.codeReviewFindings.filter(
    (finding) =>
      candidate.relatedFindingIds.includes(finding.id) &&
      finding.paths.includes(candidatePath)
  );
}

function collectLinkedDependencyFindings(
  analysis: ExecutionPlanningContext,
  candidate: PRCandidate,
  packageName: string
): DependencyFinding[] {
  return analysis.dependencyFindings.filter(
    (finding) =>
      candidate.relatedFindingIds.includes(finding.id) &&
      finding.packageName === packageName
  );
}

function hasExactSupportedDependencyFiles(paths: string[]): boolean {
  return (
    uniqueSorted(paths).join("|") ===
    [...supportedDependencyFiles].sort((left, right) => left.localeCompare(right)).join("|")
  );
}

function evaluateDependencyExecutionSupport(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
}): PRExecutionSupport {
  const packageNames = uniqueSorted(
    input.candidate.affectedPackages.filter((packageName) => packageName.trim().length > 0)
  );

  if (packageNames.length !== 1) {
    return {
      reason:
        "Deterministic dependency write-back requires exactly one affected package.",
      supported: false
    };
  }

  const isNpm = hasExactSupportedDependencyFiles(input.candidate.affectedPaths);
  const isPython = input.candidate.affectedPaths.length === 1 && (input.candidate.affectedPaths[0]?.endsWith("requirements.txt") ?? false);
  const isMaven = input.candidate.affectedPaths.length === 1 && (input.candidate.affectedPaths[0]?.endsWith("pom.xml") ?? false);
  const isGo = input.candidate.affectedPaths.length === 1 && (input.candidate.affectedPaths[0]?.endsWith("go.mod") ?? false);
  const isRust = input.candidate.affectedPaths.length === 1 && (input.candidate.affectedPaths[0]?.endsWith("Cargo.toml") ?? false);
  const isRuby = input.candidate.affectedPaths.length === 1 && (input.candidate.affectedPaths[0]?.endsWith("Gemfile") ?? false);
  const isPyProject = input.candidate.affectedPaths.length === 1 && (input.candidate.affectedPaths[0]?.endsWith("pyproject.toml") ?? false);
  const isDocker = input.candidate.affectedPaths.length === 1 && (input.candidate.affectedPaths[0]?.endsWith("Dockerfile") ?? false);
  const isGradle = input.candidate.affectedPaths.length === 1 && (input.candidate.affectedPaths[0]?.endsWith("build.gradle") || input.candidate.affectedPaths[0]?.endsWith("build.gradle.kts") || false);
  const isYarn = input.candidate.affectedPaths.length === 2 && input.candidate.affectedPaths.includes("package.json") && input.candidate.affectedPaths.includes("yarn.lock");

  if (!isNpm && !isPython && !isMaven && !isGo && !isRust && !isRuby && !isPyProject && !isDocker && !isGradle && !isYarn) {
    return {
      reason:
        "Deterministic dependency write-back currently supports only repo-root npm, Yarn (package.json/yarn.lock), Python (requirements.txt / pyproject.toml), Maven (pom.xml), Gradle (build.gradle/kts), Go (go.mod), Rust (Cargo.toml), Ruby (Gemfile), or Infra (Dockerfile) targets.",
      supported: false
    };
  }

  const plannedFiles = input.patchPlan.patchPlan?.filesPlanned.map((file) => file.path) ?? [];

  if (isNpm && !hasExactSupportedDependencyFiles(plannedFiles)) {
    return {
      reason:
        "The linked patch plan must target only repo-root package.json and package-lock.json for deterministic dependency write-back.",
      supported: false
    };
  }

  if (isYarn && (!plannedFiles.includes("package.json") || plannedFiles.length > 2)) {
    return {
      reason:
        "The linked patch plan must target package.json for deterministic Yarn dependency write-back.",
      supported: false
    };
  }

  if ((isPython || isMaven || isGo || isRust || isRuby || isPyProject || isDocker || isGradle) && (plannedFiles.length !== 1 || plannedFiles[0] !== input.candidate.affectedPaths[0])) {
    const targetName = isPython ? "requirements.txt" : isMaven ? "pom.xml" : isGo ? "go.mod" : isRust ? "Cargo.toml" : isRuby ? "Gemfile" : isPyProject ? "pyproject.toml" : isGradle ? "build.gradle target" : "Dockerfile";
    return {
      reason: `The linked patch plan must target exactly the identified ${targetName} for deterministic dependency write-back.`,
      supported: false
    };
  }

  const packageName = packageNames[0];

  if (!packageName) {
    return {
      reason:
        "Deterministic dependency write-back requires exactly one affected package.",
      supported: false
    };
  }

  const findings = collectLinkedDependencyFindings(
    input.analysis,
    input.candidate,
    packageName
  );

  if (findings.length !== 1) {
    return {
      reason:
        "Deterministic dependency write-back requires exactly one linked dependency finding for the selected package.",
      supported: false
    };
  }

  const finding = findings[0];

  if (!finding) {
    return {
      reason:
        "Deterministic dependency write-back requires exactly one linked dependency finding for the selected package.",
      supported: false
    };
  }

  if (finding.remediationType !== "upgrade") {
    return {
      reason:
        "The linked dependency finding does not identify an upgrade remediation path.",
      supported: false
    };
  }

  if (!finding.remediationVersion) {
    return {
      reason:
        "The linked dependency finding does not include a concrete remediation version.",
      supported: false
    };
  }

  if (!finding.isDirect) {
    return {
      reason:
        "Deterministic dependency write-back is limited to direct dependencies.",
      supported: false
    };
  }

  return {
    dependencyFinding: finding,
    executionKind: "dependency",
    packageName,
    remediationVersion: finding.remediationVersion,
    supported: true
  };
}

function evaluateWorkflowExecutionSupport(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
}): PRExecutionSupport {
  const findings = collectLinkedWorkflowFindings(input.analysis, input.candidate);

  if (findings.length === 0) {
    return {
      reason:
        "The selected workflow PR candidate does not include the linked review findings needed for safe patch synthesis.",
      supported: false
    };
  }

  const findingCategories = uniqueSorted(findings.map((finding) => finding.category));

  if (findingCategories.includes("workflow-trigger-risk")) {
    return {
      reason:
        "Workflow trigger-risk findings remain blocked for real write-back because the trigger change is not deterministic enough yet.",
      supported: false
    };
  }

  if (
    findingCategories.some(
      (category) => !supportedWorkflowFindingCategories.has(category)
    )
  ) {
    return {
      reason:
        "The selected workflow PR candidate contains unsupported workflow findings for automated patch synthesis.",
      supported: false
    };
  }

  return {
    executionKind: "workflow",
    findingCategories,
    supported: true
  };
}

function createBlockedWriteBackEligibility(input: {
  patchPlan: PRPatchPlan;
  reason: string;
  extraDetails?: string[];
}): PRWriteBackEligibility {
  return {
    approvalRequired: true,
    details: [
      input.reason,
      `Patchability: ${input.patchPlan.patchability}.`,
      `Validation status: ${input.patchPlan.validationStatus}.`,
      ...(input.extraDetails ?? [])
    ],
    status: "blocked",
    summary: input.reason
  };
}

function createExecutableWriteBackEligibility(input: {
  details: string[];
  matchedPatterns?: string[];
  summary: string;
}): PRWriteBackEligibility {
  return {
    approvalRequired: true,
    details: [
      "Approval is still required before Repo Guardian performs any GitHub write-back.",
      ...input.details
    ],
    matchedPatterns: input.matchedPatterns,
    status: "executable",
    summary: input.summary
  };
}

export function evaluatePRExecutionSupport(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
}): PRExecutionSupport {
  if (input.patchPlan.patchability !== "patch_candidate") {
    return {
      reason:
        input.patchPlan.patchWarnings[0] ??
        "The linked patch plan is not patch-capable for real PR execution.",
      supported: false
    };
  }

  if (input.candidate.candidateType === "workflow-hardening") {
    return evaluateWorkflowExecutionSupport({
      analysis: input.analysis,
      candidate: input.candidate
    });
  }

  if (input.candidate.candidateType === "dependency-upgrade") {
    return evaluateDependencyExecutionSupport(input);
  }

  return {
    reason: `Real PR execution is not supported for ${input.candidate.candidateType} candidates in this milestone.`,
    supported: false
  };
}

function detectNewline(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

function detectJsonIndentation(content: string): string {
  const match = content.match(/^[ \t]+(?=")/m);

  return match?.[0] ?? "  ";
}

function parseJsonDocument(content: string, path: string): JsonObject {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Repo Guardian could not parse ${path} as JSON.`);
  }

  if (!isRecord(parsed)) {
    throw new Error(`Repo Guardian expected ${path} to contain a JSON object.`);
  }

  return parsed;
}

function stringifyJsonDocument(
  document: JsonObject,
  indentation: string,
  newline: string
): string {
  return `${JSON.stringify(document, null, indentation).replace(/\n/g, newline)}${newline}`;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneJsonObject<T extends JsonObject>(value: T): T {
  return structuredClone(value);
}

function detectWorkflowPermissionRewritePatterns(
  content: string
): WorkflowPermissionRewritePattern[] {
  const lines = content.split(/\r?\n/u);
  const matchedPatterns = new Set<WorkflowPermissionRewritePattern>();
  let permissionsBlockIndentation: number | null = null;
  let hasPermissionsBlock = false;

  for (const rawLine of lines) {
    const leadingWhitespace = rawLine.match(/^[ \t]*/u)?.[0] ?? "";
    const indentation = leadingWhitespace.length;
    const trimmedLine = rawLine.trim();

    if (
      permissionsBlockIndentation !== null &&
      trimmedLine.length > 0 &&
      indentation <= permissionsBlockIndentation
    ) {
      permissionsBlockIndentation = null;
    }

    if (/^permissions\s*:\s*write-all\b/ui.test(trimmedLine)) {
      matchedPatterns.add("permissions: write-all");
      hasPermissionsBlock = true;
      continue;
    }

    if (
      /^permissions\s*:\s*\{\s*contents\s*:\s*write\s*\}(?:\s*#.*)?$/ui.test(
        trimmedLine
      )
    ) {
      matchedPatterns.add("inline permissions: { contents: write }");
      hasPermissionsBlock = true;
      continue;
    }

    if (/^permissions\s*:\s*(?:#.*)?$/u.test(trimmedLine)) {
      permissionsBlockIndentation = indentation;
      hasPermissionsBlock = true;
      continue;
    }

    if (
      permissionsBlockIndentation !== null &&
      indentation > permissionsBlockIndentation &&
      /^contents\s*:\s*write\b/ui.test(trimmedLine)
    ) {
      matchedPatterns.add("block-style contents: write");
    }
  }

  if (!hasPermissionsBlock) {
    matchedPatterns.add("missing permissions block");
  }

  return [...matchedPatterns];
}

function replaceBroadWorkflowPermissions(content: string, newline: string): string {
  const lines = content.split(/\r?\n/u);
  const updatedLines: string[] = [];
  let permissionsBlockIndentation: number | null = null;
  let replaced = false;

  for (const rawLine of lines) {
    const leadingWhitespace = rawLine.match(/^[ \t]*/u)?.[0] ?? "";
    const indentation = leadingWhitespace.length;
    const trimmedLine = rawLine.trim();

    if (
      permissionsBlockIndentation !== null &&
      trimmedLine.length > 0 &&
      indentation <= permissionsBlockIndentation
    ) {
      permissionsBlockIndentation = null;
    }

    const writeAllMatch = rawLine.match(
      /^([ \t]*)permissions\s*:\s*write-all\b([ \t]*(?:#.*)?)$/u
    );

    if (writeAllMatch) {
      const baseIndentation = writeAllMatch[1] ?? "";
      const trailingComment = writeAllMatch[2] ?? "";

      replaced = true;
      updatedLines.push(`${baseIndentation}permissions:${trailingComment}`);
      updatedLines.push(`${baseIndentation}  contents: read`);
      permissionsBlockIndentation = baseIndentation.length;
      continue;
    }

    const inlineContentsWriteMatch = rawLine.match(
      /^([ \t]*)permissions\s*:\s*\{\s*contents\s*:\s*write\s*\}([ \t]*(?:#.*)?)$/u
    );

    if (inlineContentsWriteMatch) {
      const baseIndentation = inlineContentsWriteMatch[1] ?? "";
      const trailingComment = inlineContentsWriteMatch[2] ?? "";

      replaced = true;
      updatedLines.push(`${baseIndentation}permissions: { contents: read }${trailingComment}`);
      continue;
    }

    if (/^permissions\s*:\s*(?:#.*)?$/u.test(trimmedLine)) {
      permissionsBlockIndentation = indentation;
      updatedLines.push(rawLine);
      continue;
    }

    if (
      permissionsBlockIndentation !== null &&
      indentation > permissionsBlockIndentation
    ) {
      const contentsWriteMatch = rawLine.match(
        /^([ \t]*)contents\s*:\s*write\b([ \t]*(?:#.*)?)$/u
      );

      if (contentsWriteMatch) {
        const [, contentsIndentation, trailingComment = ""] = contentsWriteMatch;

        replaced = true;
        updatedLines.push(`${contentsIndentation}contents: read${trailingComment}`);
        continue;
      }
    }

    updatedLines.push(rawLine);
  }

  if (!replaced) {
    throw new Error(
      "The workflow still needs permissions hardening, but no supported broad permissions line was found during patch synthesis."
    );
  }

  return updatedLines.join(newline);
}

function insertExplicitPermissions(content: string, newline: string): string {
  if (/^[ \t]*permissions\s*:/gmu.test(content)) {
    throw new Error(
      "The workflow hardening finding expected a missing permissions block, but the workflow already declares permissions."
    );
  }

  const permissionsBlock = `permissions:${newline}  contents: read${newline}${newline}`;
  const onMatch = /^on\s*:/mu.exec(content);

  if (onMatch?.index !== undefined) {
    return `${content.slice(0, onMatch.index)}${permissionsBlock}${content.slice(onMatch.index)}`;
  }

  return `${permissionsBlock}${content}`;
}

function findManifestSectionForPackage(
  document: JsonObject,
  packageName: string
): ManifestSection {
  const matchingSections = supportedManifestSections.filter((section) => {
    const sectionValue = document[section];

    return isRecord(sectionValue) && typeof sectionValue[packageName] === "string";
  });

  if (matchingSections.length !== 1) {
    throw new Error(
      `Deterministic dependency write-back requires exactly one supported dependency section for ${packageName}.`
    );
  }

  const section = matchingSections[0];

  if (!section) {
    throw new Error(
      `Deterministic dependency write-back requires exactly one supported dependency section for ${packageName}.`
    );
  }

  return section;
}

function updateDependencySpec(
  currentSpecifier: string,
  remediationVersion: string
): string {
  if (/^\^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(currentSpecifier)) {
    return `^${remediationVersion}`;
  }

  if (/^~\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(currentSpecifier)) {
    return `~${remediationVersion}`;
  }

  if (/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(currentSpecifier)) {
    return remediationVersion;
  }

  throw new Error(
    `Deterministic dependency write-back supports only exact, ^, or ~ version specifiers for ${remediationVersion}.`
  );
}

function getDependencySectionRecord(
  document: JsonObject,
  section: ManifestSection,
  path: string
): JsonObject {
  const sectionValue = document[section];

  if (!isRecord(sectionValue)) {
    throw new Error(`Repo Guardian expected ${path} to contain a ${section} object.`);
  }

  return sectionValue;
}

function describeSpecifierStyle(specifier: string): string {
  if (specifier.startsWith("^")) {
    return `caret range (${specifier})`;
  }

  if (specifier.startsWith("~")) {
    return `tilde range (${specifier})`;
  }

  return `exact version (${specifier})`;
}

function findDeterministicLockPackageEntry(input: {
  packageLock: JsonObject;
  packageName: string;
  remediationVersion: string;
}): JsonObject {
  const packagesValue = input.packageLock.packages;

  if (!isRecord(packagesValue)) {
    throw new Error(
      "Deterministic dependency write-back requires a package-lock.json packages object."
    );
  }

  const matchingEntries = Object.entries(packagesValue).filter(([path, value]) => {
    if (!isRecord(value)) {
      return false;
    }

    const version = value.version;
    const name = value.name;

    return (
      path.endsWith(`node_modules/${input.packageName}`) &&
      typeof version === "string" &&
      version === input.remediationVersion &&
      (typeof name !== "string" || name === input.packageName)
    );
  });

  if (matchingEntries.length !== 1) {
    throw new Error(
      `Repo Guardian could not recover unique lockfile metadata for ${input.packageName}@${input.remediationVersion}.`
    );
  }

  const matchingEntry = matchingEntries[0];

  if (!matchingEntry) {
    throw new Error(
      `Repo Guardian could not recover unique lockfile metadata for ${input.packageName}@${input.remediationVersion}.`
    );
  }

  const [, entry] = matchingEntry;

  if (!isRecord(entry)) {
    throw new Error(
      `Repo Guardian could not recover unique lockfile metadata for ${input.packageName}@${input.remediationVersion}.`
    );
  }

  return cloneJsonObject(entry);
}

function prepareDeterministicDependencyUpdate(input: {
  packageJsonContent: string;
  packageLockContent: string;
  packageName: string;
  remediationVersion: string;
}): PreparedDeterministicDependencyUpdate {
  const packageJsonPath = "package.json";
  const packageLockPath = "package-lock.json";
  const packageJson = parseJsonDocument(input.packageJsonContent, packageJsonPath);
  const packageLock = parseJsonDocument(input.packageLockContent, packageLockPath);
  const packageJsonSection = findManifestSectionForPackage(
    packageJson,
    input.packageName
  );
  const packageJsonDependencies = getDependencySectionRecord(
    packageJson,
    packageJsonSection,
    packageJsonPath
  );
  const currentManifestSpecifier = packageJsonDependencies[input.packageName];

  if (typeof currentManifestSpecifier !== "string") {
    throw new Error(
      `Repo Guardian expected ${packageJsonPath} to declare ${input.packageName} as a string dependency specifier.`
    );
  }

  const nextManifestSpecifier = updateDependencySpec(
    currentManifestSpecifier,
    input.remediationVersion
  );

  if (
    typeof packageLock.lockfileVersion !== "number" ||
    !supportedPackageLockVersions.has(packageLock.lockfileVersion)
  ) {
    throw new Error(
      "Deterministic dependency write-back currently supports only package-lock.json lockfileVersion 2 or 3."
    );
  }

  const packagesValue = packageLock.packages;

  if (!isRecord(packagesValue)) {
    throw new Error(
      "Deterministic dependency write-back requires a package-lock.json packages object."
    );
  }

  const rootPackageEntry = packagesValue[""];

  if (!isRecord(rootPackageEntry)) {
    throw new Error(
      "Deterministic dependency write-back requires package-lock.json packages[\"\"] metadata."
    );
  }

  const rootDependencies = getDependencySectionRecord(
    rootPackageEntry,
    packageJsonSection,
    `${packageLockPath} packages[""]`
  );

  if (typeof rootDependencies[input.packageName] !== "string") {
    throw new Error(
      `Repo Guardian expected ${packageLockPath} packages[""] to declare ${input.packageName} in ${packageJsonSection}.`
    );
  }

  const topLevelDependencies = packageLock.dependencies;

  if (
    !isRecord(topLevelDependencies) ||
    !isRecord(topLevelDependencies[input.packageName])
  ) {
    throw new Error(
      `Deterministic dependency write-back requires package-lock.json dependencies.${input.packageName} metadata.`
    );
  }

  const sourcePackageEntry = findDeterministicLockPackageEntry({
    packageLock,
    packageName: input.packageName,
    remediationVersion: input.remediationVersion
  });

  return {
    currentManifestSpecifier,
    newline: detectNewline(input.packageJsonContent),
    nextManifestSpecifier,
    packageJson,
    packageJsonIndentation: detectJsonIndentation(input.packageJsonContent),
    packageJsonSection,
    packageLock,
    packageLockIndentation: detectJsonIndentation(input.packageLockContent),
    sourcePackageEntry
  };
}

export function explainPRWriteBackEligibility(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  fileContentsByPath?: FileContentsByPath;
}): PRWriteBackEligibility {
  if (input.candidate.candidateType === "dependency-upgrade") {
    if (input.patchPlan.patchability === "not_patchable") {
      return createBlockedWriteBackEligibility({
        patchPlan: input.patchPlan,
        reason:
          input.patchPlan.patchWarnings[0] ??
          "The linked patch plan is not patch-capable for real PR execution."
      });
    }

    const support = evaluateDependencyExecutionSupport(input);

    if (!support.supported) {
      return createBlockedWriteBackEligibility({
        patchPlan: input.patchPlan,
        reason: support.reason
      });
    }

    if (support.executionKind !== "dependency") {
      return createBlockedWriteBackEligibility({
        patchPlan: input.patchPlan,
        reason:
          "Repo Guardian could not classify the selected dependency candidate for deterministic write-back."
      });
    }

    const packageJsonContent = input.fileContentsByPath?.["package.json"];
    const packageLockContent = input.fileContentsByPath?.["package-lock.json"];
    const requirementsTxtContent = support.packageName && input.candidate.affectedPaths[0]?.endsWith("requirements.txt")
      ? input.fileContentsByPath?.[input.candidate.affectedPaths[0]]
      : undefined;
    const pomXmlContent = support.packageName && input.candidate.affectedPaths[0]?.endsWith("pom.xml")
      ? input.fileContentsByPath?.[input.candidate.affectedPaths[0]]
      : undefined;
    const goModContent = support.packageName && input.candidate.affectedPaths[0]?.endsWith("go.mod")
      ? input.fileContentsByPath?.[input.candidate.affectedPaths[0]]
      : undefined;
    const cargoTomlContent = support.packageName && input.candidate.affectedPaths[0]?.endsWith("Cargo.toml")
      ? input.fileContentsByPath?.[input.candidate.affectedPaths[0]]
      : undefined;
    const gemfileContent = support.packageName && input.candidate.affectedPaths[0]?.endsWith("Gemfile")
      ? input.fileContentsByPath?.[input.candidate.affectedPaths[0]]
      : undefined;
    const pyprojectContent = support.packageName && input.candidate.affectedPaths[0]?.endsWith("pyproject.toml")
      ? input.fileContentsByPath?.[input.candidate.affectedPaths[0]]
      : undefined;
    const dockerfileContent = support.packageName && input.candidate.affectedPaths[0]?.endsWith("Dockerfile")
      ? input.fileContentsByPath?.[input.candidate.affectedPaths[0]]
      : undefined;
    const gradleContent = support.packageName && (input.candidate.affectedPaths[0]?.endsWith("build.gradle") || input.candidate.affectedPaths[0]?.endsWith("build.gradle.kts") || false)
      ? input.fileContentsByPath?.[input.candidate.affectedPaths[0]]
      : undefined;

    if (input.candidate.affectedPaths.includes("package-lock.json") && input.candidate.affectedPaths.includes("package.json")) {
      if (!packageJsonContent || !packageLockContent) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason:
            "Analysis did not fetch the package.json and package-lock.json content needed to verify deterministic dependency write-back."
        });
      }

      try {
        const prepared = prepareDeterministicDependencyUpdate({
          packageJsonContent,
          packageLockContent,
          packageName: support.packageName,
          remediationVersion: support.remediationVersion
        });

        return createExecutableWriteBackEligibility({
          details: [
            `The PR candidate is a direct npm dependency upgrade for ${support.packageName}.`,
            "The change scope is limited to repo-root package.json and package-lock.json.",
            `package.json uses a supported ${describeSpecifierStyle(prepared.currentManifestSpecifier)} specifier.`,
            `package-lock.json uses supported lockfileVersion ${String(prepared.packageLock.lockfileVersion)} and includes packages[""].`,
            `Existing lockfile metadata for ${support.packageName}@${support.remediationVersion} was found uniquely and can be copied deterministically.`
          ],
          summary: "Eligible for approved deterministic npm dependency write-back."
        });
      } catch (error) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason:
            error instanceof Error
              ? error.message
              : "Repo Guardian could not verify deterministic dependency write-back eligibility.",
          extraDetails: [
            `Affected package: ${support.packageName}.`,
            "The dependency write-back slice remains limited to a direct npm upgrade for repo-root package.json and package-lock.json."
          ]
        });
      }
    }

    if (requirementsTxtContent) {
      const match = detectPythonRequirementMatch(requirementsTxtContent, support.packageName);
      if (!match) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian could not find a deterministic exact-version requirement for ${support.packageName} in requirements.txt.`
        });
      }

      return createExecutableWriteBackEligibility({
        details: [
          `The PR candidate is a direct Python dependency upgrade for ${support.packageName}.`,
          "The change scope is limited to the repo requirements.txt file.",
          `Matched deterministic requirement pattern: ${match.line.trim()}.`
        ],
        summary: "Eligible for approved deterministic Python dependency write-back."
      });
    }

    if (pomXmlContent) {
      const match = detectMavenDependencyMatch(pomXmlContent, support.packageName);
      if (!match) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian could not find a deterministic explicit-version dependency for ${support.packageName} in pom.xml.`
        });
      }

      return createExecutableWriteBackEligibility({
        details: [
          `The PR candidate is a direct Maven dependency upgrade for ${support.packageName}.`,
          "The change scope is limited to the repo pom.xml file.",
          "Target identifies an explicit <version> tag within the dependency block."
        ],
        summary: "Eligible for approved deterministic Maven dependency write-back."
      });
    }

    if (goModContent) {
      const match = detectGoRequirementMatch(goModContent, support.packageName);
      if (!match) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian could not find a deterministic requirement for ${support.packageName} in go.mod.`
        });
      }

      return createExecutableWriteBackEligibility({
        details: [
          `The PR candidate is a direct Go dependency upgrade for ${support.packageName}.`,
          "The change scope is limited to the repo go.mod file. (go.sum will need an update by CI).",
          `Matched deterministic requirement pattern: ${match.line.trim()}.`
        ],
        summary: "Eligible for approved deterministic Go dependency write-back."
      });
    }

    if (cargoTomlContent) {
      const match = detectRustRequirementMatch(cargoTomlContent, support.packageName);
      if (!match) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian could not find a deterministic requirement for ${support.packageName} in Cargo.toml.`
        });
      }

      return createExecutableWriteBackEligibility({
        details: [
          `The PR candidate is a direct Rust dependency upgrade for ${support.packageName}.`,
          "The change scope is limited to the repo Cargo.toml file. (Cargo.lock will need an update by CI).",
          `Matched deterministic requirement pattern: ${match.line.trim()}.`
        ],
        summary: "Eligible for approved deterministic Rust dependency write-back."
      });
    }

    if (gemfileContent) {
      const match = detectRubyRequirementMatch(gemfileContent, support.packageName);
      if (!match) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian could not find a deterministic explicit-version dependency for ${support.packageName} in Gemfile.`
        });
      }

      return createExecutableWriteBackEligibility({
        details: [
          `The PR candidate is a direct Ruby dependency upgrade for ${support.packageName}.`,
          "The change scope is limited to the repo Gemfile file."
        ],
        summary: "Eligible for approved deterministic Ruby dependency write-back."
      });
    }

    if (pyprojectContent) {
      const match = detectPyProjectRequirementMatch(pyprojectContent, support.packageName);
      if (!match) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian could not find a deterministic explicit-version dependency for ${support.packageName} in pyproject.toml.`
        });
      }

      return createExecutableWriteBackEligibility({
        details: [
          `The PR candidate is a direct Python dependency upgrade for ${support.packageName}.`,
          "The change scope is limited to the repo pyproject.toml file."
        ],
        summary: "Eligible for approved deterministic Python dependency write-back."
      });
    }

    if (dockerfileContent) {
      const match = detectDockerImageMatch(dockerfileContent, support.packageName);
      if (!match) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian could not find a deterministic explicit base image tag for ${support.packageName} in Dockerfile.`
        });
      }

      return createExecutableWriteBackEligibility({
        details: [
          `The PR candidate is a direct Docker base image upgrade for ${support.packageName}.`,
          "The change scope is limited to the repo Dockerfile."
        ],
        summary: "Eligible for approved deterministic Infra dependency write-back."
      });
    }

    if (gradleContent) {
      const match = detectGradleRequirementMatch(gradleContent, support.packageName);
      if (!match) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian could not find a deterministic explicit-version dependency for ${support.packageName} in Gradle target.`
        });
      }
      
      if (match.isVariable) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: `Repo Guardian blocked updating ${support.packageName} because its version is centrally managed by a variable (${match.version}).`
        });
      }

      return createExecutableWriteBackEligibility({
        details: [
          `The PR candidate is a direct Gradle dependency upgrade for ${support.packageName}.`,
          "The change scope is limited to the isolated repo Gradle build target."
        ],
        summary: "Eligible for approved deterministic Gradle dependency write-back."
      });
    }

    if (input.candidate.affectedPaths.includes("yarn.lock") && input.candidate.affectedPaths.includes("package.json")) {
      if (!packageJsonContent) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason: "Analysis did not fetch the package.json content needed to verify deterministic Yarn dependency write-back."
        });
      }

      try {
        const packageJsonPath = "package.json";
        const packageJson = parseJsonDocument(packageJsonContent, packageJsonPath);
        const packageJsonSection = findManifestSectionForPackage(packageJson, support.packageName);
        const packageJsonDependencies = getDependencySectionRecord(packageJson, packageJsonSection, packageJsonPath);
        const currentManifestSpecifier = packageJsonDependencies[support.packageName];

        if (typeof currentManifestSpecifier !== "string") {
          throw new Error(`Repo Guardian expected ${packageJsonPath} to declare ${support.packageName} as a string dependency specifier.`);
        }

        updateDependencySpec(currentManifestSpecifier, support.remediationVersion); // Test throw validity

        return createExecutableWriteBackEligibility({
          details: [
            `The PR candidate is a direct Yarn dependency upgrade for ${support.packageName}.`,
            "The change scope is limited to package.json; yarn.lock will be naturally regenerated by CI actions.",
            `package.json uses a supported ${describeSpecifierStyle(currentManifestSpecifier)} specifier.`
          ],
          summary: "Eligible for approved deterministic Yarn dependency write-back."
        });
      } catch (error) {
        return createBlockedWriteBackEligibility({
          patchPlan: input.patchPlan,
          reason:
            error instanceof Error
              ? error.message
              : "Repo Guardian could not verify deterministic Yarn dependency write-back eligibility.",
          extraDetails: [
            `Affected package: ${support.packageName}.`,
            "The dependency write-back slice remains limited to package.json string updating in Yarn."
          ]
        });
      }
    }

    return createBlockedWriteBackEligibility({
      patchPlan: input.patchPlan,
      reason: "Repo Guardian could not determine the specific dependency write-back path for the selected candidate."
    });
  }

  const support = evaluatePRExecutionSupport(input);

  if (!support.supported) {
    return createBlockedWriteBackEligibility({
      patchPlan: input.patchPlan,
      reason: support.reason
    });
  }

  if (support.executionKind !== "workflow") {
    return createBlockedWriteBackEligibility({
      patchPlan: input.patchPlan,
      reason: "Repo Guardian could not classify the selected workflow candidate for write-back."
    });
  }

  const workflowPath = input.candidate.affectedPaths[0];
  const workflowContent = workflowPath
    ? input.fileContentsByPath?.[workflowPath]
    : undefined;
  const matchedPatterns = workflowContent
    ? detectWorkflowPermissionRewritePatterns(workflowContent)
    : [];

  if (
    support.findingCategories.includes("workflow-permissions") &&
    !matchedPatterns.some((pattern) => pattern !== "missing permissions block")
  ) {
    return createBlockedWriteBackEligibility({
      patchPlan: input.patchPlan,
      reason:
        "Repo Guardian could not match a supported workflow permission rewrite pattern in the fetched workflow file.",
      extraDetails: workflowPath
        ? [`Affected workflow file: ${workflowPath}.`]
        : undefined
    });
  }

  if (
    support.findingCategories.includes("workflow-hardening") &&
    !matchedPatterns.includes("missing permissions block")
  ) {
    return createBlockedWriteBackEligibility({
      patchPlan: input.patchPlan,
      reason:
        "Repo Guardian could not confirm the missing-permissions insertion pattern in the fetched workflow file.",
      extraDetails: workflowPath
        ? [`Affected workflow file: ${workflowPath}.`]
        : undefined
    });
  }

  return createExecutableWriteBackEligibility({
    details: [
      "The PR candidate is patch-capable for the current workflow-hardening write-back slice.",
      `Supported workflow finding categories: ${support.findingCategories.join(", ")}.`,
      ...(matchedPatterns.length > 0
        ? [
            `Matched deterministic workflow permission patterns: ${matchedPatterns.join(", ")}.`
          ]
        : []),
      `Affected file scope: ${input.candidate.affectedPaths.join(", ")}.`
    ],
    matchedPatterns,
    summary: "Eligible for approved workflow write-back."
  });
}

function synthesizeDependencyPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const packageJsonPath = "package.json";
  const packageLockPath = "package-lock.json";
  const repository = input.analysis.repository;

  return Promise.all([
    input.readClient.fetchRepositoryFileText({
      owner: repository.owner,
      path: packageJsonPath,
      ref: repository.defaultBranch,
      repo: repository.repo
    }),
    input.readClient.fetchRepositoryFileText({
      owner: repository.owner,
      path: packageLockPath,
      ref: repository.defaultBranch,
      repo: repository.repo
    })
  ]).then(([packageJsonContent, packageLockContent]) => {
    const prepared = prepareDeterministicDependencyUpdate({
      packageJsonContent,
      packageLockContent,
      packageName: input.support.packageName,
      remediationVersion: input.support.remediationVersion
    });
    const packageJsonDependencies = getDependencySectionRecord(
      prepared.packageJson,
      prepared.packageJsonSection,
      packageJsonPath
    );

    packageJsonDependencies[input.support.packageName] = prepared.nextManifestSpecifier;

    const packagesValue = prepared.packageLock.packages;

    if (!isRecord(packagesValue)) {
      throw new Error(
        "Deterministic dependency write-back requires a package-lock.json packages object."
      );
    }

    const rootPackageEntry = packagesValue[""];

    if (!isRecord(rootPackageEntry)) {
      throw new Error(
        "Deterministic dependency write-back requires package-lock.json packages[\"\"] metadata."
      );
    }

    const rootDependencies = getDependencySectionRecord(
      rootPackageEntry,
      prepared.packageJsonSection,
      `${packageLockPath} packages[""]`
    );

    rootDependencies[input.support.packageName] = prepared.nextManifestSpecifier;

    const rootLockPath = `node_modules/${input.support.packageName}`;

    packagesValue[rootLockPath] = cloneJsonObject(prepared.sourcePackageEntry);

    const topLevelDependencies = prepared.packageLock.dependencies;

    if (!isRecord(topLevelDependencies) || !isRecord(topLevelDependencies[input.support.packageName])) {
      throw new Error(
        `Deterministic dependency write-back requires package-lock.json dependencies.${input.support.packageName} metadata.`
      );
    }

    const nextTopLevelDependencyEntry = cloneJsonObject(prepared.sourcePackageEntry);

    delete nextTopLevelDependencyEntry.name;
    topLevelDependencies[input.support.packageName] = nextTopLevelDependencyEntry;

    const updatedPackageJsonContent = stringifyJsonDocument(
      prepared.packageJson,
      prepared.packageJsonIndentation,
      prepared.newline
    );
    const updatedPackageLockContent = stringifyJsonDocument(
      prepared.packageLock,
      prepared.packageLockIndentation,
      prepared.newline
    );

    if (
      updatedPackageJsonContent === packageJsonContent &&
      updatedPackageLockContent === packageLockContent
    ) {
      throw new Error(
        "Repo Guardian could not synthesize a concrete dependency update for the selected PR candidate."
      );
    }

    return {
      branchName: createBranchName(input.candidate),
      commitMessage: `chore(deps): ${input.candidate.title}`,
      fileChanges: [
        {
          content: updatedPackageJsonContent,
          path: packageJsonPath
        },
        {
          content: updatedPackageLockContent,
          path: packageLockPath
        }
      ],
      pullRequestBody: buildPullRequestBody(input)
    };
  });
}

async function synthesizeWorkflowPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "workflow"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const workflowPath = input.candidate.affectedPaths[0];

  if (!workflowPath) {
    throw new Error("The selected workflow PR candidate does not identify a workflow file.");
  }

  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path: workflowPath,
    ref: repository.defaultBranch,
    repo: repository.repo
  });
  const newline = detectNewline(originalContent);

  let updatedContent = originalContent;

  if (input.support.findingCategories.includes("workflow-permissions")) {
    updatedContent = replaceBroadWorkflowPermissions(updatedContent, newline);
  }

  if (input.support.findingCategories.includes("workflow-hardening")) {
    updatedContent = insertExplicitPermissions(updatedContent, newline);
  }

  if (updatedContent === originalContent) {
    throw new Error(
      "Repo Guardian could not synthesize a concrete workflow edit for the selected PR candidate."
    );
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(security): ${input.candidate.title}`,
    fileChanges: [
      {
        content: updatedContent,
        path: workflowPath
      }
    ],
    pullRequestBody: buildPullRequestBody(input)
  };
}

function buildPullRequestBody(input: {
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
}): string {
  const validationSteps =
    input.patchPlan.patchPlan?.requiredValidationSteps ?? input.candidate.testPlan;
  const linkedIssues =
    input.patchPlan.linkedIssueCandidateIds.length > 0
      ? input.patchPlan.linkedIssueCandidateIds.join(", ")
      : "none";
  const relatedFindings =
    input.patchPlan.relatedFindingIds.length > 0
      ? input.patchPlan.relatedFindingIds.join(", ")
      : "none";

  return [
    input.candidate.summary,
    "",
    "Validation follow-up:",
    ...validationSteps.map((step) => `- ${step}`),
    "",
    "Traceability:",
    `- PR candidate: ${input.candidate.id}`,
    `- Patchability: ${input.patchPlan.patchability}`,
    `- Validation status: ${input.patchPlan.validationStatus}`,
    `- Linked issue candidates: ${linkedIssues}`,
    `- Related findings: ${relatedFindings}`
  ].join("\n");
}

export async function synthesizePRCandidatePatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
}): Promise<SynthesizedPRPatch> {
  const support = evaluatePRExecutionSupport(input);

  if (!support.supported) {
    throw new Error(support.reason);
  }

  if (support.executionKind === "workflow") {
    return synthesizeWorkflowPatch({
      ...input,
      support
    });
  }

  const packagePath = input.candidate.affectedPaths[0];

  if (packagePath?.endsWith("requirements.txt")) {
    return synthesizePythonPatch({
      ...input,
      support
    });
  }

  if (packagePath?.endsWith("pom.xml")) {
    return synthesizeMavenPatch({
      ...input,
      support
    });
  }

  if (packagePath?.endsWith("go.mod")) {
    return synthesizeGoPatch({
      ...input,
      support
    });
  }

  if (packagePath?.endsWith("Cargo.toml")) {
    return synthesizeRustPatch({
      ...input,
      support
    });
  }

  if (packagePath?.endsWith("Gemfile")) {
    return synthesizeRubyPatch({
      ...input,
      support
    });
  }

  if (packagePath?.endsWith("pyproject.toml")) {
    return synthesizePyProjectPatch({
      ...input,
      support
    });
  }

  if (packagePath?.endsWith("Dockerfile")) {
    return synthesizeDockerPatch({
      ...input,
      support
    });
  }

  if (packagePath?.endsWith("build.gradle") || packagePath?.endsWith("build.gradle.kts")) {
    return synthesizeGradlePatch({
      ...input,
      support
    });
  }

  if (input.candidate.affectedPaths.includes("yarn.lock") && input.candidate.affectedPaths.includes("package.json")) {
    return synthesizeYarnPatch({
      ...input,
      support
    });
  }

  return synthesizeDependencyPatch({
    ...input,
    support
  });
}

function detectPythonRequirementMatch(content: string, packageName: string) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    // Match pkg==version, allowing for extras [extra] and avoiding matches that are just comments
    const regex = new RegExp(`^${packageName}(?:\\[[^\\]]+\\])?==[a-zA-Z0-9.-]+(?:\\s*#.*)?$`, "i");
    if (regex.test(trimmed)) {
      return { line };
    }
  }
  return null;
}

function detectMavenDependencyMatch(content: string, packageName: string) {
  // Simple check for <groupId>...<artifactId>...<version>... sequence
  // We expect a literal version tag (not a property)
  const [groupId, artifactId] = packageName.includes(":") ? packageName.split(":") : [null, packageName];

  if (!groupId) return null;

  // This is a very targeted regex to find the version tag within a dependency block
  // It's not fully XML-aware but follows our "deterministic/bounded" rule.
  const escapedGroupId = groupId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedArtifactId = artifactId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const dependencyRegex = new RegExp(
    `<dependency>\\s*(?:<!--.*?-->\\s*)*` +
    `<groupId>${escapedGroupId}</groupId>\\s*(?:<!--.*?-->\\s*)*` +
    `<artifactId>${escapedArtifactId}</artifactId>\\s*(?:<!--.*?-->\\s*)*` +
    `<version>([a-zA-Z0-9.-]+)</version>`,
    "ms"
  );

  const match = dependencyRegex.exec(content);
  if (match && match[1]) {
    return { fullMatch: match[0], version: match[1] };
  }
  return null;
}

async function synthesizePythonPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const path = input.candidate.affectedPaths[0]!;
  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const lines = originalContent.split(/\r?\n/);
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    const regex = new RegExp(`^${input.support.packageName}(?:\\[[^\\]]+\\])?==[a-zA-Z0-9.-]+`, "i");
    if (regex.test(trimmed)) {
      // Find where '==' is and replace what's after it
      const parts = line.split("==");
      if (parts.length >= 2) {
        const remaining = parts.slice(1).join("==");
        // We only want to replace the version part, potentially keeping trailing comments
        const versionMatch = remaining.match(/^[a-zA-Z0-9.-]+/);
        if (versionMatch) {
          return parts[0] + "==" + input.support.remediationVersion + remaining.slice(versionMatch[0].length);
        }
      }
    }
    return line;
  });

  const updatedContent = updatedLines.join(detectNewline(originalContent));

  if (updatedContent === originalContent) {
    throw new Error("Repo Guardian could not synthesize a concrete Python requirements edit.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [{ content: updatedContent, path }],
    pullRequestBody: buildPullRequestBody(input)
  };
}

async function synthesizeMavenPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const path = input.candidate.affectedPaths[0]!;
  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const match = detectMavenDependencyMatch(originalContent, input.support.packageName);
  if (!match) {
    throw new Error("Repo Guardian could not find a target for Maven patch synthesis.");
  }

  const updatedDependencyBlock = match.fullMatch.replace(
    `<version>${match.version}</version>`,
    `<version>${input.support.remediationVersion}</version>`
  );

  const updatedContent = originalContent.replace(match.fullMatch, updatedDependencyBlock);

  if (updatedContent === originalContent) {
    throw new Error("Repo Guardian could not synthesize a concrete Maven pom.xml edit.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [{ content: updatedContent, path }],
    pullRequestBody: buildPullRequestBody(input)
  };
}

function detectGoRequirementMatch(content: string, packageName: string) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^(?:require\\s+)?${escapedPackageName}\\s+v?[a-zA-Z0-9.-]+(?:\\s*//.*)?$`, "i");
    if (regex.test(trimmed)) {
      return { line };
    }
  }
  return null;
}

function detectRustRequirementMatch(content: string, packageName: string) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${escapedPackageName}\\s*=\\s*(?:(?:".*?")|(?:\\{.*?\\bversion\\s*=\\s*".*?".*?\\}))`, "i");
    if (regex.test(trimmed)) {
      return { line };
    }
  }
  return null;
}

async function synthesizeGoPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const path = input.candidate.affectedPaths[0]!;
  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const lines = originalContent.split(/\r?\n/);
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    const escapedPackageName = input.support.packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^(?:require\\s+)?${escapedPackageName}\\s+(v?[a-zA-Z0-9.-]+)`, "i");
    const match = regex.exec(trimmed);
    if (match && match[1]) {
      const versionStart = line.lastIndexOf(match[1]);
      const nextVersion = input.support.remediationVersion.startsWith("v") ? input.support.remediationVersion : "v" + input.support.remediationVersion;
      return line.slice(0, versionStart) + nextVersion + line.slice(versionStart + match[1].length);
    }
    return line;
  });

  const updatedContent = updatedLines.join(detectNewline(originalContent));

  if (updatedContent === originalContent) {
    throw new Error("Repo Guardian could not synthesize a concrete Go go.mod edit.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [{ content: updatedContent, path }],
    pullRequestBody: buildPullRequestBody(input)
  };
}

async function synthesizeRustPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const path = input.candidate.affectedPaths[0]!;
  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const lines = originalContent.split(/\r?\n/);
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    const escapedPackageName = input.support.packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    const regexShort = new RegExp(`(^${escapedPackageName}\\s*=\\s*")([^"]+)(")`, "i");
    const regexLong = new RegExp(`(^${escapedPackageName}\\s*=\\s*\\{.*?\\bversion\\s*=\\s*")([^"]+)(".*?\\})`, "i");
    
    const shortMatch = regexShort.exec(trimmed);
    if (shortMatch && shortMatch[2]) {
      const versionStr = `"${shortMatch[2]}"`;
      const versionIdx = line.indexOf(versionStr);
      if (versionIdx !== -1) {
        return line.slice(0, versionIdx) + `"${input.support.remediationVersion}"` + line.slice(versionIdx + versionStr.length);
      }
    }

    const longMatch = regexLong.exec(trimmed);
    if (longMatch && longMatch[2]) {
      const versionStr = `"${longMatch[2]}"`;
      const versionIdx = line.indexOf(versionStr);
      if (versionIdx !== -1) {
        return line.slice(0, versionIdx) + `"${input.support.remediationVersion}"` + line.slice(versionIdx + versionStr.length);
      }
    }
    
    return line;
  });

  const updatedContent = updatedLines.join(detectNewline(originalContent));

  if (updatedContent === originalContent) {
    throw new Error("Repo Guardian could not synthesize a concrete Rust Cargo.toml edit.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [{ content: updatedContent, path }],
    pullRequestBody: buildPullRequestBody(input)
  };
}

function detectRubyRequirementMatch(content: string, packageName: string) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^gem\\s+['"]${escapedPackageName}['"]\\s*,\\s*['"]([^'"]+)['"]`, "i");
    if (regex.test(trimmed)) {
      return { line };
    }
  }
  return null;
}

async function synthesizeRubyPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const path = input.candidate.affectedPaths[0]!;
  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const lines = originalContent.split(/\r?\n/);
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    const escapedPackageName = input.support.packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^gem\\s+['"]${escapedPackageName}['"]\\s*,\\s*['"])([^'"]+)(['"])`, "i");
    const match = regex.exec(trimmed);
    if (match && match[1] && match[2] && match[3]) {
      const versionStr = match[1].slice(-1) + match[2] + match[3].slice(0, 1);
      const versionIdx = line.indexOf(versionStr);
      if (versionIdx !== -1) {
        return line.slice(0, versionIdx) + match[1].slice(-1) + input.support.remediationVersion + match[3].slice(0, 1) + line.slice(versionIdx + versionStr.length);
      }
    }
    return line;
  });

  const updatedContent = updatedLines.join(detectNewline(originalContent));
  if (updatedContent === originalContent) {
    throw new Error("Repo Guardian could not synthesize a concrete Ruby Gemfile edit.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [{ content: updatedContent, path }],
    pullRequestBody: buildPullRequestBody(input)
  };
}

function detectPyProjectRequirementMatch(content: string, packageName: string) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regexString = new RegExp(`^"?${escapedPackageName}"?\\s*([=~<>!]+)\\s*"?([^"\\s]+)"?`, "i");
    if (regexString.test(trimmed)) {
      return { line };
    }
  }
  return null;
}

async function synthesizePyProjectPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const path = input.candidate.affectedPaths[0]!;
  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const lines = originalContent.split(/\r?\n/);
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    const escapedPackageName = input.support.packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^"?${escapedPackageName}"?\\s*[=~<>!]+\\s*"?)([^"\\s]+)("?)`, "i");
    const match = regex.exec(trimmed);
    if (match && match[1] && match[2]) {
      const versionStart = line.indexOf(match[2], line.indexOf(escapedPackageName));
      if (versionStart !== -1) {
        return line.slice(0, versionStart) + input.support.remediationVersion + line.slice(versionStart + match[2].length);
      }
    }
    return line;
  });

  const updatedContent = updatedLines.join(detectNewline(originalContent));
  if (updatedContent === originalContent) {
    throw new Error("Repo Guardian could not synthesize a concrete Python pyproject.toml edit.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [{ content: updatedContent, path }],
    pullRequestBody: buildPullRequestBody(input)
  };
}

function detectDockerImageMatch(content: string, packageName: string) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^FROM\\s+(?:--platform=[^\\s]+\\s+)?${escapedPackageName}:([^\\s]+)`, "i");
    if (regex.test(trimmed)) {
      return { line };
    }
  }
  return null;
}

async function synthesizeDockerPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const path = input.candidate.affectedPaths[0]!;
  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const lines = originalContent.split(/\r?\n/);
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    const escapedPackageName = input.support.packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^FROM\\s+(?:--platform=[^\\s]+\\s+)?${escapedPackageName}:)([^\\s@]+)(?:@sha256:[a-f0-9]+)?(.*)`, "i");
    const match = regex.exec(trimmed);
    if (match && match[1] && match[2]) {
      const versionStart = line.indexOf(match[2], line.indexOf(input.support.packageName));
      if (versionStart !== -1) {
        // Drop sha256 reference upon upgrade since it will change, user can pin it later if they want.
        const tail = match[3] ?? "";
        return line.slice(0, versionStart) + input.support.remediationVersion + tail;
      }
    }
    return line;
  });

  const updatedContent = updatedLines.join(detectNewline(originalContent));
  if (updatedContent === originalContent) {
    throw new Error("Repo Guardian could not synthesize a concrete Infra Dockerfile edit.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [{ content: updatedContent, path }],
    pullRequestBody: buildPullRequestBody(input)
  };
}

function detectGradleRequirementMatch(content: string, packageName: string) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    // Gradle deps: implementation 'com.google.guava:guava:31.0.1-jre' or implementation("com.google.guava:guava:31.0.1-jre")
    const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`['"]${escapedPackageName}:([^'"]+)['"]`, "i");
    const match = regex.exec(trimmed);
    if (match && match[1]) {
      const version = match[1];
      if (version.startsWith("$")) {
        return { isVariable: true, line, version };
      }
      return { isVariable: false, line, version };
    }
  }
  return null;
}

async function synthesizeGradlePatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const path = input.candidate.affectedPaths[0]!;
  const repository = input.analysis.repository;
  const originalContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const lines = originalContent.split(/\r?\n/);
  const updatedLines = lines.map(line => {
    const trimmed = line.trim();
    const escapedPackageName = input.support.packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(['"]${escapedPackageName}:)([^'"]+)(['"])`, "i");
    const match = regex.exec(trimmed);
    if (match && match[1] && match[2] && match[3]) {
      if (!match[2].startsWith("$")) {
        const versionStr = match[1].slice(-1) + match[2] + match[3].slice(0, 1);
        const versionIdx = line.indexOf(versionStr);
        if (versionIdx !== -1) {
          return line.slice(0, versionIdx) + match[1].slice(-1) + input.support.remediationVersion + match[3].slice(0, 1) + line.slice(versionIdx + versionStr.length);
        }
      }
    }
    return line;
  });

  const updatedContent = updatedLines.join(detectNewline(originalContent));
  if (updatedContent === originalContent) {
    throw new Error("Repo Guardian could not synthesize a concrete Gradle build script edit.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [{ content: updatedContent, path }],
    pullRequestBody: buildPullRequestBody(input)
  };
}

async function synthesizeYarnPatch(input: {
  analysis: ExecutionPlanningContext;
  candidate: PRCandidate;
  patchPlan: PRPatchPlan;
  readClient: ExecutionReadClient;
  support: Extract<PRExecutionSupport, { executionKind: "dependency"; supported: true }>;
}): Promise<SynthesizedPRPatch> {
  const packageJsonPath = "package.json";
  const repository = input.analysis.repository;
  const packageJsonContent = await input.readClient.fetchRepositoryFileText({
    owner: repository.owner,
    path: packageJsonPath,
    ref: repository.defaultBranch,
    repo: repository.repo
  });

  const parsed = parseJsonDocument(packageJsonContent, packageJsonPath);
  const newline = detectNewline(packageJsonContent);
  const indentation = detectJsonIndentation(packageJsonContent);
  const section = findManifestSectionForPackage(parsed, input.support.packageName);
  const dependencies = getDependencySectionRecord(parsed, section, packageJsonPath);
  
  const currentSpecifier = dependencies[input.support.packageName];
  if (typeof currentSpecifier !== "string") {
    throw new Error(`Repo Guardian expected ${packageJsonPath} to declare ${input.support.packageName} as a string dependency specifier.`);
  }

  const nextSpecifier = updateDependencySpec(currentSpecifier, input.support.remediationVersion);
  dependencies[input.support.packageName] = nextSpecifier;

  const updatedContent = stringifyJsonDocument(parsed, indentation, newline);
  
  if (updatedContent === packageJsonContent) {
    throw new Error("Repo Guardian could not synthesize a concrete dependency update for the selected Yarn PR candidate.");
  }

  return {
    branchName: createBranchName(input.candidate),
    commitMessage: `chore(deps): ${input.candidate.title}`,
    fileChanges: [
      {
        content: updatedContent,
        path: packageJsonPath
      }
    ],
    pullRequestBody: buildPullRequestBody(input)
  };
}
