import {
  DependencySnapshotSchema,
  type DependencySnapshot
} from "@repo-guardian/shared-types";
import { describe, expect, it } from "vitest";
import type {
  AdvisoryLookupResult,
  AdvisoryProvider,
  AdvisoryQuery
} from "../provider.js";
import { buildAdvisoryQueryKey } from "../provider.js";
import { createDependencyFindingResult } from "../service.js";

class FakeAdvisoryProvider implements AdvisoryProvider {
  readonly name = "fake";

  constructor(private readonly result: AdvisoryLookupResult) {}

  async lookupAdvisories(_queries: AdvisoryQuery[]): Promise<AdvisoryLookupResult> {
    return this.result;
  }
}

function createSnapshot(
  dependencies: DependencySnapshot["dependencies"]
): DependencySnapshot {
  return DependencySnapshotSchema.parse({
    dependencies,
    filesParsed: [],
    filesSkipped: [],
    isPartial: false,
    parseWarningDetails: [],
    parseWarnings: [],
    summary: {
      byEcosystem: [],
      directDependencies: dependencies.filter((dependency) => dependency.isDirect).length,
      parsedFileCount: 0,
      skippedFileCount: 0,
      totalDependencies: dependencies.length,
      transitiveDependencies: dependencies.filter((dependency) => !dependency.isDirect).length
    }
  });
}

describe("extended advisory ecosystems", () => {
  it("creates advisory findings for Go, Rust, JVM, and Ruby dependencies with exact versions", async () => {
    const snapshot = createSnapshot([
      {
        dependencyType: "production",
        ecosystem: "go",
        isDirect: true,
        name: "github.com/gin-gonic/gin",
        packageManager: "go-mod",
        parseConfidence: "high",
        sourceFile: "go.sum",
        version: "v1.10.0",
        workspacePath: "."
      },
      {
        dependencyType: "production",
        ecosystem: "rust",
        isDirect: true,
        name: "serde",
        packageManager: "cargo",
        parseConfidence: "high",
        sourceFile: "Cargo.lock",
        version: "1.0.215",
        workspacePath: "."
      },
      {
        dependencyType: "production",
        ecosystem: "jvm",
        isDirect: true,
        name: "org.springframework:spring-core",
        packageManager: "maven",
        parseConfidence: "high",
        sourceFile: "pom.xml",
        version: "6.1.15",
        workspacePath: "."
      },
      {
        dependencyType: "production",
        ecosystem: "ruby",
        isDirect: true,
        name: "rails",
        packageManager: "bundler",
        parseConfidence: "high",
        sourceFile: "Gemfile.lock",
        version: "7.1.5",
        workspacePath: "."
      }
    ]);
    const provider = new FakeAdvisoryProvider({
      advisoriesByQueryKey: new Map([
        [
          buildAdvisoryQueryKey("go", "github.com/gin-gonic/gin", "v1.10.0"),
          [
            {
              affectedVersionRange: "introduced 0, fixed v1.10.1",
              ecosystem: "go",
              fixedVersion: "v1.10.1",
              id: "GO-2026-0001",
              packageName: "github.com/gin-gonic/gin",
              references: [],
              severity: "medium",
              source: "OSV",
              summary: "Gin test advisory"
            }
          ]
        ],
        [
          buildAdvisoryQueryKey("rust", "serde", "1.0.215"),
          [
            {
              affectedVersionRange: "introduced 0, fixed 1.0.216",
              ecosystem: "rust",
              fixedVersion: "1.0.216",
              id: "RUSTSEC-2026-0001",
              packageName: "serde",
              references: [],
              severity: "low",
              source: "OSV",
              summary: "Serde test advisory"
            }
          ]
        ],
        [
          buildAdvisoryQueryKey("jvm", "org.springframework:spring-core", "6.1.15"),
          [
            {
              affectedVersionRange: "introduced 0, fixed 6.1.16",
              ecosystem: "jvm",
              fixedVersion: "6.1.16",
              id: "GHSA-jvm-0001",
              packageName: "org.springframework:spring-core",
              references: [],
              severity: "high",
              source: "OSV",
              summary: "Spring test advisory"
            }
          ]
        ],
        [
          buildAdvisoryQueryKey("ruby", "rails", "7.1.5"),
          [
            {
              affectedVersionRange: "introduced 0, fixed 7.1.6",
              ecosystem: "ruby",
              fixedVersion: "7.1.6",
              id: "GHSA-ruby-0001",
              packageName: "rails",
              references: [],
              severity: "medium",
              source: "OSV",
              summary: "Rails test advisory"
            }
          ]
        ]
      ]),
      isPartial: false,
      warningDetails: [],
      warnings: []
    });

    const result = await createDependencyFindingResult(snapshot, provider);

    expect(result.isPartial).toBe(false);
    expect(result.warnings).toEqual([]);
    expect(result.findings).toHaveLength(4);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          advisoryId: "GO-2026-0001",
          packageName: "github.com/gin-gonic/gin",
          remediationVersion: "v1.10.1"
        }),
        expect.objectContaining({
          advisoryId: "RUSTSEC-2026-0001",
          packageName: "serde",
          remediationVersion: "1.0.216"
        }),
        expect.objectContaining({
          advisoryId: "GHSA-jvm-0001",
          packageName: "org.springframework:spring-core",
          remediationVersion: "6.1.16"
        }),
        expect.objectContaining({
          advisoryId: "GHSA-ruby-0001",
          packageName: "rails",
          remediationVersion: "7.1.6"
        })
      ])
    );
  });
});
