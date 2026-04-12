import { importLegacyFileStores } from "@repo-guardian/persistence";
import { pathToFileURL } from "node:url";
import {
  getAnalysisRunRepository,
  getExecutionPlanRepository,
  getLegacyPlanStoreDir,
  getLegacyRunStoreDir
} from "../lib/persistence.js";

export async function runLegacyImport() {
  return importLegacyFileStores({
    planRepository: getExecutionPlanRepository(),
    plansRootDir: getLegacyPlanStoreDir(),
    runRepository: getAnalysisRunRepository(),
    runsRootDir: getLegacyRunStoreDir()
  });
}

async function main(): Promise<void> {
  const report = await runLegacyImport();
  console.log(JSON.stringify(report, null, 2));
}

function isDirectExecution(): boolean {
  const entrypoint = process.argv[1];

  if (!entrypoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entrypoint).href;
}

if (isDirectExecution()) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
