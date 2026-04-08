import type { PRCandidate, PRPatchPlan } from "@repo-guardian/shared-types";
import type {
  CandidateTypeFilter,
  EligibilityFilter,
  TraceabilityMapSummaryItem,
  TraceabilityViewModel,
  TraceableFinding,
  WriteBackReadinessSummary
} from "../features/analysis/types";
import {
  TRACEABILITY_ISSUE_CANDIDATES_SECTION_ID,
  TRACEABILITY_PATCH_PLANS_SECTION_ID,
  TRACEABILITY_PR_CANDIDATES_SECTION_ID,
  formatConfidence,
  formatIssueScope,
  formatPatchability,
  formatReadiness,
  formatSeverity,
  formatValidationStatus,
  getCandidateReadinessTone,
  getConfidenceTone,
  getEligibilityTone,
  getFindingAnchorId,
  getIssueCandidateAnchorId,
  getPRCandidateAnchorId,
  getPatchPlanAnchorId,
  getPatchabilityTone,
  getRiskTone,
  getSeverityTone,
  getValidationTone,
  getWriteBackEligibility,
  prCandidateTypeLabels
} from "../features/analysis/view-model";
import { FindingsPanel } from "./FindingsPanel";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type TraceabilityPanelProps = {
  candidateTypeFilter: CandidateTypeFilter;
  candidateTypeFilterOptions: PRPatchPlan["candidateType"][];
  eligibilityFilter: EligibilityFilter;
  onCandidateTypeFilterChange: (value: CandidateTypeFilter) => void;
  onEligibilityFilterChange: (value: EligibilityFilter) => void;
  traceability: TraceabilityViewModel;
  traceabilityMapSummary: TraceabilityMapSummaryItem[];
  visiblePatchPlans: PRPatchPlan[];
  writeBackReadinessSummary: WriteBackReadinessSummary;
};

type PatchPlanCardProps = {
  plan: PRPatchPlan;
  traceability: TraceabilityViewModel;
};

