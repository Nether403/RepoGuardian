import type {
  EcosystemDetection,
  RepositoryTreeEntry
} from "@repo-guardian/shared-types";
import { detectFiles } from "./detect-files.js";
import { inferEcosystems } from "./infer-ecosystems.js";

export function detectRepositoryStructure(
  entries: RepositoryTreeEntry[]
): EcosystemDetection {
  return inferEcosystems(detectFiles(entries));
}

export * from "./detect-files.js";
export * from "./infer-ecosystems.js";
export * from "./signals.js";
