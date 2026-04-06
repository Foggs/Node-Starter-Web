import { Router, type IRouter } from "express";
import { sessionGuard } from "../middlewares/sessionGuard.js";

const router: IRouter = Router();

/** Strips voice_id and returns the public-safe session state. */
function sanitise(req: import("express").Request) {
  return {
    consent_given: req.session.consent_given ?? false,
    voice_cloned: req.session.voice_cloned ?? false,
    voice_id_present: Boolean(req.session.voice_id),
    scenario: req.session.scenario ?? null,
    persona: req.session.persona ?? null,
    turns: req.session.turns ?? [],
  };
}

router.get("/session", sessionGuard, (req, res) => {
  res.json(sanitise(req));
});

router.patch("/session", sessionGuard, (req, res) => {
  const { scenario, persona } = req.body as {
    scenario?: unknown;
    persona?: unknown;
  };

  if (typeof scenario === "string") {
    req.session.scenario = scenario;
  }
  if (typeof persona === "string") {
    req.session.persona = persona;
  }

  res.json(sanitise(req));
});

export default router;
