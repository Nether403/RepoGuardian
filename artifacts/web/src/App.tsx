import { useState, type FormEvent } from "react";
import type {
  AnalyzeRepoResponse,
  CodeReviewFinding,
  DependencyFinding,
  DetectedEcosystem,
  DetectedFileGroup,
  DetectedSignal,
  ExecutionMode,
  ExecutionResult,
  IssueCandidate,
  PRCandidate,
  PRPatchPlan,
  PRWriteBackEligibility
} from "@repo-guardian/shared-types";
import { ExecutionPlannerPanel } from "./components/ExecutionPlannerPanel";
import { ExecutionResultsPanel } from "./components/ExecutionResultsPanel";
import { IssueCandidatesPanel } from "./components/IssueCandidatesPanel";
import { PageShell } from "./components/PageShell";
import { Panel } from "./components/Panel";
import { PRCandidatesPanel } from "./components/PRCandidatesPanel";
import { RepoInputForm } from "./components/RepoInputForm";
import { StatusBadge } from "./components/StatusBadge";
import {
  AnalyzeRepoClientError,
  analyzeRepository
} from "./lib/api-client";
import {
  ExecutionPlanClientError,
  requestExecutionPlan
} from "./lib/execution-client";

const ecosystemLabels: Record<DetectedEcosystem["ecosystem"], string> = {
  go: "Go",
  jvm: "Java / JVM",
  node: "Node.js",
  python: "Python",
  ruby: "Ruby",
  rust: "Rust"
};

const packageManagerLabels: Record<string, string> = {
  bundler: "Bundler",
  cargo: "Cargo",
  gradle: "Gradle",
  maven: "Maven",
  npm: "npm",
  pip: "pip",
  pipenv: "Pipenv",
  pnpm: "pnpm",
  poetry: "Poetry",
  yarn: "Yarn",
  "go-mod": "Go modules"
};

const signalLabels: Record<DetectedSignal["kind"], string> = {
  "docker-compose.yml": "Docker Compose",
  Dockerfile: "Dockerfile",
  "github-workflow": "GitHub workflow"
};

const prCandidateTypeLabels: Record<PRPatchPlan["candidateType"], string> = {
  "dangerous-execution": "Dangerous execution",
  "dependency-review": "Dependency review",
  "dependency-upgrade": "Dependency upgrade",
  "general-hardening": "General hardening",
  "secret-remediation": "Secret remediation",
  "shell-execution": "Shell execution",
  "workflow-hardening": "Workflow hardening"
};

const TRACEABILITY_PATCH_PLANS_SECTION_ID = "traceability-patch-plans";
const TRACEABILITY_PR_CANDIDATES_SECTION_ID = "traceability-pr-candidates";
const TRACEABILITY_ISSUE_CANDIDATES_SECTION_ID = "traceability-issue-candidates";
const TRACEABILITY_FINDINGS_SECTION_ID = "traceability-findings";

type TraceableFinding = DependencyFinding | CodeReviewFinding;
type EligibilityFilter = "all" | PRWriteBackEligibility["status"];
type CandidateTypeFilter = "all" | PRPatchPlan["candidateType"];

type TraceabilityViewModel = {
  findingById: Map<string, TraceableFinding>;
  issueCandidateById: Map<string, IssueCandidate>;
  patchPlanById: Map<string, PRPatchPlan>;
  patchPlansByCandidateId: Map<string, PRPatchPlan[]>;
  patchPlansByFindingId: Map<string, PRPatchPlan[]>;
  patchPlansByIssueCandidateId: Map<string, PRPatchPlan[]>;
  prCandidateById: Map<string, PRCandidate>;
  referencedCandidates: PRCandidate[];
  referencedFindings: TraceableFinding[];
  referencedIssueCandidates: IssueCandidate[];
};

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatPatchability(value: PRPatchPlan["patchability"]): string {
  return value.replace(/_/gu, " ");
}

function formatValidationStatus(value: PRPatchPlan["validationStatus"]): string {
  return value.replace(/_/gu, " ");
}

function formatReadiness(value: PRCandidate["readiness"]): string {
  return value.replace(/_/gu, " ");
}

function formatIssueScope(value: IssueCandidate["scope"]): string {
  return value.replace(/-/gu, " ");
}

function formatSourceType(value: TraceableFinding["sourceType"]): string {
  return value.replace(/_/gu, " ");
}

function formatSeverity(value: TraceableFinding["severity"]): string {
  return value.replace(/_/gu, " ");
}

function formatConfidence(value: TraceableFinding["confidence"]): string {
  return value.replace(/_/gu, " ");
}

function buildAnchorId(prefix: string, rawId: string): string {
  const normalized = rawId
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

  return `${prefix}-${normalized || "item"}`;
}

function getPatchPlanAnchorId(patchPlanId: string): string {
  return buildAnchorId("patch-plan", patchPlanId);
}

function getPRCandidateAnchorId(candidateId: string): string {
  return buildAnchorId("pr-candidate", candidateId);
}

function getIssueCandidateAnchorId(issueCandidateId: string): string {
  return buildAnchorId("issue-candidate", issueCandidateId);
}

function getFindingAnchorId(findingId: string): string {
  return buildAnchorId("finding", findingId);
}

