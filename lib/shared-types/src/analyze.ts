import { z } from "zod";

const repoSegmentSchema = z.string().min(1);

export const NormalizedRepoInputSchema = z.object({
  owner: repoSegmentSchema,
  repo: repoSegmentSchema,
  fullName: z.string().min(3),
  canonicalUrl: z.string().url()
});

export const AnalyzeRepoRequestSchema = z.object({
  repoInput: z.string().trim().min(1, "Repository input is required")
});

export const AnalysisWarningCodeSchema = z.enum([
  "TREE_TRUNCATED",
  "PAYLOAD_CAPPED",
  "MANIFEST_WITHOUT_LOCKFILE",
  "LOCKFILE_WITHOUT_MANIFEST",
  "UNSUPPORTED_FILE_KIND",
  "FILE_FETCH_SKIPPED",
  "FILE_PARSE_FAILED",
  "DECLARATION_ONLY_VERSION",
  "MULTIPLE_RESOLVED_VERSIONS",
  "ADVISORY_LOOKUP_PARTIAL",
  "ADVISORY_PROVIDER_FAILED",
  "REVIEW_SCOPE_LIMITED",
  "REVIEW_SELECTION_CAPPED",
  "REVIEW_FILE_SKIPPED"
]);

export const AnalysisWarningStageSchema = z.enum([
  "intake",
  "detection",
  "dependency-parse",
  "advisory",
  "review"
]);

export const AnalysisWarningSeveritySchema = z.enum(["info", "warning"]);

export const AnalysisWarningSchema = z.object({
  code: AnalysisWarningCodeSchema,
  message: z.string().min(1),
  stage: AnalysisWarningStageSchema,
  severity: AnalysisWarningSeveritySchema,
  paths: z.array(z.string().min(1)),
  source: z.string().min(1).nullable()
});

export const RepositoryMetadataSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  canonicalUrl: z.string().url(),
  fullName: z.string().min(3),
  defaultBranch: z.string().min(1),
  description: z.string().nullable(),
  primaryLanguage: z.string().nullable(),
  stars: z.number().int().nonnegative(),
  forks: z.number().int().nonnegative(),
  htmlUrl: z.string().url()
});

export const RepositoryTreeEntrySchema = z.object({
  path: z.string().min(1),
  kind: z.enum(["directory", "file", "submodule"])
});

export const RepositoryTreeSummarySchema = z.object({
  entryCount: z.number().int().nonnegative(),
  fileCount: z.number().int().nonnegative(),
  directoryCount: z.number().int().nonnegative(),
  submoduleCount: z.number().int().nonnegative(),
  truncated: z.boolean()
});

export const EcosystemIdSchema = z.enum([
  "node",
  "python",
  "go",
  "rust",
  "jvm",
  "ruby"
]);

export const PackageManagerIdSchema = z.enum([
  "npm",
  "pnpm",
  "yarn",
  "pip",
  "poetry",
  "pipenv",
  "go-mod",
  "cargo",
  "maven",
  "gradle",
  "bundler"
]);

export const ManifestKindSchema = z.enum([
  "package.json",
  "requirements.txt",
  "pyproject.toml",
  "Pipfile",
  "go.mod",
  "Cargo.toml",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "Gemfile"
]);

export const LockfileKindSchema = z.enum([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "poetry.lock",
  "Pipfile.lock",
  "go.sum",
  "Cargo.lock",
  "gradle.lockfile",
  "Gemfile.lock"
]);

export const SignalKindSchema = z.enum([
  "Dockerfile",
  "docker-compose.yml",
  "github-workflow"
]);

export const DetectedManifestSchema = z.object({
  ecosystem: EcosystemIdSchema,
  kind: ManifestKindSchema,
  path: z.string().min(1)
});

export const DetectedLockfileSchema = z.object({
  ecosystem: EcosystemIdSchema,
  kind: LockfileKindSchema,
  path: z.string().min(1)
});

export const DetectedSignalSchema = z.object({
  category: z.enum(["infra", "workflow"]),
  kind: SignalKindSchema,
  path: z.string().min(1)
});

export const DetectedEcosystemSchema = z.object({
  ecosystem: EcosystemIdSchema,
  lockfiles: z.array(z.string().min(1)),
  manifests: z.array(z.string().min(1)),
  packageManagers: z.array(PackageManagerIdSchema)
});

export const ManifestCountByEcosystemSchema = z.object({
  ecosystem: EcosystemIdSchema,
  lockfiles: z.number().int().nonnegative(),
  manifests: z.number().int().nonnegative()
});

export const EcosystemDetectionSchema = z.object({
  ecosystems: z.array(DetectedEcosystemSchema),
  lockfiles: z.array(DetectedLockfileSchema),
  manifestCounts: z.object({
    byEcosystem: z.array(ManifestCountByEcosystemSchema),
    totalLockfiles: z.number().int().nonnegative(),
    totalManifests: z.number().int().nonnegative()
  }),
  manifests: z.array(DetectedManifestSchema),
  signals: z.array(DetectedSignalSchema),
  warningDetails: z.array(AnalysisWarningSchema).default([]),
  warnings: z.array(z.string())
});

export const RepositoryIntakeSnapshotSchema = z.object({
  repository: RepositoryMetadataSchema,
  treeSummary: RepositoryTreeSummarySchema,
  treeEntries: z.array(RepositoryTreeEntrySchema),
  warningDetails: z.array(AnalysisWarningSchema).default([]),
  warnings: z.array(z.string()),
  fetchedAt: z.string().datetime(),
  isPartial: z.boolean()
});

export const PublicTreeSummarySchema = z.object({
  samplePaths: z.array(z.string().min(1)),
  totalDirectories: z.number().int().nonnegative(),
  totalFiles: z.number().int().nonnegative(),
  truncated: z.boolean()
});

export const DetectedFileGroupSchema = z.object({
  kind: z.string().min(1),
  path: z.string().min(1)
});

export const DetectedFilesSchema = z.object({
  lockfiles: z.array(DetectedFileGroupSchema),
  manifests: z.array(DetectedFileGroupSchema),
  signals: z.array(
    z.object({
      category: z.enum(["infra", "workflow"]),
      kind: SignalKindSchema,
      path: z.string().min(1)
    })
  )
});

export const DependencyTypeSchema = z.enum([
  "production",
  "development",
  "peer",
  "optional",
  "transitive"
]);

export const ParseConfidenceSchema = z.enum(["high", "medium", "low"]);

export const DependencyFileKindSchema = z.union([
  ManifestKindSchema,
  LockfileKindSchema
]);

export const NormalizedDependencySchema = z.object({
  ecosystem: EcosystemIdSchema,
  packageManager: PackageManagerIdSchema.nullable(),
  name: z.string().min(1),
  version: z.string().min(1).nullable(),
  dependencyType: DependencyTypeSchema,
  isDirect: z.boolean(),
  sourceFile: z.string().min(1),
  workspacePath: z.string().min(1).nullable(),
  parseConfidence: ParseConfidenceSchema
});

export const ParsedDependencyFileSchema = z.object({
  ecosystem: EcosystemIdSchema,
  kind: DependencyFileKindSchema,
  path: z.string().min(1),
  packageManager: PackageManagerIdSchema.nullable(),
  dependencyCount: z.number().int().nonnegative()
});

