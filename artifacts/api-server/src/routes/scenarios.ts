import { Router, type IRouter } from "express";
import { scenarios } from "../data/scenarios.js";

const router: IRouter = Router();

router.get("/scenarios", (_req, res) => {
  res.json(scenarios);
});

export default router;