function getPatchabilityTone(
  patchability: PRPatchPlan["patchability"]
): "active" | "muted" | "warning" {
  if (patchability === "patch_candidate") {
    return "active";
  }

  return patchability === "patch_plan_only" ? "warning" : "muted";
}

function getValidationTone(
  validationStatus: PRPatchPlan["validationStatus"]
): "active" | "warning" | "muted" {
  if (validationStatus === "ready") {
    return "active";
  }

  return validationStatus === "ready_with_warnings" ? "warning" : "muted";
}

function getEligibilityTone(
  status: PRWriteBackEligibility["status"]
): "active" | "warning" {
  return status === "executable" ? "active" : "warning";
}

function getCandidateReadinessTone(
  readiness: PRCandidate["readiness"]
): "active" | "warning" | "muted" {
  if (readiness === "ready") {
    return "active";
  }

  return readiness === "ready_with_warnings" ? "warning" : "muted";
}

function getRiskTone(
  riskLevel: PRCandidate["riskLevel"]
): "warning" | "muted" {
  return riskLevel === "low" ? "muted" : "warning";
}

function getSeverityTone(
  severity: TraceableFinding["severity"]
): "warning" | "muted" {
  return severity === "high" || severity === "critical" ? "warning" : "muted";
}

function getConfidenceTone(
  confidence: TraceableFinding["confidence"]
): "active" | "warning" | "muted" {
  if (confidence === "high") {
    return "active";
  }

  return confidence === "medium" ? "warning" : "muted";
}

function getWriteBackEligibility(
  plan: PRPatchPlan
): PRWriteBackEligibility {
  return (
    plan.writeBackEligibility ?? {
      approvalRequired: true,
      details: [
        "This analysis payload did not include write-back eligibility details."
      ],
      status: "blocked",
      summary: "Write-back eligibility details were not included in this analysis payload."
    }
  );
}

function getCandidateTypeFilterOptions(
  patchPlans: PRPatchPlan[]
): PRPatchPlan["candidateType"][] {
  return Array.from(new Set(patchPlans.map((plan) => plan.candidateType)));
}

function isDependencyFinding(
  finding: TraceableFinding
): finding is DependencyFinding {
  return finding.sourceType === "dependency";
}

function buildTraceabilityViewModel(
  analysis: AnalyzeRepoResponse,
  patchPlans: PRPatchPlan[] = analysis.prPatchPlans
): TraceabilityViewModel {
  const patchPlanById = new Map<string, PRPatchPlan>();
  const prCandidateById = new Map<string, PRCandidate>();
  const issueCandidateById = new Map<string, IssueCandidate>();
  const patchPlansByCandidateId = new Map<string, PRPatchPlan[]>();
  const patchPlansByFindingId = new Map<string, PRPatchPlan[]>();
  const patchPlansByIssueCandidateId = new Map<string, PRPatchPlan[]>();
  const mergedFindings: TraceableFinding[] = [
    ...analysis.dependencyFindings,
    ...analysis.codeReviewFindings
  ];
  const findingById = new Map<string, TraceableFinding>();

  for (const candidate of analysis.prCandidates) {
    prCandidateById.set(candidate.id, candidate);
  }

  for (const candidate of analysis.issueCandidates) {
    issueCandidateById.set(candidate.id, candidate);
  }

  for (const finding of mergedFindings) {
    findingById.set(finding.id, finding);
  }

  for (const plan of patchPlans) {
    patchPlanById.set(plan.id, plan);

    const candidatePlans = patchPlansByCandidateId.get(plan.prCandidateId) ?? [];
    candidatePlans.push(plan);
    patchPlansByCandidateId.set(plan.prCandidateId, candidatePlans);

    for (const findingId of plan.relatedFindingIds) {
      const findingPlans = patchPlansByFindingId.get(findingId) ?? [];
      findingPlans.push(plan);
      patchPlansByFindingId.set(findingId, findingPlans);
    }

    for (const issueCandidateId of plan.linkedIssueCandidateIds) {
      const issuePlans = patchPlansByIssueCandidateId.get(issueCandidateId) ?? [];
      issuePlans.push(plan);
      patchPlansByIssueCandidateId.set(issueCandidateId, issuePlans);
    }
  }

  return {
    findingById,
    issueCandidateById,
    patchPlanById,
    patchPlansByCandidateId,
    patchPlansByFindingId,
    patchPlansByIssueCandidateId,
    prCandidateById,
    referencedCandidates: analysis.prCandidates.filter((candidate) =>
      patchPlansByCandidateId.has(candidate.id)
    ),
    referencedFindings: mergedFindings.filter((finding) =>
      patchPlansByFindingId.has(finding.id)
    ),
    referencedIssueCandidates: analysis.issueCandidates.filter((candidate) =>
      patchPlansByIssueCandidateId.has(candidate.id)
    )
  };
}

function renderFileList(items: DetectedFileGroup[], emptyLabel: string) {
  if (items.length === 0) {
    return <p className="empty-copy">{emptyLabel}</p>;
  }

  return (
    <ul className="file-list">
      {items.map((item) => (
        <li className="file-row" key={`${item.kind}:${item.path}`}>
          <span className="file-kind">{item.kind}</span>
          <code>{item.path}</code>
        </li>
      ))}
    </ul>
  );
}

