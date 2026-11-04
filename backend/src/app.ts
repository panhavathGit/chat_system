import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { corsOptions } from "@config/cors.js";
import { logger } from "@config/logger.js";
import { errorHandler } from "@shared/middleware/error-handler.middleware.js";
import { notFound } from "@shared/middleware/not-found.middleware.js";
import { withRequestContext } from "@shared/middleware/request-context.middleware.js";
import { apiRouter } from "./routes.js";

export const app = express();

app.use(helmet());
app.use(cors(corsOptions));
app.use(withRequestContext);
app.use(pinoHttp({ logger }));
app.use(express.json());

app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);
