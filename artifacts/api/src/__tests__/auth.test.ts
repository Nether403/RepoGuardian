import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("auth routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("rejects GitHub OAuth callbacks without a matching state cookie", async () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "client_id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "client_secret");
    vi.stubEnv("SESSION_SECRET", "test-session-secret");

    const exchangeGitHubOAuthCode = vi.fn();
    vi.doMock("@repo-guardian/github", () => ({
      exchangeGitHubOAuthCode,
      fetchGitHubViewer: vi.fn()
    }));

    const { default: authRouter } = await import("../routes/auth.js");
    const app = express();
    app.use("/api", authRouter);

    const response = await request(app)
      .get("/api/auth/github/callback?code=oauth-code&state=untrusted-state");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid GitHub OAuth state."
    });
    expect(exchangeGitHubOAuthCode).not.toHaveBeenCalled();
  }, 15_000);

  it("returns a local API-key session without requiring durable persistence", async () => {
    vi.stubEnv("API_SECRET_KEY", "local-test-token");

    const { default: authRouter } = await import("../routes/auth.js");
    const app = express();
    app.use("/api", authRouter);

    const response = await request(app)
      .get("/api/auth/session")
      .set("Authorization", "Bearer local-test-token");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      authenticated: true,
      authMode: "api_key",
      activeWorkspaceId: "workspace_local_default",
      user: {
        id: "usr_local_default",
        githubLogin: "local-dev"
      },
      workspaces: [
        {
          membership: {
            role: "owner",
            workspaceId: "workspace_local_default"
          },
          workspace: {
            id: "workspace_local_default",
            name: "Local Dev Workspace",
            slug: "local-dev"
          }
        }
      ]
    });
  }, 15_000);
});
