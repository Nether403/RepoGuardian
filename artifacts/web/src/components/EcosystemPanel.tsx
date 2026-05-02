import type {
  AnalyzeRepoResponse,
  DetectedFileGroup,
  DetectedSignal
} from "@repo-guardian/shared-types";
import {
  ecosystemLabels,
  packageManagerLabels,
  signalLabels
} from "../features/analysis/view-model";
import { EmptyState } from "./ui";
import { Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

type EcosystemPanelProps = {
  analysis: AnalyzeRepoResponse;
};

function renderFileList(items: DetectedFileGroup[], emptyLabel: string) {
  if (items.length === 0) {
    return <EmptyState>{emptyLabel}</EmptyState>;
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
    return <EmptyState>No workflow or infra signals were detected.</EmptyState>;
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

export function EcosystemPanel({ analysis }: EcosystemPanelProps) {
  return (
    <>
      <Panel className="panel-wide" eyebrow="Ecosystems" title="Ecosystem summary">
        {analysis.ecosystems.length > 0 ? (
          <div className="ecosystem-grid">
            {analysis.ecosystems.map((ecosystem) => (
              <article className="ecosystem-card" key={ecosystem.ecosystem}>
                <div className="ecosystem-card-header">
                  <h3>{ecosystemLabels[ecosystem.ecosystem]}</h3>
                  <StatusBadge
                    label={`${ecosystem.manifests.length} manifest${
                      ecosystem.manifests.length === 1 ? "" : "s"
                    }`}
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
          <EmptyState>No supported ecosystems were inferred from the fetched tree.</EmptyState>
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
    </>
  );
}
