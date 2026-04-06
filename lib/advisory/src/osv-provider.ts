import type { AdvisoryReference, EcosystemId, FindingSeverity } from "@repo-guardian/shared-types";
import {
  AdvisoryProviderError,
  type AdvisoryLookupResult,
  type AdvisoryProvider,
  type AdvisoryQuery,
  type NormalizedAdvisory
} from "./provider.js";
import { getProviderEcosystem } from "./version.js";

type OsvProviderOptions = {
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
};

type OsvQueryResponse = {
  results: Array<{
    next_page_token?: string;
    vulns?: Array<{
      id?: string;
      modified?: string;
    }>;
  }>;
};

type OsvVulnerability = {
  affected?: Array<{
    database_specific?: {
      severity?: string;
    };
    ecosystem_specific?: {
      severity?: string;
    };
    package?: {
      ecosystem?: string;
      name?: string;
    };
    ranges?: Array<{
      events?: Array<Record<string, string>>;
      type?: string;
    }>;
  }>;
  aliases?: string[];
  id?: string;
  references?: Array<{
    type?: string;
    url?: string;
  }>;
  severity?: Array<{
    score?: string;
    type?: string;
  }>;
  summary?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSeverity(rawSeverity: string | null): FindingSeverity {
  switch (rawSeverity?.trim().toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "moderate":
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "info";
  }
}

function extractSeverity(vulnerability: OsvVulnerability): FindingSeverity {
  for (const affected of vulnerability.affected ?? []) {
    const rawSeverity =
      affected.ecosystem_specific?.severity ??
      affected.database_specific?.severity ??
      null;

    if (rawSeverity) {
      return normalizeSeverity(rawSeverity);
    }
  }

  for (const severity of vulnerability.severity ?? []) {
    if (severity.type?.toUpperCase() === "CVSS_V3") {
      const scoreMatch = /CVSS:3\.[01]\/.*?\/A:[HLN]/u.exec(severity.score ?? "");
      if (scoreMatch) {
        return "high";
      }
    }
  }

  return "info";
}

function normalizeProviderEcosystem(
  ecosystem: string | undefined
): EcosystemId | null {
  switch (ecosystem) {
    case "npm":
      return "node";
    case "PyPI":
      return "python";
    default:
      return null;
  }
}

function buildAffectedRange(vulnerability: OsvVulnerability): string | null {
  const matchingRange = vulnerability.affected
    ?.flatMap((affected) => affected.ranges ?? [])
    .find((range) => Array.isArray(range.events) && range.events.length > 0);

  if (!matchingRange?.events) {
    return null;
  }

  const parts = matchingRange.events.flatMap((event) =>
    Object.entries(event).map(([eventType, value]) => `${eventType} ${value}`)
  );

  return parts.length > 0 ? parts.join(", ") : null;
}

function extractFixedVersion(vulnerability: OsvVulnerability): string | null {
  for (const affected of vulnerability.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (typeof event.fixed === "string" && event.fixed.trim().length > 0) {
          return event.fixed.trim();
        }
      }
    }
  }

  return null;
}

function extractReferences(vulnerability: OsvVulnerability): AdvisoryReference[] {
  return (vulnerability.references ?? [])
    .filter(
      (reference): reference is { type?: string; url: string } =>
        typeof reference.url === "string" && reference.url.startsWith("http")
    )
    .map((reference) => ({
      type: typeof reference.type === "string" ? reference.type : null,
      url: reference.url
    }));
}

function normalizeVulnerability(
  vulnerability: OsvVulnerability,
  query: AdvisoryQuery
): NormalizedAdvisory | null {
  if (typeof vulnerability.id !== "string" || vulnerability.id.trim().length === 0) {
    return null;
  }

  const affectedMatch = (vulnerability.affected ?? []).find((affected) => {
    if (!affected.package?.name || !affected.package?.ecosystem) {
      return false;
    }

    return (
      affected.package.name.toLowerCase() === query.packageName.toLowerCase() &&
      normalizeProviderEcosystem(affected.package.ecosystem) === query.ecosystem
    );
  });

  return {
    affectedVersionRange: buildAffectedRange({
      ...vulnerability,
      affected: affectedMatch ? [affectedMatch] : vulnerability.affected
    }),
    ecosystem: query.ecosystem,
    fixedVersion: extractFixedVersion({
      ...vulnerability,
      affected: affectedMatch ? [affectedMatch] : vulnerability.affected
    }),
    id: vulnerability.id,
    packageName: query.packageName,
    references: extractReferences(vulnerability),
    severity: extractSeverity(vulnerability),
    source: "OSV",
    summary:
      typeof vulnerability.summary === "string" && vulnerability.summary.trim().length > 0
        ? vulnerability.summary.trim()
        : `OSV advisory ${vulnerability.id}`
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    throw new AdvisoryProviderError(
      "upstream_invalid_response",
      "Advisory provider returned invalid JSON",
      {
        cause: error
      }
    );
  }
}

