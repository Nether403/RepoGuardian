import { Icon, type IconName } from "./Icon";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

export type SegmentedControlProps<T extends string> = {
  ariaLabel: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<SegmentedControlOption<T>>;
  role?: "tablist" | "radiogroup";
  className?: string;
};

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
  role = "tablist",
  className
}: SegmentedControlProps<T>) {
  const itemRole = role === "tablist" ? "tab" : "radio";
  const composedClassName = ["app-mode-toggle", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div aria-label={ariaLabel} className={composedClassName} role={role}>
      {options.map((option) => {
        const isSelected = option.value === value;
        const ariaProps =
          role === "tablist"
            ? { "aria-selected": isSelected }
            : { "aria-checked": isSelected };
        return (
          <button
            {...ariaProps}
            className="app-mode-toggle-button"
            key={option.value}
            onClick={() => onChange(option.value)}
            role={itemRole}
            type="button"
          >
            {option.icon ? <Icon name={option.icon} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
