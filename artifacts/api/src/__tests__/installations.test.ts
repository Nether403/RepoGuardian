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
});