export class OsvAdvisoryProvider implements AdvisoryProvider {
  readonly name = "OSV";
  private readonly apiBaseUrl: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: OsvProviderOptions = {}) {
    this.apiBaseUrl = options.apiBaseUrl ?? "https://api.osv.dev";
    this.fetchImpl = options.fetchImpl;
  }

  async lookupAdvisories(queries: AdvisoryQuery[]): Promise<AdvisoryLookupResult> {
    if (queries.length === 0) {
      return {
        advisoriesByQueryKey: new Map(),
        isPartial: false,
        warnings: []
      };
    }

    const fetchImpl = this.fetchImpl ?? fetch;
    let queryResponse: Response;

    try {
      queryResponse = await fetchImpl(`${this.apiBaseUrl}/v1/querybatch`, {
        body: JSON.stringify({
          queries: queries.map((query) => ({
            package: {
              ecosystem: getProviderEcosystem(query.ecosystem),
              name: query.packageName
            },
            version: query.version
          }))
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        method: "POST"
      });
    } catch (error) {
      throw new AdvisoryProviderError("network_error", "Failed to reach the advisory provider", {
        cause: error
      });
    }

    if (!queryResponse.ok) {
      throw new AdvisoryProviderError(
        "upstream_error",
        `Advisory provider request failed with status ${queryResponse.status}`
      );
    }

    const payload = (await readJson(queryResponse)) as OsvQueryResponse;

    if (!Array.isArray(payload.results) || payload.results.length !== queries.length) {
      throw new AdvisoryProviderError(
        "upstream_invalid_response",
        "Advisory provider returned an unexpected batch response"
      );
    }

    const advisoriesByQueryKey = new Map<string, NormalizedAdvisory[]>();
    const warnings: string[] = [];
    let isPartial = false;
    const vulnerabilityCache = new Map<string, OsvVulnerability>();

    for (const [index, result] of payload.results.entries()) {
      const query = queries[index];

      if (!query) {
        continue;
      }

      if (typeof result.next_page_token === "string" && result.next_page_token.length > 0) {
        warnings.push(
          `Advisory results for ${query.packageName}@${query.version} were paginated; only the first page was processed.`
        );
        isPartial = true;
      }

      const advisoryIds = (result.vulns ?? [])
        .map((vulnerability) => vulnerability.id)
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0);

      const normalizedAdvisories: NormalizedAdvisory[] = [];

      for (const advisoryId of advisoryIds) {
        let vulnerability = vulnerabilityCache.get(advisoryId);

        if (!vulnerability) {
          let vulnerabilityResponse: Response;

          try {
            vulnerabilityResponse = await fetchImpl(
              `${this.apiBaseUrl}/v1/vulns/${encodeURIComponent(advisoryId)}`,
              {
                headers: {
                  Accept: "application/json"
                }
              }
            );
          } catch {
            warnings.push(
              `Advisory lookup failed for ${advisoryId}: failed to reach the advisory provider.`
            );
            isPartial = true;
            continue;
          }

          if (!vulnerabilityResponse.ok) {
            warnings.push(
              `Advisory lookup failed for ${advisoryId}: provider returned status ${vulnerabilityResponse.status}.`
            );
            isPartial = true;
            continue;
          }

          const rawVulnerability = await readJson(vulnerabilityResponse);

          if (!isRecord(rawVulnerability)) {
            warnings.push(
              `Advisory lookup failed for ${advisoryId}: provider returned an invalid vulnerability payload.`
            );
            isPartial = true;
            continue;
          }

          vulnerability = rawVulnerability as OsvVulnerability;
          vulnerabilityCache.set(advisoryId, vulnerability);
        }

        const normalized = normalizeVulnerability(vulnerability, query);

        if (!normalized) {
          warnings.push(
            `Advisory lookup skipped malformed vulnerability payload for ${advisoryId}.`
          );
          isPartial = true;
          continue;
        }

        normalizedAdvisories.push(normalized);
      }

      advisoriesByQueryKey.set(
        query.key,
        normalizedAdvisories.sort((left, right) => left.id.localeCompare(right.id))
      );
    }

    return {
      advisoriesByQueryKey,
      isPartial,
      warnings: [...new Set(warnings)].sort((left, right) => left.localeCompare(right))
    };
  }
}

export { normalizeSeverity };
