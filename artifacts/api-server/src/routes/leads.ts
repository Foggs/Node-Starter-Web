/**
 * POST /api/leads — capture a lead from the landing-page demo modal.
 *
 * Public endpoint (no sessionGuard). The express-session middleware mints a
 * session cookie automatically (saveUninitialized: true), so on success the
 * caller can navigate straight into the existing /api/consent flow.
 *
 * Lead data is appended to the "Exit Coach Leads" Google Sheet via service
 * account. Duplicate emails return 201 silently and skip the append. All
 * Sheets errors map to a generic 500 with no detail leak.
 *
 * Validation is currently inline; slice 3 swaps it for `CreateLeadBody` from
 * `@workspace/api-zod` once `lib/api-spec/openapi.yaml` is regenerated.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { leadRateLimit } from "../middlewares/rateLimits.js";
import {
  appendLeadRow,
  findEmailInSheet,
  LeadsConfigError,
} from "../lib/sheets.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

const NAME_MIN = 2;
const NAME_MAX = 100;
const EMAIL_MAX = 254;
// Pragmatic email check — matches the spec's "valid email format" requirement
// without trying to fully implement RFC 5321/5322. Rejects whitespace and
// requires at least one '.' in the domain.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidatedLead {
  name: string;
  email: string;
}

type ValidationResult =
  | { ok: true; data: ValidatedLead }
  | { ok: false; error: string };

function validateLead(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b["name"] !== "string") {
    return { ok: false, error: "name is required and must be a string" };
  }
  const name = b["name"].trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) {
    return {
      ok: false,
      error: `name must be between ${NAME_MIN} and ${NAME_MAX} characters`,
    };
  }

  if (typeof b["email"] !== "string") {
    return { ok: false, error: "email is required and must be a string" };
  }
  const email = b["email"].trim().toLowerCase();
  if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return { ok: false, error: "email must be a valid email address" };
  }

  return { ok: true, data: { name, email } };
}

router.post("/leads", leadRateLimit, async (req: Request, res: Response) => {
  const result = validateLead(req.body);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  const { name, email } = result.data;

  try {
    const exists = await findEmailInSheet(email);
    if (!exists) {
      await appendLeadRow(name, email);
    }
    res.status(201).json({ success: true });
  } catch (err) {
    // Don't leak Sheets internals or service-account hints to the client.
    logger.error(
      { err, route: "POST /api/leads" },
      err instanceof LeadsConfigError
        ? "Sheets misconfigured — check GOOGLE_SERVICE_ACCOUNT_JSON / LEADS_SHEET_ID"
        : "Sheets API call failed",
    );
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
