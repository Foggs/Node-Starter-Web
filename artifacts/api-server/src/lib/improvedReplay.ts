/**
 * Improved-Replay rewrite engine with structural variety.
 *
 * Background — the original implementation built one persona-agnostic system
 * prompt and reused it for all 5 turn rewrites. With identical context and
 * temperature 0.7, GPT-4o-mini consistently opened every rewrite with one of
 * a small set of empathy phrases ("I see that…", "I want to acknowledge…").
 * Across a 5-turn session the result felt templated and undermined the
 * product's promise of sounding like a better version of YOU.
 *
 * This module enforces variety deterministically — the LLM produces the body
 * of each rewrite, while a hardcoded `TURN_OPENERS[persona][turnIndex]`
 * matrix supplies the opening sentence. Banned-opener phrases are stripped
 * from LLM output. Turn 5 has its trailing "?" rewritten as "." so it always
 * closes with a forward-looking statement.
 *
 * ## Variety guarantees (independent of LLM output)
 *  - No two consecutive turns share the first 3 words (matrix is hand-checked).
 *  - Turn 1 is purpose-led — never opens with an empathy phrase.
 *  - Turn 5 never ends in a question mark.
 *  - The 4 banned-opener phrases never appear in the output.
 *  - Same transcript through different personas → different first 10 words on
 *    Turn 1 (and on every other turn — every cell of the matrix is unique).
 *
 * To update tone for a persona, edit a single column of `TURN_OPENERS`.
 * To add a new persona, add a row of 5 openers and extend `PERSONA_KEYS`.
 */

import { chatCompletion } from "./openai.js";
import { sanitizeTranscript } from "./sanitize.js";

// ─── persona registry ─────────────────────────────────────────────────────────

export const PERSONA_KEYS = [
  "tearful",
  "defensive",
  "withdrawn",
  "professional",
  "angry",
] as const;

export type PersonaKey = (typeof PERSONA_KEYS)[number];

const DEFAULT_PERSONA: PersonaKey = "professional";

function resolvePersona(personaId: string | undefined): PersonaKey {
  if (
    personaId !== undefined &&
    (PERSONA_KEYS as readonly string[]).includes(personaId)
  ) {
    return personaId as PersonaKey;
  }
  return DEFAULT_PERSONA;
}

// ─── turn × persona opener matrix ─────────────────────────────────────────────

export type TurnIndex = 1 | 2 | 3 | 4 | 5;

/**
 * Hand-authored openers. Constraints baked in by design:
 *  - Turn 1 row never opens with empathy ("I see / understand / can see").
 *  - Within each persona column, no two consecutive turns share the first
 *    3 words.
 *  - Across personas, the same turn index always has a distinct first 10
 *    words (different verb cadence + framing).
 *  - Turn 5 row always ends with a period and frames a concrete next step.
 */
export const TURN_OPENERS: Record<PersonaKey, Record<TurnIndex, string>> = {
  tearful: {
    1: "I want to be direct with you about why we are sitting down today.",
    2: "I hear how hard this lands for you, and I also need us to stay with what the targets show.",
    3: "This decision is final. Right now I want us to focus on what comes next for you.",
    4: "Here is what support from us is going to look like from this point on.",
    5: "Before we close, please walk out with these three concrete next steps in hand.",
  },
  defensive: {
    1: "Let me be clear with you about the purpose of this meeting.",
    2: "Your point is on the table, and we still need to be honest about what the data shows.",
    3: "The decision stands. I am not going to revisit the underlying call here.",
    4: "Now let's move to what we are putting in place from here.",
    5: "To close, I want you to walk out clear on the specifics that come next.",
  },
  withdrawn: {
    1: "I want to start by being plain about why we are talking today.",
    2: "Take a breath. What I want to add to what you have shared is this.",
    3: "The decision has been made. Let's spend the rest of our time on what is next for you.",
    4: "From here, the support we are putting around you looks like this.",
    5: "Before we wrap up, I want to give you something concrete to take with you.",
  },
  professional: {
    1: "Let me be straightforward about why I asked to meet today.",
    2: "Your point makes sense, and we still need to align on the facts of the situation.",
    3: "The decision is settled. I want to move us to what happens from here.",
    4: "On the path forward, the support we are committing to looks like this.",
    5: "To close out, here are the specific next steps you can expect from us.",
  },
  angry: {
    1: "I am going to be straightforward with you about why I called this meeting.",
    2: "Your frustration has landed with me, and we still need to be clear about the facts.",
    3: "The decision is final. I am not here to relitigate it — let us talk about next steps.",
    4: "Moving forward, the support we are putting in place from here is this.",
    5: "To wrap this up, you are going to walk out with the specifics in writing.",
  },
};

// ─── banned-opener enforcement ────────────────────────────────────────────────

/** Phrases the rewrite must never contain (anywhere). */
const BANNED_OPENERS: readonly string[] = [
  "i see that",
  "i can see that",
  "i understand that",
  "i want to acknowledge",
];

/**
 * Strips any banned-opener phrase from `body`, both as a leading prefix
 * and as embedded substrings. Case-insensitive.
 */
