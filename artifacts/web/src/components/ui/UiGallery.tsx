import { useState, type ReactNode } from "react";
import { Badge, type BadgeTone } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";
import { LinkButton } from "./LinkButton";
import { SectionHeader } from "./SectionHeader";
import { SegmentedControl, type SegmentedControlOption } from "./SegmentedControl";

const ALL_ICON_NAMES: ReadonlyArray<IconName> = [
  "activity",
  "alert",
  "arrow-right",
  "bell",
  "check",
  "chevron-right",
  "circle-dot",
  "close",
  "compass",
  "fleet",
  "github",
  "info",
  "play",
  "refresh",
  "search",
  "shield",
  "spark",
  "spinner",
  "warning",
  "x"
];

const BADGE_TONES: ReadonlyArray<BadgeTone> = [
  "active",
  "muted",
  "up-next",
  "warning",
  "success",
  "danger",
  "info",
  "neutral"
];

type GallerySection = {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
};

function GallerySectionBlock({ id, title, description, children }: GallerySection) {
  return (
    <section className="ui-gallery-section" data-testid={`ui-gallery-section-${id}`} id={id}>
      <header className="ui-gallery-section-header">
        <h2>{title}</h2>
        <p>{description}</p>
      </header>
      <div className="ui-gallery-section-body">{children}</div>
    </section>
  );
}

function VariantRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ui-gallery-variant-row">
      <p className="ui-gallery-variant-label">{label}</p>
      <div className="ui-gallery-variant-samples">{children}</div>
    </div>
  );
}

type SegmentedDemoValue = "analysis" | "fleet-admin" | "compare";

function SegmentedControlDemo() {
  const [value, setValue] = useState<SegmentedDemoValue>("analysis");
  const options: ReadonlyArray<SegmentedControlOption<SegmentedDemoValue>> = [
    { value: "analysis", label: "Analysis", icon: "compass" },
    { value: "fleet-admin", label: "Fleet Admin", icon: "fleet" },
    { value: "compare", label: "Compare", icon: "arrow-right" }
  ];
  return (
    <SegmentedControl
      ariaLabel="Demo segmented control"
      onChange={setValue}
      options={options}
      value={value}
    />
  );
}

type RadioDemoValue = "low" | "medium" | "high";

function SegmentedControlRadioDemo() {
  const [value, setValue] = useState<RadioDemoValue>("medium");
  const options: ReadonlyArray<SegmentedControlOption<RadioDemoValue>> = [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" }
  ];
  return (
    <SegmentedControl
      ariaLabel="Demo radio segmented control"
      onChange={setValue}
      options={options}
      role="radiogroup"
      value={value}
    />
  );
}

