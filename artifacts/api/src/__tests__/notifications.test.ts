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

  it("assigns monotonically increasing ids across publishes", () => {
    const bus = createExecutionNotificationBus();

    const first = bus.publish({
      createdAt: new Date().toISOString(),
      executionId: null,
      planId: "plan_1",
      reason: null,
      repositoryFullName: "octo/repo",
      status: "plan.created",
      workspaceId: "workspace_a"
    });
    const second = bus.publish({
      createdAt: new Date().toISOString(),
      executionId: null,
      planId: "plan_2",
      reason: null,
      repositoryFullName: "octo/repo",
      status: "plan.created",
      workspaceId: "workspace_b"
    });
    const third = bus.publish({
      createdAt: new Date().toISOString(),
      executionId: null,
      planId: "plan_3",
      reason: null,
      repositoryFullName: "octo/repo",
      status: "plan.created",
      workspaceId: "workspace_a"
    });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(third.id).toBe(3);
  });

  it("buffers events per workspace and replays from a cursor in id order", () => {
    const bus = createExecutionNotificationBus();

    for (let index = 1; index <= 5; index += 1) {
      bus.publish({
        createdAt: new Date().toISOString(),
        executionId: null,
        planId: `plan_a_${index}`,
        reason: null,
        repositoryFullName: "octo/repo",
        status: "plan.created",
        workspaceId: "workspace_a"
      });
    }
    bus.publish({
      createdAt: new Date().toISOString(),
      executionId: null,
      planId: "plan_b_1",
      reason: null,
      repositoryFullName: "octo/repo",
      status: "plan.created",
      workspaceId: "workspace_b"
    });

    const fromZero = bus.replay("workspace_a", 0);
    expect(fromZero.map((entry) => entry.planId)).toEqual([
      "plan_a_1",
      "plan_a_2",
      "plan_a_3",
      "plan_a_4",
      "plan_a_5"
    ]);

    const fromTwo = bus.replay("workspace_a", 2);
    expect(fromTwo.map((entry) => entry.planId)).toEqual([
      "plan_a_3",
      "plan_a_4",
      "plan_a_5"
    ]);

    // Ring buffer is workspace-scoped: workspace_a replay does not include
    // events published into workspace_b.
    expect(fromZero.every((entry) => entry.workspaceId === "workspace_a")).toBe(
      true
    );

    // Replay past the latest id returns nothing.
    expect(bus.replay("workspace_a", 999)).toHaveLength(0);
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
    options: {
      authorization?: string;
      lastEventIdHeader?: string;
      lastEventIdQuery?: string;
    }
  ): Promise<{ chunks: string[]; statusCode: number; close: () => void }> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = { Accept: "text/event-stream" };
      if (options.authorization) {
        headers.Authorization = options.authorization;
      }
      if (options.lastEventIdHeader !== undefined) {
        headers["Last-Event-ID"] = options.lastEventIdHeader;
      }

      const path =
        options.lastEventIdQuery !== undefined
          ? `/api/execution/notifications/stream?lastEventId=${encodeURIComponent(options.lastEventIdQuery)}`
          : "/api/execution/notifications/stream";

      const req = http.request(
        {
          headers,
          host: "127.0.0.1",
          method: "GET",
          path,
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

  it("replays buffered events after a disconnect using Last-Event-ID", async () => {
    // This test simulates the disconnect/reconnect scenario the bug fix
    // targets: events are published while no client is connected, then a
    // client reconnects with a Last-Event-ID and must receive every missed
    // event in id order. We verify both the standard header and the query
    // string fallback (used by EventSource on backoff-driven reconnects).
    const { bus, close, port } = await createTestServer();
    try {
      for (let index = 1; index <= 3; index += 1) {
        bus.publish({
          createdAt: new Date().toISOString(),
          executionId: null,
          planId: `plan_buffered_${index}`,
          reason: null,
          repositoryFullName: "octo/repo",
          status: "plan.created",
          workspaceId: "workspace_local_default"
        });
      }

      const result = await streamRequest(port, {
        authorization: "Bearer dev-secret-key-do-not-use-in-production",
        lastEventIdHeader: "1"
      });
      expect(result.statusCode).toBe(200);

      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
      const combined = result.chunks.join("");

      expect(combined).toContain("event: ready");
      expect(combined).not.toContain("plan_buffered_1");
      expect(combined).toContain("plan_buffered_2");
      expect(combined).toContain("plan_buffered_3");
      expect(combined).toContain("id: 2");
      expect(combined).toContain("id: 3");

      const indexTwo = combined.indexOf("plan_buffered_2");
      const indexThree = combined.indexOf("plan_buffered_3");
      expect(indexTwo).toBeGreaterThan(-1);
      expect(indexThree).toBeGreaterThan(indexTwo);

      result.close();
    } finally {
      await close();
    }
  });

  it("delivers all N missed events in order across a disconnect/reconnect cycle", async () => {
    // End-to-end coverage for the task acceptance criterion: disconnect,
    // publish N events while disconnected, reconnect with the cursor, and
    // assert all N arrive in order. Uses the ?lastEventId= query fallback so
    // that this exercises the path our hook takes on exponential-backoff
    // reconnects (where a fresh EventSource cannot include the header).
    const { bus, close, port } = await createTestServer();
    try {
      // First connection observes a single event so we have a cursor.
      const firstResult = await streamRequest(port, {
        authorization: "Bearer dev-secret-key-do-not-use-in-production"
      });
      expect(firstResult.statusCode).toBe(200);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));

      const baseline = bus.publish({
        createdAt: new Date().toISOString(),
        executionId: null,
        planId: "plan_seen",
        reason: null,
        repositoryFullName: "octo/repo",
        status: "plan.created",
        workspaceId: "workspace_local_default"
      });
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
      expect(firstResult.chunks.join("")).toContain("plan_seen");

      // Disconnect.
      firstResult.close();
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
      expect(bus.listenerCount("workspace_local_default")).toBe(0);

      // Publish N events while no one is listening.
      const missedPlanIds: string[] = [];
      for (let index = 1; index <= 4; index += 1) {
        const planId = `plan_missed_${index}`;
        missedPlanIds.push(planId);
        bus.publish({
          createdAt: new Date().toISOString(),
          executionId: null,
          planId,
          reason: null,
          repositoryFullName: "octo/repo",
          status: "plan.completed",
          workspaceId: "workspace_local_default"
        });
      }

      // Reconnect with the cursor via the query fallback.
      const secondResult = await streamRequest(port, {
        authorization: "Bearer dev-secret-key-do-not-use-in-production",
        lastEventIdQuery: String(baseline.id)
      });
      expect(secondResult.statusCode).toBe(200);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
      const replayed = secondResult.chunks.join("");

      expect(replayed).toContain("event: ready");
      expect(replayed).not.toContain("plan_seen");

      let cursor = -1;
      for (const planId of missedPlanIds) {
        const at = replayed.indexOf(planId, cursor + 1);
        expect(at, `expected ${planId} after position ${cursor}`).toBeGreaterThan(cursor);
        cursor = at;
      }

      secondResult.close();
    } finally {
      await close();
    }
  });
});