export const SkippedDependencyFileSchema = z.object({
  ecosystem: EcosystemIdSchema,
  kind: DependencyFileKindSchema,
  path: z.string().min(1),
  reason: z.string().min(1)
});

export const DependencySummaryByEcosystemSchema = z.object({
  ecosystem: EcosystemIdSchema,
  totalDependencies: z.number().int().nonnegative(),
  directDependencies: z.number().int().nonnegative()
});

export const DependencySnapshotSummarySchema = z.object({
  totalDependencies: z.number().int().nonnegative(),
  directDependencies: z.number().int().nonnegative(),
  transitiveDependencies: z.number().int().nonnegative(),
  parsedFileCount: z.number().int().nonnegative(),
  skippedFileCount: z.number().int().nonnegative(),
  byEcosystem: z.array(DependencySummaryByEcosystemSchema)
});

export const DependencySnapshotSchema = z.object({
  summary: DependencySnapshotSummarySchema,
  dependencies: z.array(NormalizedDependencySchema),
  filesParsed: z.array(ParsedDependencyFileSchema),
  filesSkipped: z.array(SkippedDependencyFileSchema),
  parseWarningDetails: z.array(AnalysisWarningSchema).default([]),
  parseWarnings: z.array(z.string()),
  isPartial: z.boolean()
});

export const FindingSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info"
]);

export const FindingConfidenceSchema = z.enum(["high", "medium", "low"]);

export const FindingSourceTypeSchema = z.enum([
  "dependency",
  "code",
  "config",
  "workflow"
]);

export const FindingEvidenceSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1)
});

export const FindingLineSpanSchema = z.object({
  path: z.string().min(1),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive()
});

export const AdvisoryReferenceSchema = z.object({
  type: z.string().min(1).nullable(),
  url: z.string().url()
});

export const DependencyFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  severity: FindingSeveritySchema,
  confidence: FindingConfidenceSchema,
  sourceType: z.literal("dependency"),
  paths: z.array(z.string().min(1)),
  lineSpans: z.array(FindingLineSpanSchema),
  summary: z.string().min(1),
  evidence: z.array(FindingEvidenceSchema),
  recommendedAction: z.string().min(1),
  candidateIssue: z.boolean(),
  candidatePr: z.boolean(),
  packageName: z.string().min(1),
  installedVersion: z.string().min(1).nullable(),
  affectedRange: z.string().min(1).nullable(),
  dependencyType: DependencyTypeSchema,
  isDirect: z.boolean(),
  advisorySource: z.string().min(1),
  advisoryId: z.string().min(1),
  referenceUrls: z.array(z.string().url()),
  remediationVersion: z.string().min(1).nullable(),
  remediationType: z.enum(["upgrade", "review", "none"])
});

export const FindingsBySeveritySchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  medium: z.number().int().nonnegative(),
  low: z.number().int().nonnegative(),
  info: z.number().int().nonnegative()
});

export const DependencyFindingSummarySchema = z.object({
  totalFindings: z.number().int().nonnegative(),
  vulnerableDirectCount: z.number().int().nonnegative(),
  vulnerableTransitiveCount: z.number().int().nonnegative(),
  findingsBySeverity: FindingsBySeveritySchema,
  isPartial: z.boolean()
});

export const CodeReviewFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  severity: FindingSeveritySchema,
  confidence: FindingConfidenceSchema,
  sourceType: z.enum(["code", "config", "workflow"]),
  paths: z.array(z.string().min(1)),
  lineSpans: z.array(FindingLineSpanSchema),
  summary: z.string().min(1),
  evidence: z.array(FindingEvidenceSchema),
  recommendedAction: z.string().min(1),
  candidateIssue: z.boolean(),
  candidatePr: z.boolean()
});

export const CodeReviewFindingSummarySchema = z.object({
  totalFindings: z.number().int().nonnegative(),
  findingsBySeverity: FindingsBySeveritySchema,
  reviewedFileCount: z.number().int().nonnegative(),
  isPartial: z.boolean()
});

export const ReviewCoverageSchema = z.object({
  strategy: z.literal("targeted"),
  candidateFileCount: z.number().int().nonnegative(),
  selectedFileCount: z.number().int().nonnegative(),
  reviewedFileCount: z.number().int().nonnegative(),
  skippedFileCount: z.number().int().nonnegative(),
  selectedPaths: z.array(z.string().min(1)),
  skippedPaths: z.array(z.string().min(1)),
  isPartial: z.boolean()
});

export const IssueCandidateTypeSchema = z.enum([
  "dependency-upgrade",
  "dependency-review",
  "workflow-hardening",
  "secret-remediation",
  "dangerous-execution",
  "shell-execution",
  "general-hardening"
]);

export const IssueCandidateScopeSchema = z.enum([
  "package",
  "workflow-file",
  "file",
  "subsystem"
]);

export const IssueCandidateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  whyItMatters: z.string().min(1),
  affectedPaths: z.array(z.string().min(1)),
  affectedPackages: z.array(z.string().min(1)),
  relatedFindingIds: z.array(z.string().min(1)),
  severity: FindingSeveritySchema,
  confidence: FindingConfidenceSchema,
  labels: z.array(z.string().min(1)),
  acceptanceCriteria: z.array(z.string().min(1)),
  candidateType: IssueCandidateTypeSchema,
  scope: IssueCandidateScopeSchema,
  suggestedBody: z.string().min(1)
});

export const IssueCandidateCountByTypeSchema = z.object({
  candidateType: IssueCandidateTypeSchema,
  count: z.number().int().nonnegative()
});

export const IssueCandidateSummarySchema = z.object({
  totalCandidates: z.number().int().nonnegative(),
  byType: z.array(IssueCandidateCountByTypeSchema),
  bySeverity: FindingsBySeveritySchema
});

export const PRCandidateTypeSchema = IssueCandidateTypeSchema;

export const PRCandidateRiskLevelSchema = z.enum(["low", "medium", "high"]);

export const PRCandidateReadinessSchema = z.enum([
  "draft_only",
  "ready_with_warnings",
  "ready"
]);

export const PRCandidateChangeTypeSchema = z.enum(["edit", "add", "remove"]);

export const PRCandidateExpectedFileChangeSchema = z.object({
  path: z.string().min(1),
  changeType: PRCandidateChangeTypeSchema,
  reason: z.string().min(1)
});

export const PRCandidateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  linkedIssueCandidateIds: z.array(z.string().min(1)),
  relatedFindingIds: z.array(z.string().min(1)),
  candidateType: PRCandidateTypeSchema,
  riskLevel: PRCandidateRiskLevelSchema,
  readiness: PRCandidateReadinessSchema,
  expectedFileChanges: z.array(PRCandidateExpectedFileChangeSchema),
  rationale: z.string().min(1),
  testPlan: z.array(z.string().min(1)),
  rollbackNote: z.string().min(1),
  affectedPaths: z.array(z.string().min(1)),
  affectedPackages: z.array(z.string().min(1)),
  confidence: FindingConfidenceSchema,
  severity: FindingSeveritySchema,
  labels: z.array(z.string().min(1))
});

