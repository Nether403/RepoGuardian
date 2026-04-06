import { describe, expect, it } from "vitest";
import {
  buildCanonicalGitHubUrl,
  normalizeRepoInput,
  normalizeRepoSegments
} from "../repo-input.js";

describe("repo input normalization", () => {
  it("normalizes a full GitHub URL", () => {
    expect(normalizeRepoInput("https://github.com/openai/openai-node")).toEqual({
      canonicalUrl: "https://github.com/openai/openai-node",
      fullName: "openai/openai-node",
      owner: "openai",
      repo: "openai-node"
    });
  });

  it("normalizes a github.com host without protocol", () => {
    expect(normalizeRepoInput("github.com/openai/openai-node.git")).toEqual({
      canonicalUrl: "https://github.com/openai/openai-node",
      fullName: "openai/openai-node",
      owner: "openai",
      repo: "openai-node"
    });
  });

  it("normalizes an owner/repo slug", () => {
    expect(normalizeRepoInput("openai/openai-node")).toEqual({
      canonicalUrl: "https://github.com/openai/openai-node",
      fullName: "openai/openai-node",
      owner: "openai",
      repo: "openai-node"
    });
  });

  it("keeps only the owner and repo for deeper GitHub URLs", () => {
    expect(
      normalizeRepoInput("https://github.com/openai/openai-node/tree/main/src")
    ).toEqual({
      canonicalUrl: "https://github.com/openai/openai-node",
      fullName: "openai/openai-node",
      owner: "openai",
      repo: "openai-node"
    });
  });

  it("normalizes repo segments directly", () => {
    expect(normalizeRepoSegments(" openai ", " openai-node.git ")).toEqual({
      canonicalUrl: "https://github.com/openai/openai-node",
      fullName: "openai/openai-node",
      owner: "openai",
      repo: "openai-node"
    });
  });

  it("builds the canonical GitHub URL", () => {
    expect(buildCanonicalGitHubUrl("openai", "openai-node")).toBe(
      "https://github.com/openai/openai-node"
    );
  });

  it("rejects non-GitHub hosts", () => {
    expect(() =>
      normalizeRepoInput("https://example.com/openai/openai-node")
    ).toThrowError(/github\.com/i);
  });

  it("rejects invalid slugs", () => {
    expect(() => normalizeRepoInput("openai")).toThrowError(
      /GitHub URL or owner\/repo/i
    );
  });
});
