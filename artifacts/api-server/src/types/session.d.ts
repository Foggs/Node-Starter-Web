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
    voice_id: string | undefined;
    voice_cloned: boolean;
    scenario: string | undefined;
    persona: string | undefined;
    turns: Turn[];
  }
}