export const PRCandidateCountByTypeSchema = z.object({
  candidateType: PRCandidateTypeSchema,
  count: z.number().int().nonnegative()
});

export const PRCandidateCountByReadinessSchema = z.object({
  readiness: PRCandidateReadinessSchema,
  count: z.number().int().nonnegative()
});

export const PRCandidateCountByRiskLevelSchema = z.object({
  riskLevel: PRCandidateRiskLevelSchema,
  count: z.number().int().nonnegative()
});

export const PRCandidateSummarySchema = z.object({
  totalCandidates: z.number().int().nonnegative(),
  byType: z.array(PRCandidateCountByTypeSchema),
  byReadiness: z.array(PRCandidateCountByReadinessSchema),
  byRiskLevel: z.array(PRCandidateCountByRiskLevelSchema)
});

export const PRPatchabilitySchema = z.enum([
  "not_patchable",
  "patch_plan_only",
  "patch_candidate"
]);

export const ValidationStatusSchema = z.enum([
  "not_run",
  "not_applicable",
  "ready",
  "ready_with_warnings",
  "blocked"
]);

export const PRPatchPlanFileSchema = z.object({
  path: z.string().min(1),
  changeType: PRCandidateChangeTypeSchema,
  reason: z.string().min(1)
});

export const PatchPlanSchema = z.object({
  filesPlanned: z.array(PRPatchPlanFileSchema),
  patchStrategy: z.string().min(1),
  constraints: z.array(z.string().min(1)),
  requiredHumanReview: z.array(z.string().min(1)),
  requiredValidationSteps: z.array(z.string().min(1))
});

export const PRWriteBackEligibilityStatusSchema = z.enum([
  "executable",
  "blocked"
]);

export const PRWriteBackEligibilitySchema = z.object({
  status: PRWriteBackEligibilityStatusSchema,
  summary: z.string().min(1),
  details: z.array(z.string().min(1)),
  approvalRequired: z.boolean(),
  matchedPatterns: z.array(z.string().min(1)).optional()
});

export const PRPatchPlanSchema = z.object({
  id: z.string().min(1),
  prCandidateId: z.string().min(1),
  title: z.string().min(1),
  candidateType: PRCandidateTypeSchema,
  riskLevel: PRCandidateRiskLevelSchema,
  readiness: PRCandidateReadinessSchema,
  patchability: PRPatchabilitySchema,
  validationStatus: ValidationStatusSchema,
  validationNotes: z.array(z.string().min(1)),
  patchWarnings: z.array(z.string().min(1)),
  patchPlan: PatchPlanSchema.nullable(),
  linkedIssueCandidateIds: z.array(z.string().min(1)),
  relatedFindingIds: z.array(z.string().min(1)),
  affectedPaths: z.array(z.string().min(1)),
  affectedPackages: z.array(z.string().min(1)),
  confidence: FindingConfidenceSchema,
  severity: FindingSeveritySchema,
  writeBackEligibility: PRWriteBackEligibilitySchema.optional()
});

export const PRPatchPlanCountByPatchabilitySchema = z.object({
  patchability: PRPatchabilitySchema,
  count: z.number().int().nonnegative()
});

export const PRPatchPlanCountByValidationStatusSchema = z.object({
  validationStatus: ValidationStatusSchema,
  count: z.number().int().nonnegative()
});

export const PRPatchPlanSummarySchema = z.object({
  totalPlans: z.number().int().nonnegative(),
  totalPatchCandidates: z.number().int().nonnegative(),
  byPatchability: z.array(PRPatchPlanCountByPatchabilitySchema),
  byValidationStatus: z.array(PRPatchPlanCountByValidationStatusSchema)
});

export const ExecutionModeSchema = z.enum(["dry_run", "execute_approved"]);

export const ApprovalStatusSchema = z.enum([
  "required",
  "not_required",
  "granted",
  "denied"
]);

export const ExecutionActionTypeSchema = z.enum([
  "create_issue",
  "create_branch",
  "commit_patch",
  "create_pr",
  "prepare_patch",
  "validate_patch",
  "skip"
]);

export const ExecutionTargetTypeSchema = z.enum([
  "issue_candidate",
  "pr_candidate",
  "patch_plan",
  "request"
]);

export const ExecutionEligibilitySchema = z.enum([
  "eligible",
  "ineligible",
  "blocked"
]);

export const ExecutionStatusSchema = z.enum([
  "planned",
  "blocked",
  "completed",
  "failed"
]);

export const ExecutionPlanLifecycleStatusSchema = z.enum([
  "planned",
  "executing",
  "completed",
  "failed",
  "expired",
  "cancelled"
]);

export const ExecutionPlanningContextSchema = z.object({
  codeReviewFindings: z.array(CodeReviewFindingSchema).default([]),
  dependencyFindings: z.array(DependencyFindingSchema).default([]),
  repository: RepositoryMetadataSchema,
  issueCandidates: z.array(IssueCandidateSchema),
  prCandidates: z.array(PRCandidateSchema),
  prPatchPlans: z.array(PRPatchPlanSchema)
});

export const ExecutionPlanRequestSchema = z.object({
  analysisRunId: z.string().min(1),
  selectedIssueCandidateIds: z.array(z.string().min(1)).default([]),
  selectedPRCandidateIds: z.array(z.string().min(1)).default([])
});

export const ExecutionExecuteRequestSchema = z.object({
  planId: z.string().min(1),
  planHash: z.string().min(1),
  approvalToken: z.string().min(1),
  confirm: z.literal(true),
  confirmationText: z.string().min(1)
});

export const ApprovalRequirementSchema = z.object({
  required: z.boolean(),
  confirmationText: z.string().min(1)
});

export const ExecutionActionPlanSchema = z.object({
  id: z.string().min(1),
  actionType: ExecutionActionTypeSchema,
  targetType: ExecutionTargetTypeSchema,
  targetId: z.string().min(1),
  title: z.string().min(1),
  eligibility: ExecutionEligibilitySchema,
  reason: z.string().min(1),
  plannedSteps: z.array(z.string().min(1)),
  affectedPaths: z.array(z.string().min(1)),
  affectedPackages: z.array(z.string().min(1)),
  linkedIssueCandidateIds: z.array(z.string().min(1)),
  linkedPRCandidateIds: z.array(z.string().min(1)),
  approvalRequired: z.boolean(),
  approvalStatus: ApprovalStatusSchema,
  approvalNotes: z.array(z.string().min(1)),
  attempted: z.boolean(),
  succeeded: z.boolean(),
  blocked: z.boolean(),
  errorMessage: z.string().min(1).nullable(),
  issueNumber: z.number().int().positive().nullable(),
  issueUrl: z.string().url().nullable(),
  branchName: z.string().min(1).nullable(),
  commitSha: z.string().min(1).nullable(),
  pullRequestNumber: z.number().int().positive().nullable(),
  pullRequestUrl: z.string().url().nullable()
});

export const ExecutionSummarySchema = z.object({
  totalSelections: z.number().int().nonnegative(),
  issueSelections: z.number().int().nonnegative(),
  prSelections: z.number().int().nonnegative(),
  totalActions: z.number().int().nonnegative(),
  eligibleActions: z.number().int().nonnegative(),
  blockedActions: z.number().int().nonnegative(),
  skippedActions: z.number().int().nonnegative(),
  approvalRequiredActions: z.number().int().nonnegative()
});

