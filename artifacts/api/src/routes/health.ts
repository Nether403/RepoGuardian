import { Router, type Router as ExpressRouter } from "express";

const healthRouter: ExpressRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.json({
    service: "repo-guardian-api",
    stage: "milestone-5a-execution-planning",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

export default healthRouter;
