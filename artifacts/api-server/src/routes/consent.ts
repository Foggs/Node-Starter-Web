import { Router, type IRouter } from "express";
import { RecordConsentBody } from "@workspace/api-zod";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { llmRateLimit } from "../middlewares/rateLimits.js";

const router: IRouter = Router();

router.post("/consent", llmRateLimit, sessionGuard, (req, res) => {
  const parse = RecordConsentBody.safeParse(req.body);

  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body", details: parse.error.flatten() });
    return;
  }

  if (!parse.data.consentGiven) {
    res.status(400).json({ error: "Consent must be given (consentGiven must be true)" });
    return;
  }

  const timestamp = new Date().toISOString();

  req.session.consent_given = true;
  req.session.consent_timestamp = timestamp;

  res.status(200).json({ timestamp });
});

export default router;