export const ExecutionResultSummarySchema = ExecutionSummarySchema;

export const ExecutionResultSchema = z.object({
  executionId: z.string().min(1),
  mode: ExecutionModeSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  status: ExecutionStatusSchema,
  approvalRequired: z.boolean(),
  approvalStatus: ApprovalStatusSchema,
  approvalNotes: z.array(z.string().min(1)),
  actions: z.array(ExecutionActionPlanSchema),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  summary: ExecutionSummarySchema
});

export const ExecutionPlanResponseSchema = z.object({
  planId: z.string().min(1),
  planHash: z.string().min(1),
  approvalToken: z.string().min(1),
  expiresAt: z.string().datetime(),
  repository: RepositoryMetadataSchema.pick({ owner: true, repo: true, defaultBranch: true }),
  summary: ExecutionSummarySchema,
  actions: z.array(ExecutionActionPlanSchema),
  approval: ApprovalRequirementSchema
});

export const PersistedExecutionActionSchema = ExecutionActionPlanSchema.extend({
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable()
});

export const ExecutionPlanDetailApprovalSchema = z.object({
  required: z.boolean(),
  confirmationText: z.string().min(1),
  status: ApprovalStatusSchema,
  notes: z.array(z.string().min(1)),
  verifiedAt: z.string().datetime().nullable()
});

export const ExecutionPlanDetailResponseSchema = z.object({
  planId: z.string().min(1),
  planHash: z.string().min(1),
  analysisRunId: z.string().min(1),
  repository: RepositoryMetadataSchema.pick({
    owner: true,
    repo: true,
    defaultBranch: true,
    fullName: true
  }),
  actorUserId: z.string().min(1).nullable(),
  selectedIssueCandidateIds: z.array(z.string().min(1)),
  selectedPRCandidateIds: z.array(z.string().min(1)),
  status: ExecutionPlanLifecycleStatusSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  executionId: z.string().min(1).nullable(),
  executionResultStatus: z.enum(["completed", "failed"]).nullable(),
  executionSummary: ExecutionResultSummarySchema.nullable(),
  approval: ExecutionPlanDetailApprovalSchema,
  actions: z.array(PersistedExecutionActionSchema)
});

export const ExecutionPlanStatusEventTypeSchema = z.enum([
  "plan_created",
  "plan_expired",
  "execution_started",
  "action_started",
  "action_succeeded",
  "action_failed",
  "execution_completed",
  "execution_failed"
]);

export const ExecutionPlanStatusEventSchema = z.object({
  eventId: z.string().min(1),
  planId: z.string().min(1),
  executionId: z.string().min(1).nullable(),
  actionId: z.string().min(1).nullable(),
  eventType: ExecutionPlanStatusEventTypeSchema,
  repositoryFullName: z.string().min(3),
  actorUserId: z.string().min(1).nullable(),
  details: z.record(z.unknown()),
  createdAt: z.string().datetime()
});

export const ExecutionPlanEventsResponseSchema = z.object({
  planId: z.string().min(1),
  events: z.array(ExecutionPlanStatusEventSchema)
});

export const AnalyzeRepoResponseSchema = z.object({
  repository: RepositoryMetadataSchema,
  treeSummary: PublicTreeSummarySchema,
  detectedFiles: DetectedFilesSchema,
  ecosystems: z.array(DetectedEcosystemSchema),
  dependencySnapshot: DependencySnapshotSchema,
  dependencyFindings: z.array(DependencyFindingSchema),
  dependencyFindingSummary: DependencyFindingSummarySchema,
  codeReviewFindings: z.array(CodeReviewFindingSchema),
  codeReviewFindingSummary: CodeReviewFindingSummarySchema,
  reviewCoverage: ReviewCoverageSchema,
  issueCandidates: z.array(IssueCandidateSchema),
  issueCandidateSummary: IssueCandidateSummarySchema,
  prCandidates: z.array(PRCandidateSchema),
  prCandidateSummary: PRCandidateSummarySchema,
  prPatchPlans: z.array(PRPatchPlanSchema),
  prPatchPlanSummary: PRPatchPlanSummarySchema,
  warningDetails: z.array(AnalysisWarningSchema).default([]),
  warnings: z.array(z.string()),
  isPartial: z.boolean(),
  fetchedAt: z.string().datetime()
});

export const SavedAnalysisRunSummarySchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  label: z.string().min(1).nullable(),
  repositoryFullName: z.string().min(3),
  defaultBranch: z.string().min(1),
  fetchedAt: z.string().datetime(),
  totalFindings: z.number().int().nonnegative(),
  highSeverityFindings: z.number().int().nonnegative(),
  issueCandidates: z.number().int().nonnegative(),
  prCandidates: z.number().int().nonnegative(),
  executablePatchPlans: z.number().int().nonnegative(),
  blockedPatchPlans: z.number().int().nonnegative(),
  execution: z.object({
    latestPlanId: z.string().min(1),
    latestPlanStatus: ExecutionPlanLifecycleStatusSchema,
    latestExecutionCompletedAt: z.string().datetime().nullable()
  }).optional()
});

export const SavedAnalysisRunSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  label: z.string().min(1).nullable(),
  analysis: AnalyzeRepoResponseSchema
});

export const SaveAnalysisRunRequestSchema = z.object({
  analysis: AnalyzeRepoResponseSchema,
  label: z.string().trim().min(1).max(120).nullable().optional()
});

export const SaveAnalysisRunResponseSchema = z.object({
  run: SavedAnalysisRunSchema,
  summary: SavedAnalysisRunSummarySchema
});

export const ListAnalysisRunsResponseSchema = z.object({
  runs: z.array(SavedAnalysisRunSummarySchema)
});

export const GetAnalysisRunResponseSchema = z.object({
  run: SavedAnalysisRunSchema,
  summary: SavedAnalysisRunSummarySchema
});

export const TrackedRepositorySchema = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  fullName: z.string().min(3),
  canonicalUrl: z.string().url(),
  label: z.string().min(1).max(120).nullable(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastQueuedAt: z.string().datetime().nullable()
});

export const CreateTrackedRepositoryRequestSchema = z.object({
  label: z.string().trim().min(1).max(120).nullable().optional(),
  repoInput: z.string().trim().min(1, "Repository input is required")
});

export const CreateTrackedRepositoryResponseSchema = z.object({
  repository: TrackedRepositorySchema
});

export const ListTrackedRepositoriesResponseSchema = z.object({
  repositories: z.array(TrackedRepositorySchema)
});

export const AnalysisJobKindSchema = z.enum([
  "analyze_repository",
  "generate_execution_plan",
  "run_scheduled_sweep"
]);

export const AnalysisJobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const AnalysisJobSchema = z.object({
  jobId: z.string().min(1),
  jobKind: AnalysisJobKindSchema,
  status: AnalysisJobStatusSchema,
  repoInput: z.string().min(1),
  repositoryFullName: z.string().min(3),
  trackedRepositoryId: z.string().min(1).nullable(),
  scheduledSweepId: z.string().min(1).nullable(),
  requestedByUserId: z.string().min(1).nullable(),
  label: z.string().min(1).max(120).nullable(),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  runId: z.string().min(1).nullable(),
  planId: z.string().min(1).nullable(),
  errorMessage: z.string().min(1).nullable(),
  queuedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime()
});

