import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import pingRouter from "./ping.js";
import scenariosRouter from "./scenarios.js";
import personasRouter from "./personas.js";
import sessionRouter from "./session.js";
import consentRouter from "./consent.js";
import voiceRouter from "./voice.js";
import coachingRouter from "./coaching.js";
import reportRouter from "./report.js";
import audioRouter from "./audio.js";
import employeeVoiceRouter from "./employeeVoice.js";

const router: IRouter = Router();

// Public — no session guard
router.use(healthRouter);
router.use(pingRouter);
router.use(scenariosRouter);
router.use(personasRouter);

// Session-guarded (guard applied per-route inside each router)
router.use(sessionRouter);
router.use(consentRouter);
router.use(voiceRouter);
router.use(coachingRouter);
router.use(reportRouter);
router.use(audioRouter);
router.use(employeeVoiceRouter);

export default router;
