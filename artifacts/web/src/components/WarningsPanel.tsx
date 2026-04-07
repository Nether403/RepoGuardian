import type { AnalyzeRepoResponse } from "@repo-guardian/shared-types";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type PartialAnalysisPanelProps = {
  isPartial: boolean;
};

type WarningsPanelProps = {
  analysis: AnalyzeRepoResponse;
};

export function PartialAnalysisPanel({ isPartial }: PartialAnalysisPanelProps) {
  if (!isPartial) {
    return null;
  }

  return (
    <Panel
      className="panel-wide partial-banner"
      eyebrow="Snapshot Coverage"
      footer={<StatusBadge label="Partial snapshot" tone="warning" />}
      title="Partial analysis"
    >
      <p className="empty-copy">
        GitHub reported incomplete tree coverage for this repository snapshot. Repo
        Guardian still returns the available metadata and detected files, but later
        results should be interpreted as partial.
      </p>
    </Panel>
  );
}

export function WarningsPanel({ analysis }: WarningsPanelProps) {
  return (
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
  );
}
