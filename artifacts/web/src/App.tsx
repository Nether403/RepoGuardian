import { useState, type FormEvent } from "react";
import type {
  AnalyzeRepoResponse,
  DetectedEcosystem,
  DetectedFileGroup,
  DetectedSignal,
  PRPatchPlan,
  PRWriteBackEligibility
} from "@repo-guardian/shared-types";
import { PageShell } from "./components/PageShell";
import { Panel } from "./components/Panel";
import { RepoInputForm } from "./components/RepoInputForm";
import { StatusBadge } from "./components/StatusBadge";
import {
  AnalyzeRepoClientError,
  analyzeRepository
} from "./lib/api-client";

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

function App() {
  const [analysis, setAnalysis] = useState<AnalyzeRepoResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  const writeBackReadinessSummary = analysis
    ? analysis.prPatchPlans.reduce(
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setHasSubmitted(true);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const nextAnalysis = await analyzeRepository(repoInput);
      setAnalysis(nextAnalysis);
    } catch (error) {
      setAnalysis(null);
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
            write-back readiness, but it will not write to GitHub without explicit
            approval in a later execution request.
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
                {analysis.prPatchPlans.map((plan) => {
                  const eligibility = getWriteBackEligibility(plan);

                  return (
                    <article className="readiness-card" key={plan.prCandidateId}>
                      <div className="readiness-card-header">
                        <div>
                          <p className="subsection-label">
                            {prCandidateTypeLabels[plan.candidateType]}
                          </p>
                          <h3>{plan.title}</h3>
                        </div>
                        <StatusBadge
                          label={eligibility.status}
                          tone={getEligibilityTone(eligibility.status)}
                        />
                      </div>
                      <div className="badge-row">
                        <StatusBadge
                          label={formatPatchability(plan.patchability)}
                          tone={getPatchabilityTone(plan.patchability)}
                        />
                        <StatusBadge
                          label={formatValidationStatus(plan.validationStatus)}
                          tone={getValidationTone(plan.validationStatus)}
                        />
                        {eligibility.approvalRequired ? (
                          <StatusBadge label="Approval required" tone="up-next" />
                        ) : null}
                      </div>
                      <p className="readiness-summary">{eligibility.summary}</p>
                      <ul className="detail-list readiness-details">
                        {eligibility.details.map((detail) => (
                          <li key={`${plan.prCandidateId}:${detail}`}>{detail}</li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="empty-copy">
                No PR patch plans were generated for this repository snapshot.
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
