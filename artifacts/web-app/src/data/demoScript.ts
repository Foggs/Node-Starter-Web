/**
 * DEMO_SCRIPT — fully-scripted 3-turn demo content for the landing modal.
 *
 * v4.0: user-paced, click-gated flow. Every advance point is an explicit
 * Continue / Begin / Show me click. The original conversation has 3 turns;
 * the improved replay has 4 segments (E1, M2-improved, E3-replay, M3-improved)
 * — the M3 turn is the response that never happened in the original because
 * the conversation cut off after Employee Turn 3.
 *
 * Voices used during pre-generation:
 *   - Employee turns: Arnold (defensive persona voice config)
 *   - Manager (original):  Adam @ stability 0.45
 *   - Manager (improved):  Adam @ stability 0.70 (more composed)
 *
 * Source: demo-feature-revised.md (v4.0)
 */

export interface DemoTurn {
  /** 1-indexed turn number, used as a stable React key. */
  turnIndex: number;
  speaker: "employee" | "manager";
  transcript: string;
  /** Path under /public so a `<audio src={...}>` can fetch it directly. */
  audioSrc: string;
  /** Coaching tip shown after this turn finishes. */
  coachingTip: string;
  /** Play-by-play narration shown below the coaching tip, above the Continue button. */
  narration: string;
  /** 1–10. Drives the (deferred) emotion-arc colour banding. */
  emotionScore: number;
}

/** A segment in the improved replay. No coaching / narration — listening mode. */
export interface DemoImprovedTurn {
  /** Stable identifier: e1 / m2 / e3 / m3 — matches the playback phase suffix. */
  id: "e1" | "m2" | "e3" | "m3";
  speaker: "employee" | "manager";
  transcript: string;
  audioSrc: string;
}

export interface DemoScript {
  scenarioName: string;
  personaName: string;
  /**
   * Scene-setter card shown when the modal first opens. Replaces v3.0's
   * generic title card. Sets the scenario / persona / turn-count expectation.
   * Waits for an explicit "Begin →" click — no auto-dismiss.
   */
  sceneSetter: {
    headline: string;
    /** Label / value rows, rendered as a small metadata block. */
    metadata: { label: string; value: string }[];
    /** Italics line below the metadata, e.g. "After the conversation, you'll hear how it could have sounded." */
    supportingLine: string;
    /** Button label, per spec: "Begin →". */
    primaryAction: string;
  };
  turns: [DemoTurn, DemoTurn, DemoTurn];
  /**
   * Transition card shown after Turn 3 "Continue →" is clicked. User clicks
   * "Show me →" to advance into the improved replay.
   */
  transitionCard: {
    headline: string;
    supportingLine: string;
    primaryAction: string;
  };
  /**
   * Improved replay segments — played back-to-back with 2s pauses between.
   * E1 reuses the original employee-turn-1.mp3; the others are dedicated files.
   */
  improvedTurns: [
    DemoImprovedTurn,
    DemoImprovedTurn,
    DemoImprovedTurn,
    DemoImprovedTurn,
  ];
}

export const DEMO_SCRIPT: DemoScript = {
  scenarioName: "Layoff / Restructuring",
  personaName: "Alex — Defensive",
  sceneSetter: {
    headline: "You're about to watch a layoff conversation go wrong.",
    metadata: [
      { label: "Scenario", value: "Layoff / Restructuring" },
      { label: "Employee", value: "Alex — Defensive" },
      { label: "Turns", value: "3" },
    ],
    supportingLine:
      "After the conversation, you'll hear how it could have sounded.",
    primaryAction: "Begin →",
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
      narration:
        "Alex reacted with shock and defensiveness — that's typical. Notice how the six years came up immediately. The manager is about to respond. See if the approach lands.",
      emotionScore: 7,
    },
    {
      turnIndex: 2,
      speaker: "manager",
      transcript:
        "I understand this is a shock, and I want you to know this decision wasn't made lightly. Your role is being eliminated as part of a company-wide restructuring — it's not a reflection of your performance.",
      audioSrc: "/demo/manager-turn-2-original.mp3",
      coachingTip:
        "Good — you separated the structural reason from performance. Right framing legally and emotionally. But the six years went unacknowledged. That's the opening Alex will push on.",
      narration:
        "The manager stayed composed — but missed something. Alex mentioned six years twice. Not acknowledging it directly leaves a gap. Watch what happens next.",
      emotionScore: 5,
    },
    {
      turnIndex: 3,
      speaker: "employee",
      transcript:
        "Not a reflection of my performance? Then why me? There are people in my department who joined six months ago. Why isn't it their position being eliminated? This feels completely arbitrary.",
      audioSrc: "/demo/employee-turn-3.mp3",
      coachingTip:
        "Don't defend the selection criteria — that path leads to legal risk. Acknowledge the frustration, then redirect to next steps and support.",
      narration:
        "The conversation escalated — exactly because the six years wasn't acknowledged. The manager now has two bad options: defend the decision (legal risk) or go silent. This is the moment Exit Coach trains you for. See how it could have gone instead.",
      emotionScore: 8,
    },
  ],
  transitionCard: {
    headline: "Here's how that conversation could have gone.",
    supportingLine:
      "The same scenario. A better approach. Listen for the difference.",
    primaryAction: "Show me →",
  },
  improvedTurns: [
    {
      id: "e1",
      speaker: "employee",
      transcript:
        "Wait — what exactly are you saying? Are you telling me my position is being eliminated? I've been here for six years. Six years. And you're just... telling me this now?",
      audioSrc: "/demo/employee-turn-1.mp3",
    },
    {
      id: "m2",
      speaker: "manager",
      transcript:
        "Six years is significant, and I want to acknowledge that directly. This decision wasn't made lightly — your role is being eliminated because of a structural change in the organisation, not because of anything you did or didn't do. That distinction matters, and I want to make sure you hear it clearly.",
      audioSrc: "/demo/manager-turn-2-improved.mp3",
    },
    {
      id: "e3",
      speaker: "employee",
      transcript:
        "Not a reflection of my performance? Then why me? There are people in my department who joined six months ago. Why isn't it their position being eliminated? This feels completely arbitrary.",
      audioSrc: "/demo/employee-turn-3-replay.mp3",
    },
    {
      id: "m3",
      speaker: "manager",
      transcript:
        "I hear you — and that frustration makes complete sense. I can't walk you through every decision that was made, but what I can tell you is that this wasn't arbitrary. What I'd like to focus on now is making sure you have everything you need going forward — severance, references, timing. Can we do that together?",
      audioSrc: "/demo/manager-turn-3-improved.mp3",
    },
  ],
};

/** Convenience: array of emotion scores in turn order, used by the dormant emotion-arc chart. */
export const DEMO_EMOTION_ARC: number[] = DEMO_SCRIPT.turns.map(
  (t) => t.emotionScore,
);
