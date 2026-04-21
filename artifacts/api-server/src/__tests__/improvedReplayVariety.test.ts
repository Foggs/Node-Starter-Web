// ─── PROVE-IT BASELINE — failing-test output (run BEFORE implementation) ─────
// Captured: 2026-04-21
//
//   FAIL  src/__tests__/improvedReplayVariety.test.ts
//     improvedReplay rewrite variety
//       × FAILS: all 5 turns currently open with the same sentence structure
//       × Test 2: no two consecutive turns open with the same first 3 words
//       × Test 3: turn 1 does not open with an empathy phrase
//       × Test 4: turn 5 does not end with a question mark
//       × Test 5: tearful and angry personas produce different turn-1 openings
//       × Test 6: no rewrite contains a banned opener phrase
//
// Cause confirmed: with the pre-refactor prompt, every turn's rewrite is
// produced by the same (turn-agnostic) system+user prompt, so when the LLM
// (or this test's mock) returns "I see that you're feeling overwhelmed…",
// all five rewrites are byte-identical and trip every variety assertion.
// ─────────────────────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the OpenAI client so every chatCompletion call returns the same
// banned-opener phrase. This simulates the current homogeneous LLM behavior
// the variety system is intended to fix.
vi.mock("../lib/openai.js", () => ({
  chatCompletion: vi
    .fn()
    .mockResolvedValue("I see that you're feeling overwhelmed by this conversation."),
  transcribeAudio: vi.fn(),
  _resetClientForTest: vi.fn(),
}));

import { generateRewrites } from "../lib/improvedReplay.js";

const mockSession = {
  scenario: "performance_issue",
  persona: "tearful",
  turns: [
    {
      turn_index: 1,
      role: "manager" as const,
      transcript:
        "Hi, I want to talk to you about your performance over the last quarter.",
    },
    {
      turn_index: 2,
      role: "manager" as const,
      transcript:
        "I understand this is hard, but the targets were clearly missed.",
    },
    {
      turn_index: 3,
      role: "manager" as const,
      transcript:
        "We do need to make a decision here about next steps.",
    },
    {
      turn_index: 4,
      role: "manager" as const,
      transcript:
        "We will support you through whatever comes next.",
    },
    {
      turn_index: 5,
      role: "manager" as const,
      transcript:
        "I hope you feel we have handled this with respect.",
    },
  ],
};

const BANNED_OPENERS = [
  "I see that",
  "I can see that",
  "I understand that",
  "I want to acknowledge",
];

function firstNWords(s: string, n: number): string {
  return s.split(/\s+/).slice(0, n).join(" ").toLowerCase();
}

describe("improvedReplay rewrite variety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // PROVE-IT BASELINE — must FAIL before implementation
  it("FAILS: all 5 turns currently open with the same sentence structure", async () => {
    const rewrites = await generateRewrites(mockSession);
    const openingPhrases = rewrites.map((t) => firstNWords(t.improved, 4));
    const uniqueOpenings = new Set(openingPhrases);
    // SHOULD fail today — proves the problem exists
    expect(uniqueOpenings.size).toBeGreaterThan(2);
  });

  it("Test 2: no two consecutive turns open with the same first 3 words", async () => {
    const rewrites = await generateRewrites(mockSession);
    const ordered = [...rewrites].sort((a, b) => a.turn_index - b.turn_index);
    for (let i = 1; i < ordered.length; i++) {
      const prev = firstNWords(ordered[i - 1]!.improved, 3);
      const curr = firstNWords(ordered[i]!.improved, 3);
      expect(
        curr,
        `Turn ${ordered[i]!.turn_index} opener "${curr}" duplicates Turn ${ordered[i - 1]!.turn_index}`,
      ).not.toBe(prev);
    }
  });

  it("Test 3: turn 1 does not open with an empathy phrase", async () => {
    const rewrites = await generateRewrites(mockSession);
    const turn1 = rewrites.find((t) => t.turn_index === 1);
    expect(turn1).toBeDefined();
    const opening = turn1!.improved.toLowerCase().trim();
    const empathyPrefixes = [
      "i see",
      "i understand",
      "i can see",
      "i want to acknowledge",
      "i know this",
    ];
    for (const prefix of empathyPrefixes) {
      expect(
        opening.startsWith(prefix),
        `Turn 1 must not open with "${prefix}…" — got "${opening.slice(0, 50)}"`,
      ).toBe(false);
    }
  });

  it("Test 4: turn 5 does not end with a question mark", async () => {
    const rewrites = await generateRewrites(mockSession);
    const turn5 = rewrites.find((t) => t.turn_index === 5);
    expect(turn5).toBeDefined();
    expect(turn5!.improved.trim().endsWith("?")).toBe(false);
  });

  it("Test 5: tearful and angry personas produce different turn-1 openings", async () => {
    const tearfulRewrites = await generateRewrites({
      ...mockSession,
      persona: "tearful",
    });
    const angryRewrites = await generateRewrites({
      ...mockSession,
      persona: "angry",
    });
    const tearfulT1 = firstNWords(
      tearfulRewrites.find((t) => t.turn_index === 1)!.improved,
      10,
    );
    const angryT1 = firstNWords(
      angryRewrites.find((t) => t.turn_index === 1)!.improved,
      10,
    );
    expect(tearfulT1).not.toBe(angryT1);
  });

  it("Test 6: no rewrite contains a banned opener phrase", async () => {
    const rewrites = await generateRewrites(mockSession);
    for (const turn of rewrites) {
      const lower = turn.improved.toLowerCase();
      for (const banned of BANNED_OPENERS) {
        expect(
          lower.includes(banned.toLowerCase()),
          `Turn ${turn.turn_index} contains banned opener "${banned}": "${turn.improved}"`,
        ).toBe(false);
      }
    }
  });
});
