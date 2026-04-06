import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecommendationsTab } from "../recommendations-tab";

// Mock dependencies
vi.mock("wouter", () => ({
  Link: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock("@/components/upgrade-prompt", () => ({
  UpgradePrompt: ({ feature }: any) => (
    <div data-testid="upgrade-prompt">Upgrade for {feature}</div>
  ),
}));

const mockRecommendations = {
  recommendations: [
    {
      repository: {
        id: "repo1",
        name: "awesome-project",
        fullName: "user/awesome-project",
        description: "An awesome project for testing",
        stars: 1500,
        forks: 200,
        language: "TypeScript",
        owner: "user",
      },
      matchScore: 95,
      reasoning: "Matches your interest in TypeScript and web development",
      basedOn: {
        languages: ["TypeScript", "JavaScript"],
        topics: ["web", "frontend"],
        similarTo: ["react", "vue"],
      },
    },
    {
      repository: {
        id: "repo2",
        name: "cool-library",
        fullName: "org/cool-library",
        description: "A cool library for developers",
        stars: 800,
        forks: 100,
        language: "JavaScript",
        owner: "org",
      },
      matchScore: 87,
      reasoning: "Similar to repositories you've bookmarked",
      basedOn: {
        languages: ["JavaScript"],
        topics: ["library", "tools"],
        similarTo: ["lodash", "axios"],
      },
    },
  ],
};

describe("RecommendationsTab", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <RecommendationsTab />
      </QueryClientProvider>
    );
  };

  it("renders loading skeletons while fetching recommendations", () => {
    queryClient.setQueryData(["/api/recommendations"], undefined);
    const { container } = renderComponent();
    
    // Check for skeleton elements by class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays recommendations when data is loaded", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("awesome-project")).toBeInTheDocument();
      expect(screen.getByText("cool-library")).toBeInTheDocument();
    });
  });

  it("displays repository details correctly", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("awesome-project")).toBeInTheDocument();
      expect(screen.getByText("user/awesome-project")).toBeInTheDocument();
      expect(screen.getByText("An awesome project for testing")).toBeInTheDocument();
      expect(screen.getByText("1,500")).toBeInTheDocument();
      expect(screen.getByText("TypeScript")).toBeInTheDocument();
    });
  });

  it("displays match score with visual indicator", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("95% match")).toBeInTheDocument();
      expect(screen.getByText("87% match")).toBeInTheDocument();
    });
  });

  it("displays reasoning text for each recommendation", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText(/Matches your interest in TypeScript/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Similar to repositories you've bookmarked/)
      ).toBeInTheDocument();
    });
  });

  it("renders Analyze button for each recommendation", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      const analyzeButtons = screen.getAllByText("Analyze");
      expect(analyzeButtons).toHaveLength(2);
    });
  });

  it("renders Dismiss button for each recommendation", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      const dismissButtons = screen.getAllByLabelText("Dismiss recommendation");
      expect(dismissButtons).toHaveLength(2);
    });
  });

  it("removes recommendation from list when dismissed", async () => {
    const user = userEvent.setup();
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("awesome-project")).toBeInTheDocument();
    });

    const dismissButtons = screen.getAllByLabelText("Dismiss recommendation");
    await user.click(dismissButtons[0]);

    await waitFor(() => {
      expect(screen.queryByText("awesome-project")).not.toBeInTheDocument();
      expect(screen.getByText("cool-library")).toBeInTheDocument();
    });
  });

  it("displays empty state when no recommendations available", async () => {
    queryClient.setQueryData(["/api/recommendations"], { recommendations: [] });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No recommendations yet")).toBeInTheDocument();
      expect(
        screen.getByText(/We need more data to generate personalized recommendations/)
      ).toBeInTheDocument();
    });
  });

  it("displays empty state when all recommendations are dismissed", async () => {
    const user = userEvent.setup();
    queryClient.setQueryData(["/api/recommendations"], {
      recommendations: [mockRecommendations.recommendations[0]],
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("awesome-project")).toBeInTheDocument();
    });

    const dismissButton = screen.getByLabelText("Dismiss recommendation");
    await user.click(dismissButton);

    await waitFor(() => {
      expect(screen.getByText("No recommendations yet")).toBeInTheDocument();
    });
  });

  it("displays error state with retry option on fetch failure", async () => {
    queryClient.setQueryData(["/api/recommendations"], undefined);
    queryClient.setQueryDefaults(["/api/recommendations"], {
      queryFn: () => Promise.reject(new Error("Network error")),
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Failed to load recommendations")).toBeInTheDocument();
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });
  });

  it("displays upgrade prompt for 403 errors", async () => {
    queryClient.setQueryData(["/api/recommendations"], undefined);
    queryClient.setQueryDefaults(["/api/recommendations"], {
      queryFn: () => Promise.reject(new Error("403 FEATURE_NOT_AVAILABLE")),
    });
    
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
    });
  });

  it("displays correct count of recommendations", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("2 Personalized Recommendations")).toBeInTheDocument();
    });
  });

  it("updates count after dismissing a recommendation", async () => {
    const user = userEvent.setup();
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("2 Personalized Recommendations")).toBeInTheDocument();
    });

    const dismissButtons = screen.getAllByLabelText("Dismiss recommendation");
    await user.click(dismissButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("1 Personalized Recommendation")).toBeInTheDocument();
    });
  });

  it("is responsive on mobile (single column layout)", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    const { container } = renderComponent();

    await waitFor(() => {
      expect(screen.getByText("awesome-project")).toBeInTheDocument();
    });

    // Check for responsive classes
    const cards = container.querySelectorAll('[class*="flex-col"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it("links to repository analysis page", async () => {
    queryClient.setQueryData(["/api/recommendations"], mockRecommendations);
    renderComponent();

    await waitFor(() => {
      const links = screen.getAllByRole("link");
      const analyzeLink = links.find(link => 
        link.getAttribute("href")?.includes("/repository/repo1")
      );
      expect(analyzeLink).toBeInTheDocument();
    });
  });

  it("displays helpful guidance in empty state", async () => {
    queryClient.setQueryData(["/api/recommendations"], { recommendations: [] });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Discover Repositories")).toBeInTheDocument();
      expect(screen.getByText("Set Preferences")).toBeInTheDocument();
    });
  });
});
