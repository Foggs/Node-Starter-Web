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
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { CreateLeadBody } from "@workspace/api-zod";
import { leadRateLimit } from "../middlewares/rateLimits.js";
import {
  appendLeadRow,
  findEmailInSheet,
  LeadsConfigError,
} from "../lib/sheets.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.post("/leads", leadRateLimit, async (req: Request, res: Response) => {
  const parse = CreateLeadBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parse.error.flatten(),
    });
    return;
  }

  // Normalise: trim whitespace from the visible name; lowercase the email
  // so the duplicate check is case-insensitive and the sheet stores a
  // canonical address.
  const name = parse.data.name.trim();
  const email = parse.data.email.trim().toLowerCase();

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