function renderSignalList(items: DetectedSignal[], notablePaths: string[]) {
  if (items.length === 0 && notablePaths.length === 0) {
    return <p className="empty-copy">No workflow or infra signals were detected.</p>;
  }

  return (
    <div className="stack-list">
      {items.length > 0 ? (
        <div>
          <p className="subsection-label">Signals</p>
          <ul className="file-list">
            {items.map((item) => (
              <li className="file-row" key={`${item.kind}:${item.path}`}>
                <span className="file-kind">{signalLabels[item.kind]}</span>
                <code>{item.path}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {notablePaths.length > 0 ? (
        <div>
          <p className="subsection-label">Notable paths</p>
          <ul className="simple-list">
            {notablePaths.map((path) => (
              <li key={path}>
                <code>{path}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function updateSelectedIds(
  selectedIds: string[],
  candidateId: string,
  selected: boolean
): string[] {
  if (selected) {
    return selectedIds.includes(candidateId)
      ? selectedIds
      : [...selectedIds, candidateId];
  }

  return selectedIds.filter((selectedId) => selectedId !== candidateId);
}

function App() {
  const [analysis, setAnalysis] = useState<AnalyzeRepoResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [eligibilityFilter, setEligibilityFilter] =
    useState<EligibilityFilter>("all");
  const [candidateTypeFilter, setCandidateTypeFilter] =
    useState<CandidateTypeFilter>("all");
  const [approvalGranted, setApprovalGranted] = useState(false);
  const [executionErrorMessage, setExecutionErrorMessage] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("dry_run");
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isExecutionLoading, setIsExecutionLoading] = useState(false);
  const [selectedIssueCandidateIds, setSelectedIssueCandidateIds] = useState<string[]>([]);
  const [selectedPRCandidateIds, setSelectedPRCandidateIds] = useState<string[]>([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [repoInput, setRepoInput] = useState("");

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
    ? analysis.prPatchPlans.filter((plan) => {
        const eligibilityMatches =
          eligibilityFilter === "all" ||
          getWriteBackEligibility(plan).status === eligibilityFilter;
        const candidateTypeMatches =
          candidateTypeFilter === "all" ||
          plan.candidateType === candidateTypeFilter;

        return eligibilityMatches && candidateTypeMatches;
      })
    : [];
  const candidateTypeFilterOptions = analysis
    ? getCandidateTypeFilterOptions(analysis.prPatchPlans)
    : [];

  const writeBackReadinessSummary = analysis
    ? visiblePatchPlans.reduce(
        (summary, plan) => {
          const eligibility = getWriteBackEligibility(plan);

          if (eligibility.status === "executable") {
            summary.executable += 1;
          } else {
            summary.blocked += 1;
          }

          return summary;
        },
        {
          blocked: 0,
          executable: 0
        }
      )
    : null;
  const traceability = analysis
    ? buildTraceabilityViewModel(analysis, visiblePatchPlans)
    : {
        findingById: new Map<string, TraceableFinding>(),
        issueCandidateById: new Map<string, IssueCandidate>(),
        patchPlanById: new Map<string, PRPatchPlan>(),
        patchPlansByCandidateId: new Map<string, PRPatchPlan[]>(),
        patchPlansByFindingId: new Map<string, PRPatchPlan[]>(),
        patchPlansByIssueCandidateId: new Map<string, PRPatchPlan[]>(),
        prCandidateById: new Map<string, PRCandidate>(),
        referencedCandidates: [],
        referencedFindings: [],
        referencedIssueCandidates: []
      };
  const traceabilityMapSummary = analysis
    ? [
        {
          count: traceability.patchPlanById.size,
          href: `#${TRACEABILITY_PATCH_PLANS_SECTION_ID}`,
          label: "Patch plans"
        },
        {
          count: traceability.referencedCandidates.length,
          href: `#${TRACEABILITY_PR_CANDIDATES_SECTION_ID}`,
          label: "PR candidates"
        },
        {
          count: traceability.referencedIssueCandidates.length,
          href: `#${TRACEABILITY_ISSUE_CANDIDATES_SECTION_ID}`,
          label: "Issue candidates"
        },
        {
          count: traceability.referencedFindings.length,
          href: `#${TRACEABILITY_FINDINGS_SECTION_ID}`,
          label: "Findings"
        }
      ]
    : [];

  function resetExecutionState() {
    setApprovalGranted(false);
    setExecutionErrorMessage(null);
    setExecutionMode("dry_run");
    setExecutionResult(null);
    setIsExecutionLoading(false);
    setSelectedIssueCandidateIds([]);
    setSelectedPRCandidateIds([]);
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

  function handleExecutionModeChange(nextMode: ExecutionMode) {
    setExecutionMode(nextMode);
    setExecutionErrorMessage(null);

    if (nextMode === "dry_run") {
      setApprovalGranted(false);
    }
  }

  async function handleExecutionSubmit() {
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

    if (executionMode === "execute_approved" && !approvalGranted) {
      setExecutionErrorMessage(
        "Approved execution requires the explicit GitHub write-back approval checkbox."
      );
      return;
    }

    setExecutionErrorMessage(null);
    setExecutionResult(null);
    setIsExecutionLoading(true);

    try {
      const result = await requestExecutionPlan({
        analysis,
        approvalGranted: executionMode === "execute_approved" && approvalGranted,
        mode: executionMode,
        selectedIssueCandidateIds,
        selectedPRCandidateIds
      });

      setExecutionResult(result);
    } catch (error) {
      setExecutionErrorMessage(
        error instanceof ExecutionPlanClientError
          ? error.message
          : "Repo Guardian could not complete the execution request."
      );
    } finally {
      setIsExecutionLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setIsLoading(true);
    setErrorMessage(null);

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
      eyebrow="Approval-Gated Analysis"
      heading="Repo Guardian"
      summary="A supervised GitHub repository triage assistant that inspects public repositories, drafts findings and remediation candidates, and surfaces approval-gated GitHub write-back readiness before any execution step."
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
    >
      <Panel
        className="panel-wide"
        eyebrow="Repository Intake"
        title="Analyze a public GitHub repository"
        footer={<StatusBadge label={statusLabel} tone={statusTone} />}
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
              <li>Structured dependency and workflow findings with candidate remediation paths</li>
              <li>Pre-approval PR write-back readiness for supported issue and PR slices</li>
            </ul>
          </div>
        </Panel>
      ) : null}

      {analysis?.isPartial ? (
        <Panel
          className="panel-wide partial-banner"
          eyebrow="Snapshot Coverage"
          title="Partial analysis"
          footer={<StatusBadge label="Partial snapshot" tone="warning" />}
        >
          <p className="empty-copy">
            GitHub reported incomplete tree coverage for this repository snapshot.
            Repo Guardian still returns the available metadata and detected files,
            but later results should be interpreted as partial.
          </p>
        </Panel>
      ) : null}

      {analysis ? (
        <>
          <Panel
            className="panel-half"
            eyebrow="Repository"
            title="Repository summary"
          >
            <dl className="meta-grid">
              <div>
                <dt>Full name</dt>
                <dd>{analysis.repository.fullName}</dd>
              </div>
              <div>
                <dt>Default branch</dt>
                <dd>{analysis.repository.defaultBranch}</dd>
              </div>
              <div>
                <dt>Primary language</dt>
                <dd>{analysis.repository.primaryLanguage ?? "Not reported"}</dd>
              </div>
              <div>
                <dt>Stars</dt>
                <dd>{analysis.repository.stars.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Forks</dt>
                <dd>{analysis.repository.forks.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Fetched at</dt>
                <dd>
                  <time dateTime={analysis.fetchedAt}>
                    {formatTimestamp(analysis.fetchedAt)}
                  </time>
                </dd>
              </div>
            </dl>
            <p className="description-copy">
              {analysis.repository.description ??
                "GitHub did not provide a repository description."}
            </p>
            <p className="resource-link">
              <a href={analysis.repository.htmlUrl} rel="noreferrer" target="_blank">
                Open repository on GitHub
              </a>
            </p>
          </Panel>

          <Panel className="panel-half" eyebrow="Tree" title="Tree summary">
            <dl className="meta-grid">
              <div>
                <dt>Total files</dt>
                <dd>{analysis.treeSummary.totalFiles.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Total directories</dt>
                <dd>{analysis.treeSummary.totalDirectories.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Truncated by GitHub</dt>
                <dd>{analysis.treeSummary.truncated ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Coverage</dt>
                <dd>{analysis.isPartial ? "Partial snapshot" : "Complete snapshot"}</dd>
              </div>
            </dl>
            <div className="stack-list">
              <div>
                <p className="subsection-label">Sample notable paths</p>
                <ul className="simple-list">
                  {analysis.treeSummary.samplePaths.map((path) => (
                    <li key={path}>
                      <code>{path}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>

          <Panel
            className="panel-wide"
            eyebrow="PR Readiness"
            title="PR write-back readiness"
            footer={
              writeBackReadinessSummary ? (
                <div className="badge-row">
                  <StatusBadge
                    label={`${writeBackReadinessSummary.executable} executable`}
                    tone="active"
                  />
                  <StatusBadge
                    label={`${writeBackReadinessSummary.blocked} blocked`}
                    tone="warning"
                  />
                </div>
              ) : null
            }
          >
            {analysis.prPatchPlans.length > 0 ? (
              <div className="readiness-list">
                <div className="traceability-map" aria-label="Traceability map summary">
                  {traceabilityMapSummary.map((item) => (
                    <a
                      className="traceability-map-item"
                      href={item.href}
                      key={item.label}
                    >
                      <span>{item.label}</span>
                      <strong>{item.count.toLocaleString()}</strong>
                    </a>
                  ))}
                </div>
                <div className="readiness-filter-row" aria-label="Readiness filters">
                  <label>
                    <span>Eligibility</span>
                    <select
                      onChange={(event) =>
                        setEligibilityFilter(event.target.value as EligibilityFilter)
                      }
                      value={eligibilityFilter}
                    >
                      <option value="all">All</option>
                      <option value="executable">Executable</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </label>
                  <label>
                    <span>Candidate type</span>
                    <select
                      onChange={(event) =>
                        setCandidateTypeFilter(event.target.value as CandidateTypeFilter)
                      }
                      value={candidateTypeFilter}
                    >
                      <option value="all">All types</option>
                      {candidateTypeFilterOptions.map((candidateType) => (
                        <option key={candidateType} value={candidateType}>
                          {prCandidateTypeLabels[candidateType]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div
                  className="readiness-card-section"
                  id={TRACEABILITY_PATCH_PLANS_SECTION_ID}
                >
                  {visiblePatchPlans.length > 0 ? (
                    visiblePatchPlans.map((plan) => {
                  const eligibility = getWriteBackEligibility(plan);
                  const traceabilityPlan = traceability.patchPlanById.get(plan.id) ?? plan;
                  const patchPlanAnchorId = getPatchPlanAnchorId(traceabilityPlan.id);
                  const candidateAnchorId = getPRCandidateAnchorId(
                    traceabilityPlan.prCandidateId
                  );
                  const linkedFindings = traceabilityPlan.relatedFindingIds
                    .map((findingId) => traceability.findingById.get(findingId))
                    .filter((finding): finding is TraceableFinding => Boolean(finding));

                      return (
                        <article
                          className="readiness-card"
                          id={patchPlanAnchorId}
                          key={traceabilityPlan.id}
                        >
                      <div className="readiness-card-header">
                        <div>
                          <p className="subsection-label">
                            {prCandidateTypeLabels[traceabilityPlan.candidateType]}
                          </p>
                          <h3>{traceabilityPlan.title}</h3>
                        </div>
                        <StatusBadge
                          label={eligibility.status}
                          tone={getEligibilityTone(eligibility.status)}
                        />
                      </div>
                      <div className="badge-row">
                        <StatusBadge
                          label={formatPatchability(traceabilityPlan.patchability)}
                          tone={getPatchabilityTone(traceabilityPlan.patchability)}
                        />
                        <StatusBadge
                          label={formatValidationStatus(traceabilityPlan.validationStatus)}
                          tone={getValidationTone(traceabilityPlan.validationStatus)}
                        />
                        {eligibility.approvalRequired ? (
                          <StatusBadge label="Approval required" tone="up-next" />
                        ) : null}
                      </div>
                      <p className="readiness-summary">{eligibility.summary}</p>
                      <ul className="detail-list readiness-details">
                        {eligibility.details.map((detail) => (
                          <li key={`${traceabilityPlan.id}:${detail}`}>{detail}</li>
                        ))}
                      </ul>
                      <div className="traceability-section">
                        <p className="subsection-label">Traceability</p>
                        <div className="trace-chip-row">
                          <a
                            className="trace-chip trace-chip-link"
                            href={`#${patchPlanAnchorId}`}
                          >
                            <code>{traceabilityPlan.id}</code>
                          </a>
                          <a
                            className="trace-chip trace-chip-link"
                            href={`#${candidateAnchorId}`}
                          >
                            <code>{traceabilityPlan.prCandidateId}</code>
                          </a>
                          {traceabilityPlan.relatedFindingIds.map((findingId) => (
                            <a
                              className="trace-chip trace-chip-link"
                              href={`#${getFindingAnchorId(findingId)}`}
                              key={`${traceabilityPlan.id}:${findingId}`}
                            >
                              <code>{findingId}</code>
                            </a>
                          ))}
                          {traceabilityPlan.linkedIssueCandidateIds.map((issueCandidateId) =>
                            traceability.issueCandidateById.has(issueCandidateId) ? (
                              <a
                                className="trace-chip trace-chip-link"
                                href={`#${getIssueCandidateAnchorId(issueCandidateId)}`}
                                key={`${traceabilityPlan.id}:${issueCandidateId}`}
                              >
                                <code>{issueCandidateId}</code>
                              </a>
                            ) : (
                              <span
                                className="trace-chip trace-chip-muted"
                                key={`${traceabilityPlan.id}:${issueCandidateId}`}
                              >
                                <code>{issueCandidateId}</code>
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <details className="trace-expander">
                        <summary>Patch-plan detail</summary>
                        <div className="trace-expander-content">
                          {traceabilityPlan.patchPlan ? (
                            <>
                              <div>
                                <p className="subsection-label">Patch strategy</p>
                                <p className="trace-copy">
                                  {traceabilityPlan.patchPlan.patchStrategy}
                                </p>
                              </div>
                              <div>
                                <p className="subsection-label">Planned files</p>
                                <ul className="file-list">
                                  {traceabilityPlan.patchPlan.filesPlanned.map((filePlan) => (
                                    <li
                                      className="file-row"
                                      key={`${traceabilityPlan.id}:${filePlan.path}`}
                                    >
                                      <span className="file-kind">{filePlan.changeType}</span>
                                      <code>{filePlan.path}</code>
                                      <span className="trace-copy">{filePlan.reason}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="subsection-label">Constraints</p>
                                <ul className="simple-list">
                                  {traceabilityPlan.patchPlan.constraints.map((constraint) => (
                                    <li key={`${traceabilityPlan.id}:${constraint}`}>
                                      {constraint}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <p className="subsection-label">Validation steps</p>
                                <ul className="simple-list">
                                  {traceabilityPlan.patchPlan.requiredValidationSteps.map(
                                    (step) => (
                                      <li key={`${traceabilityPlan.id}:${step}`}>{step}</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            </>
                          ) : (
                            <p className="trace-copy">
                              No concrete file patch plan is attached to this PR candidate.
                            </p>
                          )}
                          <div>
                            <p className="subsection-label">Validation notes</p>
                            <ul className="simple-list">
                              {traceabilityPlan.validationNotes.map((note) => (
                                <li key={`${traceabilityPlan.id}:${note}`}>{note}</li>
                              ))}
                            </ul>
                          </div>
                          {linkedFindings.length > 0 ? (
                            <div>
                              <p className="subsection-label">Linked findings</p>
                              <ul className="simple-list">
                                {linkedFindings.map((finding) => (
                                  <li key={`${traceabilityPlan.id}:${finding.id}`}>
                                    <a
                                      className="trace-link"
                                      href={`#${getFindingAnchorId(finding.id)}`}
                                    >
                                      <code>{finding.id}</code>
                                    </a>{" "}
                                    {finding.title}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                      </details>
                        </article>
                      );
                    })
                  ) : (
                    <p className="empty-copy">
                      No PR patch plans match the active readiness filters.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="empty-copy">
                No PR patch plans were generated for this repository snapshot.
              </p>
            )}
          </Panel>

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
            isSubmitting={isExecutionLoading}
            mode={executionMode}
            onApprovalChange={setApprovalGranted}
            onModeChange={handleExecutionModeChange}
            onSubmit={handleExecutionSubmit}
            selectedIssueCount={selectedIssueCandidateIds.length}
            selectedPRCount={selectedPRCandidateIds.length}
          />

          <ExecutionResultsPanel result={executionResult} />

          <Panel
            className="panel-wide"
            eyebrow="PR Candidates"
            id={TRACEABILITY_PR_CANDIDATES_SECTION_ID}
            title="PR candidate traceability"
          >
            {traceability.referencedCandidates.length > 0 ? (
              <div className="traceability-list">
                {traceability.referencedCandidates.map((candidate) => {
                  const candidateAnchorId = getPRCandidateAnchorId(candidate.id);
                  const relatedPatchPlans =
                    traceability.patchPlansByCandidateId.get(candidate.id) ?? [];

                  return (
                    <article
                      className="trace-card"
                      id={candidateAnchorId}
                      key={candidate.id}
                    >
                      <div className="trace-card-header">
                        <div>
                          <p className="subsection-label">
                            {prCandidateTypeLabels[candidate.candidateType]}
                          </p>
                          <h3>{candidate.title}</h3>
                        </div>
                        <div className="badge-row">
                          <StatusBadge
                            label={formatReadiness(candidate.readiness)}
                            tone={getCandidateReadinessTone(candidate.readiness)}
                          />
                          <StatusBadge
                            label={`${candidate.riskLevel} risk`}
                            tone={getRiskTone(candidate.riskLevel)}
                          />
                        </div>
                      </div>
                      <p className="trace-copy">{candidate.summary}</p>
                      <div className="traceability-section">
                        <p className="subsection-label">Traceability</p>
                        <div className="trace-chip-row">
                          <a
                            className="trace-chip trace-chip-link"
                            href={`#${candidateAnchorId}`}
                          >
                            <code>{candidate.id}</code>
                          </a>
                          {relatedPatchPlans.map((patchPlan) => (
                            <a
                              className="trace-chip trace-chip-link"
                              href={`#${getPatchPlanAnchorId(patchPlan.id)}`}
                              key={`${candidate.id}:${patchPlan.id}`}
                            >
                              <code>{patchPlan.id}</code>
                            </a>
                          ))}
                        </div>
                      </div>
                      <div className="trace-meta-grid">
                        <div>
                          <p className="subsection-label">Affected paths</p>
                          <ul className="simple-list">
                            {candidate.affectedPaths.map((path) => (
                              <li key={`${candidate.id}:${path}`}>
                                <code>{path}</code>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="subsection-label">Affected packages</p>
                          {candidate.affectedPackages.length > 0 ? (
                            <ul className="simple-list">
                              {candidate.affectedPackages.map((pkg) => (
                                <li key={`${candidate.id}:${pkg}`}>
                                  <code>{pkg}</code>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="trace-copy">No package-level scope.</p>
                          )}
                        </div>
                      </div>
                      <details className="trace-expander">
                        <summary>Candidate detail</summary>
                        <div className="trace-expander-content">
                          <div>
                            <p className="subsection-label">Rationale</p>
                            <p className="trace-copy">{candidate.rationale}</p>
                          </div>
                          <div>
                            <p className="subsection-label">Rollback note</p>
                            <p className="trace-copy">{candidate.rollbackNote}</p>
                          </div>
                          <div>
                            <p className="subsection-label">Test plan</p>
                            <ul className="simple-list">
                              {candidate.testPlan.map((step) => (
                                <li key={`${candidate.id}:${step}`}>{step}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="subsection-label">Expected file changes</p>
                            <ul className="file-list">
                              {candidate.expectedFileChanges.map((change) => (
                                <li
                                  className="file-row"
                                  key={`${candidate.id}:${change.path}`}
                                >
                                  <span className="file-kind">{change.changeType}</span>
                                  <code>{change.path}</code>
                                  <span className="trace-copy">{change.reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-copy">
                No PR candidates are referenced by the current readiness cards.
              </p>
            )}
          </Panel>

          <Panel
            className="panel-wide"
            eyebrow="Issue Candidates"
            id={TRACEABILITY_ISSUE_CANDIDATES_SECTION_ID}
            title="Issue candidate traceability"
          >
            {traceability.referencedIssueCandidates.length > 0 ? (
              <div className="traceability-list">
                {traceability.referencedIssueCandidates.map((candidate) => {
                  const candidateAnchorId = getIssueCandidateAnchorId(candidate.id);
                  const relatedPatchPlans =
                    traceability.patchPlansByIssueCandidateId.get(candidate.id) ?? [];

                  return (
                    <article
                      className="trace-card"
                      id={candidateAnchorId}
                      key={candidate.id}
                    >
                      <div className="trace-card-header">
                        <div>
                          <p className="subsection-label">
                            {prCandidateTypeLabels[candidate.candidateType]}
                          </p>
                          <h3>{candidate.title}</h3>
                        </div>
                        <div className="badge-row">
                          <StatusBadge
                            label={formatSeverity(candidate.severity)}
                            tone={getSeverityTone(candidate.severity)}
                          />
                          <StatusBadge
                            label={formatConfidence(candidate.confidence)}
                            tone={getConfidenceTone(candidate.confidence)}
                          />
                          <StatusBadge
                            label={formatIssueScope(candidate.scope)}
                            tone="muted"
                          />
                        </div>
                      </div>
                      <p className="trace-copy">{candidate.summary}</p>
                      <div className="traceability-section">
                        <p className="subsection-label">Traceability</p>
                        <div className="trace-chip-row">
                          <a
                            className="trace-chip trace-chip-link"
                            href={`#${candidateAnchorId}`}
                          >
                            <code>{candidate.id}</code>
                          </a>
                          {relatedPatchPlans.map((patchPlan) => (
                            <a
                              className="trace-chip trace-chip-link"
                              href={`#${getPatchPlanAnchorId(patchPlan.id)}`}
                              key={`${candidate.id}:${patchPlan.id}`}
                            >
                              <code>{patchPlan.id}</code>
                            </a>
                          ))}
                        </div>
                      </div>
                      <div className="trace-meta-grid">
                        <div>
                          <p className="subsection-label">Affected paths</p>
                          <ul className="simple-list">
                            {candidate.affectedPaths.map((path) => (
                              <li key={`${candidate.id}:${path}`}>
                                <code>{path}</code>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="subsection-label">Affected packages</p>
                          {candidate.affectedPackages.length > 0 ? (
                            <ul className="simple-list">
                              {candidate.affectedPackages.map((pkg) => (
                                <li key={`${candidate.id}:${pkg}`}>
                                  <code>{pkg}</code>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="trace-copy">No package-level scope.</p>
                          )}
                        </div>
                      </div>
                      <details className="trace-expander">
                        <summary>Issue detail</summary>
                        <div className="trace-expander-content">
                          <div>
                            <p className="subsection-label">Why it matters</p>
                            <p className="trace-copy">{candidate.whyItMatters}</p>
                          </div>
                          <div>
                            <p className="subsection-label">Acceptance criteria</p>
                            <ul className="simple-list">
                              {candidate.acceptanceCriteria.map((criterion) => (
                                <li key={`${candidate.id}:${criterion}`}>
                                  {criterion}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="subsection-label">Labels</p>
                            <div className="trace-chip-row">
                              {candidate.labels.map((label) => (
                                <span
                                  className="trace-chip trace-chip-muted"
                                  key={`${candidate.id}:${label}`}
                                >
                                  {label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="subsection-label">Suggested body</p>
                            <p className="trace-copy">{candidate.suggestedBody}</p>
                          </div>
                          <div>
                            <p className="subsection-label">Linked findings</p>
                            <div className="trace-chip-row">
                              {candidate.relatedFindingIds.map((findingId) =>
                                traceability.findingById.has(findingId) ? (
                                  <a
                                    className="trace-chip trace-chip-link"
                                    href={`#${getFindingAnchorId(findingId)}`}
                                    key={`${candidate.id}:${findingId}`}
                                  >
                                    <code>{findingId}</code>
                                  </a>
                                ) : (
                                  <span
                                    className="trace-chip trace-chip-muted"
                                    key={`${candidate.id}:${findingId}`}
                                  >
                                    <code>{findingId}</code>
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-copy">
                No issue candidates are referenced by the current readiness cards.
              </p>
            )}
          </Panel>

          <Panel
            className="panel-wide"
            eyebrow="Findings"
            id={TRACEABILITY_FINDINGS_SECTION_ID}
            title="Linked findings"
          >
            {traceability.referencedFindings.length > 0 ? (
              <div className="traceability-list">
                {traceability.referencedFindings.map((finding) => {
                  const findingAnchorId = getFindingAnchorId(finding.id);
                  const relatedPatchPlans =
                    traceability.patchPlansByFindingId.get(finding.id) ?? [];

                  return (
                    <article
                      className="trace-card"
                      id={findingAnchorId}
                      key={finding.id}
                    >
                      <div className="trace-card-header">
                        <div>
                          <p className="subsection-label">{formatSourceType(finding.sourceType)}</p>
                          <h3>{finding.title}</h3>
                        </div>
                        <div className="badge-row">
                          <StatusBadge
                            label={formatSeverity(finding.severity)}
                            tone={getSeverityTone(finding.severity)}
                          />
                          <StatusBadge
                            label={formatConfidence(finding.confidence)}
                            tone={getConfidenceTone(finding.confidence)}
                          />
                        </div>
                      </div>
                      <p className="trace-copy">{finding.summary}</p>
                      <div className="traceability-section">
                        <p className="subsection-label">Traceability</p>
                        <div className="trace-chip-row">
                          <a
                            className="trace-chip trace-chip-link"
                            href={`#${findingAnchorId}`}
                          >
                            <code>{finding.id}</code>
                          </a>
                          {relatedPatchPlans.map((patchPlan) => (
                            <a
                              className="trace-chip trace-chip-link"
                              href={`#${getPatchPlanAnchorId(patchPlan.id)}`}
                              key={`${finding.id}:${patchPlan.id}`}
                            >
                              <code>{patchPlan.id}</code>
                            </a>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="subsection-label">Paths</p>
                        <ul className="simple-list">
                          {finding.paths.map((path) => (
                            <li key={`${finding.id}:${path}`}>
                              <code>{path}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <details className="trace-expander">
                        <summary>Finding detail</summary>
                        <div className="trace-expander-content">
                          <div>
                            <p className="subsection-label">Recommended action</p>
                            <p className="trace-copy">{finding.recommendedAction}</p>
                          </div>
                          {finding.evidence.length > 0 ? (
                            <div>
                              <p className="subsection-label">Evidence</p>
                              <ul className="simple-list">
                                {finding.evidence.map((entry) => (
                                  <li key={`${finding.id}:${entry.label}:${entry.value}`}>
                                    <strong>{entry.label}:</strong> {entry.value}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {finding.lineSpans.length > 0 ? (
                            <div>
                              <p className="subsection-label">Line spans</p>
                              <ul className="simple-list">
                                {finding.lineSpans.map((lineSpan) => (
                                  <li
                                    key={`${finding.id}:${lineSpan.path}:${lineSpan.startLine}:${lineSpan.endLine}`}
                                  >
                                    <code>
                                      {lineSpan.path}:{lineSpan.startLine}-{lineSpan.endLine}
                                    </code>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                          {isDependencyFinding(finding) ? (
                            <>
                              <div className="trace-meta-grid">
                                <div>
                                  <p className="subsection-label">Package</p>
                                  <p className="trace-copy">
                                    <code>{finding.packageName}</code>
                                  </p>
                                </div>
                                <div>
                                  <p className="subsection-label">Installed version</p>
                                  <p className="trace-copy">
                                    {finding.installedVersion ? (
                                      <code>{finding.installedVersion}</code>
                                    ) : (
                                      "Unknown"
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="subsection-label">Remediation version</p>
                                  <p className="trace-copy">
                                    {finding.remediationVersion ? (
                                      <code>{finding.remediationVersion}</code>
                                    ) : (
                                      "None"
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="subsection-label">Remediation type</p>
                                  <p className="trace-copy">{finding.remediationType}</p>
                                </div>
                              </div>
                              {finding.referenceUrls.length > 0 ? (
                                <div>
                                  <p className="subsection-label">References</p>
                                  <ul className="simple-list">
                                    {finding.referenceUrls.map((url) => (
                                      <li key={`${finding.id}:${url}`}>
                                        <a className="trace-link" href={url}>
                                          {url}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </details>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-copy">
                No findings are referenced by the current readiness cards.
              </p>
            )}
          </Panel>

          <Panel
            className="panel-wide"
            eyebrow="Ecosystems"
            title="Ecosystem summary"
          >
            {analysis.ecosystems.length > 0 ? (
              <div className="ecosystem-grid">
                {analysis.ecosystems.map((ecosystem) => (
                  <article className="ecosystem-card" key={ecosystem.ecosystem}>
                    <div className="ecosystem-card-header">
                      <h3>{ecosystemLabels[ecosystem.ecosystem]}</h3>
                      <StatusBadge
                        label={`${ecosystem.manifests.length} manifest${ecosystem.manifests.length === 1 ? "" : "s"}`}
                        tone="active"
                      />
                    </div>
                    <p className="ecosystem-copy">
                      Package managers:{" "}
                      {ecosystem.packageManagers.length > 0
                        ? ecosystem.packageManagers
                            .map((packageManager) => packageManagerLabels[packageManager])
                            .join(", ")
                        : "No lockfile-backed package manager detected"}
                    </p>
                    <ul className="simple-list">
                      <li>Manifests: {ecosystem.manifests.length}</li>
                      <li>Lockfiles: {ecosystem.lockfiles.length}</li>
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-copy">
                No supported ecosystems were inferred from the fetched tree.
              </p>
            )}
          </Panel>

          <Panel eyebrow="Manifests" title="Manifests found">
            {renderFileList(
              analysis.detectedFiles.manifests,
              "No supported manifest files were detected."
            )}
          </Panel>

          <Panel eyebrow="Lockfiles" title="Lockfiles found">
            {renderFileList(
              analysis.detectedFiles.lockfiles,
              "No supported lockfiles were detected."
            )}
          </Panel>

          <Panel eyebrow="Signals" title="Signals and notable files">
            {renderSignalList(
              analysis.detectedFiles.signals,
              analysis.treeSummary.samplePaths
            )}
          </Panel>

          <Panel className="panel-wide" eyebrow="Warnings" title="Warnings">
            {analysis.warnings.length > 0 ? (
              <ul className="warning-list">
                {analysis.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-copy">
                No warnings surfaced for this repository snapshot.
              </p>
            )}
          </Panel>
        </>
      ) : null}
    </PageShell>
  );
}

export default App;
