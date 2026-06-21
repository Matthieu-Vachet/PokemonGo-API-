const compression = require("compression");
const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerJsdoc = require("swagger-jsdoc");
const { env } = require("./config/env");
const { databaseStatus } = require("./config/database");
const { createOpenApi } = require("./docs/openapi");
const { redocPage } = require("./docs/redoc-page");
const { swaggerPage } = require("./docs/swagger-page");
const { cacheMiddleware } = require("./lib/cache");
const { errorHandler, notFound } = require("./middleware/errors");
const { publicReadOnly } = require("./middleware/read-only");
const { requestId } = require("./middleware/request-id");
const api = require("./routes");

function createApp() {
  const app = express();
  app.set("trust proxy", env.trustProxy);
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          connectSrc: ["'self'", "https:"],
          fontSrc: ["'self'", "data:"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", "data:", "https:"],
          objectSrc: ["'none'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://cdn.redoc.ly",
            "https://unpkg.com",
          ],
          styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        },
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    }),
  );
  app.use(
    cors({
      origin:
        env.corsOrigins.includes("*")
          ? true
          : (origin, callback) =>
              callback(null, !origin || env.corsOrigins.includes(origin)),
      methods: ["GET", "HEAD", "OPTIONS"],
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "256kb" }));
  app.use(morgan(env.isProduction ? "combined" : "dev"));
  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      limit: env.rateLimitMax,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Trop de requêtes. Réessayez plus tard.",
        },
      },
    }),
  );

  const specification = swaggerJsdoc({ definition: createOpenApi(), apis: [] });
  app.get("/api-docs.json", (_request, response) => response.json(specification));
  app.get("/api-docs", (_request, response) => response.type("html").send(redocPage()));
  app.get(["/swagger", "/swagger/"], (_request, response) =>
    response.type("html").send(swaggerPage()),
  );
  app.get("/health", (_request, response) => {
    const database = databaseStatus();
    response.status(database === "connected" ? 200 : 503).json({
      data: {
        status: database === "connected" ? "ok" : "degraded",
        database,
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      },
    });
  });
  app.get("/", (_request, response) =>
    response.json({
      data: {
        name: "Pokémon GO API",
        version: "v1",
        api: env.apiBasePath,
        documentation: "/api-docs",
        swagger: "/swagger",
        openapi: "/api-docs.json",
      },
    }),
  );
  app.use(env.apiBasePath, publicReadOnly, cacheMiddleware(), api);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
