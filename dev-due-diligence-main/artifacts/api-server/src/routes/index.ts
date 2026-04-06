import { Router, type IRouter } from "express";
import healthRouter from "./health";
import githubRouter from "./github";
import benchmarkRouter from "./benchmark";

const router: IRouter = Router();

router.use(healthRouter);
router.use(githubRouter);
router.use(benchmarkRouter);

export default router;