function stripBannedPhrases(body: string): string {
  let out = body.trim();
  // Repeatedly remove banned prefixes (handles "I see that I understand that…").
  let changed = true;
  while (changed) {
    changed = false;
    const lower = out.toLowerCase();
    for (const banned of BANNED_OPENERS) {
      if (lower.startsWith(banned)) {
        out = out.slice(banned.length).trimStart();
        changed = true;
      }
    }
  }
  // Remove any embedded occurrences (preserve surrounding spacing minimally).
  for (const banned of BANNED_OPENERS) {
    const escaped = banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escaped, "gi"), "").replace(/\s{2,}/g, " ");
  }
  return out.trim();
}

// ─── prompt builder ───────────────────────────────────────────────────────────

function buildVarietySystemPrompt(persona: PersonaKey): string {
  return [
    "You are an expert HR communication coach.",
    "Rewrite each manager statement so it sounds like a calmer, more skilled",
    "version of the same person speaking — preserve the core message and intent.",
    "",
    `The employee in front of you is a ${persona} listener. Match the register:`,
    "  tearful      → warmer tone, shorter sentences, slower pacing",
    "  defensive    → calm, firm, non-reactive, no hedging language",
    "  angry        → de-escalating, steady, no mirroring of hostility",
    "  withdrawn    → gentle, direct, fill silence with clarity",
    "  professional → peer-to-peer tone, efficient, respectful",
    "",
    "GLOBAL RULES (every turn):",
    "- Plain, warm, professional language. No jargon.",
    "- Length within ±20% of the original.",
    "- NEVER open the rewrite with any of these phrases:",
    '    "I see that…", "I can see that…", "I understand that…", "I want to acknowledge…"',
    "",
    "Respond ONLY with the rewritten body — no preamble, no commentary.",
    "An opening sentence will be prepended to your output by the system, so",
    "your rewrite should read naturally as the SECOND sentence of the response.",
  ].join("\n");
}

function buildVarietyUserPrompt(
  transcript: string,
  turnIndex: TurnIndex,
): string {
  const turnGuidance: Record<TurnIndex, string> = {
    1: "Lead with the purpose of the meeting. Be direct. Do not open with empathy or feelings.",
    2: "Acknowledge the employee's specific point first, then redirect to what you need them to hear.",
    3: "Hold the position with a calm, firm restatement. Do not relitigate the decision.",
    4: "Bridge from the difficulty to the path forward. Be concrete about support.",
    5: "Close with a forward-looking, concrete statement. DO NOT end with a question.",
  };
  return [
    `This is Turn ${turnIndex} of 5.`,
    `Turn ${turnIndex} guidance: ${turnGuidance[turnIndex]}`,
    "",
    `Manager said: "${transcript}"`,
    "",
    "Write the body of the rewrite (one short paragraph):",
  ].join("\n");
}

// ─── public API ───────────────────────────────────────────────────────────────

export interface RewriteSessionInput {
  scenario?: string;
  persona?: string;
  turns: ReadonlyArray<{
    turn_index: number;
    role: "manager" | "employee";
    transcript: string;
  }>;
}

export interface ImprovedRewrite {
  turn_index: number;
  original: string;
  improved: string;
}

function clampTurnIndex(turnIndex: number): TurnIndex {
  const rounded = Math.round(turnIndex);
  if (rounded < 1) return 1;
  if (rounded > 5) return 5;
  return rounded as TurnIndex;
}

/**
 * Rewrites every manager turn in `session` with the variety system applied.
 * Each result is `{ turn_index, original, improved }` — `improved` is
 * `<persona-and-turn-specific opener> <stripped LLM body>`.
 *
 * Failure modes:
 *  - Unknown persona            → falls back to "professional".
 *  - turn_index outside [1,5]   → clamped to the nearest valid bucket.
 *  - chatCompletion throws      → propagates to the caller (the route turns
 *                                 the rejection into HTTP 502 — silently
 *                                 echoing the original transcript would
 *                                 hide an outage from the user).
 */
export async function generateRewrites(
  session: RewriteSessionInput,
): Promise<ImprovedRewrite[]> {
  const persona = resolvePersona(session.persona);
  const systemPrompt = buildVarietySystemPrompt(persona);

  const managerTurns = session.turns
    .filter((t) => t.role === "manager")
    .slice()
    .sort((a, b) => a.turn_index - b.turn_index);

  const results: ImprovedRewrite[] = [];

  for (const turn of managerTurns) {
    const turnIdx = clampTurnIndex(turn.turn_index);
    const opener = TURN_OPENERS[persona][turnIdx];

    // chatCompletion errors propagate to the caller — POST /api/improved-replay
    // surfaces them as HTTP 502 so the user knows the LLM is unavailable
    // rather than receiving a degraded rewrite that silently echoes the
    // original transcript.
    const raw = await chatCompletion(
      [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: buildVarietyUserPrompt(turn.transcript, turnIdx),
        },
      ],
      { temperature: 0.7, max_tokens: 300 },
    );
    let body = stripBannedPhrases(sanitizeTranscript(raw.trim()));

    let improved = body.length > 0 ? `${opener} ${body}` : opener;

    // Turn 5: must close with a forward-looking statement, not a question.
    if (turnIdx === 5) {
      improved = improved.replace(/\?+\s*$/g, ".");
      if (!/[.!]\s*$/.test(improved)) improved = `${improved.trimEnd()}.`;
    }

    results.push({
      turn_index: turn.turn_index,
      original: turn.transcript,
      improved,
    });
  }

  return results;
}
