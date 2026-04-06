import type { RequestHandler } from "express";
import session from "express-session";
import connectMemoryStore from "memorystore";
import { deleteVoice } from "../lib/elevenlabs.js";
import { logger } from "../lib/logger.js";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

// ─── voice cleanup on session disposal ───────────────────────────────────────

/**
 * Called by the MemoryStore `dispose` hook whenever a session is removed
 * (explicit destroy, TTL expiry, or LRU eviction).
 *
 * If the session contained an ElevenLabs `voice_id`, the cloned voice is
 * deleted from ElevenLabs so biometric data does not outlive the session.
 *
 * Exported so it can be unit-tested independently of the Express lifecycle.
 *
 * SECURITY: errors from deleteVoice are logged and suppressed — they must
 * NEVER propagate back into the session store's eviction logic.
 */
export function onSessionDispose(sid: string, serialized: string): void {
  let data: { voice_id?: unknown } | undefined;

  try {
    data = JSON.parse(serialized) as { voice_id?: unknown };
  } catch {
    // Malformed JSON — nothing to clean up
    return;
  }

  const voiceId = data?.voice_id;
  if (!voiceId || typeof voiceId !== "string") return;

  // Fire-and-forget: we must not block session cleanup
  deleteVoice(voiceId).catch((err: unknown) => {
    logger.error(
      { err, sid },
      "Failed to delete ElevenLabs voice clone on session cleanup",
    );
  });
}

// ─── session store ────────────────────────────────────────────────────────────

const MemoryStore = connectMemoryStore(session);

const store = new MemoryStore({
  checkPeriod: TWO_HOURS_MS,
  // Fires on explicit destroy(), TTL expiry, and LRU eviction
  dispose(sid: string, serialized: string) {
    onSessionDispose(sid, serialized);
  },
});

// ─── session middleware ───────────────────────────────────────────────────────

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
