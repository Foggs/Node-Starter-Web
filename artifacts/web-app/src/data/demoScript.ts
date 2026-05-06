/**
 * DEMO_SCRIPT — fully-scripted 3-turn demo content for the landing modal.
 *
 * The demo is "Layoff / Restructuring" + "Defensive / Argumentative" persona.
 * Voices used during pre-generation:
 *   - Employee turns: Arnold (defensive persona voice config)
 *   - Manager turn (original):  Adam @ stability 0.45
 *   - Manager turn (improved):  Adam @ stability 0.70 (more composed)
 *
 * Source: demo-feature.md
 */

export interface DemoTurn {
  /** 1-indexed turn number, displayed nowhere but used for arc data points. */
  turnIndex: number;
  speaker: "employee" | "manager";
  transcript: string;
  /** Path under /public so a `<audio src={...}>` can fetch it directly. */
  audioSrc: string;
  /** Coaching tip shown after this turn finishes. */
  coachingTip: string;
  /** 1–10. Drives the emotion arc colour banding. */
  emotionScore: number;
}

export interface DemoScript {
  scenarioName: string;
  personaName: string;
  /**
   * Intro / title card content shown before playback. Waits for an explicit
   * Continue click — no auto-dismiss. Sets expectations so the user knows
   * what they're about to watch.
   */
  titleCard: {
    heading: string;
    bullets: [string, string, string];
  };
  turns: [DemoTurn, DemoTurn, DemoTurn];
  /** Side-by-side comparison shown after turn 3. */
  improvedReplay: {
    /** Original turn 2 manager transcript (mirrors turns[1].transcript). */
    originalTranscript: string;
    /** GPT-rewritten version that applies the turn-2 coaching tip. */
    improvedTranscript: string;
    /** Pre-generated Adam @ stability 0.70 audio. */
    audioSrc: string;
  };
}

export const DEMO_SCRIPT: DemoScript = {
  scenarioName: "Layoff conversation",
  personaName: "Alex — Defensive",
  titleCard: {
    heading: "What you'll see",
    bullets: [
      "3 scripted turns of a tough layoff conversation",
      "Real-time coaching tips after each of your turns",
      "An improved version of your reply played back at the end",
    ],
  },
  turns: [
    {
      turnIndex: 1,
      speaker: "employee",
      transcript:
        "Wait — what exactly are you saying? Are you telling me my position is being eliminated? I've been here for six years. Six years. And you're just... telling me this now?",
      audioSrc: "/demo/employee-turn-1.mp3",
      coachingTip:
        "Let the employee finish before responding. Jumping in too quickly signals defensiveness on your side too.",
      emotionScore: 7,
    },
    {
      turnIndex: 2,
      speaker: "manager",
      transcript:
        "I understand this is a shock, and I want you to know this decision wasn't made lightly. Your role is being eliminated as part of a company-wide restructuring — it's not a reflection of your performance.",
      audioSrc: "/demo/manager-turn-2-original.mp3",
      coachingTip:
        "Good — you separated the structural reason from their performance. That's the right framing legally and emotionally. Next: acknowledge the six years directly.",
      emotionScore: 5,
    },
    {
      turnIndex: 3,
      speaker: "employee",
      transcript:
        "Not a reflection of my performance? Then why me? There are people in my department who joined six months ago. Why isn't it their position being eliminated? This feels completely arbitrary.",
      audioSrc: "/demo/employee-turn-3.mp3",
      coachingTip:
        "Don't defend the selection criteria — that path leads to legal risk. Acknowledge their frustration, then redirect to next steps and support.",
      emotionScore: 8,
    },
  ],
  improvedReplay: {
    originalTranscript:
      "I understand this is a shock, and I want you to know this decision wasn't made lightly. Your role is being eliminated as part of a company-wide restructuring — it's not a reflection of your performance.",
    improvedTranscript:
      "Six years is significant, and I want to acknowledge that directly. This decision wasn't made lightly — your role is being eliminated because of a structural change in the organisation, not because of anything you did or didn't do. That distinction matters, and I want to make sure you hear it clearly.",
    audioSrc: "/demo/manager-turn-2-improved.mp3",
  },
};

/** Convenience: array of emotion scores in turn order, suitable for the arc chart. */
export const DEMO_EMOTION_ARC: number[] = DEMO_SCRIPT.turns.map(
  (t) => t.emotionScore,
);
