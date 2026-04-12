import {
  type NextFunction,
  type Request,
  type Response,
  type Router as ExpressRouter,
  Router
} from "express";
import analyzeRouter from "./analyze.js";
import createDefaultExecutionRouter from "./execution.js";
import createDefaultFleetRouter from "./fleet.js";
import createDefaultRunsRouter from "./runs.js";

function createLazyRouter(factory: () => ExpressRouter): ExpressRouter {
  let router: ExpressRouter | null = null;
  const lazyRouter = Router();

  lazyRouter.use((request: Request, response: Response, next: NextFunction) => {
    try {
      router ??= factory();
      router(request, response, next);
    } catch (error) {
      next(error);
    }
  });

  return lazyRouter;
}

const apiRouter: ExpressRouter = Router();

apiRouter.use(analyzeRouter);
apiRouter.use(createLazyRouter(createDefaultExecutionRouter));
apiRouter.use(createLazyRouter(createDefaultFleetRouter));
apiRouter.use(createLazyRouter(createDefaultRunsRouter));

export default apiRouter;
