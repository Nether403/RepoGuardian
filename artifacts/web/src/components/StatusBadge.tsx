type StatusBadgeProps = {
  label: string;
  tone?: "active" | "muted" | "up-next";
};

const toneClassNames: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  active: "badge-active",
  muted: "badge-muted",
  "up-next": "badge-up-next"
};

export function StatusBadge({
  label,
  tone = "muted"
}: StatusBadgeProps) {
  return <span className={`status-badge ${toneClassNames[tone]}`}>{label}</span>;
}
