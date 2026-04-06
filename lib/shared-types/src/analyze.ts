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
  warnings: z.array(z.string())
});

export const RepositoryIntakeSnapshotSchema = z.object({
  repository: RepositoryMetadataSchema,
  treeSummary: RepositoryTreeSummarySchema,
  treeEntries: z.array(RepositoryTreeEntrySchema),
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

export const AnalyzeRepoResponseSchema = z.object({
  repository: RepositoryMetadataSchema,
  treeSummary: PublicTreeSummarySchema,
  detectedFiles: DetectedFilesSchema,
  ecosystems: z.array(DetectedEcosystemSchema),
  warnings: z.array(z.string()),
  isPartial: z.boolean(),
  fetchedAt: z.string().datetime()
});

export type NormalizedRepoInput = z.infer<typeof NormalizedRepoInputSchema>;
export type AnalyzeRepoRequest = z.infer<typeof AnalyzeRepoRequestSchema>;
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
export type AnalyzeRepoResponse = z.infer<typeof AnalyzeRepoResponseSchema>;
