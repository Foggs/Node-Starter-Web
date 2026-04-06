import { Router, type IRouter } from "express";
import { sessionGuard } from "../middlewares/sessionGuard.js";

const router: IRouter = Router();

router.post("/clone-voice", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #5" });
});

router.get("/voice/preview", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #5" });
});

export default router;
