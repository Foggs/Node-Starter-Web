import type { RequestHandler } from "express";
import session from "express-session";
import connectMemoryStore from "memorystore";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const MemoryStore = connectMemoryStore(session);

const store = new MemoryStore({
  checkPeriod: TWO_HOURS_MS,
});

const rawSession = session({
  secret: process.env["SESSION_SECRET"] ?? "exit-coach-dev-secret-change-in-prod",
  resave: false,
  saveUninitialized: true,
  rolling: true,
  store,
  cookie: {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    maxAge: TWO_HOURS_MS,
  },
});

function initDefaults(
  req: import("express").Request,
  _res: import("express").Response,
  next: import("express").NextFunction,
): void {
  if (req.session.consent_given === undefined) {
    req.session.consent_given = false;
  }
  if (req.session.voice_cloned === undefined) {
    req.session.voice_cloned = false;
  }
  if (req.session.turns === undefined) {
    req.session.turns = [];
  }
  next();
}

export const sessionMiddleware: RequestHandler = (req, res, next) => {
  rawSession(req, res, (err) => {
    if (err) return next(err);
    initDefaults(req, res, next);
  });
};
