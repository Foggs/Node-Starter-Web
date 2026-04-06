import { Router, type IRouter } from "express";
import { sessionGuard } from "../middlewares/sessionGuard.js";

const router: IRouter = Router();

router.post("/export-report", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #6" });
});

export default router;
