import { Router, type IRouter } from "express";
import multer from "multer";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { voiceRateLimit } from "../middlewares/rateLimits.js";
import { cloneVoice, synthesizeSpeech, deleteVoice, ElevenLabsError } from "../lib/elevenlabs.js";

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

// ─── DELETE /api/voice ───────────────────────────────────────────────────────

/**
 * Discard the currently cloned voice so the manager can re-record.
 * Removes the voice from ElevenLabs and wipes the session fields so a fresh
 * clone-voice upload is required before the session is considered ready.
 */
router.delete("/voice", sessionGuard, async (req, res) => {
  // Snapshot the voice_id at request time. If a concurrent clone-voice
  // completes while ElevenLabs deletion is in-flight, we must NOT overwrite
  // the freshly cloned session state with our stale discard.
  const capturedVoiceId = req.session.voice_id;

  if (capturedVoiceId) {
    try {
      await deleteVoice(capturedVoiceId);
    } catch (err) {
      if (err instanceof ElevenLabsError) {
        res.status(502).json({ error: "Failed to remove cloned voice" });
        return;
      }
      throw err;
    }
  }

  // Only clear the session if the voice_id hasn't changed since we started.
  // A concurrent POST /clone-voice could have replaced it by now.
  if (req.session.voice_id === capturedVoiceId) {
    req.session.voice_id = undefined;
    // Reset to undefined (not false) so voice_step_completed returns false.
    // Setting false would signal "fallback accepted"; undefined means "not yet done".
    req.session.voice_cloned = undefined;
  }

  res.status(200).json({ success: true });
});

export default router;
