import { describe, expect, it } from "vitest";
import { WorkspaceRepository } from "../workspaces.js";

describe("WorkspaceRepository", () => {
  it("parses GitHub BIGINT user ids returned as strings by pg", async () => {
    const client = {
      query: async () => ({
        rows: [
          {
            avatar_url: null,
            created_at: "2026-05-08T12:00:00.000Z",
            display_name: "Octo User",
            github_login: "octo",
            github_user_id: "123456789",
            updated_at: "2026-05-08T12:00:00.000Z",
            user_id: "usr_octo"
          }
        ]
      })
    };
    const repository = new WorkspaceRepository(
      client as unknown as ConstructorParameters<typeof WorkspaceRepository>[0]
    );

    await expect(repository.getUser("usr_octo")).resolves.toMatchObject({
      githubLogin: "octo",
      githubUserId: 123456789,
      id: "usr_octo"
    });
  });
});
