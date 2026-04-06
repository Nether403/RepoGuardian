import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";

describe("App", () => {
  it("renders the Prompt 1 scaffold shell", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Repo Guardian" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Milestone 1 Foundation/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Repo input starts in Prompt 2/i)
    ).toBeInTheDocument();
  });
});
