import type { ReactNode, SVGProps } from "react";

export type IconName =
  | "activity"
  | "alert"
  | "arrow-right"
  | "bell"
  | "check"
  | "chevron-right"
  | "circle-dot"
  | "close"
  | "compass"
  | "fleet"
  | "github"
  | "info"
  | "play"
  | "refresh"
  | "search"
  | "shield"
  | "spark"
  | "spinner"
  | "warning"
  | "x";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
};

const ICON_PATHS: Record<IconName, ReactNode> = {
  activity: (
    <path d="M3 12h3.5l2-6 4 12 2-6H21" strokeLinecap="round" strokeLinejoin="round" />
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4" strokeLinecap="round" />
      <path d="M12 16h.01" strokeLinecap="round" />
    </>
  ),
  "arrow-right": (
    <>
      <path d="M5 12h14" strokeLinecap="round" />
      <path d="M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 4.5 1.5 6 1.5 6h-15S6 12.5 6 8z" strokeLinejoin="round" />
      <path d="M10.5 18a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />,
  "chevron-right": (
    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  ),
  "circle-dot": (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  close: (
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" strokeLinejoin="round" />
    </>
  ),
  fleet: (
    <>
      <rect x="3" y="5" width="7" height="6" rx="1" />
      <rect x="14" y="5" width="7" height="6" rx="1" />
      <rect x="3" y="14" width="7" height="6" rx="1" />
      <rect x="14" y="14" width="7" height="6" rx="1" />
    </>
  ),
  github: (
    <path
      d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.69-.22.69-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1.01.07 1.54 1.04 1.54 1.04.9 1.53 2.36 1.09 2.93.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.99 1.03-2.69-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.6 1.03 2.69 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
      strokeLinejoin="round"
    />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" strokeLinecap="round" />
      <path d="M12 8h.01" strokeLinecap="round" />
    </>
  ),
  play: (
    <path d="M8 5l11 7-11 7V5z" strokeLinejoin="round" fill="currentColor" stroke="none" />
  ),
  refresh: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" />
      <path d="M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
    </>
  ),
  shield: (
    <path
      d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"
      strokeLinejoin="round"
    />
  ),
  spark: (
    <path
      d="M12 3l1.7 4.6L18 9.3l-4.3 1.7L12 15l-1.7-4-4.3-1.7 4.3-1.7L12 3z"
      strokeLinejoin="round"
    />
  ),
  spinner: (
    <>
      <circle cx="12" cy="12" r="9" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
    </>
  ),
  warning: (
    <>
      <path d="M12 3l10 18H2L12 3z" strokeLinejoin="round" />
      <path d="M12 10v4" strokeLinecap="round" />
      <path d="M12 18h.01" strokeLinecap="round" />
    </>
  ),
  x: (
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
  )
};

export function Icon({
  name,
  width = 16,
  height = 16,
  fill = "none",
  stroke = "currentColor",
  strokeWidth = 1.6,
  ...rest
}: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      fill={fill}
      height={height}
      stroke={stroke}
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
      width={width}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
