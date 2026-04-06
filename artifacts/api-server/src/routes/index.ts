import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import pingRouter from "./ping.js";
import scenariosRouter from "./scenarios.js";
import personasRouter from "./personas.js";
import sessionRouter from "./session.js";

const router: IRouter = Router();

// Public — no session guard
router.use(healthRouter);
router.use(pingRouter);
router.use(scenariosRouter);
router.use(personasRouter);

// Session-guarded (guard applied per-route inside each router)
router.use(sessionRouter);

export default router;
