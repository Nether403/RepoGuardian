import { PersistenceError } from "@repo-guardian/persistence";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("GitHub installation client selection", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("falls back to the configured read token when a manual analysis repo is not installation-linked", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://example");
    vi.stubEnv("GITHUB_APP_ID", "3643341");
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "private-key");
    vi.stubEnv("GITHUB_TOKEN", "public-read-token");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("API_SECRET_KEY", "api-secret");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_ID", "client-id");
    vi.stubEnv("GITHUB_OAUTH_CLIENT_SECRET", "client-secret");
    vi.stubEnv("SESSION_SECRET", "session-secret");

    vi.doMock("../persistence.js", () => ({
      getGitHubInstallationRepository: () => ({
        findRepositoryByFullName: vi.fn().mockRejectedValue(
          new PersistenceError(
            "not_found",
            "Repository is not linked to an active installation."
          )
        )
      })
    }));

    const { createInstallationReadClient } = await import("../github-installations.js");
    const client = await createInstallationReadClient({
      repositoryFullName: "Nether403/RepoGuardian",
      workspaceId: "workspace_octo"
    });

    expect(client).toBeDefined();
  });
});
