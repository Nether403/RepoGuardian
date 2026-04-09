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

describe("JVM and Ruby advisory ecosystems", () => {
  it("creates advisory findings for JVM and Ruby dependencies with exact versions", async () => {
    const snapshot = createSnapshot([
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
    expect(result.findings).toEqual(
      expect.arrayContaining([
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

  it("normalizes Maven and RubyGems OSV payloads into shared ecosystems", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          results: [
            {
              vulns: [{ id: "GHSA-jvm-0001", modified: "2026-04-06T11:30:00.000Z" }]
            },
            {
              vulns: [{ id: "GHSA-ruby-0001", modified: "2026-04-06T11:30:00.000Z" }]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          affected: [
            {
              ecosystem_specific: { severity: "HIGH" },
              package: {
                ecosystem: "Maven",
                name: "org.springframework:spring-core"
              },
              ranges: [
                {
                  events: [{ introduced: "0" }, { fixed: "6.1.16" }],
                  type: "ECOSYSTEM"
                }
              ]
            }
          ],
          id: "GHSA-jvm-0001",
          references: [],
          summary: "Spring test advisory"
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          affected: [
            {
              ecosystem_specific: { severity: "MODERATE" },
              package: {
                ecosystem: "RubyGems",
                name: "rails"
              },
              ranges: [
                {
                  events: [{ introduced: "0" }, { fixed: "7.1.6" }],
                  type: "ECOSYSTEM"
                }
              ]
            }
          ],
          id: "GHSA-ruby-0001",
          references: [],
          summary: "Rails test advisory"
        })
      );
    const provider = new OsvAdvisoryProvider({
      apiBaseUrl: "https://api.osv.dev",
      fetchImpl: fetchMock
    });

    const result = await provider.lookupAdvisories([
      {
        ecosystem: "jvm",
        key: "jvm:org.springframework:spring-core:6.1.15",
        packageName: "org.springframework:spring-core",
        version: "6.1.15"
      },
      {
        ecosystem: "ruby",
        key: "ruby:rails:7.1.5",
        packageName: "rails",
        version: "7.1.5"
      }
    ]);

    expect(result.advisoriesByQueryKey.get("jvm:org.springframework:spring-core:6.1.15")).toEqual([
      expect.objectContaining({
        ecosystem: "jvm",
        id: "GHSA-jvm-0001"
      })
    ]);
    expect(result.advisoriesByQueryKey.get("ruby:rails:7.1.5")).toEqual([
      expect.objectContaining({
        ecosystem: "ruby",
        id: "GHSA-ruby-0001"
      })
    ]);
  });
});
