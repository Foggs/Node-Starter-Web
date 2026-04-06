import { Router, type IRouter } from "express";
import multer from "multer";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { voiceRateLimit } from "../middlewares/rateLimits.js";
import { cloneVoice, ElevenLabsError } from "../lib/elevenlabs.js";

const router: IRouter = Router();

/**
 * multer with in-memory storage — raw audio bytes are NEVER written to disk.
 * 25 MB limit covers 60 s of high-quality audio with room to spare.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// ─── POST /api/clone-voice ────────────────────────────────────────────────────

router.post(
  "/clone-voice",
  voiceRateLimit,
  sessionGuard,
  upload.single("audio"),
  async (req, res) => {
    // 1. File presence check
    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    // 2. MIME type gate — only audio/* accepted
    if (!req.file.mimetype.startsWith("audio/")) {
      res
        .status(400)
        .json({ error: "Invalid file type — audio files only (audio/*)" });
      return;
    }

    // 3. Attempt voice cloning; fall back gracefully on ElevenLabs error
    try {
      const voiceId = await cloneVoice(
        req.file.buffer,
        "Manager Voice",
        req.file.mimetype,
      );

      // voice_id lives in the session ONLY — never returned to the frontend
      req.session.voice_id = voiceId;
      req.session.voice_cloned = true;

      res.status(200).json({ success: true, fallback: false });
    } catch (err) {
      if (err instanceof ElevenLabsError) {
        // Graceful fallback: practice session continues with a generic voice
        req.session.voice_cloned = false;
        res.status(200).json({ success: true, fallback: true });
        return;
      }
      // Unexpected error — propagate to Express error handler
      throw err;
    }
  },
);

// ─── GET /api/voice/preview ───────────────────────────────────────────────────
// Implemented in Task #5 Step 4

router.get("/voice/preview", voiceRateLimit, sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #5 Step 4" });
});

export default router;
