import { describe, expect, it } from "vitest";
import { GitHubInstallationRepositoryStore } from "../github-installations.js";

describe("GitHubInstallationRepositoryStore", () => {
  it("parses GitHub installation BIGINT values returned as strings by pg", async () => {
    const client = {
      query: async () => ({
        rows: [
          {
            created_at: "2026-05-08T12:00:00.000Z",
            github_installation_id: "12345",
            installation_id: "ghi_12345",
            installed_at: "2026-05-08T12:00:00.000Z",
            permissions: { contents: "read" },
            repository_selection: "selected",
            status: "active",
            suspended_at: null,
            target_id: "98765",
            target_login: "Nether403",
            target_type: "User",
            updated_at: "2026-05-08T12:00:00.000Z",
            workspace_id: "workspace_octo"
          }
        ]
      })
    };
    const store = new GitHubInstallationRepositoryStore(
      client as unknown as ConstructorParameters<typeof GitHubInstallationRepositoryStore>[0]
    );

    await expect(
      store.upsertInstallation({
        githubInstallationId: 12345,
        permissions: { contents: "read" },
        repositorySelection: "selected",
        status: "active",
        targetId: 98765,
        targetLogin: "Nether403",
        targetType: "User",
        workspaceId: "workspace_octo"
      })
    ).resolves.toMatchObject({
      githubInstallationId: 12345,
      targetId: 98765,
      targetLogin: "Nether403"
    });
  });
});
