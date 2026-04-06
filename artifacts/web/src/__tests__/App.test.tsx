import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AnalyzeRepoResponseSchema } from "@repo-guardian/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    json: async () => body,
    ok,
    status
  } as Response;
}

function createDeferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });

  return {
    promise,
    resolve
  };
}

const successPayload = AnalyzeRepoResponseSchema.parse({
  dependencySnapshot: {
    dependencies: [
      {
        dependencyType: "production",
        ecosystem: "node",
        isDirect: true,
        name: "react",
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: "package.json",
        version: "^19.0.0",
        workspacePath: "."
      }
    ],
    filesParsed: [
      {
        dependencyCount: 1,
        ecosystem: "node",
        kind: "package.json",
        packageManager: "npm",
        path: "package.json"
      }
    ],
    filesSkipped: [],
    isPartial: false,
    parseWarnings: [],
    summary: {
      byEcosystem: [
        {
          directDependencies: 1,
          ecosystem: "node",
          totalDependencies: 1
        }
      ],
      directDependencies: 1,
      parsedFileCount: 1,
      skippedFileCount: 0,
      totalDependencies: 1,
      transitiveDependencies: 0
    }
  },
  detectedFiles: {
    lockfiles: [
      {
        kind: "package-lock.json",
        path: "package-lock.json"
      }
    ],
    manifests: [
      {
        kind: "package.json",
        path: "package.json"
      },
      {
        kind: "pyproject.toml",
        path: "services/api/pyproject.toml"
      }
    ],
    signals: [
      {
        category: "workflow",
        kind: "github-workflow",
        path: ".github/workflows/ci.yml"
      }
    ]
  },
  ecosystems: [
    {
      ecosystem: "node",
      lockfiles: ["package-lock.json"],
      manifests: ["package.json"],
      packageManagers: ["npm"]
    },
    {
      ecosystem: "python",
      lockfiles: [],
      manifests: ["services/api/pyproject.toml"],
      packageManagers: ["poetry"]
    }
  ],
  fetchedAt: "2026-04-06T11:30:00.000Z",
  isPartial: false,
  repository: {
    canonicalUrl: "https://github.com/openai/openai-node",
    defaultBranch: "main",
    description: "SDK repository",
    forks: 12,
    fullName: "openai/openai-node",
    htmlUrl: "https://github.com/openai/openai-node",
    owner: "openai",
    primaryLanguage: "TypeScript",
    repo: "openai-node",
    stars: 42
  },
  treeSummary: {
    samplePaths: [
      ".github/workflows/ci.yml",
      "package-lock.json",
      "package.json",
      "services/api/pyproject.toml"
    ],
    totalDirectories: 8,
    totalFiles: 42,
    truncated: false
  },
  warnings: ["Manifest without lockfile: services/api/pyproject.toml"]
});

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the idle state before the first submit", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Repo Guardian" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Start with one repository snapshot/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Accepted forms: full GitHub URL/i)
    ).toBeInTheDocument();
  });

  it("renders a successful analyze flow", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
    );

    render(<App />);

    await user.type(screen.getByLabelText(/Repository input/i), "openai/openai-node");
    await user.click(screen.getByRole("button", { name: /Analyze Repository/i }));

    expect(
      await screen.findByRole("heading", { name: /Repository summary/i })
    ).toBeInTheDocument();
    expect(screen.getByText("openai/openai-node")).toBeInTheDocument();
    expect(screen.getByDisplayValue("openai/openai-node")).toBeInTheDocument();
    expect(screen.getByText(/Snapshot fetched/i)).toBeInTheDocument();
  });

  it("shows a loading state during submit", async () => {
    const user = userEvent.setup();
    const deferred = createDeferredResponse();
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockReturnValue(deferred.promise));

    render(<App />);

    await user.type(screen.getByLabelText(/Repository input/i), "openai/openai-node");
    await user.click(screen.getByRole("button", { name: /Analyze Repository/i }));

    expect(screen.getByRole("button", { name: /Analyzing/i })).toBeDisabled();
    expect(
      screen.getByText(/Fetching the repository snapshot, recursive tree, and ecosystem signals/i)
    ).toBeInTheDocument();

    deferred.resolve(createJsonResponse(successPayload));

    await screen.findByRole("heading", { name: /Repository summary/i });
  });

  it("shows an inline API error state", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        createJsonResponse(
          {
            dependencySnapshot: successPayload.dependencySnapshot,
            error: "Repository not found or not publicly accessible"
          },
          false,
          404
        )
      )
    );

    render(<App />);

    await user.type(screen.getByLabelText(/Repository input/i), "openai/missing-repo");
    await user.click(screen.getByRole("button", { name: /Analyze Repository/i }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Repository not found or not publicly accessible");
  });

  it("shows the partial-analysis banner when the backend marks the snapshot partial", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        createJsonResponse({
          ...successPayload,
          isPartial: true,
          treeSummary: {
            ...successPayload.treeSummary,
            truncated: true
          },
          warnings: [
            "GitHub returned a truncated recursive tree; the repository snapshot is partial."
          ]
        })
      )
    );

    render(<App />);

    await user.type(screen.getByLabelText(/Repository input/i), "openai/openai-node");
    await user.click(screen.getByRole("button", { name: /Analyze Repository/i }));

    expect(
      await screen.findByRole("heading", { name: /Partial analysis/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Partial snapshot/i).length).toBeGreaterThan(0);
  });

  it("renders ecosystems and detected files from a successful payload", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(createJsonResponse(successPayload))
    );

    render(<App />);

    await user.type(screen.getByLabelText(/Repository input/i), "openai/openai-node");
    await user.click(screen.getByRole("button", { name: /Analyze Repository/i }));

    await waitFor(() => {
      expect(screen.getByText("Node.js")).toBeInTheDocument();
    });

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getAllByText("package.json").length).toBeGreaterThan(0);
    expect(screen.getAllByText("package-lock.json").length).toBeGreaterThan(0);
    expect(screen.queryByText("Dockerfile")).not.toBeInTheDocument();
    expect(screen.getAllByText(".github/workflows/ci.yml").length).toBeGreaterThan(0);
  });
});
