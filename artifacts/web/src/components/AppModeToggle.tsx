import { SegmentedControl, type SegmentedControlOption } from "./ui";

type AppMode = "analysis" | "fleet-admin";

type AppModeToggleProps = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
};

const OPTIONS: ReadonlyArray<SegmentedControlOption<AppMode>> = [
  { value: "analysis", label: "Repository Analysis", icon: "compass" },
  { value: "fleet-admin", label: "Fleet Admin", icon: "fleet" }
];

export function AppModeToggle({ mode, onChange }: AppModeToggleProps) {
  return (
    <SegmentedControl
      ariaLabel="Application mode"
      onChange={onChange}
      options={OPTIONS}
      value={mode}
    />
  );
}
