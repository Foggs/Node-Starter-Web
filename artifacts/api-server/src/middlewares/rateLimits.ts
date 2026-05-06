import { rateLimit } from "express-rate-limit";
import type { Request } from "express";

function sessionKey(req: Request): string {
  return req.sessionID ?? req.ip ?? "anonymous";
}

function ipKey(req: Request): string {
  return req.ip ?? "anonymous";
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

/**
 * Per-IP limit for the public /api/leads endpoint. Anonymous callers don't
 * have a stable session ID yet, so IP is the only signal. 5 lead submissions
 * per IP per hour is generous enough for genuine demo→signup flows but stops
 * trivial form-spam without needing a CAPTCHA.
 */
export const leadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyGenerator: ipKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
