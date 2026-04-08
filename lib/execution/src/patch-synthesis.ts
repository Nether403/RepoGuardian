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

  if (!hasExactSupportedDependencyFiles(input.candidate.affectedPaths)) {
    return {
      reason:
        "Deterministic dependency write-back currently supports only repo-root npm package.json and package-lock.json targets.",
      supported: false
    };
  }

  const plannedFiles = input.patchPlan.patchPlan?.filesPlanned.map((file) => file.path) ?? [];

  if (!hasExactSupportedDependencyFiles(plannedFiles)) {
    return {
      reason:
        "The linked patch plan must target only repo-root package.json and package-lock.json for deterministic dependency write-back.",
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

  return synthesizeDependencyPatch({
    ...input,
    support
  });
}
