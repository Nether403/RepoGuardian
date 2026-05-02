import type { ButtonHTMLAttributes } from "react";
import { Icon, type IconName } from "./Icon";

type IconButtonVariant = "ghost" | "subtle";

const VARIANT_CLASS: Record<IconButtonVariant, string> = {
  ghost: "icon-button icon-button-ghost",
  subtle: "icon-button icon-button-subtle"
};

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-label" | "children"
> & {
  icon: IconName;
  label: string;
  variant?: IconButtonVariant;
  size?: "sm" | "md";
};

export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  className,
  type,
  ...rest
}: IconButtonProps) {
  const composedClassName = [
    VARIANT_CLASS[variant],
    size === "sm" ? "icon-button-sm" : null,
    className
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      aria-label={label}
      className={composedClassName}
      type={type ?? "button"}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}
