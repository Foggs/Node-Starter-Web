import "express-session";

export interface Turn {
  turn_index: number;
  role: "employee" | "manager";
  transcript: string;
  coaching_tip?: string;
  emotion_score?: number;
}

declare module "express-session" {
  interface SessionData {
    consent_given: boolean;
    /** ISO 8601 server-side timestamp of when consent was recorded. */
    consent_timestamp: string | undefined;
    /** ElevenLabs voice ID — NEVER returned to the frontend. */
    voice_id: string | undefined;
    voice_cloned: boolean;
    scenario: string | undefined;
    persona: string | undefined;
    turns: Turn[];
  }
}
