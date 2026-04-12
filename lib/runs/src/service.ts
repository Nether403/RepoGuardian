import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  AnalyzeRepoResponse,
  CompareAnalysisRunsResponse,
  CompareEntitySetDelta,
  CompareMetricDelta,
  FindingSeverity,
  FindingsBySeverity,
  SavedAnalysisRun,
  SavedAnalysisRunSummary,
  SaveAnalysisRunResponse
} from "@repo-guardian/shared-types";
import {
  CompareAnalysisRunsResponseSchema,
  SavedAnalysisRunSchema,
  SaveAnalysisRunResponseSchema
} from "@repo-guardian/shared-types";

export type AnalysisRunStoreErrorCode = "invalid_run_id" | "not_found";

export class AnalysisRunStoreError extends Error {
  readonly code: AnalysisRunStoreErrorCode;

  constructor(code: AnalysisRunStoreErrorCode, message: string) {
    super(message);
    this.name = "AnalysisRunStoreError";
    this.code = code;
  }
}

export function isAnalysisRunStoreError(
  error: unknown
): error is AnalysisRunStoreError {
  return error instanceof AnalysisRunStoreError;
}

function createEmptySeverityCounts(): FindingsBySeverity {
  return {
    critical: 0,
    high: 0,
    info: 0,
    low: 0,
    medium: 0
  };
}

function isHighSeverity(severity: FindingSeverity): boolean {
  return severity === "critical" || severity === "high";
}

function countFindingsBySeverity(analysis: AnalyzeRepoResponse): FindingsBySeverity {
  const counts = createEmptySeverityCounts();

  for (const finding of [
    ...analysis.dependencyFindings,
    ...analysis.codeReviewFindings
  ]) {
    counts[finding.severity] += 1;
  }

  return counts;
}

function getAllFindingIds(analysis: AnalyzeRepoResponse): string[] {
  return [
    ...analysis.dependencyFindings.map((finding) => finding.id),
    ...analysis.codeReviewFindings.map((finding) => finding.id)
  ].sort((left, right) => left.localeCompare(right));
}

function countExecutablePatchPlans(analysis: AnalyzeRepoResponse): number {
  return analysis.prPatchPlans.filter(
    (plan) => plan.writeBackEligibility?.status === "executable"
  ).length;
}

function createMetricDelta(base: number, target: number): CompareMetricDelta {
  return {
    base,
    delta: target - base,
    target
  };
}

function compareSets(
  baseValues: Iterable<string>,
  targetValues: Iterable<string>
): CompareEntitySetDelta {
  const base = new Set(baseValues);
  const target = new Set(targetValues);
  const added = [...target].filter((value) => !base.has(value));
  const removed = [...base].filter((value) => !target.has(value));
  const unchanged = [...target].filter((value) => base.has(value));

  return {
    added: added.sort((left, right) => left.localeCompare(right)),
    removed: removed.sort((left, right) => left.localeCompare(right)),
    unchanged: unchanged.sort((left, right) => left.localeCompare(right))
  };
}

function normalizeLabel(label: string | null | undefined): string | null {
  const trimmed = label?.trim();

  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function sanitizeRunSegment(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);

  return sanitized.length > 0 ? sanitized : "analysis";
}

export function createRunId(
  analysis: AnalyzeRepoResponse,
  createdAt: string,
  uuidFactory: () => string = randomUUID
): string {
  const repository = sanitizeRunSegment(analysis.repository.fullName);
  const timestamp = createdAt.replace(/[^0-9]/gu, "").slice(0, 14);
  const suffix = uuidFactory().slice(0, 8);

  return `${repository}-${timestamp}-${suffix}`;
}

function assertValidRunId(runId: string): void {
  if (!/^[a-z0-9._-]+$/iu.test(runId)) {
    throw new AnalysisRunStoreError(
      "invalid_run_id",
      "Saved analysis run id is invalid."
    );
  }
}

export function createAnalysisRunSummary(
  run: SavedAnalysisRun
): SavedAnalysisRunSummary {
  const totalFindings =
    run.analysis.dependencyFindings.length + run.analysis.codeReviewFindings.length;
  const highSeverityFindings = [
    ...run.analysis.dependencyFindings,
    ...run.analysis.codeReviewFindings
  ].filter((finding) => isHighSeverity(finding.severity)).length;
  const executablePatchPlans = countExecutablePatchPlans(run.analysis);

  return {
    blockedPatchPlans: run.analysis.prPatchPlans.length - executablePatchPlans,
    createdAt: run.createdAt,
    defaultBranch: run.analysis.repository.defaultBranch,
    executablePatchPlans,
    fetchedAt: run.analysis.fetchedAt,
    highSeverityFindings,
    id: run.id,
    issueCandidates: run.analysis.issueCandidates.length,
    label: run.label,
    prCandidates: run.analysis.prCandidates.length,
    repositoryFullName: run.analysis.repository.fullName,
    totalFindings
  };
}

