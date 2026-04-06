import { describe, expect, it } from "vitest";
import type { DetectedLockfile, DetectedManifest } from "@repo-guardian/shared-types";
import { parsePackageJson } from "../package-json.js";
import { parsePackageLockJson } from "../package-lock.js";
import { parsePnpmLockYaml } from "../pnpm-lock.js";
import { parsePoetryLock } from "../poetry-lock.js";
import { parsePyprojectToml } from "../pyproject.js";
import { parseRequirementsTxt } from "../requirements.js";

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

describe("dependency parsers", () => {
  it("parses package.json direct dependencies by section", () => {
    const file = createManifest("package.json", "package.json");
    const result = parsePackageJson(
      file,
      JSON.stringify({
        dependencies: {
          react: "^19.0.0"
        },
        devDependencies: {
          vitest: "^3.0.0"
        },
        optionalDependencies: {
          fsevents: "^2.3.0"
        },
        peerDependencies: {
          typescript: "^5.0.0"
        }
      }),
      {
        directDependencyNames: new Set<string>(),
        lockfilesByWorkspace: new Map([
          [
            ".",
            [
              {
                ecosystem: "node",
                kind: "package-lock.json",
                path: "package-lock.json"
              }
            ]
          ]
        ])
      }
    );

    expect(result.packageManager).toBe("npm");
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "react",
          packageManager: "npm"
        }),
        expect.objectContaining({
          dependencyType: "development",
          name: "vitest"
        }),
        expect.objectContaining({
          dependencyType: "peer",
          name: "typescript"
        }),
        expect.objectContaining({
          dependencyType: "optional",
          name: "fsevents"
        })
      ])
    );
  });

  it("parses package-lock.json package records", () => {
    const file = createLockfile("package-lock.json", "package-lock.json");
    const result = parsePackageLockJson(
      file,
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          "": {
            dependencies: {
              react: "^19.0.0"
            },
            devDependencies: {
              vitest: "^3.0.0"
            }
          },
          "node_modules/react": {
            name: "react",
            version: "19.0.0"
          },
          "node_modules/vitest": {
            dev: true,
            name: "vitest",
            version: "3.2.4"
          },
          "node_modules/tinypool": {
            version: "1.0.0"
          }
        }
      }),
      {
        directDependencyNames: new Set<string>(),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "react",
          version: "19.0.0"
        }),
        expect.objectContaining({
          dependencyType: "development",
          isDirect: true,
          name: "vitest",
          version: "3.2.4"
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "tinypool",
          version: "1.0.0"
        })
      ])
    );
  });

  it("parses pnpm-lock.yaml package records", () => {
    const file = createLockfile("pnpm-lock.yaml", "pnpm-lock.yaml");
    const result = parsePnpmLockYaml(
      file,
      [
        "lockfileVersion: '9.0'",
        "importers:",
        "  .:",
        "    dependencies:",
        "      react:",
        "        specifier: ^19.0.0",
        "        version: 19.0.0",
        "packages:",
        "  /react@19.0.0:",
        "    resolution:",
        "      integrity: sha512-react",
        "  /scheduler@0.25.0:",
        "    resolution:",
        "      integrity: sha512-scheduler"
      ].join("\n")
    );

    expect(result.packageManager).toBe("pnpm");
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "react",
          packageManager: "pnpm",
          workspacePath: "."
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "scheduler",
          workspacePath: null
        })
      ])
    );
  });

  it("parses requirements.txt entries", () => {
    const file = createManifest("requirements.txt", "requirements.txt");
    const result = parseRequirementsTxt(
      file,
      [
        "# comment",
        "requests==2.32.3",
        "fastapi>=0.110,<1.0",
        "-r base.txt"
      ].join("\n")
    );

    expect(result.packageManager).toBe("pip");
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "requests",
          version: "==2.32.3"
        }),
        expect.objectContaining({
          name: "fastapi",
          version: ">=0.110,<1.0"
        })
      ])
    );
    expect(result.warningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "FILE_PARSE_FAILED",
          message: expect.stringContaining("Skipped unsupported requirements.txt directive")
        })
      ])
    );
  });

  it("parses pyproject.toml straightforward dependency declarations", () => {
    const file = createManifest("pyproject.toml", "services/api/pyproject.toml");
    const result = parsePyprojectToml(
      file,
      [
        "[project]",
        'dependencies = ["fastapi>=0.110", "pydantic==2.9.2"]',
        "",
        "[project.optional-dependencies]",
        'dev = ["pytest>=8.0"]'
      ].join("\n"),
      {
        directDependencyNames: new Set<string>(),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(result.packageManager).toBeNull();
    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          name: "fastapi",
          workspacePath: "services/api"
        }),
        expect.objectContaining({
          dependencyType: "optional",
          name: "pytest"
        })
      ])
    );
  });

  it("parses poetry.lock package records using direct dependency context", () => {
    const file = createLockfile("poetry.lock", "poetry.lock");
    const result = parsePoetryLock(
      file,
      [
        "[[package]]",
        'name = "fastapi"',
        'version = "0.115.0"',
        'category = "main"',
        "",
        "[[package]]",
        'name = "anyio"',
        'version = "4.6.2"',
        'category = "main"'
      ].join("\n"),
      {
        directDependencyNames: new Set(["fastapi"]),
        lockfilesByWorkspace: new Map()
      }
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dependencyType: "production",
          isDirect: true,
          name: "fastapi",
          workspacePath: "."
        }),
        expect.objectContaining({
          dependencyType: "transitive",
          isDirect: false,
          name: "anyio",
          workspacePath: null
        })
      ])
    );
  });
});
