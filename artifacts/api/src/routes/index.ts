import { type Router as ExpressRouter, Router } from "express";
import analyzeRouter from "./analyze.js";

const apiRouter: ExpressRouter = Router();

apiRouter.use(analyzeRouter);

export default apiRouter;
