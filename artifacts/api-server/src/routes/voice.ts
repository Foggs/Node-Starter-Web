import { Router, type IRouter } from "express";
import multer from "multer";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { voiceRateLimit } from "../middlewares/rateLimits.js";
import { cloneVoice, synthesizeSpeech, ElevenLabsError } from "../lib/elevenlabs.js";

/**
 * A well-known ElevenLabs pre-built voice used when the manager has not cloned
 * their own voice (or when cloning failed and the fallback path was taken).
 * "Adam" — neutral, professional, clear.
 */
const FALLBACK_VOICE_ID = "pNInz6obpgDQGcFmaJgB";

/**
 * Short sample read aloud to let the manager confirm their cloned voice sounds
 * correct before starting the practice session.
 */
const PREVIEW_TEXT =
  "Thank you for meeting with me today. I want to discuss something important regarding your role, and I appreciate you taking the time.";

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

router.get("/voice/preview", voiceRateLimit, sessionGuard, async (req, res) => {
  // Use the manager's cloned voice if available; fall back to a generic voice
  const voiceId =
    req.session.voice_cloned && req.session.voice_id
      ? req.session.voice_id
      : FALLBACK_VOICE_ID;

  try {
    const audioBuffer = await synthesizeSpeech(voiceId, PREVIEW_TEXT);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audioBuffer.length),
      // Never cache — each preview must reflect the current session voice
      "Cache-Control": "no-store",
    });
    res.status(200).send(audioBuffer);
  } catch (err) {
    if (err instanceof ElevenLabsError) {
      // Return a clean error — do NOT include the voice_id in the message
      res.status(502).json({ error: "Failed to generate voice preview" });
      return;
    }
    throw err;
  }
});

export default router;
