import { useEffect, useRef, useState, type FormEvent } from "react";
import type {
  AnalysisJob,
  AnalyzeRepoResponse,
  CompareAnalysisRunsResponse,
  ExecutionPlanDetailResponse,
  ExecutionPlanEventsResponse,
  ExecutionPlanResponse,
  ExecutionResult,
  FleetStatusResponse,
  FleetTrackedRepositoryStatus,
  GetAnalysisRunResponse,
  SavedAnalysisRunSummary,
  SweepSchedule,
  TrackedRepositoryHistoryResponse,
  TrackedRepository
} from "@repo-guardian/shared-types";
import { AnalysisJobsPanel } from "./components/AnalysisJobsPanel";
import { AppModeToggle } from "./components/AppModeToggle";
import { CompareRunsPanel } from "./components/CompareRunsPanel";
import { EcosystemPanel } from "./components/EcosystemPanel";
import { ExecutionPlannerPanel } from "./components/ExecutionPlannerPanel";
import { ExecutionResultsPanel } from "./components/ExecutionResultsPanel";
import { FleetOverviewPanel } from "./components/FleetOverviewPanel";
import { FleetInspectorPanel } from "./components/FleetInspectorPanel";
import { GuardianGraphPanel } from "./components/GuardianGraphPanel";
import { IssueCandidatesPanel } from "./components/IssueCandidatesPanel";
import { PageShell } from "./components/PageShell";
import { Panel } from "./components/Panel";
import { PRCandidatesPanel } from "./components/PRCandidatesPanel";
import { RepoInputForm } from "./components/RepoInputForm";
import { RepositorySummaryPanel } from "./components/RepositorySummaryPanel";
import { SavedRunsPanel } from "./components/SavedRunsPanel";
import { StatusBadge } from "./components/StatusBadge";
import { SweepSchedulesPanel } from "./components/SweepSchedulesPanel";
import { TraceabilityPanel } from "./components/TraceabilityPanel";
import { TrackedPullRequestsPanel } from "./components/TrackedPullRequestsPanel";
import { TrackedRepositoriesPanel } from "./components/TrackedRepositoriesPanel";
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
import { requestExecutionPlan, requestExecutionExecute } from "./lib/execution-client";
import {
  cancelAnalysisJob,
  createSweepSchedule,
  createTrackedRepository,
  enqueueTrackedRepositoryAnalysis,
  FleetClientError,
  getAnalysisJob,
  getExecutionPlanDetail,
  getFleetStatus,
  getTrackedRepositoryHistory,
  listAnalysisJobs,
  listExecutionPlanEvents,
  listSweepSchedules,
  listTrackedRepositories,
  retryAnalysisJob,
  triggerSweepSchedule
} from "./lib/fleet-client";
import {
  compareSavedAnalysisRuns,
  getSavedAnalysisRun,
  listSavedAnalysisRuns,
  saveAnalysisRun,
  SavedRunsClientError
} from "./lib/runs-client";

type AppMode = "analysis" | "fleet-admin";
type FleetInspectorSelection =
  | { id: string; kind: "job" }
  | { id: string; kind: "plan" }
  | { id: string; kind: "repository" }
  | { id: string; kind: "run" };

type FleetAdminSnapshot = {
  analysisJobs: AnalysisJob[];
  fleetStatus: FleetStatusResponse;
  sweepSchedules: SweepSchedule[];
  trackedRepositories: TrackedRepository[];
};

async function loadFleetAdminSnapshot(): Promise<FleetAdminSnapshot> {
  const [trackedRepositories, fleetStatus, analysisJobs, sweepSchedules] = await Promise.all([
    listTrackedRepositories(),
    getFleetStatus(),
    listAnalysisJobs(),
    listSweepSchedules()
  ]);

  return {
    analysisJobs,
    fleetStatus,
    sweepSchedules,
    trackedRepositories
  };
}

function createFallbackTrackedRepositoryStatus(
  trackedRepository: TrackedRepository
): FleetTrackedRepositoryStatus {
  return {
    latestAnalysisJob: null,
    latestPlanId: null,
    latestPlanStatus: null,
    latestRun: null,
    patchPlanCounts: {
      blocked: 0,
      executable: 0,
      stale: 0
    },
    stale: true,
    trackedRepository
  };
}

