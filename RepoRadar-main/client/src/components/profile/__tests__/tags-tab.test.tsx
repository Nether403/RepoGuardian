import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TagsTab } from "../tags-tab";
import * as queryClient from "@/lib/queryClient";

// Mock the API request function
vi.mock("@/lib/queryClient", () => ({
  apiRequest: vi.fn(),
}));

// Mock toast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockTags = [
  {
    id: 1,
    userId: "user-1",
    name: "Frontend",
    color: "#3b82f6",
    createdAt: "2024-01-15T10:00:00Z",
    repositoryCount: 5,
  },
  {
    id: 2,
    userId: "user-1",
    name: "Backend",
    color: "#22c55e",
    createdAt: "2024-01-16T10:00:00Z",
    repositoryCount: 3,
  },
  {
    id: 3,
    userId: "user-1",
    name: "DevOps",
    color: "#f59e0b",
    createdAt: "2024-01-17T10:00:00Z",
    repositoryCount: 0,
  },
];

const createWrapper = (mockData?: any) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { 
        retry: false,
        queryFn: async () => {
          if (mockData instanceof Error) {
            throw mockData;
          }
          // Wrap data in pagination structure if it's an array
          if (Array.isArray(mockData)) {
            return {
              data: mockData,
              pagination: {
                page: 1,
                limit: 1000,
                total: mockData.length,
                totalPages: 1,
                hasMore: false,
              },
            };
          }
          return mockData || { data: [], pagination: { page: 1, limit: 1000, total: 0, totalPages: 0, hasMore: false } };
        },
      },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("TagsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should display loading skeletons while fetching tags", () => {
      render(<TagsTab />, { wrapper: createWrapper() });

      // Should show skeleton elements
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Error State", () => {
    it("should display error message when tags fail to load", async () => {
      const errorMessage = "Failed to fetch tags";
      render(<TagsTab />, { wrapper: createWrapper(new Error(errorMessage)) });

      await waitFor(() => {
        expect(screen.getByText("Failed to load tags")).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
      });
    });

    it("should show retry button after error", async () => {
      render(<TagsTab />, { wrapper: createWrapper(new Error("Network error")) });

      await waitFor(() => {
        expect(screen.getByText("Failed to load tags")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("should display empty state when no tags exist", async () => {
      render(<TagsTab />, { wrapper: createWrapper([]) });

      await waitFor(() => {
        expect(screen.getByText("No tags yet")).toBeInTheDocument();
        expect(
          screen.getByText(/Create custom tags to organize your repositories/i)
        ).toBeInTheDocument();
      });
    });

    it("should show create button in empty state", async () => {
      render(<TagsTab />, { wrapper: createWrapper([]) });

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create your first tag/i })
        ).toBeInTheDocument();
      });
    });
  });

  describe("Tags Display", () => {
    it("should display all tags with correct information", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
        expect(screen.getByText("Backend")).toBeInTheDocument();
        expect(screen.getByText("DevOps")).toBeInTheDocument();
      });

      expect(screen.getByText("5 repositories")).toBeInTheDocument();
      expect(screen.getByText("3 repositories")).toBeInTheDocument();
      expect(screen.getByText("0 repositories")).toBeInTheDocument();
    });

    it("should display correct tag count in header", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("3 Tags")).toBeInTheDocument();
      });
    });

    it("should display singular 'Tag' for single tag", async () => {
      render(<TagsTab />, { wrapper: createWrapper([mockTags[0]]) });

      await waitFor(() => {
        expect(screen.getByText("1 Tag")).toBeInTheDocument();
      });
    });

    it("should display tags in responsive grid", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        const grid = screen.getByText("Frontend").closest(".grid");
        expect(grid).toHaveClass("grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-3");
      });
    });
  });

  describe("Create Tag Form", () => {
    it("should show create form when create button is clicked", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", { name: /create tag/i });
      await userEvent.click(createButton);

      expect(screen.getByLabelText(/tag name/i)).toBeInTheDocument();
      expect(screen.getByText("Color")).toBeInTheDocument();
    });

    it("should hide create form when cancel is clicked", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      // Open form
      const createButton = screen.getByRole("button", { name: /create tag/i });
      await userEvent.click(createButton);

      expect(screen.getByLabelText(/tag name/i)).toBeInTheDocument();

      // Close form
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByLabelText(/tag name/i)).not.toBeInTheDocument();
      });
    });

    it("should validate empty tag name", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", { name: /create tag/i });
      await userEvent.click(createButton);

      // Submit button should be disabled when name is empty
      const submitButton = screen.getByRole("button", { name: /^create tag$/i });
      expect(submitButton).toBeDisabled();
    });

    it("should validate tag name length", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", { name: /create tag/i });
      await userEvent.click(createButton);

      const nameInput = screen.getByLabelText(/tag name/i);
      // Input has maxLength=50, so it won't accept more than 50 characters
      // Type 50 characters and verify it's accepted
      await userEvent.type(nameInput, "a".repeat(50));
      expect(nameInput).toHaveValue("a".repeat(50));
      
      // Submit button should be enabled with valid length
      const submitButton = screen.getByRole("button", { name: /^create tag$/i });
      expect(submitButton).not.toBeDisabled();
    });

    it("should validate duplicate tag names", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", { name: /create tag/i });
      await userEvent.click(createButton);

      const nameInput = screen.getByLabelText(/tag name/i);
      await userEvent.type(nameInput, "Frontend");

      const submitButton = screen.getByRole("button", { name: /^create tag$/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText("A tag with this name already exists")
        ).toBeInTheDocument();
      });
    });

    it("should create tag with valid data", async () => {
      const newTag = {
        id: 4,
        userId: "user-1",
        name: "Testing",
        color: "#ef4444",
        createdAt: new Date().toISOString(),
        repositoryCount: 0,
      };

      vi.mocked(queryClient.apiRequest).mockResolvedValue(newTag);

      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", { name: /create tag/i });
      await userEvent.click(createButton);

      const nameInput = screen.getByLabelText(/tag name/i);
      await userEvent.type(nameInput, "Testing");

      const submitButton = screen.getByRole("button", { name: /^create tag$/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(queryClient.apiRequest).toHaveBeenCalledWith("POST", "/api/tags", {
          name: "Testing",
          color: expect.any(String),
        });
      });
    });

    it("should allow color selection", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", { name: /create tag/i });
      await userEvent.click(createButton);

      // Color buttons should be present
      const colorButtons = screen.getAllByRole("button", {
        name: /select color/i,
      });
      expect(colorButtons.length).toBeGreaterThan(0);

      // Click a color
      await userEvent.click(colorButtons[5]);

      // The color should be selected (visual feedback)
      expect(colorButtons[5]).toHaveClass("scale-110");
    });
  });

  describe("Delete Tag", () => {
    it("should show delete button on hover", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete tag/i);
      expect(deleteButtons.length).toBe(mockTags.length);
    });

    it("should show confirmation dialog when delete is clicked", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete tag/i);
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Delete Tag")).toBeInTheDocument();
        expect(
          screen.getByText(/are you sure you want to delete the tag "frontend"/i)
        ).toBeInTheDocument();
      });
    });

    it("should cancel delete when cancel is clicked", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete tag/i);
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Delete Tag")).toBeInTheDocument();
      });

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await userEvent.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText("Delete Tag")).not.toBeInTheDocument();
      });
    });

    it("should delete tag when confirmed", async () => {
      vi.mocked(queryClient.apiRequest).mockResolvedValue({ success: true });

      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete tag/i);
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Delete Tag")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await userEvent.click(confirmButton);

      await waitFor(() => {
        expect(queryClient.apiRequest).toHaveBeenCalledWith(
          "DELETE",
          "/api/tags/1"
        );
      });
    });

    it("should show repository count in delete confirmation", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete tag/i);
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(
          screen.getByText(/this will remove the tag from all 5 associated repositories/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Optimistic Updates", () => {
    it("should optimistically remove tag from UI", async () => {
      vi.mocked(queryClient.apiRequest).mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete tag/i);
      await userEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Delete Tag")).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await userEvent.click(confirmButton);

      // Tag should be removed optimistically
      await waitFor(() => {
        expect(screen.queryByText("Frontend")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels", async () => {
      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByLabelText(/delete tag/i);
      expect(deleteButtons.length).toBe(mockTags.length);
    });

    it("should support keyboard navigation in create form", async () => {
      const newTag = {
        id: 4,
        userId: "user-1",
        name: "Testing",
        color: "#ef4444",
        createdAt: new Date().toISOString(),
        repositoryCount: 0,
      };

      vi.mocked(queryClient.apiRequest).mockResolvedValue(newTag);

      render(<TagsTab />, { wrapper: createWrapper(mockTags) });

      await waitFor(() => {
        expect(screen.getByText("Frontend")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", { name: /create tag/i });
      await userEvent.click(createButton);

      const nameInput = screen.getByLabelText(/tag name/i);
      await userEvent.type(nameInput, "Testing{Enter}");

      await waitFor(() => {
        expect(queryClient.apiRequest).toHaveBeenCalledWith("POST", "/api/tags", {
          name: "Testing",
          color: expect.any(String),
        });
      });
    });
  });
});
