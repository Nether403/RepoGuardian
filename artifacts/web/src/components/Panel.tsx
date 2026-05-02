import type { PropsWithChildren, ReactNode } from "react";
import { Card, resolveEyebrowIcon, type IconName } from "./ui";

type PanelProps = PropsWithChildren<{
  title: string;
  eyebrow?: string;
  footer?: ReactNode;
  className?: string;
  id?: string;
  icon?: IconName;
}>;

export function Panel({
  children,
  className,
  eyebrow,
  footer,
  icon,
  id,
  title
}: PanelProps) {
  return (
    <Card
      className={className}
      eyebrow={eyebrow}
      footer={footer}
      icon={icon ?? resolveEyebrowIcon(eyebrow)}
      id={id}
      title={title}
    >
      {children}
    </Card>
  );
}
