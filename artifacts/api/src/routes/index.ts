import { type Router as ExpressRouter, Router } from "express";
import analyzeRouter from "./analyze.js";
import executionRouter from "./execution.js";
import runsRouter from "./runs.js";

const apiRouter: ExpressRouter = Router();

apiRouter.use(analyzeRouter);
apiRouter.use(executionRouter);
apiRouter.use(runsRouter);

export default apiRouter;
