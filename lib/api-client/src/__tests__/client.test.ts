import { describe, expect, it, vi } from "vitest";
import {
  analyzeRepository,
  compareAnalysisRuns,
  getExecutionPlan,
  getAnalysisRun,
  listAnalysisRuns,
  listExecutionPlanEvents,
  RepoGuardianApiError,
  saveAnalysisRun
} from "../index.js";

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    json: async () => body,
    ok,
    status
  } as Response;
}

describe("generated Repo Guardian API client", () => {
  it("calls generated endpoint paths with JSON request bodies", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        ok: true
      })
    );
    const options = {
      fetchImpl
    };

    await analyzeRepository({ repoInput: "openai/openai-node" }, options);
    await listAnalysisRuns(options);
    await getAnalysisRun("run:one/two", options);
    await saveAnalysisRun({ analysis: {} as never, label: "Latest" }, options);
    await getExecutionPlan("plan:one/two", options);
    await listExecutionPlanEvents("plan:one/two", options);
    await compareAnalysisRuns(
      {
        baseRunId: "base",
        targetRunId: "target"
      },
      options
    );

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "/api/analyze",
      expect.objectContaining({
        body: JSON.stringify({
          repoInput: "openai/openai-node"
        }),
        method: "POST"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "/api/runs",
      expect.objectContaining({
        body: undefined,
        method: "GET"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "/api/runs/run%3Aone%2Ftwo",
      expect.objectContaining({
        method: "GET"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      4,
      "/api/runs",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      5,
      "/api/execution/plans/plan%3Aone%2Ftwo",
      expect.objectContaining({
        method: "GET"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      6,
      "/api/execution/plans/plan%3Aone%2Ftwo/events",
      expect.objectContaining({
        method: "GET"
      })
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      7,
      "/api/runs/compare",
      expect.objectContaining({
        body: JSON.stringify({
          baseRunId: "base",
          targetRunId: "target"
        }),
        method: "POST"
      })
    );
  });

  it("throws a typed API error for non-2xx responses", async () => {
    await expect(
      analyzeRepository(
        {
          repoInput: "openai/missing"
        },
        {
          fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
            createJsonResponse(
              {
                error: "Repository not found"
              },
              false,
              404
            )
          )
        }
      )
    ).rejects.toMatchObject({
      details: {
        error: "Repository not found"
      },
      message: "Repository not found",
      name: "RepoGuardianApiError",
      status: 404
    } satisfies Partial<RepoGuardianApiError>);
  });
});
