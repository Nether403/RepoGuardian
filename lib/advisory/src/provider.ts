import type {
  AdvisoryReference,
  EcosystemId,
  FindingSeverity
} from "@repo-guardian/shared-types";

export type AdvisoryQuery = {
  ecosystem: EcosystemId;
  key: string;
  packageName: string;
  version: string;
};

export type NormalizedAdvisory = {
  affectedVersionRange: string | null;
  ecosystem: EcosystemId;
  fixedVersion: string | null;
  id: string;
  packageName: string;
  references: AdvisoryReference[];
  severity: FindingSeverity;
  source: string;
  summary: string;
};

export type AdvisoryLookupResult = {
  advisoriesByQueryKey: Map<string, NormalizedAdvisory[]>;
  isPartial: boolean;
  warnings: string[];
};

export interface AdvisoryProvider {
  readonly name: string;
  lookupAdvisories(queries: AdvisoryQuery[]): Promise<AdvisoryLookupResult>;
}

export class AdvisoryProviderError extends Error {
  readonly code: "network_error" | "upstream_error" | "upstream_invalid_response";

  constructor(
    code: AdvisoryProviderError["code"],
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "AdvisoryProviderError";
    this.code = code;
  }
}

export function buildAdvisoryQueryKey(
  ecosystem: EcosystemId,
  packageName: string,
  version: string
): string {
  return `${ecosystem}:${packageName}:${version}`;
}
