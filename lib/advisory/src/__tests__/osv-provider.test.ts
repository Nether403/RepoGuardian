import { describe, expect, it, vi } from "vitest";
import { OsvAdvisoryProvider, normalizeSeverity } from "../osv-provider.js";

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: init?.status ?? 200,
    ...(init ?? {})
  });
}

describe("OsvAdvisoryProvider", () => {
  it("normalizes advisories from OSV batch and vulnerability responses", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          results: [
            {
              vulns: [
                {
                  id: "GHSA-test-1234",
                  modified: "2026-04-06T11:30:00.000Z"
                }
              ]
            }
          ]
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          affected: [
            {
              ecosystem_specific: {
                severity: "HIGH"
              },
              package: {
                ecosystem: "npm",
                name: "react"
              },
              ranges: [
                {
                  events: [
                    {
                      introduced: "0"
                    },
                    {
                      fixed: "19.0.1"
                    }
                  ],
                  type: "ECOSYSTEM"
                }
              ]
            }
          ],
          id: "GHSA-test-1234",
          references: [
            {
              type: "ADVISORY",
              url: "https://osv.dev/vulnerability/GHSA-test-1234"
            }
          ],
          summary: "React test advisory"
        })
      );
    const provider = new OsvAdvisoryProvider({
      apiBaseUrl: "https://api.osv.dev",
      fetchImpl: fetchMock
    });

    const result = await provider.lookupAdvisories([
      {
        ecosystem: "node",
        key: "node:react:19.0.0",
        packageName: "react",
        version: "19.0.0"
      }
    ]);

    expect(result.isPartial).toBe(false);
    expect(result.warningDetails).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.advisoriesByQueryKey.get("node:react:19.0.0")).toEqual([
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
    ]);
  });

  it("returns partial warnings for malformed vulnerability payloads", async () => {
    const provider = new OsvAdvisoryProvider({
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          createJsonResponse({
            results: [
              {
                vulns: [
                  {
                    id: "GHSA-test-1234",
                    modified: "2026-04-06T11:30:00.000Z"
                  }
                ]
              }
            ]
          })
        )
        .mockResolvedValueOnce(createJsonResponse({ summary: "missing id" }))
    });

    const result = await provider.lookupAdvisories([
      {
        ecosystem: "node",
        key: "node:react:19.0.0",
        packageName: "react",
        version: "19.0.0"
      }
    ]);

    expect(result.advisoriesByQueryKey.get("node:react:19.0.0")).toEqual([]);
    expect(result.isPartial).toBe(true);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({
        code: "ADVISORY_PROVIDER_FAILED"
      })
    ]);
    expect(result.warnings).toEqual([
      "Advisory lookup skipped malformed vulnerability payload for GHSA-test-1234."
    ]);
  });
});

describe("normalizeSeverity", () => {
  it("normalizes provider severities into shared severity levels", () => {
    expect(normalizeSeverity("CRITICAL")).toBe("critical");
    expect(normalizeSeverity("HIGH")).toBe("high");
    expect(normalizeSeverity("MODERATE")).toBe("medium");
    expect(normalizeSeverity("LOW")).toBe("low");
    expect(normalizeSeverity("unknown")).toBe("info");
  });
});
