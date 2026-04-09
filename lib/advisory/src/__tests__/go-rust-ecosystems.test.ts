import {
  DependencySnapshotSchema,
  type DependencySnapshot
} from "@repo-guardian/shared-types";
import { describe, expect, it, vi } from "vitest";
import type {
  AdvisoryLookupResult,
  AdvisoryProvider,
  AdvisoryQuery
} from "../provider.js";
import { buildAdvisoryQueryKey } from "../provider.js";
import { OsvAdvisoryProvider } from "../osv-provider.js";
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

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: init?.status ?? 200,
    ...(init ?? {})
  });
}

describe("Go and Rust advisory ecosystems", () => {
  it("creates advisory findings for Go and Rust dependencies with exact versions", async () => {
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
        ]
      ]),
      isPartial: false,
      warningDetails: [],
      warnings: []
    });

    const result = await createDependencyFindingResult(snapshot, provider);

    expect(result.isPartial).toBe(false);
    expect(result.warnings).toEqual([]);
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
        })
      ])
    );
  });

  it("normalizes Go and crates.io OSV payloads into shared ecosystems", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          results: [
            {
              vulns: [
                { id: "GO-2026-0001", modified: "2026-04-06T11:30:00.000Z" }
              ]
            },
            {
              vulns: [
                { id: "RUSTSEC-2026-0001", modified: "2026-04-06T11:30:00.000Z" }
              ]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          affected: [
            {
              ecosystem_specific: { severity: "MODERATE" },
              package: {
                ecosystem: "Go",
                name: "github.com/gin-gonic/gin"
              },
              ranges: [
                {
                  events: [{ introduced: "0" }, { fixed: "v1.10.1" }],
                  type: "ECOSYSTEM"
                }
              ]
            }
          ],
          id: "GO-2026-0001",
          references: [],
          summary: "Gin test advisory"
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          affected: [
            {
              ecosystem_specific: { severity: "LOW" },
              package: {
                ecosystem: "crates.io",
                name: "serde"
              },
              ranges: [
                {
                  events: [{ introduced: "0" }, { fixed: "1.0.216" }],
                  type: "ECOSYSTEM"
                }
              ]
            }
          ],
          id: "RUSTSEC-2026-0001",
          references: [],
          summary: "Serde test advisory"
        })
      );
    const provider = new OsvAdvisoryProvider({
      apiBaseUrl: "https://api.osv.dev",
      fetchImpl: fetchMock
    });

    const result = await provider.lookupAdvisories([
      {
        ecosystem: "go",
        key: "go:github.com/gin-gonic/gin:v1.10.0",
        packageName: "github.com/gin-gonic/gin",
        version: "v1.10.0"
      },
      {
        ecosystem: "rust",
        key: "rust:serde:1.0.215",
        packageName: "serde",
        version: "1.0.215"
      }
    ]);

    expect(result.advisoriesByQueryKey.get("go:github.com/gin-gonic/gin:v1.10.0")).toEqual([
      expect.objectContaining({
        ecosystem: "go",
        id: "GO-2026-0001"
      })
    ]);
    expect(result.advisoriesByQueryKey.get("rust:serde:1.0.215")).toEqual([
      expect.objectContaining({
        ecosystem: "rust",
        id: "RUSTSEC-2026-0001"
      })
    ]);
  });
});
