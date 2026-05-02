import { Badge, type BadgeTone } from "./ui";

type StatusBadgeProps = {
  label: string;
  tone?: BadgeTone;
};

export function StatusBadge({ label, tone = "muted" }: StatusBadgeProps) {
  return <Badge tone={tone}>{label}</Badge>;
}
