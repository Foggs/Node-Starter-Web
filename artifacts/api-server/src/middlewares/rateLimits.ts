import { rateLimit } from "express-rate-limit";
import type { Request } from "express";

function sessionKey(req: Request): string {
  return req.sessionID ?? req.ip ?? "anonymous";
}

export const voiceRateLimit = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: sessionKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

export const llmRateLimit = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: sessionKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