function mergeTrackedRepositoryStatuses(input: {
  fleetStatus: FleetStatusResponse | null;
  trackedRepositories: TrackedRepository[];
}): FleetTrackedRepositoryStatus[] {
  const fleetStatuses = input.fleetStatus?.trackedRepositories ?? [];
  const statusesById = new Map(
    fleetStatuses.map((entry) => [entry.trackedRepository.id, entry] as const)
  );
  const merged: FleetTrackedRepositoryStatus[] = [];

  const baseRepositories =
    input.trackedRepositories.length > 0
      ? input.trackedRepositories
      : fleetStatuses.map((entry) => entry.trackedRepository);

  for (const trackedRepository of baseRepositories) {
    merged.push(
      statusesById.get(trackedRepository.id) ??
        createFallbackTrackedRepositoryStatus(trackedRepository)
    );
  }

  for (const entry of fleetStatuses) {
    if (!merged.some((candidate) => candidate.trackedRepository.id === entry.trackedRepository.id)) {
      merged.push(entry);
    }
  }

  return merged;
}

function App() {
  const [appMode, setAppMode] = useState<AppMode>("analysis");
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
  const [selectedPRCandidateIds, setSelectedPRCandidateIds] = useState<string[]>([]);
  const [targetRunId, setTargetRunId] = useState("");

  const [analysisJobs, setAnalysisJobs] = useState<AnalysisJob[]>([]);
  const [fleetStatus, setFleetStatus] = useState<FleetStatusResponse | null>(null);
  const [fleetErrorMessage, setFleetErrorMessage] = useState<string | null>(null);
  const [isFleetLoading, setIsFleetLoading] = useState(false);
  const [isCreatingSweepSchedule, setIsCreatingSweepSchedule] = useState(false);
  const [isCreatingTrackedRepository, setIsCreatingTrackedRepository] =
    useState(false);
  const [jobsErrorMessage, setJobsErrorMessage] = useState<string | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [pendingSweepScheduleId, setPendingSweepScheduleId] = useState<string | null>(
    null
  );
  const [pendingTrackedRepositoryId, setPendingTrackedRepositoryId] = useState<
    string | null
  >(null);
  const [sweepSchedules, setSweepSchedules] = useState<SweepSchedule[]>([]);
  const [sweepSchedulesErrorMessage, setSweepSchedulesErrorMessage] = useState<
    string | null
  >(null);
  const [trackedRepositories, setTrackedRepositories] = useState<TrackedRepository[]>(
    []
  );
  const [trackedRepositoriesErrorMessage, setTrackedRepositoriesErrorMessage] =
    useState<string | null>(null);
  const [fleetInspectorSelection, setFleetInspectorSelection] =
    useState<FleetInspectorSelection | null>(null);
  const [fleetInspectorErrorMessage, setFleetInspectorErrorMessage] = useState<
    string | null
  >(null);
  const [isFleetInspectorLoading, setIsFleetInspectorLoading] = useState(false);
  const [analysisJobDetailsById, setAnalysisJobDetailsById] = useState<
    Record<string, AnalysisJob>
  >({});
  const [executionPlanDetailsById, setExecutionPlanDetailsById] = useState<
    Record<string, ExecutionPlanDetailResponse>
  >({});
  const [executionPlanEventsById, setExecutionPlanEventsById] = useState<
    Record<string, ExecutionPlanEventsResponse>
  >({});
  const [runDetailsById, setRunDetailsById] = useState<
    Record<string, GetAnalysisRunResponse>
  >({});
  const [trackedRepositoryHistoriesById, setTrackedRepositoryHistoriesById] =
    useState<Record<string, TrackedRepositoryHistoryResponse>>({});
  const fleetInspectorRequestIdRef = useRef(0);

  const statusLabel =
    appMode === "analysis"
      ? isLoading
        ? "Analyzing snapshot"
        : analysis
          ? "Analysis ready"
          : "Ready for intake"
      : isFleetLoading
        ? "Refreshing fleet"
        : fleetStatus
          ? "Fleet admin ready"
          : "Fleet admin idle";
  const statusTone =
    appMode === "analysis"
      ? analysis
        ? "active"
        : isLoading
          ? "warning"
          : "muted"
      : fleetStatus
        ? "active"
        : isFleetLoading
          ? "warning"
          : "muted";
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
  const trackedRepositoryStatuses = mergeTrackedRepositoryStatuses({
    fleetStatus,
    trackedRepositories
  });
  const selectedJobDetail =
    fleetInspectorSelection?.kind === "job"
      ? analysisJobDetailsById[fleetInspectorSelection.id] ?? null
      : null;
  const selectedPlanDetail =
    fleetInspectorSelection?.kind === "plan"
      ? executionPlanDetailsById[fleetInspectorSelection.id] ?? null
      : null;
  const selectedPlanEvents =
    fleetInspectorSelection?.kind === "plan"
      ? executionPlanEventsById[fleetInspectorSelection.id] ?? null
      : null;
  const selectedPlanRunDetail =
    fleetInspectorSelection?.kind === "plan" && selectedPlanDetail
      ? runDetailsById[selectedPlanDetail.analysisRunId] ?? null
      : null;
  const selectedRepositoryHistory =
    fleetInspectorSelection?.kind === "repository"
      ? trackedRepositoryHistoriesById[fleetInspectorSelection.id] ?? null
      : null;
  const selectedRunDetail =
    fleetInspectorSelection?.kind === "run"
      ? runDetailsById[fleetInspectorSelection.id] ?? null
      : null;

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

  function applyFleetAdminSnapshot(snapshot: FleetAdminSnapshot) {
    setAnalysisJobs(snapshot.analysisJobs);
    setFleetStatus(snapshot.fleetStatus);
    setSweepSchedules(snapshot.sweepSchedules);
    setTrackedRepositories(snapshot.trackedRepositories);
  }

  function hasInspectorCache(selection: FleetInspectorSelection): boolean {
    switch (selection.kind) {
      case "job":
        return Boolean(analysisJobDetailsById[selection.id]);
      case "plan":
        return Boolean(
          executionPlanDetailsById[selection.id] && executionPlanEventsById[selection.id]
        );
      case "repository":
        return Boolean(trackedRepositoryHistoriesById[selection.id]);
      case "run":
        return Boolean(runDetailsById[selection.id]);
    }
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

  async function handleRefreshFleetAdmin() {
    setFleetErrorMessage(null);
    setIsFleetLoading(true);

    try {
      applyFleetAdminSnapshot(await loadFleetAdminSnapshot());
    } catch (error) {
      setFleetErrorMessage(
        error instanceof FleetClientError
          ? error.message
          : "Repo Guardian could not load fleet admin data."
      );
    } finally {
      setIsFleetLoading(false);
    }
  }

  async function handleCreateTrackedRepository(input: {
    label?: string | null;
    repoInput: string;
  }) {
    setTrackedRepositoriesErrorMessage(null);
    setIsCreatingTrackedRepository(true);

    try {
      await createTrackedRepository(input);
      await handleRefreshFleetAdmin();
    } catch (error) {
      setTrackedRepositoriesErrorMessage(
        error instanceof FleetClientError
          ? error.message
          : "Repo Guardian could not register the tracked repository."
      );
    } finally {
      setIsCreatingTrackedRepository(false);
    }
  }

  async function handleEnqueueTrackedRepositoryAnalysis(trackedRepositoryId: string) {
    setTrackedRepositoriesErrorMessage(null);
    setPendingTrackedRepositoryId(trackedRepositoryId);

    try {
      await enqueueTrackedRepositoryAnalysis(trackedRepositoryId);
      await handleRefreshFleetAdmin();
    } catch (error) {
      setTrackedRepositoriesErrorMessage(
        error instanceof FleetClientError
          ? error.message
          : "Repo Guardian could not enqueue the tracked repository analysis."
      );
    } finally {
      setPendingTrackedRepositoryId(null);
    }
  }

  async function handleCancelJob(jobId: string) {
    setJobsErrorMessage(null);
    setPendingJobId(jobId);

    try {
      await cancelAnalysisJob(jobId);
      await handleRefreshFleetAdmin();
    } catch (error) {
      setJobsErrorMessage(
        error instanceof FleetClientError
          ? error.message
          : "Repo Guardian could not cancel the analysis job."
      );
    } finally {
      setPendingJobId(null);
    }
  }

  async function handleRetryJob(jobId: string) {
    setJobsErrorMessage(null);
    setPendingJobId(jobId);

    try {
      await retryAnalysisJob(jobId);
      await handleRefreshFleetAdmin();
    } catch (error) {
      setJobsErrorMessage(
        error instanceof FleetClientError
          ? error.message
          : "Repo Guardian could not retry the analysis job."
      );
    } finally {
      setPendingJobId(null);
    }
  }

  async function handleCreateSweepSchedule(input: { label: string }) {
    setSweepSchedulesErrorMessage(null);
    setIsCreatingSweepSchedule(true);

    try {
      await createSweepSchedule({
        cadence: "weekly",
        label: input.label,
        selectionStrategy: "all_executable_prs"
      });
      await handleRefreshFleetAdmin();
    } catch (error) {
      setSweepSchedulesErrorMessage(
        error instanceof FleetClientError
          ? error.message
          : "Repo Guardian could not create the sweep schedule."
      );
    } finally {
      setIsCreatingSweepSchedule(false);
    }
  }

  async function handleTriggerSweepSchedule(scheduleId: string) {
    setSweepSchedulesErrorMessage(null);
    setPendingSweepScheduleId(scheduleId);

    try {
      await triggerSweepSchedule(scheduleId);
      await handleRefreshFleetAdmin();
    } catch (error) {
      setSweepSchedulesErrorMessage(
        error instanceof FleetClientError
          ? error.message
          : "Repo Guardian could not trigger the sweep schedule."
      );
    } finally {
      setPendingSweepScheduleId(null);
    }
  }

  async function openFleetInspector(
    selection: FleetInspectorSelection,
    forceRefresh = false
  ) {
    setFleetInspectorSelection(selection);
    setFleetInspectorErrorMessage(null);

    if (!forceRefresh && hasInspectorCache(selection)) {
      setIsFleetInspectorLoading(false);
      return;
    }

    const requestId = fleetInspectorRequestIdRef.current + 1;
    fleetInspectorRequestIdRef.current = requestId;
    setIsFleetInspectorLoading(true);

    try {
      switch (selection.kind) {
        case "job": {
          const detail = await getAnalysisJob(selection.id);

          if (fleetInspectorRequestIdRef.current !== requestId) {
            return;
          }

          setAnalysisJobDetailsById((current) => ({
            ...current,
            [selection.id]: detail
          }));
          break;
        }
        case "plan": {
          const detail = await getExecutionPlanDetail(selection.id);
          const [events, run] = await Promise.all([
            listExecutionPlanEvents(selection.id),
            getSavedAnalysisRun(detail.analysisRunId)
          ]);

          if (fleetInspectorRequestIdRef.current !== requestId) {
            return;
          }

          setExecutionPlanDetailsById((current) => ({
            ...current,
            [selection.id]: detail
          }));
          setExecutionPlanEventsById((current) => ({
            ...current,
            [selection.id]: events
          }));
          setRunDetailsById((current) => ({
            ...current,
            [detail.analysisRunId]: run
          }));
          break;
        }
        case "repository": {
          const history = await getTrackedRepositoryHistory(selection.id);

          if (fleetInspectorRequestIdRef.current !== requestId) {
            return;
          }

          setTrackedRepositoryHistoriesById((current) => ({
            ...current,
            [selection.id]: history
          }));
          break;
        }
        case "run": {
          const detail = await getSavedAnalysisRun(selection.id);

          if (fleetInspectorRequestIdRef.current !== requestId) {
            return;
          }

          setRunDetailsById((current) => ({
            ...current,
            [selection.id]: detail
          }));
          break;
        }
      }
    } catch (error) {
      if (fleetInspectorRequestIdRef.current !== requestId) {
        return;
      }

      setFleetInspectorErrorMessage(
        error instanceof Error
          ? error.message
          : "Repo Guardian could not load the selected fleet detail."
      );
    } finally {
      if (fleetInspectorRequestIdRef.current === requestId) {
        setIsFleetInspectorLoading(false);
      }
    }
  }

  function handleCloseFleetInspector() {
    setFleetInspectorSelection(null);
    setFleetInspectorErrorMessage(null);
    setIsFleetInspectorLoading(false);
  }

  async function handleRefreshFleetInspector() {
    if (!fleetInspectorSelection) {
      return;
    }

    await openFleetInspector(fleetInspectorSelection, true);
  }

  useEffect(() => {
    if (appMode !== "fleet-admin" || fleetStatus) {
      return;
    }

    let cancelled = false;
    setFleetErrorMessage(null);
    setIsFleetLoading(true);

    void loadFleetAdminSnapshot()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        applyFleetAdminSnapshot(snapshot);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setFleetErrorMessage(
          error instanceof FleetClientError
            ? error.message
            : "Repo Guardian could not load fleet admin data."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsFleetLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [appMode, fleetStatus]);

  const heroAside =
    appMode === "analysis" ? (
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
    ) : (
      <div className="hero-stack">
        <StatusBadge label={statusLabel} tone={statusTone} />
        <p className="aside-copy">
          Fleet Admin keeps tracked repositories, queue activity, schedule-driven
          planning, and remediation PR lifecycle visible without introducing any
          unattended GitHub writes.
        </p>
        {fleetStatus ? (
          <p className="aside-copy aside-copy-muted">
            Snapshot updated {formatTimestamp(fleetStatus.generatedAt)}.
          </p>
        ) : (
          <p className="aside-copy aside-copy-muted">
            Load a fleet snapshot to inspect queue and schedule health.
          </p>
        )}
      </div>
    );

  return (
    <PageShell
      aside={heroAside}
      eyebrow={appMode === "analysis" ? "Approval-Gated Analysis" : "Fleet Admin"}
      heading="Repo Guardian"
      summary={
        appMode === "analysis"
          ? "A supervised GitHub repository triage assistant that inspects public repositories, drafts findings and remediation candidates, and surfaces approval-gated GitHub write-back readiness before any execution step."
          : "Operational controls for tracked repositories, async queue visibility, scheduled plan-only sweeps, and remediation pull-request lifecycle reporting."
      }
      toolbar={<AppModeToggle mode={appMode} onChange={setAppMode} />}
    >
      {appMode === "analysis" ? (
        <>
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
                        approvalNotes: [
                          "Dry-run plan generated; approval required for execution."
                        ],
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
        </>
      ) : (
        <>
          <FleetOverviewPanel
            errorMessage={fleetErrorMessage}
            fleetStatus={fleetStatus}
            isLoading={isFleetLoading}
            onRefresh={handleRefreshFleetAdmin}
          />
          <TrackedRepositoriesPanel
            errorMessage={trackedRepositoriesErrorMessage}
            isCreating={isCreatingTrackedRepository}
            isLoading={isFleetLoading}
            onCreateRepository={handleCreateTrackedRepository}
            onEnqueueAnalysis={handleEnqueueTrackedRepositoryAnalysis}
            onOpenJobDetails={(jobId) => void openFleetInspector({ id: jobId, kind: "job" })}
            onOpenPlanDetails={(planId) =>
              void openFleetInspector({ id: planId, kind: "plan" })
            }
            onOpenRepositoryDetails={(trackedRepositoryId) =>
              void openFleetInspector({
                id: trackedRepositoryId,
                kind: "repository"
              })
            }
            onOpenRunDetails={(runId) => void openFleetInspector({ id: runId, kind: "run" })}
            onRefresh={handleRefreshFleetAdmin}
            pendingTrackedRepositoryId={pendingTrackedRepositoryId}
            repositories={trackedRepositoryStatuses}
          />
          <AnalysisJobsPanel
            errorMessage={jobsErrorMessage}
            isLoading={isFleetLoading}
            jobs={analysisJobs}
            onCancelJob={handleCancelJob}
            onOpenJobDetails={(jobId) => void openFleetInspector({ id: jobId, kind: "job" })}
            onOpenPlanDetails={(planId) =>
              void openFleetInspector({ id: planId, kind: "plan" })
            }
            onOpenRunDetails={(runId) => void openFleetInspector({ id: runId, kind: "run" })}
            onRefresh={handleRefreshFleetAdmin}
            onRetryJob={handleRetryJob}
            pendingJobId={pendingJobId}
          />
          <SweepSchedulesPanel
            errorMessage={sweepSchedulesErrorMessage}
            isCreating={isCreatingSweepSchedule}
            isLoading={isFleetLoading}
            onCreateSchedule={handleCreateSweepSchedule}
            onRefresh={handleRefreshFleetAdmin}
            onTriggerSchedule={handleTriggerSweepSchedule}
            pendingScheduleId={pendingSweepScheduleId}
            schedules={sweepSchedules}
          />
          <TrackedPullRequestsPanel
            onOpenPlanDetails={(planId) =>
              void openFleetInspector({ id: planId, kind: "plan" })
            }
            pullRequests={fleetStatus?.trackedPullRequests ?? []}
          />
          {fleetInspectorSelection ? (
            <FleetInspectorPanel
              errorMessage={fleetInspectorErrorMessage}
              isLoading={isFleetInspectorLoading}
              jobDetail={selectedJobDetail}
              onClose={handleCloseFleetInspector}
              onOpenPlan={(planId) =>
                void openFleetInspector({ id: planId, kind: "plan" })
              }
              onOpenRun={(runId) => void openFleetInspector({ id: runId, kind: "run" })}
              onRefresh={() => void handleRefreshFleetInspector()}
              planDetail={selectedPlanDetail}
              planEvents={selectedPlanEvents}
              planRunDetail={selectedPlanRunDetail}
              repositoryHistory={selectedRepositoryHistory}
              runDetail={selectedRunDetail}
              selection={fleetInspectorSelection}
            />
          ) : null}
        </>
      )}
    </PageShell>
  );
}

export default App;
