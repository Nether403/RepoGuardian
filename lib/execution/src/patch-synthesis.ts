import type {
  CodeReviewFinding,
  DependencyFinding,
  ExecutionPlanningContext,
  PRCandidate,
  PRPatchPlan
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

type JsonObject = Record<string, unknown>;
type ManifestSection = (typeof supportedManifestSections)[number];

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

function replaceWriteAllPermissions(content: string, newline: string): string {
  let replaced = false;
  const updated = content.replace(
    /^([ \t]*)permissions\s*:\s*write-all\b[^\r\n]*$/gmu,
    (_match, indentation: string) => {
      replaced = true;
      return `${indentation}permissions:${newline}${indentation}  contents: read`;
    }
  );

  if (!replaced) {
    throw new Error(
      "The workflow still needs permissions hardening, but no permissions: write-all line was found during patch synthesis."
    );
  }

  return updated;
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
    const packageJson = parseJsonDocument(packageJsonContent, packageJsonPath);
    const packageLock = parseJsonDocument(packageLockContent, packageLockPath);
    const packageJsonSection = findManifestSectionForPackage(
      packageJson,
      input.support.packageName
    );
    const packageJsonDependencies = getDependencySectionRecord(
      packageJson,
      packageJsonSection,
      packageJsonPath
    );
    const currentManifestSpecifier = packageJsonDependencies[input.support.packageName];

    if (typeof currentManifestSpecifier !== "string") {
      throw new Error(
        `Repo Guardian expected ${packageJsonPath} to declare ${input.support.packageName} as a string dependency specifier.`
      );
    }

    const nextManifestSpecifier = updateDependencySpec(
      currentManifestSpecifier,
      input.support.remediationVersion
    );

    packageJsonDependencies[input.support.packageName] = nextManifestSpecifier;

    if (packageLock.lockfileVersion !== 3) {
      throw new Error(
        "Deterministic dependency write-back currently supports only package-lock.json lockfileVersion 3."
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

    if (typeof rootDependencies[input.support.packageName] !== "string") {
      throw new Error(
        `Repo Guardian expected ${packageLockPath} packages[""] to declare ${input.support.packageName} in ${packageJsonSection}.`
      );
    }

    rootDependencies[input.support.packageName] = nextManifestSpecifier;

    const sourcePackageEntry = findDeterministicLockPackageEntry({
      packageLock,
      packageName: input.support.packageName,
      remediationVersion: input.support.remediationVersion
    });
    const rootLockPath = `node_modules/${input.support.packageName}`;

    packagesValue[rootLockPath] = cloneJsonObject(sourcePackageEntry);

    const topLevelDependencies = packageLock.dependencies;

    if (!isRecord(topLevelDependencies) || !isRecord(topLevelDependencies[input.support.packageName])) {
      throw new Error(
        `Deterministic dependency write-back requires package-lock.json dependencies.${input.support.packageName} metadata.`
      );
    }

    const nextTopLevelDependencyEntry = cloneJsonObject(sourcePackageEntry);

    delete nextTopLevelDependencyEntry.name;
    topLevelDependencies[input.support.packageName] = nextTopLevelDependencyEntry;

    const newline = detectNewline(packageJsonContent);
    const packageJsonIndentation = detectJsonIndentation(packageJsonContent);
    const packageLockIndentation = detectJsonIndentation(packageLockContent);
    const updatedPackageJsonContent = stringifyJsonDocument(
      packageJson,
      packageJsonIndentation,
      newline
    );
    const updatedPackageLockContent = stringifyJsonDocument(
      packageLock,
      packageLockIndentation,
      newline
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
    updatedContent = replaceWriteAllPermissions(updatedContent, newline);
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
