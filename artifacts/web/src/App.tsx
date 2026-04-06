import { PageShell } from "./components/PageShell";
import { Panel } from "./components/Panel";
import { StatusBadge } from "./components/StatusBadge";

const stages = [
  {
    description: "Workspace tooling, package boundaries, API health, and the first web surface are ready to build on.",
    label: "Prompt 1",
    status: "In Progress",
    tone: "active" as const
  },
  {
    description: "Repository intake and the synchronous analyze endpoint land next without adding findings or write-back.",
    label: "Prompt 2",
    status: "Up Next",
    tone: "up-next" as const
  },
  {
    description: "Manifest detection, ecosystem inference, and Milestone 1 result rendering close out the first slice.",
    label: "Prompt 3",
    status: "Planned",
    tone: "muted" as const
  }
];

const guardrails = [
  "Public GitHub intake only",
  "Read-only GitHub boundary",
  "No clone or full checkout",
  "No advisories or code review yet",
  "No issue or PR write-back",
  "No auth or background jobs"
];

function App() {
  return (
    <PageShell
      eyebrow="Milestone 1 Foundation"
      heading="Repo Guardian"
      summary="A supervised repository triage assistant, starting with a narrow scaffold: typed workspace boundaries, a healthy API, and a calm shell for the next intake step."
      aside={
        <div className="hero-stack">
          <StatusBadge label="Prompt 1 foundation" tone="active" />
          <p className="aside-copy">
            The next implementation pass adds repo intake and the locked
            Milestone 1 analyze contract.
          </p>
        </div>
      }
    >
      <Panel
        eyebrow="Current Scope"
        title="What this scaffold includes"
        footer={<StatusBadge label="Stable baseline" tone="active" />}
      >
        <ul className="detail-list">
          <li>pnpm workspace and package scripts</li>
          <li>Express API shell with `GET /health`</li>
          <li>Vite + React web shell with reusable surface primitives</li>
          <li>Library boundaries for shared types, GitHub reads, and ecosystems</li>
        </ul>
      </Panel>

      <Panel eyebrow="Delivery Sequence" title="Prompt staging">
        <div className="stage-list">
          {stages.map((stage) => (
            <div className="stage-row" key={stage.label}>
              <div>
                <p className="stage-label">{stage.label}</p>
                <p className="stage-description">{stage.description}</p>
              </div>
              <StatusBadge label={stage.status} tone={stage.tone} />
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        eyebrow="Guardrails"
        title="Milestone 1 boundaries"
        footer={<p className="footnote">Repo input starts in Prompt 2.</p>}
      >
        <ul className="tag-list">
          {guardrails.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>
    </PageShell>
  );
}

export default App;