export function UiGallery() {
  return (
    <div className="ui-gallery" data-testid="ui-gallery">
      <header className="ui-gallery-topbar">
        <div className="app-brand">
          <span aria-hidden="true" className="app-brand-mark">
            <Icon name="shield" />
          </span>
          <span className="app-brand-name">
            <strong>Repo Guardian</strong>
            <span>UI Primitives Gallery</span>
          </span>
        </div>
        <p className="ui-gallery-topbar-meta">
          Visual reference for the design tokens and primitives under{" "}
          <code>components/ui/</code>.
        </p>
      </header>

      <main className="ui-gallery-content">
        <GallerySectionBlock
          description="Surfaces, text, and accent palette derived from CSS custom properties in index.css."
          id="tokens"
          title="Design tokens"
        >
          <VariantRow label="Surfaces">
            <span className="ui-gallery-swatch" data-token="--surface">
              surface
            </span>
            <span
              className="ui-gallery-swatch"
              data-token="--surface-1"
              style={{ background: "var(--surface-1)" }}
            >
              surface-1
            </span>
            <span
              className="ui-gallery-swatch"
              data-token="--surface-2"
              style={{ background: "var(--surface-2)" }}
            >
              surface-2
            </span>
            <span
              className="ui-gallery-swatch"
              data-token="--surface-inset"
              style={{ background: "var(--surface-inset)" }}
            >
              surface-inset
            </span>
          </VariantRow>
          <VariantRow label="Accents">
            <span
              className="ui-gallery-swatch"
              style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}
            >
              accent
            </span>
            <span
              className="ui-gallery-swatch"
              style={{ background: "var(--amber-soft)", color: "var(--amber-strong)" }}
            >
              amber
            </span>
            <span
              className="ui-gallery-swatch"
              style={{ background: "var(--success-soft)", color: "var(--success)" }}
            >
              success
            </span>
            <span
              className="ui-gallery-swatch"
              style={{ background: "var(--danger-soft)", color: "var(--danger-strong)" }}
            >
              danger
            </span>
            <span
              className="ui-gallery-swatch"
              style={{ background: "var(--violet-soft)", color: "#d8ccff" }}
            >
              violet
            </span>
          </VariantRow>
          <VariantRow label="Text">
            <span style={{ color: "var(--text-strong)" }}>text-strong</span>
            <span style={{ color: "var(--text)" }}>text</span>
            <span style={{ color: "var(--text-muted)" }}>text-muted</span>
            <span style={{ color: "var(--text-soft)" }}>text-soft</span>
          </VariantRow>
        </GallerySectionBlock>

        <GallerySectionBlock
          description="Primary, secondary, ghost, and danger variants. All states (hover, focus-visible, active, disabled, loading) are wired to tokens."
          id="button"
          title="Button"
        >
          <VariantRow label="Variants">
            <Button variant="primary">Primary action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </VariantRow>
          <VariantRow label="With icon">
            <Button icon="play" variant="primary">
              Run analysis
            </Button>
            <Button icon="refresh" variant="secondary">
              Refresh
            </Button>
            <Button icon="arrow-right" iconPosition="trailing" variant="ghost">
              View details
            </Button>
          </VariantRow>
          <VariantRow label="States">
            <Button loading variant="primary">
              Loading
            </Button>
            <Button disabled variant="primary">
              Disabled
            </Button>
            <Button disabled variant="secondary">
              Disabled
            </Button>
          </VariantRow>
          <VariantRow label="Link buttons">
            <LinkButton href="#button" variant="primary">
              Primary link
            </LinkButton>
            <LinkButton href="#button" variant="secondary">
              Secondary link
            </LinkButton>
            <LinkButton external href="https://example.com" icon="github" variant="ghost">
              External
            </LinkButton>
          </VariantRow>
        </GallerySectionBlock>

        <GallerySectionBlock
          description="Compact icon-only buttons that surface ghost or subtle backgrounds."
          id="icon-button"
          title="IconButton"
        >
          <VariantRow label="Ghost">
            <IconButton icon="bell" label="Notifications" />
            <IconButton icon="search" label="Search" />
            <IconButton icon="close" label="Close" />
          </VariantRow>
          <VariantRow label="Subtle">
            <IconButton icon="bell" label="Notifications" variant="subtle" />
            <IconButton icon="refresh" label="Refresh" variant="subtle" />
            <IconButton disabled icon="play" label="Play (disabled)" variant="subtle" />
          </VariantRow>
          <VariantRow label="Small">
            <IconButton icon="close" label="Close" size="sm" />
            <IconButton icon="x" label="Dismiss" size="sm" variant="subtle" />
          </VariantRow>
        </GallerySectionBlock>

        <GallerySectionBlock
          description="Status pills used across the panels. Each tone pairs a default icon with the underlying color token."
          id="badge"
          title="Badge"
        >
          <VariantRow label="Tones">
            {BADGE_TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </VariantRow>
          <VariantRow label="Custom icon / no icon">
            <Badge icon="github" tone="info">
              github
            </Badge>
            <Badge icon={false} tone="muted">
              text only
            </Badge>
          </VariantRow>
        </GallerySectionBlock>

        <GallerySectionBlock
          description="Animated segmented selector used by the AppMode toggle and other tabbed surfaces."
          id="segmented-control"
          title="SegmentedControl"
        >
          <VariantRow label="Tablist (default)">
            <SegmentedControlDemo />
          </VariantRow>
          <VariantRow label="Radiogroup">
            <SegmentedControlRadioDemo />
          </VariantRow>
        </GallerySectionBlock>

        <GallerySectionBlock
          description="Reusable header used by Card and Panel. Composes eyebrow + icon + title + actions."
          id="section-header"
          title="SectionHeader"
        >
          <VariantRow label="Title only">
            <SectionHeader title="Plain section header" />
          </VariantRow>
          <VariantRow label="Eyebrow + icon">
            <SectionHeader
              eyebrow="Approval-Gated Analysis"
              icon="shield"
              title="Repository intake"
            />
          </VariantRow>
          <VariantRow label="With actions">
            <SectionHeader
              actions={
                <>
                  <Button icon="refresh" variant="ghost">
                    Refresh
                  </Button>
                  <IconButton icon="close" label="Dismiss" />
                </>
              }
              eyebrow="Findings"
              icon="warning"
              title="Open findings"
            />
          </VariantRow>
        </GallerySectionBlock>

        <GallerySectionBlock
          description="Empty/zero-state container with optional icon, title, body, and call-to-action row."
          id="empty-state"
          title="EmptyState"
        >
          <VariantRow label="Default">
            <EmptyState
              actions={
                <Button icon="play" variant="primary">
                  Run a sweep
                </Button>
              }
              icon="compass"
              title="No analyses yet"
            >
              Trigger your first sweep to populate this view.
            </EmptyState>
          </VariantRow>
          <VariantRow label="Body only">
            <EmptyState>
              Awaiting first repository snapshot.
            </EmptyState>
          </VariantRow>
        </GallerySectionBlock>

        <GallerySectionBlock
          description="Composable surface used by every panel. Wraps SectionHeader and a body region."
          id="card"
          title="Card"
        >
          <Card
            actions={<Badge tone="active">Live</Badge>}
            eyebrow="Snapshot Coverage"
            footer={
              <div className="ui-gallery-card-footer">
                <Button icon="arrow-right" iconPosition="trailing" variant="ghost">
                  View report
                </Button>
              </div>
            }
            icon="warning"
            title="Sample card"
          >
            <p>
              Cards group related content with a shared header, body, and optional
              footer. They inherit the panel surface from the design tokens.
            </p>
          </Card>
        </GallerySectionBlock>

        <GallerySectionBlock
          description="All registered icons in the design system, drawn from the typed Icon registry."
          id="icons"
          title="Icon registry"
        >
          <div className="ui-gallery-icon-grid">
            {ALL_ICON_NAMES.map((name) => (
              <div className="ui-gallery-icon-cell" key={name}>
                <Icon height={20} name={name} width={20} />
                <code>{name}</code>
              </div>
            ))}
          </div>
        </GallerySectionBlock>
      </main>
    </div>
  );
}
