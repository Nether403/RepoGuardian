import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

type OpenApiDocument = {
  paths?: Record<string, Record<string, Record<string, unknown>>>;
};

function getOperationIds(document: OpenApiDocument): string[] {
  return Object.values(document.paths ?? {})
    .flatMap((pathItem) => Object.values(pathItem))
    .map((operation) => operation.operationId)
    .filter((operationId): operationId is string => typeof operationId === "string")
    .sort((left, right) => left.localeCompare(right));
}

describe("Repo Guardian OpenAPI contract", () => {
  it("defines client operations for analysis, execution, and saved runs", async () => {
    const spec = parse(
      await readFile(resolve("openapi.yaml"), "utf8")
    ) as OpenApiDocument;

    expect(getOperationIds(spec)).toEqual([
      "analyzeRepository",
      "cancelAnalysisJob",
      "compareAnalysisRuns",
      "createExecutionPlan",
      "createSweepSchedule",
      "createTrackedRepository",
      "enqueueAnalysisJob",
      "enqueueExecutionPlanJob",
      "executeExecutionPlan",
      "getAnalysisJob",
      "getAnalysisRun",
      "getExecutionPlan",
      "getFleetStatus",
      "getTrackedRepositoryHistory",
      "listAnalysisJobs",
      "listAnalysisRuns",
      "listExecutionPlanEvents",
      "listSweepSchedules",
      "listTrackedRepositories",
      "retryAnalysisJob",
      "saveAnalysisRun",
      "triggerSweepSchedule"
    ]);
  });
});
