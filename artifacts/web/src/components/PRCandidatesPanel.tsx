import type {
  PRCandidate,
  PRPatchPlan,
  PRWriteBackEligibility
} from "@repo-guardian/shared-types";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type PRCandidatesPanelProps = {
  candidates: PRCandidate[];
  onToggleCandidate: (candidateId: string, selected: boolean) => void;
  patchPlans: PRPatchPlan[];
  selectedCandidateIds: string[];
};

const fallbackEligibility: PRWriteBackEligibility = {
  approvalRequired: true,
  details: ["No write-back eligibility details were provided for this PR candidate."],
  status: "blocked",
  summary: "Write-back eligibility is not available for this PR candidate."
};

function formatValue(value: string): string {
  return value.replace(/[-_]/gu, " ");
}

function getReadinessTone(readiness: PRCandidate["readiness"]): "active" | "muted" | "warning" {
  if (readiness === "ready") {
    return "active";
  }

  return readiness === "ready_with_warnings" ? "warning" : "muted";
}

function getRiskTone(riskLevel: PRCandidate["riskLevel"]): "muted" | "warning" {
  return riskLevel === "low" ? "muted" : "warning";
}

function getEligibilityTone(
  status: PRWriteBackEligibility["status"]
): "active" | "warning" {
  return status === "executable" ? "active" : "warning";
}

export function PRCandidatesPanel({
  candidates,
  onToggleCandidate,
  patchPlans,
  selectedCandidateIds
}: PRCandidatesPanelProps) {
  const selectedIds = new Set(selectedCandidateIds);
  const patchPlanByCandidateId = new Map(
    patchPlans.map((patchPlan) => [patchPlan.prCandidateId, patchPlan])
  );

  return (
    <Panel
      className="panel-wide"
      eyebrow="Action Selection"
      footer={
        <StatusBadge
          label={`${selectedIds.size} of ${candidates.length} selected`}
          tone={selectedIds.size > 0 ? "active" : "muted"}
        />
      }
      title="PR candidates"
    >
      {candidates.length > 0 ? (
        <div className="candidate-selection-list">
          {candidates.map((candidate) => {
            const patchPlan = patchPlanByCandidateId.get(candidate.id);
            const eligibility = patchPlan?.writeBackEligibility ?? fallbackEligibility;

            return (
              <article className="candidate-selection-card" key={candidate.id}>
                <label className="candidate-selection-control">
                  <input
                    checked={selectedIds.has(candidate.id)}
                    onChange={(event) =>
                      onToggleCandidate(candidate.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  <span>Select PR candidate</span>
                </label>
                <div className="candidate-selection-content">
                  <div className="candidate-selection-header">
                    <div>
                      <p className="subsection-label">{formatValue(candidate.candidateType)}</p>
                      <h3>{candidate.title}</h3>
                    </div>
                    <div className="badge-row">
                      <StatusBadge
                        label={formatValue(candidate.readiness)}
                        tone={getReadinessTone(candidate.readiness)}
                      />
                      <StatusBadge
                        label={`${candidate.riskLevel} risk`}
                        tone={getRiskTone(candidate.riskLevel)}
                      />
                      <StatusBadge
                        label={eligibility.status}
                        tone={getEligibilityTone(eligibility.status)}
                      />
                    </div>
                  </div>
                  <p className="trace-copy">{candidate.summary}</p>
                  <p className="readiness-summary">{eligibility.summary}</p>
                  <div className="trace-meta-grid">
                    <div>
                      <p className="subsection-label">Expected file changes</p>
                      <ul className="file-list">
                        {candidate.expectedFileChanges.map((change) => (
                          <li
                            className="file-row"
                            key={`${candidate.id}:${change.path}:${change.reason}`}
                          >
                            <span className="file-kind">{change.changeType}</span>
                            <code>{change.path}</code>
                            <span className="trace-copy">{change.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="subsection-label">Linked issue candidates</p>
                      {candidate.linkedIssueCandidateIds.length > 0 ? (
                        <div className="trace-chip-row">
                          {candidate.linkedIssueCandidateIds.map((candidateId) => (
                            <span
                              className="trace-chip trace-chip-muted"
                              key={`${candidate.id}:${candidateId}`}
                            >
                              <code>{candidateId}</code>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="trace-copy">No linked issue candidates.</p>
                      )}
                    </div>
                  </div>
                  <details className="trace-expander">
                    <summary>PR candidate detail</summary>
                    <div className="trace-expander-content">
                      <div>
                        <p className="subsection-label">Rationale</p>
                        <p className="trace-copy">{candidate.rationale}</p>
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
                        <p className="subsection-label">Eligibility details</p>
                        <ul className="simple-list">
                          {eligibility.details.map((detail) => (
                            <li key={`${candidate.id}:${detail}`}>{detail}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="subsection-label">Candidate ID</p>
                        <code>{candidate.id}</code>
                      </div>
                    </div>
                  </details>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-copy">No PR candidates were generated.</p>
      )}
    </Panel>
  );
}
