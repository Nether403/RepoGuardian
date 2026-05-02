import type { TraceabilityViewModel } from "../features/analysis/types";
import {
  TRACEABILITY_FINDINGS_SECTION_ID,
  formatConfidence,
  formatReachabilityBand,
  formatReachabilityScore,
  formatSeverity,
  formatSourceType,
  getConfidenceTone,
  getFindingAnchorId,
  getPatchPlanAnchorId,
  getReachabilityTone,
  getSeverityTone,
  isDependencyFinding
} from "../features/analysis/view-model";
import { EmptyState } from "./ui";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type FindingsPanelProps = {
  traceability: TraceabilityViewModel;
};

export function FindingsPanel({ traceability }: FindingsPanelProps) {
  return (
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
              <article className="trace-card" id={findingAnchorId} key={finding.id}>
                <div className="trace-card-header">
                  <div>
                    <p className="subsection-label">
                      {formatSourceType(finding.sourceType)}
                    </p>
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
                                {`${lineSpan.path}:${lineSpan.startLine}-${lineSpan.endLine}`}
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
                        <div className="reachability-block">
                          <div className="badge-row">
                            <StatusBadge
                              label={`${formatReachabilityBand(finding.reachability.band)} (${formatReachabilityScore(finding.reachability.score)})`}
                              tone={getReachabilityTone(finding.reachability.band)}
                            />
                          </div>
                          {finding.reachability.signals.length > 0 ? (
                            <ul className="simple-list">
                              {finding.reachability.signals.map((signal) => (
                                <li
                                  key={`${finding.id}:reachability:${signal.kind}:${signal.detail}`}
                                >
                                  {signal.detail}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {finding.reachability.referencedPaths.length > 0 ? (
                            <div>
                              <p className="subsection-label">Referenced files</p>
                              <ul className="simple-list">
                                {finding.reachability.referencedPaths.map((path) => (
                                  <li key={`${finding.id}:reachability-path:${path}`}>
                                    <code>{path}</code>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
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
        <EmptyState>No findings are referenced by the current readiness cards.</EmptyState>
      )}
    </Panel>
  );
}
