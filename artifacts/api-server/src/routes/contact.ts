/**
 * POST /api/contact — capture a public contact-form submission.
 *
 * Public endpoint (no sessionGuard). Submissions are appended to the
 * "Contact" tab of the Exit Coach Google Sheet via service account.
 * No deduplication — the same email may submit multiple enquiries.
 * All Sheets errors map to a generic 500 with no detail leak.
 */

import { Router, type IRouter, type Request, type Response } from "express";
import { SubmitContactBody } from "@workspace/api-zod";
import { contactRateLimit } from "../middlewares/rateLimits.js";
import { appendContactRow, LeadsConfigError } from "../lib/sheets.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.post("/contact", contactRateLimit, async (req: Request, res: Response) => {
  const parse = SubmitContactBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: "Invalid request body",
      details: parse.error.flatten(),
    });
    return;
  }

  const name = parse.data.name.trim();
  const email = parse.data.email.trim().toLowerCase();
  const message = parse.data.message.trim();

  try {
    await appendContactRow(name, email, message);
    res.status(201).json({ success: true });
  } catch (err) {
    logger.error(
      { err, route: "POST /api/contact" },
      err instanceof LeadsConfigError
        ? "Sheets misconfigured — check GOOGLE_SERVICE_ACCOUNT_JSON / LEADS_SHEET_ID"
        : "Sheets API call failed",
    );
    res.status(500).json({ error: "Internal error" });
  }
});

export default router;
