import { useState, type FormEvent } from "react";
import type {
  AnalyzeRepoResponse,
  CompareAnalysisRunsResponse,
  ExecutionPlanResponse,
  ExecutionResult,
  SavedAnalysisRunSummary
} from "@repo-guardian/shared-types";
import { CompareRunsPanel } from "./components/CompareRunsPanel";
import { EcosystemPanel } from "./components/EcosystemPanel";
import { ExecutionPlannerPanel } from "./components/ExecutionPlannerPanel";
import { ExecutionResultsPanel } from "./components/ExecutionResultsPanel";
import { GuardianGraphPanel } from "./components/GuardianGraphPanel";
import { IssueCandidatesPanel } from "./components/IssueCandidatesPanel";
import { PageShell } from "./components/PageShell";
import { Panel } from "./components/Panel";
import { PRCandidatesPanel } from "./components/PRCandidatesPanel";
import { RepoInputForm } from "./components/RepoInputForm";
import { RepositorySummaryPanel } from "./components/RepositorySummaryPanel";
import { SavedRunsPanel } from "./components/SavedRunsPanel";
import { StatusBadge } from "./components/StatusBadge";
import { TraceabilityPanel } from "./components/TraceabilityPanel";
import { PartialAnalysisPanel, WarningsPanel } from "./components/WarningsPanel";
import {
  buildTraceabilityMapSummary,
  filterPatchPlans,
  getCandidateTypeFilterOptions,
  summarizeWriteBackReadiness,
  updateSelectedIds
} from "./features/analysis/selectors";
import type {
  CandidateTypeFilter,
  EligibilityFilter
} from "./features/analysis/types";
import {
  buildEmptyTraceabilityViewModel,
  buildTraceabilityViewModel,
  formatTimestamp
} from "./features/analysis/view-model";
import {
  AnalyzeRepoClientError,
  analyzeRepository
} from "./lib/api-client";
import {
  requestExecutionPlan,
  requestExecutionExecute
} from "./lib/execution-client";
import {
  compareSavedAnalysisRuns,
  getSavedAnalysisRun,
  listSavedAnalysisRuns,
  saveAnalysisRun,
  SavedRunsClientError
} from "./lib/runs-client";

