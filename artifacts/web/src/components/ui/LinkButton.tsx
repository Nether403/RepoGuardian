import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type LinkButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "unstyled";

const VARIANT_CLASS: Record<LinkButtonVariant, string> = {
  primary: "submit-button",
  secondary: "secondary-button",
  ghost: "ghost-button",
  danger: "danger-button",
  unstyled: ""
};

export type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: LinkButtonVariant;
  icon?: IconName;
  iconPosition?: "leading" | "trailing";
  external?: boolean;
  children?: ReactNode;
};

export function LinkButton({
  variant = "secondary",
  icon,
  iconPosition = "leading",
  external = false,
  className,
  children,
  rel,
  target,
  ...rest
}: LinkButtonProps) {
  const composedClassName = [VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");
  const renderedIcon = icon ? <Icon name={icon} /> : null;
  const resolvedTarget = target ?? (external ? "_blank" : undefined);
  const resolvedRel =
    rel ?? (resolvedTarget === "_blank" ? "noreferrer" : undefined);

  return (
    <a
      className={composedClassName}
      rel={resolvedRel}
      target={resolvedTarget}
      {...rest}
    >
      {iconPosition === "leading" ? renderedIcon : null}
      {children}
      {iconPosition === "trailing" ? renderedIcon : null}
    </a>
  );
}
