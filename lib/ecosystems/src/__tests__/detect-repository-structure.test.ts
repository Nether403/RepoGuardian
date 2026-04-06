import type { RepositoryTreeEntry } from "@repo-guardian/shared-types";
import { describe, expect, it } from "vitest";
import { detectRepositoryStructure } from "../index.js";

function file(path: string): RepositoryTreeEntry {
  return {
    kind: "file",
    path
  };
}

describe("detectRepositoryStructure", () => {
  it("detects a single-ecosystem Node.js repository", () => {
    const result = detectRepositoryStructure([
      file("package.json"),
      file("pnpm-lock.yaml"),
      file("src/index.ts")
    ]);

    expect(result.ecosystems).toEqual([
      {
        ecosystem: "node",
        lockfiles: ["pnpm-lock.yaml"],
        manifests: ["package.json"],
        packageManagers: ["pnpm"]
      }
    ]);
    expect(result.manifests).toEqual([
      {
        ecosystem: "node",
        kind: "package.json",
        path: "package.json"
      }
    ]);
    expect(result.lockfiles).toEqual([
      {
        ecosystem: "node",
        kind: "pnpm-lock.yaml",
        path: "pnpm-lock.yaml"
      }
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("detects a polyglot repository with infra signals", () => {
    const result = detectRepositoryStructure([
      file("package.json"),
      file("package-lock.json"),
      file("go.mod"),
      file("go.sum"),
      file("Dockerfile"),
      file(".github/workflows/ci.yml")
    ]);

    expect(result.ecosystems).toEqual([
      {
        ecosystem: "go",
        lockfiles: ["go.sum"],
        manifests: ["go.mod"],
        packageManagers: ["go-mod"]
      },
      {
        ecosystem: "node",
        lockfiles: ["package-lock.json"],
        manifests: ["package.json"],
        packageManagers: ["npm"]
      }
    ]);
    expect(result.signals).toEqual([
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
    ]);
  });

  it("detects monorepo structure with nested manifests", () => {
    const result = detectRepositoryStructure([
      file("package.json"),
      file("pnpm-lock.yaml"),
      file("apps/web/package.json"),
      file("packages/ui/package.json")
    ]);

    expect(result.manifestCounts).toEqual({
      byEcosystem: [
        {
          ecosystem: "node",
          lockfiles: 1,
          manifests: 3
        }
      ],
      totalLockfiles: 1,
      totalManifests: 3
    });
    expect(result.warnings).toContain(
      "Likely monorepo structure: manifests detected across 3 directories."
    );
  });

  it("returns a no-manifests warning when no supported files are found", () => {
    const result = detectRepositoryStructure([
      file("README.md"),
      file("docs/package.json.md"),
      file("docker-compose.yaml")
    ]);

    expect(result.ecosystems).toEqual([]);
    expect(result.manifests).toEqual([]);
    expect(result.lockfiles).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.warnings).toEqual([
      "No supported manifests or lockfiles were detected in the fetched tree."
    ]);
  });

  it("avoids false positives from lookalike filenames", () => {
    const result = detectRepositoryStructure([
      file("configs/package-json.template"),
      file("docs/Cargo.toml.backup"),
      file("examples/docker-compose.yml.example"),
      file(".github/workflows.md")
    ]);

    expect(result.manifests).toEqual([]);
    expect(result.lockfiles).toEqual([]);
    expect(result.signals).toEqual([]);
  });

  it("warns when a manifest has no matching lockfile", () => {
    const result = detectRepositoryStructure([
      file("services/api/package.json"),
      file("services/api/src/index.ts")
    ]);

    expect(result.warnings).toContain(
      "Manifest without lockfile: services/api/package.json"
    );
  });

  it("warns when multiple package managers are detected", () => {
    const result = detectRepositoryStructure([
      file("package.json"),
      file("package-lock.json"),
      file("pnpm-lock.yaml")
    ]);

    expect(result.warnings).toContain(
      "Multiple Node.js package managers detected: npm, pnpm."
    );
  });
});
