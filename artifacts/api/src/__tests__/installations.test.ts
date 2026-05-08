import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("installation routes", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("handles the GitHub App setup callback and redirects back to the app", async () => {
    const registerGitHubAppInstallation = vi.fn().mockResolvedValue({
      installation: {},
      repositories: []
    });
    vi.doMock("../lib/github-installations.js", () => ({
      registerGitHubAppInstallation,
      syncInstallationRepositories: vi.fn()
    }));

    const { default: installationRouter } = await import("../routes/installations.js");
    const app = express();
    app.use("/api", installationRouter);

    const response = await request(app)
      .get("/api/github/installations/setup?installation_id=12345&setup_action=install")
      .set("Authorization", "Bearer local-test-token");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/?githubInstallation=12345");
    expect(registerGitHubAppInstallation).toHaveBeenCalledWith({
      githubInstallationId: 12345,
      workspaceId: "workspace_local_default"
    });
  });

  it("redirects setup callbacks without a session back to the app instead of returning raw JSON", async () => {
    vi.doMock("../lib/github-installations.js", () => ({
      registerGitHubAppInstallation: vi.fn(),
      syncInstallationRepositories: vi.fn()
    }));

    const { default: installationRouter } = await import("../routes/installations.js");
    const app = express();
    app.use("/api", installationRouter);

    const response = await request(app).get(
      "/api/github/installations/setup?installation_id=12345&setup_action=install"
    );

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      "/?githubInstallation=12345&githubInstallationStatus=login_required"
    );
  });

  it("associates installation webhooks to the sender workspace when GitHub sends no workspace id", async () => {
    const upsertInstallation = vi.fn().mockResolvedValue({
      id: "ghi_130675329",
      workspaceId: "workspace_sender"
    });
    const listWorkspacesForUser = vi.fn().mockResolvedValue([
      {
        membership: { role: "owner" },
        workspace: { id: "workspace_sender" }
      }
    ]);
    const syncInstallationRepositories = vi.fn().mockResolvedValue([]);

    vi.doMock("../lib/persistence.js", () => ({
      getGitHubInstallationRepository: () => ({
        upsertInstallation
      }),
      getWorkspaceRepository: () => ({
        findUserByGitHubId: vi.fn().mockResolvedValue({ id: "usr_sender" }),
        listWorkspacesForUser
      })
    }));
    vi.doMock("../lib/github-installations.js", () => ({
      registerGitHubAppInstallation: vi.fn(),
      syncInstallationRepositories
    }));

    const { default: installationRouter } = await import("../routes/installations.js");
    const app = express();
    app.use(express.json());
    app.use("/api", installationRouter);

    const response = await request(app)
      .post("/api/github/webhooks")
      .set("X-GitHub-Event", "installation")
      .send({
        action: "created",
        installation: {
          id: 130675329,
          account: {
            id: 220687769,
            login: "tuki332kag",
            type: "User"
          },
          permissions: {
            contents: "write"
          },
          repository_selection: "all"
        },
        repositories: [
          {
            full_name: "tuki332kag/RepoRadar",
            id: 1076793025,
            name: "RepoRadar",
            private: false
          }
        ],
        sender: {
          id: 220687769,
          login: "tuki332kag"
        }
      });

    expect(response.status).toBe(202);
    expect(upsertInstallation).toHaveBeenCalledWith(
      expect.objectContaining({
        githubInstallationId: 130675329,
        targetLogin: "tuki332kag",
        workspaceId: "workspace_sender"
      })
    );
    expect(syncInstallationRepositories).toHaveBeenCalledWith({
      installationId: "ghi_130675329",
      workspaceId: "workspace_sender"
    });
  });
});
