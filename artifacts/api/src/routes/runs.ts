import { type Router as ExpressRouter, Router } from "express";
import type { AnalysisRunRepository } from "@repo-guardian/persistence";
import { isPersistenceError } from "@repo-guardian/persistence";
import { isAnalysisRunStoreError } from "@repo-guardian/runs";
import {
  CompareAnalysisRunsRequestSchema,
  SaveAnalysisRunRequestSchema
} from "@repo-guardian/shared-types";
import { getAnalysisRunRepository } from "../lib/persistence.js";
import { requireAuth } from "../middleware/auth.js";

type AnalysisRunStore = Pick<
  AnalysisRunRepository,
  "compareRuns" | "getRun" | "listRuns" | "saveRun"
>;

function mapRunStoreStatus(error: unknown): number | null {
  if (isAnalysisRunStoreError(error)) {
    switch (error.code) {
      case "invalid_run_id":
        return 400;
      case "not_found":
        return 404;
    }
  }

  if (!isPersistenceError(error)) {
    return null;
  }

  switch (error.code) {
    case "invalid_run_id":
      return 400;
    case "not_found":
      return 404;
    case "conflict":
    case "invalid_plan_id":
      return 409;
  }

  return null;
}

export function createRunsRouter(store: AnalysisRunStore): ExpressRouter {
  const runsRouter: ExpressRouter = Router();

  runsRouter.use(requireAuth);

  runsRouter.get("/runs", async (_request, response, next) => {
    try {
      response.json({
        runs: await store.listRuns()
      });
    } catch (error) {
      next(error);
    }
  });

  runsRouter.post("/runs", async (request, response, next) => {
    const parsedRequest = SaveAnalysisRunRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      response.status(201).json(await store.saveRun(parsedRequest.data));
    } catch (error) {
      next(error);
    }
  });

  runsRouter.post("/runs/compare", async (request, response, next) => {
    const parsedRequest = CompareAnalysisRunsRequestSchema.safeParse(request.body);

    if (!parsedRequest.success) {
      response.status(400).json({
        error: parsedRequest.error.issues[0]?.message ?? "Invalid request body"
      });
      return;
    }

    try {
      response.json(await store.compareRuns(parsedRequest.data));
    } catch (error) {
      const status = mapRunStoreStatus(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Saved run request failed"
        });
        return;
      }

      next(error);
    }
  });

  runsRouter.get("/runs/:runId", async (request, response, next) => {
    const runId = request.params.runId;

    if (!runId) {
      response.status(400).json({
        error: "Saved analysis run id is required."
      });
      return;
    }

    try {
      response.json(await store.getRun(runId));
    } catch (error) {
      const status = mapRunStoreStatus(error);

      if (status) {
        response.status(status).json({
          error: error instanceof Error ? error.message : "Saved run request failed"
        });
        return;
      }

      next(error);
    }
  });

  return runsRouter;
}

export default function createDefaultRunsRouter(): ExpressRouter {
  return createRunsRouter(getAnalysisRunRepository());
}