function App() {
  const [analysis, setAnalysis] = useState<AnalyzeRepoResponse | null>(null);
  const [approvalGranted, setApprovalGranted] = useState(false);
  const [candidateTypeFilter, setCandidateTypeFilter] =
    useState<CandidateTypeFilter>("all");
  const [eligibilityFilter, setEligibilityFilter] =
    useState<EligibilityFilter>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executionErrorMessage, setExecutionErrorMessage] = useState<string | null>(
    null
  );
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlanResponse | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(
    null
  );
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [baseRunId, setBaseRunId] = useState("");
  const [compareResult, setCompareResult] =
    useState<CompareAnalysisRunsResponse | null>(null);
  const [isExecutionPlanLoading, setIsExecutionPlanLoading] = useState(false);
  const [isExecutionExecuteLoading, setIsExecutionExecuteLoading] = useState(false);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpeningRun, setIsOpeningRun] = useState(false);
  const [isSavedRunsLoading, setIsSavedRunsLoading] = useState(false);
  const [isSavingRun, setIsSavingRun] = useState(false);
  const [repoInput, setRepoInput] = useState("");
  const [savedRuns, setSavedRuns] = useState<SavedAnalysisRunSummary[]>([]);
  const [savedRunsErrorMessage, setSavedRunsErrorMessage] = useState<string | null>(
    null
  );
  const [selectedIssueCandidateIds, setSelectedIssueCandidateIds] = useState<
    string[]
  >([]);
  const [selectedPRCandidateIds, setSelectedPRCandidateIds] = useState<string[]>(
    []
  );
  const [targetRunId, setTargetRunId] = useState("");

  const statusLabel = isLoading
    ? "Analyzing snapshot"
    : analysis
      ? "Analysis ready"
      : "Ready for intake";
  const statusTone = analysis ? "active" : isLoading ? "warning" : "muted";
  const helperText = isLoading
    ? "Fetching the repository snapshot, recursive tree, and ecosystem signals."
    : analysis
      ? `Snapshot fetched ${formatTimestamp(analysis.fetchedAt)}.`
      : "Paste a public GitHub repository and Repo Guardian will inspect the current default-branch snapshot.";
  const visiblePatchPlans = analysis
    ? filterPatchPlans({
        candidateTypeFilter,
        eligibilityFilter,
        patchPlans: analysis.prPatchPlans
      })
    : [];
  const candidateTypeFilterOptions = analysis
    ? getCandidateTypeFilterOptions(analysis.prPatchPlans)
    : [];
  const writeBackReadinessSummary =
    analysis && visiblePatchPlans
      ? summarizeWriteBackReadiness(visiblePatchPlans)
      : null;
  const traceability = analysis
    ? buildTraceabilityViewModel(analysis, visiblePatchPlans)
    : buildEmptyTraceabilityViewModel();
  const traceabilityMapSummary = analysis
    ? buildTraceabilityMapSummary(traceability)
    : [];

  function resetExecutionState() {
    setApprovalGranted(false);
    setExecutionErrorMessage(null);
    setExecutionPlan(null);
    setExecutionResult(null);
    setIsExecutionPlanLoading(false);
    setIsExecutionExecuteLoading(false);
    setSelectedIssueCandidateIds([]);
    setSelectedPRCandidateIds([]);
  }

  function applySavedRuns(nextRuns: SavedAnalysisRunSummary[]) {
    setSavedRuns(nextRuns);
    setBaseRunId((currentRunId) =>
      currentRunId && nextRuns.some((run) => run.id === currentRunId)
        ? currentRunId
        : (nextRuns[1]?.id ?? nextRuns[0]?.id ?? "")
    );
    setTargetRunId((currentRunId) =>
      currentRunId && nextRuns.some((run) => run.id === currentRunId)
        ? currentRunId
        : (nextRuns[0]?.id ?? "")
    );
  }

  async function handleRefreshSavedRuns() {
    setSavedRunsErrorMessage(null);
    setIsSavedRunsLoading(true);

    try {
      const response = await listSavedAnalysisRuns();
      applySavedRuns(response.runs);
    } catch (error) {
      setSavedRunsErrorMessage(
        error instanceof SavedRunsClientError
          ? error.message
          : "Repo Guardian could not load saved analysis runs."
      );
    } finally {
      setIsSavedRunsLoading(false);
    }
  }

  async function handleSaveCurrentRun(label: string | null) {
    if (!analysis) {
      setSavedRunsErrorMessage("Analyze or reopen a repository before saving a run.");
      return;
    }

    setSavedRunsErrorMessage(null);
    setIsSavingRun(true);

    try {
      const response = await saveAnalysisRun({
        analysis,
        label
      });
      const nextRuns = [
        response.summary,
        ...savedRuns.filter((run) => run.id !== response.summary.id)
      ];
      applySavedRuns(nextRuns);
      setTargetRunId(response.summary.id);
    } catch (error) {
      setSavedRunsErrorMessage(
        error instanceof SavedRunsClientError
          ? error.message
          : "Repo Guardian could not save the current analysis run."
      );
    } finally {
      setIsSavingRun(false);
    }
  }

  async function handleOpenSavedRun(runId: string) {
    setSavedRunsErrorMessage(null);
    setIsOpeningRun(true);

    try {
      const response = await getSavedAnalysisRun(runId);
      setAnalysis(response.run.analysis);
      setRepoInput(response.summary.repositoryFullName);
      setHasSubmitted(true);
      setCompareResult(null);
      setEligibilityFilter("all");
      setCandidateTypeFilter("all");
      resetExecutionState();
    } catch (error) {
      setSavedRunsErrorMessage(
        error instanceof SavedRunsClientError
          ? error.message
          : "Repo Guardian could not reopen the saved analysis run."
      );
    } finally {
      setIsOpeningRun(false);
    }
  }

  async function handleCompareSavedRuns() {
    if (!baseRunId || !targetRunId) {
      setSavedRunsErrorMessage("Select a base run and target run before comparing.");
      return;
    }

    if (baseRunId === targetRunId) {
      setSavedRunsErrorMessage("Select two different saved runs before comparing.");
      return;
    }

    setSavedRunsErrorMessage(null);
    setIsCompareLoading(true);

    try {
      setCompareResult(
        await compareSavedAnalysisRuns({
          baseRunId,
          targetRunId
        })
      );
    } catch (error) {
      setSavedRunsErrorMessage(
        error instanceof SavedRunsClientError
          ? error.message
          : "Repo Guardian could not compare the selected saved runs."
      );
    } finally {
      setIsCompareLoading(false);
    }
  }

  function handleIssueCandidateSelection(candidateId: string, selected: boolean) {
    setSelectedIssueCandidateIds((currentIds) =>
      updateSelectedIds(currentIds, candidateId, selected)
    );
    setExecutionErrorMessage(null);
  }

  function handlePRCandidateSelection(candidateId: string, selected: boolean) {
    setSelectedPRCandidateIds((currentIds) =>
      updateSelectedIds(currentIds, candidateId, selected)
    );
    setExecutionErrorMessage(null);
  }

  async function handleRequestPlan() {
    if (!analysis) {
      return;
    }

    if (
      selectedIssueCandidateIds.length === 0 &&
      selectedPRCandidateIds.length === 0
    ) {
      setExecutionErrorMessage("Select at least one issue or PR candidate first.");
      return;
    }

    setExecutionErrorMessage(null);
    setExecutionPlan(null);
    setExecutionResult(null);
    setIsExecutionPlanLoading(true);

    try {
      // NOTE: We MUST have a saved run ID for execution planning.
      // If we don't have targetRunId, we will save the run right now automatically.
      let runIdToUse = targetRunId;
      if (!runIdToUse) {
        const response = await saveAnalysisRun({
          analysis,
          label: "Auto-saved for Execution Planning"
        });
        const nextRuns = [
          response.summary,
          ...savedRuns.filter((run) => run.id !== response.summary.id)
        ];
        applySavedRuns(nextRuns);
        setTargetRunId(response.summary.id);
        runIdToUse = response.summary.id;
      }

      const plan = await requestExecutionPlan({
        analysisRunId: runIdToUse,
        selectedIssueCandidateIds,
        selectedPRCandidateIds
      });

      setExecutionPlan(plan);
      setApprovalGranted(false);
    } catch (error) {
      setExecutionErrorMessage(
        error instanceof Error
          ? error.message
          : "Repo Guardian could not complete the execution plan request."
      );
    } finally {
      setIsExecutionPlanLoading(false);
    }
  }

  async function handleRequestExecute() {
    if (!executionPlan) return;

    if (!approvalGranted) {
      setExecutionErrorMessage("Explicit approval is required before execution.");
      return;
    }

    setExecutionErrorMessage(null);
    setIsExecutionExecuteLoading(true);

    try {
      const result = await requestExecutionExecute({
        planId: executionPlan.planId,
        planHash: executionPlan.planHash,
        approvalToken: executionPlan.approvalToken,
        confirm: true,
        confirmationText: "I approve this GitHub write-back plan."
      });

      setExecutionResult(result);
    } catch (error) {
      setExecutionErrorMessage(
        error instanceof Error
          ? error.message
          : "Repo Guardian could not execute the approved plan."
      );
    } finally {
      setIsExecutionExecuteLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setIsLoading(true);
    setErrorMessage(null);
    setCompareResult(null);

    try {
      const nextAnalysis = await analyzeRepository(repoInput);
      setAnalysis(nextAnalysis);
      setEligibilityFilter("all");
      setCandidateTypeFilter("all");
      resetExecutionState();
    } catch (error) {
      setAnalysis(null);
      setEligibilityFilter("all");
      setCandidateTypeFilter("all");
      resetExecutionState();
      setErrorMessage(
        error instanceof AnalyzeRepoClientError
          ? error.message
          : "Repo Guardian could not complete the analysis request."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <PageShell
      aside={
        <div className="hero-stack">
          <StatusBadge label={statusLabel} tone={statusTone} />
          <p className="aside-copy">
            Analysis stays supervised. Repo Guardian can surface issue and PR
            write-back readiness, preview dry-run execution plans, and only write to
            GitHub after explicit approval for selected actions.
          </p>
          {analysis ? (
            <p className="aside-copy aside-copy-muted">
              Latest snapshot: {formatTimestamp(analysis.fetchedAt)}
            </p>
          ) : null}
        </div>
      }
      eyebrow="Approval-Gated Analysis"
      heading="Repo Guardian"
      summary="A supervised GitHub repository triage assistant that inspects public repositories, drafts findings and remediation candidates, and surfaces approval-gated GitHub write-back readiness before any execution step."
    >
      <Panel
        className="panel-wide"
        eyebrow="Repository Intake"
        footer={<StatusBadge label={statusLabel} tone={statusTone} />}
        title="Analyze a public GitHub repository"
      >
        <RepoInputForm
          errorMessage={errorMessage}
          helperText={helperText}
          isLoading={isLoading}
          onChange={setRepoInput}
          onSubmit={handleSubmit}
          value={repoInput}
        />
      </Panel>

      <SavedRunsPanel
        analysis={analysis}
        baseRunId={baseRunId}
        errorMessage={savedRunsErrorMessage}
        isComparing={isCompareLoading}
        isLoading={isSavedRunsLoading}
        isOpening={isOpeningRun}
        isSaving={isSavingRun}
        onBaseRunChange={setBaseRunId}
        onCompareRuns={handleCompareSavedRuns}
        onOpenRun={handleOpenSavedRun}
        onRefreshRuns={handleRefreshSavedRuns}
        onSaveCurrentRun={handleSaveCurrentRun}
        onTargetRunChange={setTargetRunId}
        runs={savedRuns}
        targetRunId={targetRunId}
      />
      <CompareRunsPanel comparison={compareResult} />

      {!hasSubmitted ? (
        <Panel
          className="panel-wide"
          eyebrow="Empty State"
          title="Start with one repository snapshot"
        >
          <div className="empty-state">
            <p className="empty-copy">
              Repo Guardian fetches the default branch, analyzes dependency and
              workflow risk signals, drafts issue and PR candidates, and shows
              approval-gated write-back readiness without performing any GitHub
              write actions.
            </p>
            <ul className="tag-list">
              <li>Repository summary, tree coverage, and notable paths</li>
              <li>Detected manifests, lockfiles, workflow files, and ecosystems</li>
              <li>
                Structured dependency and workflow findings with candidate
                remediation paths
              </li>
              <li>
                Pre-approval PR write-back readiness for supported issue and PR
                slices
              </li>
            </ul>
          </div>
        </Panel>
      ) : null}

      {analysis ? (
        <>
          <PartialAnalysisPanel isPartial={analysis.isPartial} />
          <RepositorySummaryPanel analysis={analysis} />
          <GuardianGraphPanel analysis={analysis} />
          {writeBackReadinessSummary ? (
            <TraceabilityPanel
              candidateTypeFilter={candidateTypeFilter}
              candidateTypeFilterOptions={candidateTypeFilterOptions}
              eligibilityFilter={eligibilityFilter}
              onCandidateTypeFilterChange={setCandidateTypeFilter}
              onEligibilityFilterChange={setEligibilityFilter}
              traceability={traceability}
              traceabilityMapSummary={traceabilityMapSummary}
              visiblePatchPlans={visiblePatchPlans}
              writeBackReadinessSummary={writeBackReadinessSummary}
            />
          ) : null}
          <IssueCandidatesPanel
            candidates={analysis.issueCandidates}
            onToggleCandidate={handleIssueCandidateSelection}
            selectedCandidateIds={selectedIssueCandidateIds}
          />
          <PRCandidatesPanel
            candidates={analysis.prCandidates}
            onToggleCandidate={handlePRCandidateSelection}
            patchPlans={analysis.prPatchPlans}
            selectedCandidateIds={selectedPRCandidateIds}
          />
          <ExecutionPlannerPanel
            approvalGranted={approvalGranted}
            executionErrorMessage={executionErrorMessage}
            executionPlan={executionPlan}
            isSubmittingPlan={isExecutionPlanLoading}
            isSubmittingExecute={isExecutionExecuteLoading}
            onApprovalChange={setApprovalGranted}
            onRequestPlan={handleRequestPlan}
            onRequestExecute={handleRequestExecute}
            selectedIssueCount={selectedIssueCandidateIds.length}
            selectedPRCount={selectedPRCandidateIds.length}
          />
          <ExecutionResultsPanel
            result={
              executionResult ||
              (executionPlan
                ? {
                    executionId: executionPlan.planId,
                    mode: "dry_run" as const,
                    status: "planned" as const,
                    approvalStatus: "required" as const,
                    approvalRequired: true,
                    approvalNotes: ["Dry-run plan generated; approval required for execution."],
                    startedAt: new Date().toISOString(),
                    completedAt: new Date().toISOString(),
                    summary: executionPlan.summary,
                    actions: executionPlan.actions,
                    errors: [],
                    warnings: []
                  }
                : null)
            }
          />
          <EcosystemPanel analysis={analysis} />
          <WarningsPanel analysis={analysis} />
        </>
      ) : null}
    </PageShell>
  );
}

export default App;
