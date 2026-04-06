import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type Express,
  type Request,
  type Response
} from "express";
import { isHttpError } from "./lib/http-error.js";
import apiRouter from "./routes/index.js";
import healthRouter from "./routes/health.js";

const app: Express = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(healthRouter);
app.use("/api", apiRouter);

app.get("/", (_request: Request, response: Response) => {
  response.json({
    name: "Repo Guardian API",
    stage: "milestone-5b-writeback",
    status: "ready"
  });
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (isHttpError(error)) {
    response.status(error.statusCode).json({
      error: error.message
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: "Unexpected server error"
  });
};

app.use(errorHandler);

export default app;
