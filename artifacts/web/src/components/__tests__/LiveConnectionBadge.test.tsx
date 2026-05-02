import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LiveConnectionBadge } from "../LiveConnectionBadge";

afterEach(() => {
  cleanup();
});

describe("LiveConnectionBadge", () => {
  it("renders the live label and variant when the channel is open", () => {
    render(<LiveConnectionBadge state="open" />);

    const badge = screen.getByTestId("live-connection-badge");
    expect(badge).toHaveTextContent("Live");
    expect(badge).toHaveAttribute("data-variant", "live");
    expect(badge).toHaveAttribute("data-state", "open");
    expect(badge).toHaveAttribute("role", "status");
  });

  it("renders the reconnecting label for the connecting state", () => {
    render(<LiveConnectionBadge state="connecting" />);

    const badge = screen.getByTestId("live-connection-badge");
    expect(badge).toHaveTextContent("Reconnecting");
    expect(badge).toHaveAttribute("data-variant", "reconnecting");
    expect(badge).toHaveAttribute("data-state", "connecting");
  });

  it("renders the reconnecting label when the SSE stream errored (backoff window)", () => {
    render(<LiveConnectionBadge state="error" />);

    const badge = screen.getByTestId("live-connection-badge");
    expect(badge).toHaveTextContent("Reconnecting");
    expect(badge).toHaveAttribute("data-variant", "reconnecting");
    expect(badge).toHaveAttribute("data-state", "error");
  });

  it("renders the offline variant when the hook is idle (workspace not selected)", () => {
    render(<LiveConnectionBadge state="idle" />);

    const badge = screen.getByTestId("live-connection-badge");
    expect(badge).toHaveTextContent("Offline");
    expect(badge).toHaveAttribute("data-variant", "offline");
    expect(badge).toHaveAttribute("data-state", "idle");
  });

  it("renders the offline variant when the source has been closed", () => {
    render(<LiveConnectionBadge state="closed" />);

    const badge = screen.getByTestId("live-connection-badge");
    expect(badge).toHaveTextContent("Offline");
    expect(badge).toHaveAttribute("data-variant", "offline");
    expect(badge).toHaveAttribute("data-state", "closed");
  });

  it("treats reconnecting as visually distinct from idle/offline", () => {
    const { rerender } = render(<LiveConnectionBadge state="idle" />);
    const idleVariant = screen
      .getByTestId("live-connection-badge")
      .getAttribute("data-variant");

    rerender(<LiveConnectionBadge state="connecting" />);
    const connectingVariant = screen
      .getByTestId("live-connection-badge")
      .getAttribute("data-variant");

    rerender(<LiveConnectionBadge state="error" />);
    const errorVariant = screen
      .getByTestId("live-connection-badge")
      .getAttribute("data-variant");

    expect(idleVariant).toBe("offline");
    expect(connectingVariant).toBe("reconnecting");
    expect(errorVariant).toBe("reconnecting");
    expect(connectingVariant).not.toBe(idleVariant);
    expect(errorVariant).not.toBe(idleVariant);
  });

  it("supports overriding the testid for host-specific assertions", () => {
    render(<LiveConnectionBadge data-testid="custom-id" state="open" />);
    expect(screen.getByTestId("custom-id")).toBeInTheDocument();
  });

  it("announces transitions via aria-live by default", () => {
    render(<LiveConnectionBadge state="connecting" />);

    const badge = screen.getByTestId("live-connection-badge");
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveAttribute("aria-live", "polite");
    expect(badge).toHaveAttribute("data-announce", "true");
  });

  it("suppresses aria-live announcements when announce is false", () => {
    render(<LiveConnectionBadge announce={false} state="connecting" />);

    const badge = screen.getByTestId("live-connection-badge");
    expect(badge).not.toHaveAttribute("role");
    expect(badge).not.toHaveAttribute("aria-live");
    expect(badge).toHaveAttribute("data-announce", "false");
    // Still needs an accessible name for screen readers, just not as a live region.
    expect(badge).toHaveAttribute("aria-label", expect.stringMatching(/live update/i));
  });
});
