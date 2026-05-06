import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { sessionMiddleware } from "./middlewares/session.js";

const app: Express = express();

// Replit (and any reverse-proxied deploy) terminates TLS upstream and forwards
// the request to Node over HTTP with `X-Forwarded-Proto: https`. Without this,
// Express treats every request as HTTP and `express-session` refuses to emit
// Secure cookies in production, breaking every session-dependent route.
// `1` = trust exactly one upstream hop; `true` would be a header-spoof risk.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      const allowed = process.env["ALLOWED_ORIGIN"];
      if (allowed && allowed !== "*") {
        callback(null, allowed);
      } else {
        callback(null, origin ?? "*");
      }
    },
  }),
);

app.use(sessionMiddleware);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

export default app;
