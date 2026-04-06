import { type Router as ExpressRouter, Router } from "express";
import analyzeRouter from "./analyze.js";
import executionRouter from "./execution.js";

const apiRouter: ExpressRouter = Router();

apiRouter.use(analyzeRouter);
apiRouter.use(executionRouter);

export default apiRouter;
