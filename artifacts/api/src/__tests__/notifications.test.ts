import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createExecutionNotificationBus,
  type ExecutionPlanNotification
} from "../lib/notifications.js";
import { createExecutionRouter } from "../routes/execution.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExecutionNotificationBus", () => {
  it("delivers published events to subscribers in the same workspace", () => {
    const bus = createExecutionNotificationBus();
    const received: ExecutionPlanNotification[] = [];
    const unsubscribe = bus.subscribe("workspace_a", (event) => {
      received.push(event);
    });

    bus.publish({
      createdAt: new Date().toISOString(),
      executionId: null,
      planId: "plan_1",
      reason: null,
      repositoryFullName: "octo/repo",
      status: "plan.created",
      workspaceId: "workspace_a"
    });
    bus.publish({
      createdAt: new Date().toISOString(),
      executionId: null,
      planId: "plan_2",
      reason: null,
      repositoryFullName: "octo/repo",
      status: "plan.created",
      workspaceId: "workspace_b"
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.planId).toBe("plan_1");
    unsubscribe();
  });

  it("stops delivering once unsubscribed", () => {
    const bus = createExecutionNotificationBus();
    const received: ExecutionPlanNotification[] = [];
    const unsubscribe = bus.subscribe("workspace_a", (event) => {
      received.push(event);
    });
    unsubscribe();

    bus.publish({
      createdAt: new Date().toISOString(),
      executionId: null,
      planId: "plan_after_unsubscribe",
      reason: null,
      repositoryFullName: "octo/repo",
      status: "plan.created",
      workspaceId: "workspace_a"
    });

    expect(received).toHaveLength(0);
    expect(bus.listenerCount("workspace_a")).toBe(0);
  });
});

describe("GET /api/execution/notifications/stream", () => {
  function createTestServer() {
    const bus = createExecutionNotificationBus();
    const app = express();
    app.use(express.json());
    app.use(
      "/api",
      createExecutionRouter(
        {
          readClient: { fetchRepositoryFileText: vi.fn() },
          writeClient: {
            createBranchFromDefaultBranch: vi.fn(),
            commitFileChanges: vi.fn(),
            createIssue: vi.fn(),
            openPullRequest: vi.fn()
          }
        },
        {
          notificationBus: bus,
          planRepository: {
            async claimExecution() {
              throw new Error("not used in this test");
            },
            async finalizeExecution() {},
            async getPlanDetail() {
              throw new Error("not used in this test");
            },
            async getPlanEvents() {
              throw new Error("not used in this test");
            },
            async markExecutionFailure() {},
            async recordActionCompleted() {},
            async recordActionStarted() {},
            async savePlan() {}
          },
          policyDecisionRepository: {
            recordDecision: vi.fn().mockResolvedValue({})
          },
          runRepository: {
            async getRun() {
              throw new Error("not used in this test");
            }
          },
          trackedPullRequestRepository: {
            upsertOpenedPullRequest: vi.fn()
          }
        }
      )
    );

    const server = http.createServer(app);
    return new Promise<{ bus: typeof bus; close: () => Promise<void>; port: number }>(
      (resolve) => {
        server.listen(0, () => {
          const port = (server.address() as AddressInfo).port;
          resolve({
            bus,
            close: () =>
              new Promise<void>((resolveClose) =>
                server.close(() => resolveClose())
              ),
            port
          });
        });
      }
    );
  }

  function streamRequest(
    port: number,
    options: { authorization?: string }
  ): Promise<{ chunks: string[]; statusCode: number; close: () => void }> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = { Accept: "text/event-stream" };
      if (options.authorization) {
        headers.Authorization = options.authorization;
      }

      const req = http.request(
        {
          headers,
          host: "127.0.0.1",
          method: "GET",
          path: "/api/execution/notifications/stream",
          port
        },
        (response) => {
          const chunks: string[] = [];
          response.setEncoding("utf-8");
          response.on("data", (chunk: string) => {
            chunks.push(chunk);
          });
          response.on("error", reject);
          resolve({
            chunks,
            close: () => {
              req.destroy();
            },
            statusCode: response.statusCode ?? 0
          });
        }
      );
      req.on("error", reject);
      req.end();
    });
  }

  it("rejects unauthenticated callers", async () => {
    const { close, port } = await createTestServer();
    try {
      const result = await streamRequest(port, {});
      expect(result.statusCode).toBe(401);
      result.close();
    } finally {
      await close();
    }
  });

  it("rejects ?access_token= on non-SSE routes (scoping regression guard)", async () => {
    // The query-token fallback exists *only* for the SSE notifications stream
    // because EventSource cannot send custom headers. It must NOT be honoured
    // on any other route, otherwise we expand credential exposure through URL
    // logs, browser history, and Referer headers.
    const { close, port } = await createTestServer();
    try {
      const result = await new Promise<{ statusCode: number }>(
        (resolve, reject) => {
          const req = http.request(
            {
              host: "127.0.0.1",
              method: "GET",
              path: "/api/execution/plans/plan_does_not_exist?access_token=dev-secret-key-do-not-use-in-production",
              port
            },
            (response) => {
              response.resume();
              response.on("end", () =>
                resolve({ statusCode: response.statusCode ?? 0 })
              );
            }
          );
          req.on("error", reject);
          req.end();
        }
      );

      expect(result.statusCode).toBe(401);
    } finally {
      await close();
    }
  });

  it("publishes a ready event then forwards workspace-scoped notifications", async () => {
    const { bus, close, port } = await createTestServer();
    try {
      const result = await streamRequest(port, {
        authorization: "Bearer dev-secret-key-do-not-use-in-production"
      });
      expect(result.statusCode).toBe(200);

      // Allow the route handler to subscribe before publishing.
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
      expect(bus.listenerCount("workspace_local_default")).toBe(1);
      expect(bus.listenerCount("workspace_other")).toBe(0);

      bus.publish({
        createdAt: new Date().toISOString(),
        executionId: null,
        planId: "plan_match",
        reason: null,
        repositoryFullName: "octo/repo",
        status: "plan.created",
        workspaceId: "workspace_local_default"
      });
      bus.publish({
        createdAt: new Date().toISOString(),
        executionId: null,
        planId: "plan_other_workspace",
        reason: null,
        repositoryFullName: "octo/repo",
        status: "plan.created",
        workspaceId: "workspace_other"
      });

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
      const combined = result.chunks.join("");
      expect(combined).toContain("event: ready");
      expect(combined).toContain("event: plan.created");
      expect(combined).toContain("plan_match");
      expect(combined).not.toContain("plan_other_workspace");
      result.close();

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
      expect(bus.listenerCount("workspace_local_default")).toBe(0);
    } finally {
      await close();
    }
  });
});
