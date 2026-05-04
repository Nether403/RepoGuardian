import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { UiGallery } from "../ui";

afterEach(() => {
  cleanup();
});

describe("UiGallery", () => {
  it("renders a section for every primitive in the design system", () => {
    render(<UiGallery />);

    expect(screen.getByTestId("ui-gallery")).toBeInTheDocument();
    for (const id of [
      "tokens",
      "button",
      "icon-button",
      "badge",
      "segmented-control",
      "section-header",
      "empty-state",
      "card",
      "icons"
    ]) {
      expect(screen.getByTestId(`ui-gallery-section-${id}`)).toBeInTheDocument();
    }
  });

  it("renders all badge tones using the shared primitive", () => {
    render(<UiGallery />);
    const badgeSection = screen.getByTestId("ui-gallery-section-badge");

    for (const tone of [
      "active",
      "muted",
      "up-next",
      "warning",
      "success",
      "danger",
      "info",
      "neutral"
    ]) {
      expect(
        badgeSection.querySelector(`.badge-${tone}`)
      ).not.toBeNull();
    }
  });

  it("uses the typed Button primitive for variant samples", () => {
    render(<UiGallery />);
    const buttonSection = screen.getByTestId("ui-gallery-section-button");

    expect(buttonSection.querySelector(".submit-button")).not.toBeNull();
    expect(buttonSection.querySelector(".secondary-button")).not.toBeNull();
    expect(buttonSection.querySelector(".ghost-button")).not.toBeNull();
    expect(buttonSection.querySelector(".danger-button")).not.toBeNull();
  });

  it("toggles the segmented control when a tab is clicked", async () => {
    const user = userEvent.setup();
    render(<UiGallery />);

    const tabs = screen.getAllByRole("tab", { name: "Compare" });
    expect(tabs.length).toBeGreaterThan(0);
    const compareTab = tabs[0]!;
    expect(compareTab).toHaveAttribute("aria-selected", "false");

    await user.click(compareTab);
    expect(compareTab).toHaveAttribute("aria-selected", "true");
  });
});
