import type { RequestHandler } from "express";

const SESSION_COOKIE_NAME = "connect.sid";

/**
 * Rejects requests that do not carry a valid, store-backed session.
 *
 * Two checks are made in order:
 *
 * 1. Cookie presence — requests with no `connect.sid` header are rejected
 *    immediately; there is nothing to verify.
 *
 * 2. Session-ID integrity — express-session signs the session ID before
 *    placing it in the cookie (`s:<id>.<hmac>`).  When it receives a cookie
 *    whose ID is unrecognised (expired, forged, or from a restarted store),
 *    it discards that ID and generates a fresh one.  We detect this by
 *    comparing the ID decoded from the cookie against `req.sessionID`.  A
 *    mismatch means the cookie was not honoured — the client does not have a
 *    live session.
 */
export const sessionGuard: RequestHandler = (req, res, next) => {
  // ── 1. cookie presence ────────────────────────────────────────────────────
  const cookieHeader = req.headers.cookie ?? "";
  const sidEntry = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!sidEntry) {
    res.status(401).json({ error: "No active session" });
    return;
  }

  // ── 2. session-ID integrity ───────────────────────────────────────────────
  // Signed-cookie format (set by cookie-signature via express-session):
  //   connect.sid=s%3A<sessionId>.<hmac>
  // After URL-decoding: s:<sessionId>.<hmac>
  // We extract <sessionId> and compare it with req.sessionID.
  const encoded = sidEntry.slice(`${SESSION_COOKIE_NAME}=`.length);
  const decoded = decodeURIComponent(encoded);
  // Strip the "s:" prefix that express-session adds to signed cookies
  const withoutPrefix = decoded.startsWith("s:") ? decoded.slice(2) : decoded;
  // The ID is everything before the first "." (the HMAC separator)
  const cookieSessionId = withoutPrefix.split(".")[0];

  if (cookieSessionId !== req.sessionID) {
    res.status(401).json({ error: "No active session" });
    return;
  }

  next();
};
