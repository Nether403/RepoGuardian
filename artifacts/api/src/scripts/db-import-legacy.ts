import { importLegacyFileStores } from "@repo-guardian/persistence";
import {
  getAnalysisRunRepository,
  getExecutionPlanRepository,
  getLegacyPlanStoreDir,
  getLegacyRunStoreDir
} from "../lib/persistence.js";

async function main(): Promise<void> {
  const report = await importLegacyFileStores({
    planRepository: getExecutionPlanRepository(),
    plansRootDir: getLegacyPlanStoreDir(),
    runRepository: getAnalysisRunRepository(),
    runsRootDir: getLegacyRunStoreDir()
  });

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