export function compareAnalysisRuns(
  baseRun: SavedAnalysisRun,
  targetRun: SavedAnalysisRun
): CompareAnalysisRunsResponse {
  const baseSummary = createAnalysisRunSummary(baseRun);
  const targetSummary = createAnalysisRunSummary(targetRun);
  const response: CompareAnalysisRunsResponse = {
    baseRun: baseSummary,
    candidates: {
      blockedPatchPlans: createMetricDelta(
        baseSummary.blockedPatchPlans,
        targetSummary.blockedPatchPlans
      ),
      executablePatchPlans: createMetricDelta(
        baseSummary.executablePatchPlans,
        targetSummary.executablePatchPlans
      ),
      issueCandidates: createMetricDelta(
        baseSummary.issueCandidates,
        targetSummary.issueCandidates
      ),
      prCandidates: createMetricDelta(
        baseSummary.prCandidates,
        targetSummary.prCandidates
      )
    },
    findings: {
      bySeverity: {
        base: countFindingsBySeverity(baseRun.analysis),
        target: countFindingsBySeverity(targetRun.analysis)
      },
      newFindingIds: compareSets(
        getAllFindingIds(baseRun.analysis),
        getAllFindingIds(targetRun.analysis)
      ).added,
      resolvedFindingIds: compareSets(
        getAllFindingIds(baseRun.analysis),
        getAllFindingIds(targetRun.analysis)
      ).removed,
      total: createMetricDelta(baseSummary.totalFindings, targetSummary.totalFindings)
    },
    repository: {
      baseRepositoryFullName: baseSummary.repositoryFullName,
      sameRepository:
        baseSummary.repositoryFullName === targetSummary.repositoryFullName,
      targetRepositoryFullName: targetSummary.repositoryFullName
    },
    structure: {
      ecosystems: compareSets(
        baseRun.analysis.ecosystems.map((ecosystem) => ecosystem.ecosystem),
        targetRun.analysis.ecosystems.map((ecosystem) => ecosystem.ecosystem)
      ),
      lockfiles: compareSets(
        baseRun.analysis.detectedFiles.lockfiles.map((lockfile) => lockfile.path),
        targetRun.analysis.detectedFiles.lockfiles.map((lockfile) => lockfile.path)
      ),
      manifests: compareSets(
        baseRun.analysis.detectedFiles.manifests.map((manifest) => manifest.path),
        targetRun.analysis.detectedFiles.manifests.map((manifest) => manifest.path)
      )
    },
    targetRun: targetSummary
  };

  return CompareAnalysisRunsResponseSchema.parse(response);
}

export type FileAnalysisRunStoreOptions = {
  rootDir: string;
};

export class FileAnalysisRunStore {
  private readonly rootDir: string;

  constructor(options: FileAnalysisRunStoreOptions) {
    this.rootDir = options.rootDir;
  }

  private getRunPath(runId: string): string {
    assertValidRunId(runId);

    return join(this.rootDir, `${runId}.json`);
  }

  private async readRun(runId: string): Promise<SavedAnalysisRun> {
    try {
      const content = await readFile(this.getRunPath(runId), "utf8");

      return SavedAnalysisRunSchema.parse(JSON.parse(content));
    } catch (error) {
      if (
        error instanceof AnalysisRunStoreError ||
        (error instanceof Error && "code" in error && error.code === "ENOENT")
      ) {
        throw new AnalysisRunStoreError(
          error instanceof AnalysisRunStoreError ? error.code : "not_found",
          error instanceof AnalysisRunStoreError
            ? error.message
            : "Saved analysis run was not found."
        );
      }

      throw error;
    }
  }

  async saveRun(input: {
    analysis: AnalyzeRepoResponse;
    label?: string | null;
  }): Promise<SaveAnalysisRunResponse> {
    await mkdir(this.rootDir, { recursive: true });

    const createdAt = new Date().toISOString();
    const run: SavedAnalysisRun = {
      analysis: input.analysis,
      createdAt,
      id: createRunId(input.analysis, createdAt),
      label: normalizeLabel(input.label)
    };

    await writeFile(
      this.getRunPath(run.id),
      `${JSON.stringify(SavedAnalysisRunSchema.parse(run), null, 2)}\n`,
      "utf8"
    );

    return SaveAnalysisRunResponseSchema.parse({
      run,
      summary: createAnalysisRunSummary(run)
    });
  }

  async listRuns(): Promise<SavedAnalysisRunSummary[]> {
    let entries: string[];

    try {
      entries = await readdir(this.rootDir);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return [];
      }

      throw error;
    }

    const runIds = entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => entry.slice(0, -".json".length));
    const summaries = await Promise.all(
      runIds.map(async (runId) => createAnalysisRunSummary(await this.readRun(runId)))
    );

    return summaries.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }

  async getRun(runId: string): Promise<SaveAnalysisRunResponse> {
    const run = await this.readRun(runId);

    return SaveAnalysisRunResponseSchema.parse({
      run,
      summary: createAnalysisRunSummary(run)
    });
  }

  async compareRuns(input: {
    baseRunId: string;
    targetRunId: string;
  }): Promise<CompareAnalysisRunsResponse> {
    const [baseRun, targetRun] = await Promise.all([
      this.readRun(input.baseRunId),
      this.readRun(input.targetRunId)
    ]);

    return compareAnalysisRuns(baseRun, targetRun);
  }
}