function PatchPlanCard({ plan, traceability }: PatchPlanCardProps) {
  const eligibility = getWriteBackEligibility(plan);
  const patchPlanAnchorId = getPatchPlanAnchorId(plan.id);
  const candidateAnchorId = getPRCandidateAnchorId(plan.prCandidateId);
  const linkedFindings = plan.relatedFindingIds
    .map((findingId) => traceability.findingById.get(findingId))
    .filter((finding): finding is TraceableFinding => Boolean(finding));

  return (
    <article className="readiness-card" id={patchPlanAnchorId}>
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
      {(eligibility.matchedPatterns?.length ?? 0) > 0 ? (
        <div className="traceability-section">
          <p className="subsection-label">Matched workflow patterns</p>
          <div className="trace-chip-row">
            {eligibility.matchedPatterns?.map((pattern) => (
              <span className="trace-chip trace-chip-muted" key={`${plan.id}:${pattern}`}>
                {pattern}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <p className="readiness-summary">{eligibility.summary}</p>
      <ul className="detail-list readiness-details">
        {eligibility.details.map((detail) => (
          <li key={`${plan.id}:${detail}`}>{detail}</li>
        ))}
      </ul>
      <div className="traceability-section">
        <p className="subsection-label">Traceability</p>
        <div className="trace-chip-row">
          <a className="trace-chip trace-chip-link" href={`#${patchPlanAnchorId}`}>
            <code>{plan.id}</code>
          </a>
          <a className="trace-chip trace-chip-link" href={`#${candidateAnchorId}`}>
            <code>{plan.prCandidateId}</code>
          </a>
          {plan.relatedFindingIds.map((findingId) => (
            <a
              className="trace-chip trace-chip-link"
              href={`#${getFindingAnchorId(findingId)}`}
              key={`${plan.id}:${findingId}`}
            >
              <code>{findingId}</code>
            </a>
          ))}
          {plan.linkedIssueCandidateIds.map((issueCandidateId) =>
            traceability.issueCandidateById.has(issueCandidateId) ? (
              <a
                className="trace-chip trace-chip-link"
                href={`#${getIssueCandidateAnchorId(issueCandidateId)}`}
                key={`${plan.id}:${issueCandidateId}`}
              >
                <code>{issueCandidateId}</code>
              </a>
            ) : (
              <span
                className="trace-chip trace-chip-muted"
                key={`${plan.id}:${issueCandidateId}`}
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
          {plan.patchPlan ? (
            <>
              <div>
                <p className="subsection-label">Patch strategy</p>
                <p className="trace-copy">{plan.patchPlan.patchStrategy}</p>
              </div>
              <div>
                <p className="subsection-label">Planned files</p>
                <ul className="file-list">
                  {plan.patchPlan.filesPlanned.map((filePlan) => (
                    <li className="file-row" key={`${plan.id}:${filePlan.path}`}>
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
                  {plan.patchPlan.constraints.map((constraint) => (
                    <li key={`${plan.id}:${constraint}`}>{constraint}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="subsection-label">Validation steps</p>
                <ul className="simple-list">
                  {plan.patchPlan.requiredValidationSteps.map((step) => (
                    <li key={`${plan.id}:${step}`}>{step}</li>
                  ))}
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
              {plan.validationNotes.map((note) => (
                <li key={`${plan.id}:${note}`}>{note}</li>
              ))}
            </ul>
          </div>
          {linkedFindings.length > 0 ? (
            <div>
              <p className="subsection-label">Linked findings</p>
              <ul className="simple-list">
                {linkedFindings.map((finding) => (
                  <li key={`${plan.id}:${finding.id}`}>
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
}

function PRCandidateTraceabilityPanel({
  traceability
}: {
  traceability: TraceabilityViewModel;
}) {
  return (
    <Panel
      className="panel-wide"
      eyebrow="PR Candidates"
      id={TRACEABILITY_PR_CANDIDATES_SECTION_ID}
      title="PR candidate traceability"
    >
      {traceability.referencedCandidates.length > 0 ? (
        <div className="traceability-list">
          {traceability.referencedCandidates.map((candidate) => (
            <PRCandidateTraceabilityCard
              candidate={candidate}
              key={candidate.id}
              traceability={traceability}
            />
          ))}
        </div>
      ) : (
        <p className="empty-copy">
          No PR candidates are referenced by the current readiness cards.
        </p>
      )}
    </Panel>
  );
}

function PRCandidateTraceabilityCard({
  candidate,
  traceability
}: {
  candidate: PRCandidate;
  traceability: TraceabilityViewModel;
}) {
  const candidateAnchorId = getPRCandidateAnchorId(candidate.id);
  const relatedPatchPlans =
    traceability.patchPlansByCandidateId.get(candidate.id) ?? [];

  return (
    <article className="trace-card" id={candidateAnchorId}>
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
      <TraceabilityBacklinkChips
        anchorId={candidateAnchorId}
        entityId={candidate.id}
        relatedPatchPlans={relatedPatchPlans}
      />
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
                <li className="file-row" key={`${candidate.id}:${change.path}`}>
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
}

function IssueCandidateTraceabilityPanel({
  traceability
}: {
  traceability: TraceabilityViewModel;
}) {
  return (
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
              <article className="trace-card" id={candidateAnchorId} key={candidate.id}>
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
                <TraceabilityBacklinkChips
                  anchorId={candidateAnchorId}
                  entityId={candidate.id}
                  relatedPatchPlans={relatedPatchPlans}
                />
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
                          <li key={`${candidate.id}:${criterion}`}>{criterion}</li>
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
  );
}

function TraceabilityBacklinkChips({
  anchorId,
  entityId,
  relatedPatchPlans
}: {
  anchorId: string;
  entityId: string;
  relatedPatchPlans: PRPatchPlan[];
}) {
  return (
    <div className="traceability-section">
      <p className="subsection-label">Traceability</p>
      <div className="trace-chip-row">
        <a className="trace-chip trace-chip-link" href={`#${anchorId}`}>
          <code>{entityId}</code>
        </a>
        {relatedPatchPlans.map((patchPlan) => (
          <a
            className="trace-chip trace-chip-link"
            href={`#${getPatchPlanAnchorId(patchPlan.id)}`}
            key={`${entityId}:${patchPlan.id}`}
          >
            <code>{patchPlan.id}</code>
          </a>
        ))}
      </div>
    </div>
  );
}

export function TraceabilityPanel({
  candidateTypeFilter,
  candidateTypeFilterOptions,
  eligibilityFilter,
  onCandidateTypeFilterChange,
  onEligibilityFilterChange,
  traceability,
  traceabilityMapSummary,
  visiblePatchPlans,
  writeBackReadinessSummary
}: TraceabilityPanelProps) {
  return (
    <>
      <Panel
        className="panel-wide"
        eyebrow="PR Readiness"
        footer={
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
        }
        title="PR write-back readiness"
      >
        {candidateTypeFilterOptions.length > 0 ? (
          <div className="readiness-list">
            <div className="traceability-map" aria-label="Traceability map summary">
              {traceabilityMapSummary.map((item) => (
                <a className="traceability-map-item" href={item.href} key={item.label}>
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
                    onEligibilityFilterChange(event.target.value as EligibilityFilter)
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
                    onCandidateTypeFilterChange(
                      event.target.value as CandidateTypeFilter
                    )
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
                visiblePatchPlans.map((plan) => (
                  <PatchPlanCard
                    key={plan.id}
                    plan={traceability.patchPlanById.get(plan.id) ?? plan}
                    traceability={traceability}
                  />
                ))
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

      <PRCandidateTraceabilityPanel traceability={traceability} />
      <IssueCandidateTraceabilityPanel traceability={traceability} />
      <FindingsPanel traceability={traceability} />
    </>
  );
}
