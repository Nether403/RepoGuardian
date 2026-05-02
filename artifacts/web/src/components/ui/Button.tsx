import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type ButtonVariant = "primary" | "secondary" | "ghost";

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: "submit-button",
  secondary: "secondary-button",
  ghost: "ghost-button"
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: IconName;
  iconPosition?: "leading" | "trailing";
  loading?: boolean;
  children?: ReactNode;
};

export function Button({
  variant = "secondary",
  icon,
  iconPosition = "leading",
  loading = false,
  className,
  children,
  type,
  disabled,
  ...rest
}: ButtonProps) {
  const composedClassName = [VARIANT_CLASS[variant], className]
    .filter(Boolean)
    .join(" ");
  const renderedIcon = loading ? (
    <Icon name="spinner" className="button-spinner" />
  ) : icon ? (
    <Icon name={icon} />
  ) : null;

  return (
    <button
      className={composedClassName}
      disabled={disabled || loading}
      type={type ?? "button"}
      {...rest}
    >
      {iconPosition === "leading" ? renderedIcon : null}
      {children}
      {iconPosition === "trailing" ? renderedIcon : null}
    </button>
  );
}
