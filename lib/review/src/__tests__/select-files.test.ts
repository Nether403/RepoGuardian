import { describe, expect, it } from "vitest";
import type { RepositoryTreeEntry } from "@repo-guardian/shared-types";
import { selectReviewTargets } from "../select-files.js";

function file(path: string): RepositoryTreeEntry {
  return {
    kind: "file",
    path
  };
}

describe("selectReviewTargets", () => {
  it("prioritizes workflows, security-sensitive files, configs, and entrypoints", () => {
    const selection = selectReviewTargets({
      signals: [
        {
          category: "workflow",
          kind: "github-workflow",
          path: ".github/workflows/ci.yml"
        },
        {
          category: "infra",
          kind: "Dockerfile",
          path: "Dockerfile"
        }
      ],
      treeEntries: [
        file(".github/workflows/ci.yml"),
        file("Dockerfile"),
        file("src/auth/token-service.ts"),
        file("src/server.ts"),
        file("src/utils.test.ts")
      ]
    });

    expect(selection.targets.map((target) => target.path)).toEqual([
      ".github/workflows/ci.yml",
      "Dockerfile",
      "src/auth/token-service.ts",
      "src/server.ts"
    ]);
    expect(selection.candidateCount).toBe(4);
  });

  it("caps the targeted selection to keep review bounded", () => {
    const selection = selectReviewTargets({
      maxFiles: 2,
      treeEntries: [
        file(".github/workflows/ci.yml"),
        file("Dockerfile"),
        file("src/server.ts"),
        file("src/auth/session.ts")
      ]
    });

    expect(selection.isCapped).toBe(true);
    expect(selection.targets).toHaveLength(2);
    expect(selection.candidateCount).toBe(4);
  });
});
