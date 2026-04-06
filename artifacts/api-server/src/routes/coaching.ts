import { Router, type IRouter } from "express";
import { sessionGuard } from "../middlewares/sessionGuard.js";

const router: IRouter = Router();

router.post("/coaching-tip", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #6" });
});

router.post("/improved-replay", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #6" });
});

router.post("/feedback-summary", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #6" });
});

export default router;
