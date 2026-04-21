import "express-session";

export interface Turn {
  turn_index: number;
  role: "employee" | "manager";
  transcript: string;
  coaching_tip?: string;
  emotion_score?: number;
  /** UUID assigned to manager turns during improved-replay generation. */
  turn_id?: string;
  /** GPT-4o-mini rewrite of the manager's transcript. */
  improved_transcript?: string;
  /** Base64-encoded TTS audio (audio/mpeg) — NEVER sent to the frontend. */
  audio_buffer?: string;
}

export interface CachedFeedback {
  strengths: string[];
  improvements: string[];
  summary: string;
  emotionArc: number[];
}

declare module "express-session" {
  interface SessionData {
    consent_given: boolean;
    /** ISO 8601 server-side timestamp of when consent was recorded. */
    consent_timestamp: string | undefined;
    /** ElevenLabs voice ID — NEVER returned to the frontend. */
    voice_id: string | undefined;
    /**
     * undefined  = voice step not yet reached
     * true       = voice cloned successfully (voice_id is set)
     * false      = voice step completed via generic-voice fallback
     */
    voice_cloned: boolean | undefined;
    scenario: string | undefined;
    persona: string | undefined;
    turns: Turn[];
    /** Cached feedback summary — populated by POST /api/feedback-summary. */
    feedback?: CachedFeedback;
  }
}
