import { Router, type IRouter } from "express";
import { sessionGuard } from "../middlewares/sessionGuard.js";

const router: IRouter = Router();

// ─── GET /api/audio/:turnId ───────────────────────────────────────────────────

router.get("/audio/:turnId", sessionGuard, (req, res) => {
  const { turnId } = req.params;
  const turns = req.session.turns ?? [];

  const turn = turns.find(
    (t) => t.turn_id === turnId && t.audio_buffer !== undefined,
  );

  if (!turn || !turn.audio_buffer) {
    res.status(404).json({ error: "Audio not found for this turn ID" });
    return;
  }

  // audio_buffer is stored as base64 to survive session serialization
  const audioBytes = Buffer.from(turn.audio_buffer, "base64");

  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Content-Length", audioBytes.length);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.end(audioBytes);
});

export default router;
