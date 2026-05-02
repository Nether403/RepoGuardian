import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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

type IndicatorRect = { left: number; width: number } | null;

export function SegmentedControl<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
  role = "tablist",
  className
}: SegmentedControlProps<T>) {
  const itemRole = role === "tablist" ? "tab" : "radio";
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState<IndicatorRect>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const active = container.querySelector<HTMLButtonElement>(
      '[data-segmented-active="true"]'
    );
    if (!active) {
      setIndicator(null);
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const buttonRect = active.getBoundingClientRect();
    setIndicator({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width
    });
  }, [value, options]);

  const composedClassName = ["app-mode-toggle", "segmented-control", className]
    .filter(Boolean)
    .join(" ");
  const indicatorStyle: CSSProperties | undefined = indicator
    ? {
        transform: `translateX(${indicator.left}px)`,
        width: `${indicator.width}px`
      }
    : undefined;

  return (
    <div
      aria-label={ariaLabel}
      className={composedClassName}
      ref={containerRef}
      role={role}
    >
      {indicator ? (
        <span
          aria-hidden="true"
          className="segmented-control-indicator"
          style={indicatorStyle}
        />
      ) : null}
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
            data-segmented-active={isSelected ? "true" : undefined}
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
