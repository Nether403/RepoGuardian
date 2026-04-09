import { describe, expect, it } from "vitest";
import type { DetectedLockfile, DetectedManifest } from "@repo-guardian/shared-types";
import { parsePipfile } from "../pipfile.js";
import { parsePipfileLock } from "../pipfile-lock.js";
import { parseYarnLock } from "../yarn-lock.js";

function createManifest(
  kind: Extract<DetectedManifest["kind"], "Pipfile">,
  path: string
): DetectedManifest {
  return { ecosystem: "python", kind, path };
}

function createLockfile(
  kind: Extract<DetectedLockfile["kind"], "Pipfile.lock" | "yarn.lock">,
  path: string
): DetectedLockfile {
  return {
    ecosystem: kind === "yarn.lock" ? "node" : "python",
    kind,
    path
  };
}

describe("Node and Python parser expansion", () => {
  it("parses yarn.lock entries with direct and transitive packages", () => {
    const result = parseYarnLock(
      createLockfile("yarn.lock", "yarn.lock"),
      ['"react@^19.0.0":', '  version "19.0.0"', "", '"scheduler@^0.25.0":', '  version "0.25.0"'].join("\n"),
      {
        directDependencyNames: new Set(["react"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(result.packageManager).toBe("yarn");
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "react",
          version: "19.0.0",
          workspacePath: "."
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "scheduler",
          version: "0.25.0",
          workspacePath: null
        })
      ])
    );
  });

  it("warns when a yarn.lock entry has no usable version", () => {
    const result = parseYarnLock(
      createLockfile("yarn.lock", "yarn.lock"),
      ['"react@^19.0.0":', "  resolved \"https://registry.yarnpkg.com/react/-/react.tgz\""].join("\n"),
      {
        directDependencyNames: new Set(["react"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(result.dependencies).toEqual([]);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "FILE_PARSE_FAILED",
        message: "Skipped yarn.lock entry starting on line 1 in yarn.lock."
      })
    ]);
  });

  it("parses Pipfile and Pipfile.lock dependencies", () => {
    const pipfileResult = parsePipfile(
      createManifest("Pipfile", "Pipfile"),
      ["[packages]", 'requests = "==2.32.3"', "", "[dev-packages]", 'pytest = "==8.3.3"'].join("\n")
    );
    const lockResult = parsePipfileLock(
      createLockfile("Pipfile.lock", "Pipfile.lock"),
      JSON.stringify({
        default: {
          requests: { version: "==2.32.3" },
          urllib3: { version: "==2.2.3" }
        },
        develop: {
          pytest: { version: "==8.3.3" }
        }
      }),
      {
        directDependencyNames: new Set(["requests", "pytest"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(pipfileResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "requests",
          version: "==2.32.3"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "pytest",
          version: "==8.3.3"
        })
      ])
    );
    expect(lockResult.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "requests",
          version: "==2.32.3"
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "urllib3",
          version: "==2.2.3"
        }),
        expect.objectContaining({
          dependencyType: "development",
          isDirect: true,
          name: "pytest",
          version: "==8.3.3"
        })
      ])
    );
  });

  it("keeps declaration-only Pipfile dependencies as warnings instead of fabricating exact versions", () => {
    const result = parsePipfile(
      createManifest("Pipfile", "Pipfile"),
      ["[packages]", 'editable-lib = { path = "./vendor/editable-lib" }'].join("\n")
    );

    expect(result.dependencies).toEqual([
      expect.objectContaining({
        name: "editable-lib",
        parseConfidence: "low",
        version: null
      })
    ]);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "FILE_PARSE_FAILED",
        message:
          'Skipped declaration-only Pipfile dependency "editable-lib" in Pipfile; no version was available for advisory lookup.'
      })
    ]);
  });

  it("warns when Pipfile.lock dependencies do not contain versions", () => {
    const result = parsePipfileLock(
      createLockfile("Pipfile.lock", "Pipfile.lock"),
      JSON.stringify({
        default: {
          requests: {}
        }
      }),
      {
        directDependencyNames: new Set(["requests"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(result.dependencies).toEqual([]);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "FILE_PARSE_FAILED",
        message: 'Skipped Pipfile.lock dependency "requests" in Pipfile.lock.'
      })
    ]);
  });
});
