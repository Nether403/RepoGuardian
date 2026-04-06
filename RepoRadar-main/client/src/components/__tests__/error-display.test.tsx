import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorDisplay } from "../error-display";
import { 
  TierRestrictionError, 
  ValidationError, 
  NetworkError,
  AppError 
} from "@/lib/error-handling";

describe("ErrorDisplay", () => {
  it("should render tier restriction as upgrade prompt", () => {
    const error = new TierRestrictionError("Upgrade required", "free", "pro");
    render(<ErrorDisplay error={error} />);
    expect(screen.getByText(/upgrade/i)).toBeInTheDocument();
  });

  it("should render network error with appropriate icon", () => {
    const error = new NetworkError("Connection failed");
    render(<ErrorDisplay error={error} />);
    expect(screen.getByText("Connection Error")).toBeInTheDocument();
    expect(screen.getByText(/network connection/i)).toBeInTheDocument();
  });

  it("should render server error", () => {
    const error = new AppError("Server error", "SERVER_ERROR", 500, true);
    render(<ErrorDisplay error={error} />);
    expect(screen.getByText("Server Error")).toBeInTheDocument();
  });

  it("should render validation error", () => {
    const error = new ValidationError("Invalid email", "email");
    render(<ErrorDisplay error={error} />);
    expect(screen.getByText("Validation Error")).toBeInTheDocument();
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });

  it("should show retry button for retryable errors", () => {
    const error = new NetworkError();
    const onRetry = vi.fn();
    render(<ErrorDisplay error={error} onRetry={onRetry} />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("should not show retry button for non-retryable errors", () => {
    const error = new ValidationError("Invalid");
    const onRetry = vi.fn();
    render(<ErrorDisplay error={error} onRetry={onRetry} />);
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("should call onRetry when button is clicked", async () => {
    const user = userEvent.setup();
    const error = new NetworkError();
    const onRetry = vi.fn();
    
    render(<ErrorDisplay error={error} onRetry={onRetry} />);
    
    const button = screen.getByRole("button", { name: /try again/i });
    await user.click(button);
    
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("should render compact version", () => {
    const error = new NetworkError();
    const onRetry = vi.fn();
    
    render(<ErrorDisplay error={error} onRetry={onRetry} compact />);
    
    // Compact version should not have the full card structure
    expect(screen.queryByText("Connection Error")).not.toBeInTheDocument();
    // But should still show the message
    expect(screen.getByText(/network connection/i)).toBeInTheDocument();
  });
});
