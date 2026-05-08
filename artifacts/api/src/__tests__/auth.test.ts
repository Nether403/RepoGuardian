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

  it("sets a session cookie on a successful GitHub OAuth callback and reopens the session", async () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "client_id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "client_secret");
    vi.stubEnv("SESSION_SECRET", "test-session-secret");

    const timestamp = "2026-05-08T12:00:00.000Z";
    const user = {
      avatarUrl: "https://avatars.githubusercontent.com/u/123",
      createdAt: timestamp,
      displayName: "Octo User",
      githubLogin: "octo",
      githubUserId: 123,
      id: "usr_octo",
      updatedAt: timestamp
    };
    const workspace = {
      membership: {
        createdAt: timestamp,
        id: "membership_octo",
        role: "owner" as const,
        updatedAt: timestamp,
        userId: "usr_octo",
        workspaceId: "workspace_octo"
      },
      workspace: {
        createdAt: timestamp,
        id: "workspace_octo",
        isDefault: false,
        name: "octo's Workspace",
        slug: "octos-workspace",
        updatedAt: timestamp
      }
    };
    const workspaceRepository = {
      createWorkspace: vi.fn().mockResolvedValue({
        membership: workspace.membership,
        workspace: workspace.workspace
      }),
      getMembership: vi.fn().mockResolvedValue(workspace),
      getUser: vi.fn().mockResolvedValue(user),
      listWorkspacesForUser: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([workspace])
        .mockResolvedValueOnce([workspace]),
      upsertGitHubUser: vi.fn().mockResolvedValue(user)
    };

    vi.doMock("@repo-guardian/github", () => ({
      exchangeGitHubOAuthCode: vi.fn().mockResolvedValue({
        accessToken: "github-access-token"
      }),
      fetchGitHubViewer: vi.fn().mockResolvedValue({
        avatarUrl: user.avatarUrl,
        id: user.githubUserId,
        login: user.githubLogin,
        name: user.displayName
      })
    }));
    vi.doMock("../lib/persistence.js", () => ({
      getWorkspaceRepository: () => workspaceRepository
    }));

    const { createOAuthStateSetCookieHeader } = await import("../lib/auth-session.js");
    const { default: authRouter } = await import("../routes/auth.js");
    const app = express();
    app.use("/api", authRouter);

    const callbackResponse = await request(app)
      .get("/api/auth/github/callback?code=oauth-code&state=trusted-state")
      .set("Cookie", createOAuthStateSetCookieHeader("trusted-state"));
    const setCookie = callbackResponse.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie].filter(Boolean);
    const sessionCookie = cookies.find((cookie) =>
      cookie.startsWith("repo_guardian_session=")
    );

    expect(callbackResponse.status).toBe(302);
    expect(callbackResponse.headers.location).toBe("/");
    expect(sessionCookie).toBeDefined();

    const sessionResponse = await request(app)
      .get("/api/auth/session")
      .set("Cookie", sessionCookie!.split(";")[0]!);

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body).toMatchObject({
      activeWorkspaceId: "workspace_octo",
      authenticated: true,
      authMode: "session",
      user: {
        githubLogin: "octo",
        id: "usr_octo"
      },
      workspaces: [
        {
          membership: {
            role: "owner",
            workspaceId: "workspace_octo"
          },
          workspace: {
            id: "workspace_octo"
          }
        }
      ]
    });
  }, 15_000);

  it("uses the public callback URL during GitHub OAuth start and token exchange", async () => {
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "client_id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "client_secret");
    vi.stubEnv("SESSION_SECRET", "test-session-secret");

    const timestamp = "2026-05-08T12:00:00.000Z";
    const user = {
      avatarUrl: null,
      createdAt: timestamp,
      displayName: "Octo User",
      githubLogin: "octo",
      githubUserId: 123,
      id: "usr_octo",
      updatedAt: timestamp
    };
    const workspace = {
      membership: {
        createdAt: timestamp,
        id: "membership_octo",
        role: "owner" as const,
        updatedAt: timestamp,
        userId: "usr_octo",
        workspaceId: "workspace_octo"
      },
      workspace: {
        createdAt: timestamp,
        id: "workspace_octo",
        isDefault: false,
        name: "octo's Workspace",
        slug: "octos-workspace",
        updatedAt: timestamp
      }
    };
    const exchangeGitHubOAuthCode = vi.fn().mockResolvedValue({
      accessToken: "github-access-token"
    });

    vi.doMock("@repo-guardian/github", () => ({
      exchangeGitHubOAuthCode,
      fetchGitHubViewer: vi.fn().mockResolvedValue({
        avatarUrl: user.avatarUrl,
        id: user.githubUserId,
        login: user.githubLogin,
        name: user.displayName
      })
    }));
    vi.doMock("../lib/persistence.js", () => ({
      getWorkspaceRepository: () => ({
        createWorkspace: vi.fn().mockResolvedValue({
          membership: workspace.membership,
          workspace: workspace.workspace
        }),
        listWorkspacesForUser: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([workspace]),
        upsertGitHubUser: vi.fn().mockResolvedValue(user)
      })
    }));

    const { createOAuthStateSetCookieHeader } = await import("../lib/auth-session.js");
    const { default: authRouter } = await import("../routes/auth.js");
    const app = express();
    app.use("/api", authRouter);

    const startResponse = await request(app)
      .get("/api/auth/github/start")
      .set("Host", "repo-guardian.example")
      .set("X-Forwarded-Proto", "https");
    const redirectUrl = new URL(startResponse.headers.location);

    expect(redirectUrl.searchParams.get("redirect_uri")).toBe(
      "https://repo-guardian.example/api/auth/github/callback"
    );

    await request(app)
      .get("/api/auth/github/callback?code=oauth-code&state=trusted-state")
      .set("Cookie", createOAuthStateSetCookieHeader("trusted-state"))
      .set("Host", "repo-guardian.example")
      .set("X-Forwarded-Proto", "https");

    expect(exchangeGitHubOAuthCode).toHaveBeenCalledWith(
      expect.objectContaining({
        redirectUri: "https://repo-guardian.example/api/auth/github/callback"
      })
    );
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
