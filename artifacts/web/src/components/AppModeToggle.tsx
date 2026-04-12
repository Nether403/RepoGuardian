type AppModeToggleProps = {
  mode: "analysis" | "fleet-admin";
  onChange: (mode: "analysis" | "fleet-admin") => void;
};

export function AppModeToggle({ mode, onChange }: AppModeToggleProps) {
  return (
    <div
      aria-label="Application mode"
      className="app-mode-toggle"
      role="tablist"
    >
      <button
        aria-selected={mode === "analysis"}
        className="app-mode-toggle-button"
        onClick={() => onChange("analysis")}
        role="tab"
        type="button"
      >
        Repository Analysis
      </button>
      <button
        aria-selected={mode === "fleet-admin"}
        className="app-mode-toggle-button"
        onClick={() => onChange("fleet-admin")}
        role="tab"
        type="button"
      >
        Fleet Admin
      </button>
    </div>
  );
}
