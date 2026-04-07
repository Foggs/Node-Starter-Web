import type { RequestHandler } from "express";

const SESSION_COOKIE_NAME = "connect.sid";

/**
 * Rejects requests that do not carry a fully-initialised, store-backed session.
 *
 * Three checks are applied in order:
 *
 * 1. **Cookie presence** — requests with no `connect.sid` header are rejected
 *    immediately.
 *
 * 2. **Session-ID integrity** — express-session signs the session ID before
 *    placing it in the cookie (`s:<id>.<hmac>`).  When it receives a cookie
 *    whose ID is unrecognised (forged, expired, or from a restarted store),
 *    it discards that ID and generates a fresh one.  Detecting a mismatch
 *    between the decoded cookie ID and `req.sessionID` catches forged or
 *    expired cookies before they reach any business logic.  Cookie parsing is
 *    wrapped in try/catch so malformed percent-encoding cannot cause a 500.
 *
 * 3. **Session initialisation** — `initDefaults` (called inside
 *    `sessionMiddleware`) sets `consent_given` to `false` on every properly
 *    created session.  If it is still `undefined` the session was never run
 *    through the standard middleware stack and must be rejected.
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

  // ── 2. session-ID integrity (forged / expired cookie detection) ───────────
  // Signed-cookie format: connect.sid=s%3A<id>.<hmac>
  // After URL-decode: s:<id>.<hmac>  →  strip "s:" prefix  →  id is before "."
  // Wrapped in try/catch: malformed percent-encoding must not throw a 500.
  try {
    const encoded = sidEntry.slice(`${SESSION_COOKIE_NAME}=`.length);
    const decoded = decodeURIComponent(encoded);
    const withoutPrefix = decoded.startsWith("s:") ? decoded.slice(2) : decoded;
    const cookieSessionId = withoutPrefix.split(".")[0];

    if (cookieSessionId !== req.sessionID) {
      res.status(401).json({ error: "No active session" });
      return;
    }
  } catch {
    // Malformed cookie value — treat as no valid session
    res.status(401).json({ error: "No active session" });
    return;
  }

  // ── 3. session initialisation ─────────────────────────────────────────────
  // `initDefaults` sets consent_given to false on every properly initialised
  // session.  An undefined value means the session was never run through the
  // standard middleware stack (e.g. constructed outside normal flow).
  if (req.session.consent_given === undefined) {
    res.status(401).json({ error: "No active session" });
    return;
  }

  next();
};
