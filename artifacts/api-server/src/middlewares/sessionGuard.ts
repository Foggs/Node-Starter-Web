import type { RequestHandler } from "express";

const SESSION_COOKIE_NAME = "connect.sid";

export const sessionGuard: RequestHandler = (req, res, next) => {
  const cookieHeader = req.headers.cookie ?? "";
  const hasSessionCookie = cookieHeader
    .split(";")
    .some((c) => c.trim().startsWith(`${SESSION_COOKIE_NAME}=`));

  if (!hasSessionCookie) {
    res.status(401).json({ error: "No active session" });
    return;
  }

  next();
};
