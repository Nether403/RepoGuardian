import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createFleetRouter } from "../routes/fleet.js";

function createTestApp(input: Parameters<typeof createFleetRouter>[0]) {
  const app = express();
  app.use(express.json());
  app.use(createFleetRouter(input));
  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    response.status(500).json({
      error: error instanceof Error ? error.message : "Unexpected error"
    });
  });
  return app;
}

describe("fleet routes", () => {
  it("lists and creates tracked repositories", async () => {
    const trackedRepository = {
      canonicalUrl: "https://github.com/openai/openai-node",
      createdAt: "2026-04-12T10:00:00.000Z",
      fullName: "openai/openai-node",
      id: "tracked_one",
      isActive: true,
      label: "Weekly review",
      lastQueuedAt: null,
      owner: "openai",
      repo: "openai-node",
      updatedAt: "2026-04-12T10:00:00.000Z"
    };
    const app = createTestApp({
      analysisJobProcessor: {
        enqueueAdHoc: vi.fn(),
        enqueueTrackedRepositoryAnalysis: vi.fn(),
        getJob: vi.fn()
      },
      trackedRepositoryStore: {
        createRepository: vi.fn().mockResolvedValue(trackedRepository),
        listRepositories: vi.fn().mockResolvedValue([trackedRepository])
      }
    });

    const listResponse = await request(app)
      .get("/tracked-repositories")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toEqual({
      repositories: [trackedRepository]
    });

    const createResponse = await request(app)
      .post("/tracked-repositories")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        label: "Weekly review",
        repoInput: "github.com/openai/openai-node"
      });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toEqual({
      repository: trackedRepository
    });
  });

  it("enqueues and reads analysis jobs", async () => {
    const job = {
      attemptCount: 0,
      completedAt: null,
      errorMessage: null,
      failedAt: null,
      jobId: "job_one",
      jobKind: "analyze_repository",
      label: "Async",
      maxAttempts: 1,
      queuedAt: "2026-04-12T10:00:00.000Z",
      repoInput: "openai/openai-node",
      repositoryFullName: "openai/openai-node",
      requestedByUserId: "usr_authenticated",
      runId: null,
      startedAt: null,
      status: "queued",
      trackedRepositoryId: null,
      updatedAt: "2026-04-12T10:00:00.000Z"
    };
    const analysisJobProcessor = {
      enqueueAdHoc: vi.fn().mockResolvedValue(job),
      enqueueTrackedRepositoryAnalysis: vi.fn().mockResolvedValue({
        ...job,
        trackedRepositoryId: "tracked_one"
      }),
      getJob: vi.fn().mockResolvedValue(job)
    };
    const app = createTestApp({
      analysisJobProcessor,
      trackedRepositoryStore: {
        createRepository: vi.fn(),
        listRepositories: vi.fn().mockResolvedValue([])
      }
    });

    const enqueueResponse = await request(app)
      .post("/analyze/jobs")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        label: "Async",
        repoInput: "openai/openai-node"
      });
    expect(enqueueResponse.status).toBe(202);
    expect(enqueueResponse.body).toEqual({ job });
    expect(analysisJobProcessor.enqueueAdHoc).toHaveBeenCalledWith({
      label: "Async",
      repoInput: "openai/openai-node",
      requestedByUserId: "usr_authenticated"
    });

    const trackedEnqueueResponse = await request(app)
      .post("/analyze/jobs")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production")
      .send({
        trackedRepositoryId: "tracked_one"
      });
    expect(trackedEnqueueResponse.status).toBe(202);
    expect(analysisJobProcessor.enqueueTrackedRepositoryAnalysis).toHaveBeenCalledWith({
      requestedByUserId: "usr_authenticated",
      trackedRepositoryId: "tracked_one"
    });

    const getResponse = await request(app)
      .get("/analyze/jobs/job_one")
      .set("Authorization", "Bearer dev-secret-key-do-not-use-in-production");
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toEqual({ job });
  });
});
