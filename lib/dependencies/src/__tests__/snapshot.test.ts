import { describe, expect, it } from "vitest";
import type {
  DetectedLockfile,
  DetectedManifest,
  EcosystemDetection,
  SkippedDependencyFile
} from "@repo-guardian/shared-types";
import { createDependencySnapshot } from "../snapshot.js";

function createManifest(
  kind: DetectedManifest["kind"],
  path: string
): DetectedManifest {
  return {
    ecosystem: kind === "package.json" ? "node" : "python",
    kind,
    path
  };
}

function createLockfile(
  kind: DetectedLockfile["kind"],
  path: string
): DetectedLockfile {
  return {
    ecosystem: kind === "package-lock.json" || kind === "pnpm-lock.yaml" ? "node" : "python",
    kind,
    path
  };
}

describe("createDependencySnapshot", () => {
  it("normalizes parsed files into the shared dependency snapshot model", () => {
    const detection: EcosystemDetection = {
      ecosystems: [
        {
          ecosystem: "node",
          lockfiles: ["package-lock.json"],
          manifests: ["package.json"],
          packageManagers: ["npm"]
        }
      ],
      lockfiles: [createLockfile("package-lock.json", "package-lock.json")],
      manifestCounts: {
        byEcosystem: [
          {
            ecosystem: "node",
            lockfiles: 1,
            manifests: 1
          }
        ],
        totalLockfiles: 1,
        totalManifests: 1
      },
      manifests: [createManifest("package.json", "package.json")],
      signals: [],
      warningDetails: [],
      warnings: []
    };

    const snapshot = createDependencySnapshot({
      detection,
      fetchedFiles: [
        {
          content: JSON.stringify({
            dependencies: {
              react: "^19.0.0"
            }
          }),
          ecosystem: "node",
          kind: "package.json",
          path: "package.json"
        },
        {
          content: JSON.stringify({
            packages: {
              "": {
                dependencies: {
                  react: "^19.0.0"
                }
              },
              "node_modules/react": {
                name: "react",
                version: "19.0.0"
              },
              "node_modules/scheduler": {
                version: "0.25.0"
              }
            }
          }),
          ecosystem: "node",
          kind: "package-lock.json",
          path: "package-lock.json"
        }
      ]
    });

    expect(snapshot.summary).toEqual({
      byEcosystem: [
        {
          directDependencies: 2,
          ecosystem: "node",
          totalDependencies: 3
        }
      ],
      directDependencies: 2,
      parsedFileCount: 2,
      skippedFileCount: 0,
      totalDependencies: 3,
      transitiveDependencies: 1
    });
    expect(snapshot.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          isDirect: true,
          name: "react",
          sourceFile: "package.json"
        }),
        expect.objectContaining({
          isDirect: true,
          name: "react",
          sourceFile: "package-lock.json",
          version: "19.0.0"
        }),
        expect.objectContaining({
          isDirect: false,
          name: "scheduler"
        })
      ])
    );
    expect(snapshot.isPartial).toBe(false);
  });

  it("handles malformed or skipped files with partial warnings", () => {
    const detection: EcosystemDetection = {
      ecosystems: [
        {
          ecosystem: "node",
          lockfiles: ["yarn.lock"],
          manifests: ["package.json"],
          packageManagers: ["yarn"]
        },
        {
          ecosystem: "python",
          lockfiles: ["poetry.lock"],
          manifests: ["pyproject.toml"],
          packageManagers: ["poetry"]
        }
      ],
      lockfiles: [
        createLockfile("yarn.lock", "yarn.lock"),
        createLockfile("poetry.lock", "services/api/poetry.lock")
      ],
      manifestCounts: {
        byEcosystem: [
          {
            ecosystem: "node",
            lockfiles: 1,
            manifests: 1
          },
          {
            ecosystem: "python",
            lockfiles: 1,
            manifests: 1
          }
        ],
        totalLockfiles: 2,
        totalManifests: 2
      },
      manifests: [
        createManifest("package.json", "package.json"),
        createManifest("pyproject.toml", "services/api/pyproject.toml")
      ],
      signals: [],
      warningDetails: [
        {
          code: "MANIFEST_WITHOUT_LOCKFILE",
          message: "Manifest without lockfile: package.json",
          paths: ["package.json"],
          severity: "warning",
          source: "package.json",
          stage: "detection"
        }
      ],
      warnings: ["Manifest without lockfile: package.json"]
    };
    const skippedFiles: SkippedDependencyFile[] = [
      {
        ecosystem: "python",
        kind: "poetry.lock",
        path: "services/api/poetry.lock",
        reason: "Skipped services/api/poetry.lock: GitHub returned invalid file content"
      }
    ];

    const snapshot = createDependencySnapshot({
      detection,
      fetchedFiles: [
        {
          content: "{not-valid-json",
          ecosystem: "node",
          kind: "package.json",
          path: "package.json"
        },
        {
          content: [
            "[tool.poetry.dependencies]",
            'python = "^3.12"',
            'fastapi = "^0.115.0"'
          ].join("\n"),
          ecosystem: "python",
          kind: "pyproject.toml",
          path: "services/api/pyproject.toml"
        }
      ],
      prefetchWarningDetails: [
        {
          code: "FILE_FETCH_SKIPPED",
          message: "Skipped services/api/poetry.lock: GitHub returned invalid file content",
          paths: ["services/api/poetry.lock"],
          severity: "warning",
          source: "poetry.lock",
          stage: "dependency-parse"
        }
      ],
      skippedFiles
    });

    expect(snapshot.isPartial).toBe(true);
    expect(snapshot.filesSkipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "yarn.lock",
          path: "yarn.lock"
        }),
        expect.objectContaining({
          kind: "package.json",
          path: "package.json"
        }),
        expect.objectContaining({
          kind: "poetry.lock",
          path: "services/api/poetry.lock"
        })
      ])
    );
    expect(snapshot.parseWarnings).toEqual(
      expect.arrayContaining([
        "Skipped yarn.lock: file content was not fetched.",
        "Manifest without lockfile: package.json",
        "Skipped services/api/poetry.lock: GitHub returned invalid file content"
      ])
    );
    expect(snapshot.parseWarningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "FILE_FETCH_SKIPPED",
          message: "Skipped yarn.lock: file content was not fetched."
        }),
        expect.objectContaining({
          code: "MANIFEST_WITHOUT_LOCKFILE",
          message: "Manifest without lockfile: package.json"
        }),
        expect.objectContaining({
          code: "FILE_FETCH_SKIPPED",
          message: "Skipped services/api/poetry.lock: GitHub returned invalid file content"
        })
      ])
    );
  });
});
