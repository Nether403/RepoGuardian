import { Router, type Router as ExpressRouter } from "express";

const healthRouter: ExpressRouter = Router();

healthRouter.get("/health", (_request, response) => {
  response.json({
    service: "repo-guardian-api",
    stage: "prompt-1-foundation",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

export default healthRouter;