export const EnqueueAnalysisJobRequestSchema = z
  .object({
    label: z.string().trim().min(1).max(120).nullable().optional(),
    repoInput: z.string().trim().min(1).optional(),
    trackedRepositoryId: z.string().trim().min(1).optional()
  })
  .refine((value) => Boolean(value.repoInput || value.trackedRepositoryId), {
    message: "repoInput or trackedRepositoryId is required",
    path: ["repoInput"]
  });

export const EnqueueAnalysisJobResponseSchema = z.object({
  job: AnalysisJobSchema
});

export const GetAnalysisJobResponseSchema = z.object({
  job: AnalysisJobSchema
});

export const ListAnalysisJobsResponseSchema = z.object({
  jobs: z.array(AnalysisJobSchema)
});

export const RetryAnalysisJobResponseSchema = z.object({
  job: AnalysisJobSchema
});

export const CancelAnalysisJobResponseSchema = z.object({
  job: AnalysisJobSchema
});

export const AsyncPlanSelectionStrategySchema = z.enum([
  "provided_candidates",
  "all_executable_prs"
]);

export const EnqueueExecutionPlanJobRequestSchema = z
  .object({
    analysisRunId: z.string().min(1),
    selectionStrategy: AsyncPlanSelectionStrategySchema.default("all_executable_prs"),
    selectedIssueCandidateIds: z.array(z.string().min(1)).default([]),
    selectedPRCandidateIds: z.array(z.string().min(1)).default([])
  })
  .superRefine((value, context) => {
    if (
      value.selectionStrategy === "provided_candidates" &&
      value.selectedIssueCandidateIds.length === 0 &&
      value.selectedPRCandidateIds.length === 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "At least one selected candidate id is required when using provided_candidates.",
        path: ["selectedPRCandidateIds"]
      });
    }
  });

export const EnqueueExecutionPlanJobResponseSchema = z.object({
  job: AnalysisJobSchema
});

export const SweepCadenceSchema = z.enum(["weekly"]);

export const SweepSelectionStrategySchema = z.enum(["all_executable_prs"]);

