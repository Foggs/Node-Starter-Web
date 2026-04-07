import { Router, type IRouter } from "express";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { voiceRateLimit } from "../middlewares/rateLimits.js";
import {
  synthesizeSpeech,
  ElevenLabsError,
  type VoiceSettings,
} from "../lib/elevenlabs.js";

const router: IRouter = Router();

// ─── Persona → voice config map ───────────────────────────────────────────────

interface PersonaVoiceConfig {
  voiceId: string;
  settings: VoiceSettings;
}

/**
 * Maps each persona emotional style to a built-in ElevenLabs premade voice
 * and voice settings tuned to reflect that temperament.
 *
 * All voice IDs are from the ElevenLabs premade library — available on all
 * Starter+ plans. Settings use stability (0 = expressive, 1 = monotone) and
 * style (0 = default, 1 = highly exaggerated) to match emotional character.
 */
const PERSONA_VOICE_CONFIG: Record<string, PersonaVoiceConfig> = {
  tearful: {
    voiceId: "21m00Tcm4TlvDq8ikWAM", // Rachel — warm, emotive female voice
    settings: { stability: 0.3, similarity_boost: 0.75, style: 0.5 },
  },
  defensive: {
    voiceId: "VR6AewLTigWG4xSOukaG", // Arnold — firm, authoritative male voice
    settings: { stability: 0.7, similarity_boost: 0.75, style: 0.4 },
  },
  withdrawn: {
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Bella — soft, restrained female voice
    settings: { stability: 0.9, similarity_boost: 0.75, style: 0.05 },
  },
  professional: {
    voiceId: "pNInz6obpgDQGcFmaJgB", // Adam — clear, neutral male voice
    settings: { stability: 0.8, similarity_boost: 0.75, style: 0.1 },
  },
  angry: {
    voiceId: "ErXwobaYiN019PkySvjV", // Antoni — expressive, intense male voice
    settings: { stability: 0.2, similarity_boost: 0.75, style: 0.7 },
  },
};

/** Fallback config when the session persona is unknown or unset. */
const DEFAULT_VOICE_CONFIG: PersonaVoiceConfig = {
  voiceId: "pNInz6obpgDQGcFmaJgB", // Adam
  settings: { stability: 0.6, similarity_boost: 0.75, style: 0.2 },
};

// ─── POST /api/employee-voice ─────────────────────────────────────────────────

router.post(
  "/employee-voice",
  sessionGuard,
  voiceRateLimit,
  async (req, res) => {
    const turns = req.session.turns ?? [];

    // Find the latest employee turn that has not yet been synthesized.
    // Using findLastIndex to get the exact array position so the writeback
    // targets precisely one turn even when multiple pending turns exist.
    const pendingIndex = turns.findLastIndex(
      (t) => t.role === "employee" && !t.audio_buffer,
    );

    if (pendingIndex === -1) {
      res.status(400).json({
        error: "No pending employee turn to synthesize",
      });
      return;
    }

    const pendingTurn = turns[pendingIndex]!;

    // Select voice config: env override > persona map > default
    const personaId = req.session.persona ?? "";
    const personaConfig = PERSONA_VOICE_CONFIG[personaId] ?? DEFAULT_VOICE_CONFIG;
    const overrideVoiceId = process.env["ELEVENLABS_EMPLOYEE_VOICE_ID"];
    const voiceConfig: PersonaVoiceConfig = overrideVoiceId
      ? { voiceId: overrideVoiceId, settings: personaConfig.settings }
      : personaConfig;

    let audioBuffer: Buffer;
    try {
      audioBuffer = await synthesizeSpeech(
        voiceConfig.voiceId,
        pendingTurn.transcript,
        voiceConfig.settings,
      );
    } catch (err) {
      if (err instanceof ElevenLabsError) {
        res.status(502).json({
          error: "Voice service unavailable — try again later",
        });
        return;
      }
      throw err;
    }

    // Assign a stable turn ID and store audio as base64 in session.
    // Update exactly the turn at pendingIndex — no ambiguity even with
    // duplicate unsynthesized turns sharing the same turn_index.
    const turnId = crypto.randomUUID();

    req.session.turns = req.session.turns!.map((t, i) =>
      i === pendingIndex
        ? { ...t, turn_id: turnId, audio_buffer: audioBuffer.toString("base64") }
        : t,
    );

    res.status(200).json({ audioUrl: `/api/audio/${turnId}` });
  },
);

export default router;
