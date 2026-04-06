import { Router, type IRouter } from "express";
import { personas } from "../data/personas.js";

const router: IRouter = Router();

router.get("/personas", (_req, res) => {
  res.json(personas);
});

export default router;