export const SweepScheduleSchema = z.object({
  scheduleId: z.string().min(1),
  cadence: SweepCadenceSchema,
  label: z.string().min(1).max(120),
  selectionStrategy: SweepSelectionStrategySchema,
  isActive: z.boolean(),
  lastTriggeredAt: z.string().datetime().nullable(),
  nextRunAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const CreateSweepScheduleRequestSchema = z.object({
  cadence: SweepCadenceSchema.default("weekly"),
  label: z.string().trim().min(1).max(120),
  selectionStrategy: SweepSelectionStrategySchema.default("all_executable_prs")
});

export const CreateSweepScheduleResponseSchema = z.object({
  schedule: SweepScheduleSchema
});

export const ListSweepSchedulesResponseSchema = z.object({
  schedules: z.array(SweepScheduleSchema)
});

export const TriggerSweepScheduleResponseSchema = z.object({
  job: AnalysisJobSchema,
  schedule: SweepScheduleSchema
});

export const TrackedPullRequestLifecycleStatusSchema = z.enum([
  "open",
  "closed",
  "merged"
]);

export const TrackedPullRequestSchema = z.object({
  trackedPullRequestId: z.string().min(1),
  repositoryFullName: z.string().min(3),
  owner: z.string().min(1),
  repo: z.string().min(1),
  pullRequestNumber: z.number().int().positive(),
  pullRequestUrl: z.string().url(),
  branchName: z.string().min(1),
  title: z.string().min(1),
  planId: z.string().min(1).nullable(),
  executionId: z.string().min(1).nullable(),
  lifecycleStatus: TrackedPullRequestLifecycleStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  mergedAt: z.string().datetime().nullable()
});

export const FleetTrackedRepositoryStatusSchema = z.object({
  trackedRepository: TrackedRepositorySchema,
  latestAnalysisJob: AnalysisJobSchema.nullable(),
  latestRun: SavedAnalysisRunSummarySchema.nullable(),
  latestPlanId: z.string().min(1).nullable(),
  latestPlanStatus: ExecutionPlanLifecycleStatusSchema.nullable(),
  patchPlanCounts: z.object({
    blocked: z.number().int().nonnegative(),
    executable: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative()
  }),
  stale: z.boolean()
});

export const FleetStatusResponseSchema = z.object({
  generatedAt: z.string().datetime(),
  summary: z.object({
    blockedPatchPlans: z.number().int().nonnegative(),
    executablePatchPlans: z.number().int().nonnegative(),
    failedJobs: z.number().int().nonnegative(),
    mergedPullRequests: z.number().int().nonnegative(),
    openPullRequests: z.number().int().nonnegative(),
    stalePatchPlans: z.number().int().nonnegative(),
    staleRepositories: z.number().int().nonnegative(),
    trackedRepositories: z.number().int().nonnegative()
  }),
  trackedRepositories: z.array(FleetTrackedRepositoryStatusSchema),
  recentJobs: z.array(AnalysisJobSchema),
  trackedPullRequests: z.array(TrackedPullRequestSchema)
});

export const ExecutionPlanSummarySchema = z.object({
  planId: z.string().min(1),
  analysisRunId: z.string().min(1),
  repositoryFullName: z.string().min(3),
  status: ExecutionPlanLifecycleStatusSchema,
  createdAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  executionId: z.string().min(1).nullable(),
  executionResultStatus: z.enum(["completed", "failed"]).nullable(),
  approvalStatus: ApprovalStatusSchema,
  selectedIssueCandidateCount: z.number().int().nonnegative(),
  selectedPRCandidateCount: z.number().int().nonnegative(),
  summary: ExecutionResultSummarySchema
});

export const RepositoryActivityKindSchema = z.enum([
  "analysis_job",
  "analysis_run",
  "execution_event",
  "execution_plan",
  "tracked_pull_request"
]);

export const RepositoryActivitySortPresetSchema = z.enum([
  "newest_first",
  "oldest_first"
]);

export const RepositoryActivityCursorDirectionSchema = z.enum([
  "next",
  "previous"
]);

export const RepositoryTimelineExpansionModeSchema = z.enum([
  "summary",
  "detail"
]);

export const RepositoryActivityDetailSchema = z.object({
  auditEventType: z.string().min(1).nullable(),
  blockedPatchPlanCount: z.number().int().nonnegative().nullable(),
  branchName: z.string().min(1).nullable(),
  candidateSelectionCount: z.number().int().nonnegative().nullable(),
  executablePatchPlanCount: z.number().int().nonnegative().nullable(),
  findingCount: z.number().int().nonnegative().nullable(),
  jobKind: z.string().min(1).nullable(),
  label: z.string().min(1).nullable(),
  lifecycleStatus: z.string().min(1).nullable(),
  relatedActionId: z.string().min(1).nullable(),
  relatedExecutionId: z.string().min(1).nullable(),
  relatedJobId: z.string().min(1).nullable(),
  relatedPlanId: z.string().min(1).nullable(),
  relatedRunId: z.string().min(1).nullable(),
  relatedTrackedPullRequestId: z.string().min(1).nullable()
});

export const RepositoryActivityEventSchema = z.object({
  actionId: z.string().min(1).nullable(),
  activityId: z.string().min(1),
  detail: RepositoryActivityDetailSchema.nullable(),
  executionEventId: z.string().min(1).nullable(),
  executionId: z.string().min(1).nullable(),
  jobId: z.string().min(1).nullable(),
  kind: RepositoryActivityKindSchema,
  occurredAt: z.string().datetime(),
  planId: z.string().min(1).nullable(),
  pullRequestUrl: z.string().url().nullable(),
  repositoryFullName: z.string().min(3),
  runId: z.string().min(1).nullable(),
  status: z.string().min(1),
  summary: z.string().min(1).nullable(),
  title: z.string().min(1),
  trackedPullRequestId: z.string().min(1).nullable()
});

export const RepositoryActivityFeedSchema = z.object({
  appliedCursor: z.string().min(1).nullable(),
  appliedCursorDirection: RepositoryActivityCursorDirectionSchema,
  appliedKinds: z.array(RepositoryActivityKindSchema),
  appliedSortPreset: RepositoryActivitySortPresetSchema,
  appliedStatuses: z.array(z.string().min(1)),
  availableKinds: z.array(RepositoryActivityKindSchema),
  detailsIncluded: z.boolean(),
  events: z.array(RepositoryActivityEventSchema),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  nextCursor: z.string().min(1).nullable(),
  occurredAfter: z.string().datetime().nullable(),
  occurredBefore: z.string().datetime().nullable(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  previousCursor: z.string().min(1).nullable(),
  totalPages: z.number().int().nonnegative(),
  totalEvents: z.number().int().nonnegative()
});

export const RepositoryTimelinePageSchema = z.object({
  appliedCursor: z.string().min(1).nullable(),
  appliedCursorDirection: RepositoryActivityCursorDirectionSchema,
  appliedKinds: z.array(RepositoryActivityKindSchema),
  appliedSortPreset: RepositoryActivitySortPresetSchema,
  appliedStatuses: z.array(z.string().min(1)),
  availableKinds: z.array(RepositoryActivityKindSchema),
  events: z.array(RepositoryActivityEventSchema),
  expansionMode: RepositoryTimelineExpansionModeSchema,
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
  limit: z.number().int().positive(),
  nextCursor: z.string().min(1).nullable(),
  occurredAfter: z.string().datetime().nullable(),
  occurredBefore: z.string().datetime().nullable(),
  previousCursor: z.string().min(1).nullable(),
  returnedCount: z.number().int().nonnegative()
});

export const TrackedRepositoryHistoryResponseSchema = z.object({
  activityFeed: RepositoryActivityFeedSchema,
  generatedAt: z.string().datetime(),
  trackedRepository: TrackedRepositorySchema,
  currentStatus: FleetTrackedRepositoryStatusSchema,
  recentRuns: z.array(SavedAnalysisRunSummarySchema),
  recentJobs: z.array(AnalysisJobSchema),
  recentPlans: z.array(ExecutionPlanSummarySchema),
  trackedPullRequests: z.array(TrackedPullRequestSchema)
});

export const CompareAnalysisRunsRequestSchema = z.object({
  baseRunId: z.string().min(1),
  targetRunId: z.string().min(1)
});

export const CompareMetricDeltaSchema = z.object({
  base: z.number().int().nonnegative(),
  target: z.number().int().nonnegative(),
  delta: z.number().int()
});

export const CompareEntitySetDeltaSchema = z.object({
  added: z.array(z.string().min(1)),
  removed: z.array(z.string().min(1)),
  unchanged: z.array(z.string().min(1))
});

export const CompareAnalysisRunsResponseSchema = z.object({
  baseRun: SavedAnalysisRunSummarySchema,
  targetRun: SavedAnalysisRunSummarySchema,
  findings: z.object({
    total: CompareMetricDeltaSchema,
    bySeverity: z.object({
      base: FindingsBySeveritySchema,
      target: FindingsBySeveritySchema
    }),
    newFindingIds: z.array(z.string().min(1)),
    resolvedFindingIds: z.array(z.string().min(1))
  }),
  candidates: z.object({
    issueCandidates: CompareMetricDeltaSchema,
    prCandidates: CompareMetricDeltaSchema,
    executablePatchPlans: CompareMetricDeltaSchema,
    blockedPatchPlans: CompareMetricDeltaSchema
  }),
  repository: z.object({
    sameRepository: z.boolean(),
    baseRepositoryFullName: z.string().min(3),
    targetRepositoryFullName: z.string().min(3)
  }),
  structure: z.object({
    ecosystems: CompareEntitySetDeltaSchema,
    manifests: CompareEntitySetDeltaSchema,
    lockfiles: CompareEntitySetDeltaSchema
  })
});

const coverageWarningCodes = new Set<z.infer<typeof AnalysisWarningCodeSchema>>([
  "TREE_TRUNCATED",
  "PAYLOAD_CAPPED",
  "MANIFEST_WITHOUT_LOCKFILE",
  "LOCKFILE_WITHOUT_MANIFEST",
  "UNSUPPORTED_FILE_KIND",
  "FILE_FETCH_SKIPPED",
  "FILE_PARSE_FAILED",
  "DECLARATION_ONLY_VERSION",
  "MULTIPLE_RESOLVED_VERSIONS",
  "ADVISORY_LOOKUP_PARTIAL",
  "ADVISORY_PROVIDER_FAILED",
  "REVIEW_SCOPE_LIMITED",
  "REVIEW_SELECTION_CAPPED",
  "REVIEW_FILE_SKIPPED"
]);

function sortStrings(values: Iterable<string>): string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function createWarningDeduplicationKey(warning: z.infer<typeof AnalysisWarningSchema>): string {
  return [
    warning.code,
    warning.stage,
    sortStrings(warning.paths).join("|"),
    warning.source ?? "",
    warning.message
  ].join("::");
}

export function createAnalysisWarning(input: {
  code: z.infer<typeof AnalysisWarningCodeSchema>;
  message: string;
  paths?: string[];
  severity?: z.infer<typeof AnalysisWarningSeveritySchema>;
  source?: string | null;
  stage: z.infer<typeof AnalysisWarningStageSchema>;
}): z.infer<typeof AnalysisWarningSchema> {
  return AnalysisWarningSchema.parse({
    code: input.code,
    message: input.message,
    paths: sortStrings(
      new Set((input.paths ?? []).filter((path) => path.trim().length > 0))
    ),
    severity: input.severity ?? "warning",
    source: input.source ?? null,
    stage: input.stage
  });
}

export function dedupeAnalysisWarnings(
  warnings: z.infer<typeof AnalysisWarningSchema>[]
): z.infer<typeof AnalysisWarningSchema>[] {
  const deduped = new Map<string, z.infer<typeof AnalysisWarningSchema>>();

  for (const warning of warnings) {
    if (warning.message.trim().length === 0) {
      continue;
    }

    deduped.set(createWarningDeduplicationKey(warning), warning);
  }

  return [...deduped.values()].sort((left, right) => {
    const leftKey = [
      left.stage,
      left.code,
      left.paths.join("|"),
      left.source ?? "",
      left.message
    ].join("::");
    const rightKey = [
      right.stage,
      right.code,
      right.paths.join("|"),
      right.source ?? "",
      right.message
    ].join("::");

    return leftKey.localeCompare(rightKey);
  });
}

export function getWarningMessages(
  warnings: z.infer<typeof AnalysisWarningSchema>[]
): string[] {
  return sortStrings(new Set(warnings.map((warning) => warning.message)));
}

export function isCoverageWarningCode(
  code: z.infer<typeof AnalysisWarningCodeSchema>
): boolean {
  return coverageWarningCodes.has(code);
}

export function hasCoverageWarnings(
  warnings: z.infer<typeof AnalysisWarningSchema>[]
): boolean {
  return warnings.some((warning) => isCoverageWarningCode(warning.code));
}

export type NormalizedRepoInput = z.infer<typeof NormalizedRepoInputSchema>;
export type AnalyzeRepoRequest = z.infer<typeof AnalyzeRepoRequestSchema>;
export type AnalysisWarningCode = z.infer<typeof AnalysisWarningCodeSchema>;
export type AnalysisWarningStage = z.infer<typeof AnalysisWarningStageSchema>;
export type AnalysisWarningSeverity = z.infer<typeof AnalysisWarningSeveritySchema>;
export type AnalysisWarning = z.infer<typeof AnalysisWarningSchema>;
export type RepositoryMetadata = z.infer<typeof RepositoryMetadataSchema>;
export type RepositoryTreeEntry = z.infer<typeof RepositoryTreeEntrySchema>;
export type RepositoryTreeSummary = z.infer<typeof RepositoryTreeSummarySchema>;
export type EcosystemId = z.infer<typeof EcosystemIdSchema>;
export type PackageManagerId = z.infer<typeof PackageManagerIdSchema>;
export type ManifestKind = z.infer<typeof ManifestKindSchema>;
export type LockfileKind = z.infer<typeof LockfileKindSchema>;
export type SignalKind = z.infer<typeof SignalKindSchema>;
export type DetectedManifest = z.infer<typeof DetectedManifestSchema>;
export type DetectedLockfile = z.infer<typeof DetectedLockfileSchema>;
export type DetectedSignal = z.infer<typeof DetectedSignalSchema>;
export type DetectedEcosystem = z.infer<typeof DetectedEcosystemSchema>;
export type ManifestCountByEcosystem = z.infer<
  typeof ManifestCountByEcosystemSchema
>;
export type EcosystemDetection = z.infer<typeof EcosystemDetectionSchema>;
export type RepositoryIntakeSnapshot = z.infer<
  typeof RepositoryIntakeSnapshotSchema
>;
export type PublicTreeSummary = z.infer<typeof PublicTreeSummarySchema>;
export type DetectedFileGroup = z.infer<typeof DetectedFileGroupSchema>;
export type DetectedFiles = z.infer<typeof DetectedFilesSchema>;
export type DependencyType = z.infer<typeof DependencyTypeSchema>;
export type ParseConfidence = z.infer<typeof ParseConfidenceSchema>;
export type DependencyFileKind = z.infer<typeof DependencyFileKindSchema>;
export type NormalizedDependency = z.infer<typeof NormalizedDependencySchema>;
export type ParsedDependencyFile = z.infer<typeof ParsedDependencyFileSchema>;
export type SkippedDependencyFile = z.infer<typeof SkippedDependencyFileSchema>;
export type DependencySummaryByEcosystem = z.infer<
  typeof DependencySummaryByEcosystemSchema
>;
export type DependencySnapshotSummary = z.infer<
  typeof DependencySnapshotSummarySchema
>;
export type DependencySnapshot = z.infer<typeof DependencySnapshotSchema>;
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;
export type FindingConfidence = z.infer<typeof FindingConfidenceSchema>;
export type FindingSourceType = z.infer<typeof FindingSourceTypeSchema>;
export type FindingEvidence = z.infer<typeof FindingEvidenceSchema>;
export type FindingLineSpan = z.infer<typeof FindingLineSpanSchema>;
export type AdvisoryReference = z.infer<typeof AdvisoryReferenceSchema>;
export type DependencyFinding = z.infer<typeof DependencyFindingSchema>;
export type FindingsBySeverity = z.infer<typeof FindingsBySeveritySchema>;
export type DependencyFindingSummary = z.infer<
  typeof DependencyFindingSummarySchema
>;
export type CodeReviewFinding = z.infer<typeof CodeReviewFindingSchema>;
export type CodeReviewFindingSummary = z.infer<
  typeof CodeReviewFindingSummarySchema
>;
export type ReviewCoverage = z.infer<typeof ReviewCoverageSchema>;
export type IssueCandidateType = z.infer<typeof IssueCandidateTypeSchema>;
export type IssueCandidateScope = z.infer<typeof IssueCandidateScopeSchema>;
export type IssueCandidate = z.infer<typeof IssueCandidateSchema>;
export type IssueCandidateCountByType = z.infer<
  typeof IssueCandidateCountByTypeSchema
>;
export type IssueCandidateSummary = z.infer<typeof IssueCandidateSummarySchema>;
export type PRCandidateType = z.infer<typeof PRCandidateTypeSchema>;
export type PRCandidateRiskLevel = z.infer<typeof PRCandidateRiskLevelSchema>;
export type PRCandidateReadiness = z.infer<typeof PRCandidateReadinessSchema>;
export type PRCandidateChangeType = z.infer<typeof PRCandidateChangeTypeSchema>;
export type PRCandidateExpectedFileChange = z.infer<
  typeof PRCandidateExpectedFileChangeSchema
>;
export type PRCandidate = z.infer<typeof PRCandidateSchema>;
export type PRCandidateCountByType = z.infer<typeof PRCandidateCountByTypeSchema>;
export type PRCandidateCountByReadiness = z.infer<
  typeof PRCandidateCountByReadinessSchema
>;
export type PRCandidateCountByRiskLevel = z.infer<
  typeof PRCandidateCountByRiskLevelSchema
>;
export type PRCandidateSummary = z.infer<typeof PRCandidateSummarySchema>;
export type PRPatchability = z.infer<typeof PRPatchabilitySchema>;
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;
export type PRPatchPlanFile = z.infer<typeof PRPatchPlanFileSchema>;
export type PatchPlan = z.infer<typeof PatchPlanSchema>;
export type PRWriteBackEligibilityStatus = z.infer<
  typeof PRWriteBackEligibilityStatusSchema
>;
export type PRWriteBackEligibility = z.infer<typeof PRWriteBackEligibilitySchema>;
export type PRPatchPlan = z.infer<typeof PRPatchPlanSchema>;
export type PRPatchPlanCountByPatchability = z.infer<
  typeof PRPatchPlanCountByPatchabilitySchema
>;
export type PRPatchPlanCountByValidationStatus = z.infer<
  typeof PRPatchPlanCountByValidationStatusSchema
>;
export type PRPatchPlanSummary = z.infer<typeof PRPatchPlanSummarySchema>;
export type ExecutionMode = z.infer<typeof ExecutionModeSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type ExecutionActionType = z.infer<typeof ExecutionActionTypeSchema>;
export type ExecutionTargetType = z.infer<typeof ExecutionTargetTypeSchema>;
export type ExecutionEligibility = z.infer<typeof ExecutionEligibilitySchema>;
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;
export type ExecutionPlanLifecycleStatus = z.infer<
  typeof ExecutionPlanLifecycleStatusSchema
>;
export type ExecutionPlanningContext = z.infer<
  typeof ExecutionPlanningContextSchema
>;
export type ExecutionPlanRequest = z.infer<typeof ExecutionPlanRequestSchema>;
export type ExecutionExecuteRequest = z.infer<typeof ExecutionExecuteRequestSchema>;
export type ApprovalRequirement = z.infer<typeof ApprovalRequirementSchema>;
export type ExecutionPlanResponse = z.infer<typeof ExecutionPlanResponseSchema>;
export type ExecutionActionPlan = z.infer<typeof ExecutionActionPlanSchema>;
export type ExecutionSummary = z.infer<typeof ExecutionSummarySchema>;
export type ExecutionResultSummary = z.infer<typeof ExecutionResultSummarySchema>;
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export type PersistedExecutionAction = z.infer<
  typeof PersistedExecutionActionSchema
>;
export type ExecutionPlanDetailApproval = z.infer<
  typeof ExecutionPlanDetailApprovalSchema
>;
export type ExecutionPlanDetailResponse = z.infer<
  typeof ExecutionPlanDetailResponseSchema
>;
export type ExecutionPlanStatusEventType = z.infer<
  typeof ExecutionPlanStatusEventTypeSchema
>;
export type ExecutionPlanStatusEvent = z.infer<
  typeof ExecutionPlanStatusEventSchema
>;
export type ExecutionPlanEventsResponse = z.infer<
  typeof ExecutionPlanEventsResponseSchema
>;
export type AnalyzeRepoResponse = z.infer<typeof AnalyzeRepoResponseSchema>;
export type SavedAnalysisRunSummary = z.infer<
  typeof SavedAnalysisRunSummarySchema
>;
export type SavedAnalysisRun = z.infer<typeof SavedAnalysisRunSchema>;
export type SaveAnalysisRunRequest = z.infer<
  typeof SaveAnalysisRunRequestSchema
>;
export type SaveAnalysisRunResponse = z.infer<
  typeof SaveAnalysisRunResponseSchema
>;
export type ListAnalysisRunsResponse = z.infer<
  typeof ListAnalysisRunsResponseSchema
>;
export type GetAnalysisRunResponse = z.infer<
  typeof GetAnalysisRunResponseSchema
>;
export type TrackedRepository = z.infer<typeof TrackedRepositorySchema>;
export type CreateTrackedRepositoryRequest = z.infer<
  typeof CreateTrackedRepositoryRequestSchema
>;
export type CreateTrackedRepositoryResponse = z.infer<
  typeof CreateTrackedRepositoryResponseSchema
>;
export type ListTrackedRepositoriesResponse = z.infer<
  typeof ListTrackedRepositoriesResponseSchema
>;
export type AnalysisJobKind = z.infer<typeof AnalysisJobKindSchema>;
export type AnalysisJobStatus = z.infer<typeof AnalysisJobStatusSchema>;
export type AnalysisJob = z.infer<typeof AnalysisJobSchema>;
export type EnqueueAnalysisJobRequest = z.infer<
  typeof EnqueueAnalysisJobRequestSchema
>;
export type EnqueueAnalysisJobResponse = z.infer<
  typeof EnqueueAnalysisJobResponseSchema
>;
export type GetAnalysisJobResponse = z.infer<typeof GetAnalysisJobResponseSchema>;
export type ListAnalysisJobsResponse = z.infer<typeof ListAnalysisJobsResponseSchema>;
export type RetryAnalysisJobResponse = z.infer<typeof RetryAnalysisJobResponseSchema>;
export type CancelAnalysisJobResponse = z.infer<
  typeof CancelAnalysisJobResponseSchema
>;
export type AsyncPlanSelectionStrategy = z.infer<
  typeof AsyncPlanSelectionStrategySchema
>;
export type EnqueueExecutionPlanJobRequest = z.infer<
  typeof EnqueueExecutionPlanJobRequestSchema
>;
export type EnqueueExecutionPlanJobResponse = z.infer<
  typeof EnqueueExecutionPlanJobResponseSchema
>;
export type SweepCadence = z.infer<typeof SweepCadenceSchema>;
export type SweepSelectionStrategy = z.infer<typeof SweepSelectionStrategySchema>;
export type SweepSchedule = z.infer<typeof SweepScheduleSchema>;
export type CreateSweepScheduleRequest = z.infer<
  typeof CreateSweepScheduleRequestSchema
>;
export type CreateSweepScheduleResponse = z.infer<
  typeof CreateSweepScheduleResponseSchema
>;
export type ListSweepSchedulesResponse = z.infer<
  typeof ListSweepSchedulesResponseSchema
>;
export type TriggerSweepScheduleResponse = z.infer<
  typeof TriggerSweepScheduleResponseSchema
>;
export type TrackedPullRequestLifecycleStatus = z.infer<
  typeof TrackedPullRequestLifecycleStatusSchema
>;
export type TrackedPullRequest = z.infer<typeof TrackedPullRequestSchema>;
export type FleetTrackedRepositoryStatus = z.infer<
  typeof FleetTrackedRepositoryStatusSchema
>;
export type FleetStatusResponse = z.infer<typeof FleetStatusResponseSchema>;
export type ExecutionPlanSummary = z.infer<typeof ExecutionPlanSummarySchema>;
export type RepositoryActivityKind = z.infer<typeof RepositoryActivityKindSchema>;
export type RepositoryActivityEvent = z.infer<typeof RepositoryActivityEventSchema>;
export type RepositoryActivityFeed = z.infer<typeof RepositoryActivityFeedSchema>;
export type RepositoryTimelineExpansionMode = z.infer<
  typeof RepositoryTimelineExpansionModeSchema
>;
export type RepositoryTimelinePage = z.infer<typeof RepositoryTimelinePageSchema>;
export type TrackedRepositoryHistoryResponse = z.infer<
  typeof TrackedRepositoryHistoryResponseSchema
>;
export type CompareAnalysisRunsRequest = z.infer<
  typeof CompareAnalysisRunsRequestSchema
>;
export type CompareMetricDelta = z.infer<typeof CompareMetricDeltaSchema>;
export type CompareEntitySetDelta = z.infer<
  typeof CompareEntitySetDeltaSchema
>;
export type CompareAnalysisRunsResponse = z.infer<
  typeof CompareAnalysisRunsResponseSchema
>;

export const ExecutionPlanLifecycleStatusValues =
  ExecutionPlanLifecycleStatusSchema.options;
export const ExecutionPlanStatusEventTypeValues =
  ExecutionPlanStatusEventTypeSchema.options;
export const AnalysisJobStatusValues = AnalysisJobStatusSchema.options;
