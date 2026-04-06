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
  dependencies: DependencySnapshot["dependencies"],
  isPartial = false
): DependencySnapshot {
  return DependencySnapshotSchema.parse({
    dependencies,
    filesParsed: [],
    filesSkipped: [],
    isPartial,
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

describe("createDependencyFindingResult", () => {
  it("creates high-confidence direct findings for resolved direct dependencies", async () => {
    const snapshot = createSnapshot([
      {
        dependencyType: "production",
        ecosystem: "node",
        isDirect: true,
        name: "react",
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: "package.json",
        version: "^19.0.0",
        workspacePath: "."
      },
      {
        dependencyType: "production",
        ecosystem: "node",
        isDirect: true,
        name: "react",
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: "package-lock.json",
        version: "19.0.0",
        workspacePath: "."
      }
    ]);
    const provider = new FakeAdvisoryProvider({
      advisoriesByQueryKey: new Map([
        [
          buildAdvisoryQueryKey("node", "react", "19.0.0"),
          [
            {
              affectedVersionRange: "introduced 0, fixed 19.0.1",
              ecosystem: "node",
              fixedVersion: "19.0.1",
              id: "GHSA-test-1234",
              packageName: "react",
              references: [
                {
                  type: "ADVISORY",
                  url: "https://osv.dev/vulnerability/GHSA-test-1234"
                }
              ],
              severity: "high",
              source: "OSV",
              summary: "React test advisory"
            }
          ]
        ]
      ]),
      isPartial: false,
      warnings: []
    });

    const result = await createDependencyFindingResult(snapshot, provider);

    expect(result.warnings).toEqual([]);
    expect(result.isPartial).toBe(false);
    expect(result.summary).toMatchObject({
      totalFindings: 1,
      vulnerableDirectCount: 1,
      vulnerableTransitiveCount: 0
    });
    expect(result.findings).toEqual([
      expect.objectContaining({
        advisoryId: "GHSA-test-1234",
        confidence: "high",
        isDirect: true,
        packageName: "react",
        paths: ["package-lock.json", "package.json"],
        severity: "high"
      })
    ]);
  });

  it("classifies transitive findings separately from direct findings", async () => {
    const snapshot = createSnapshot([
      {
        dependencyType: "transitive",
        ecosystem: "node",
        isDirect: false,
        name: "minimist",
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: "package-lock.json",
        version: "1.2.5",
        workspacePath: "."
      }
    ]);
    const provider = new FakeAdvisoryProvider({
      advisoriesByQueryKey: new Map([
        [
          buildAdvisoryQueryKey("node", "minimist", "1.2.5"),
          [
            {
              affectedVersionRange: "introduced 0, fixed 1.2.6",
              ecosystem: "node",
              fixedVersion: "1.2.6",
              id: "GHSA-vh95-rmgr-6w4m",
              packageName: "minimist",
              references: [],
              severity: "medium",
              source: "OSV",
              summary: "Prototype pollution"
            }
          ]
        ]
      ]),
      isPartial: false,
      warnings: []
    });

    const result = await createDependencyFindingResult(snapshot, provider);

    expect(result.summary.vulnerableDirectCount).toBe(0);
    expect(result.summary.vulnerableTransitiveCount).toBe(1);
    expect(result.findings[0]).toMatchObject({
      isDirect: false,
      remediationType: "upgrade",
      severity: "medium"
    });
  });

  it("marks declaration-only coverage as partial without false findings", async () => {
    const snapshot = createSnapshot([
      {
        dependencyType: "production",
        ecosystem: "python",
        isDirect: true,
        name: "requests",
        packageManager: "pip",
        parseConfidence: "medium",
        sourceFile: "requirements.txt",
        version: ">=2.0,<3.0",
        workspacePath: "."
      }
    ]);
    const provider = new FakeAdvisoryProvider({
      advisoriesByQueryKey: new Map(),
      isPartial: false,
      warnings: []
    });

    const result = await createDependencyFindingResult(snapshot, provider);

    expect(result.findings).toEqual([]);
    expect(result.isPartial).toBe(true);
    expect(result.warnings).toEqual([
      "Declaration-only advisory coverage for requests in requirements.txt; no exact resolved version was available."
    ]);
  });

  it("does not create false findings when the provider returns no advisories", async () => {
    const snapshot = createSnapshot([
      {
        dependencyType: "production",
        ecosystem: "node",
        isDirect: true,
        name: "react",
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: "package-lock.json",
        version: "19.0.0",
        workspacePath: "."
      }
    ]);
    const provider = new FakeAdvisoryProvider({
      advisoriesByQueryKey: new Map([
        [buildAdvisoryQueryKey("node", "react", "19.0.0"), []]
      ]),
      isPartial: false,
      warnings: []
    });

    const result = await createDependencyFindingResult(snapshot, provider);

    expect(result.findings).toEqual([]);
    expect(result.summary.totalFindings).toBe(0);
  });

  it("propagates provider partial warnings into the result", async () => {
    const snapshot = createSnapshot([
      {
        dependencyType: "production",
        ecosystem: "node",
        isDirect: true,
        name: "react",
        packageManager: "npm",
        parseConfidence: "high",
        sourceFile: "package-lock.json",
        version: "19.0.0",
        workspacePath: "."
      }
    ]);
    const provider = new FakeAdvisoryProvider({
      advisoriesByQueryKey: new Map([
        [buildAdvisoryQueryKey("node", "react", "19.0.0"), []]
      ]),
      isPartial: true,
      warnings: [
        "Advisory results for react@19.0.0 were paginated; only the first page was processed."
      ]
    });

    const result = await createDependencyFindingResult(snapshot, provider);

    expect(result.isPartial).toBe(true);
    expect(result.summary.isPartial).toBe(true);
    expect(result.warnings).toEqual([
      "Advisory results for react@19.0.0 were paginated; only the first page was processed."
    ]);
  });
});
