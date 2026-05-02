import { Icon, type IconName } from "./ui";

type AppMode = "analysis" | "fleet-admin";

type AppModeToggleProps = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
};

const TABS: ReadonlyArray<{ id: AppMode; label: string; icon: IconName }> = [
  { id: "analysis", label: "Repository Analysis", icon: "compass" },
  { id: "fleet-admin", label: "Fleet Admin", icon: "fleet" }
];

export function AppModeToggle({ mode, onChange }: AppModeToggleProps) {
  return (
    <div
      aria-label="Application mode"
      className="app-mode-toggle"
      role="tablist"
    >
      {TABS.map((tab) => (
        <button
          aria-selected={mode === tab.id}
          className="app-mode-toggle-button"
          key={tab.id}
          onClick={() => onChange(tab.id)}
          role="tab"
          type="button"
        >
          <Icon name={tab.icon} />
          {tab.label}
        </button>
      ))}
    </div>
  );
}
