import { Router, type IRouter } from "express";
import multer from "multer";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { llmRateLimit } from "../middlewares/rateLimits.js";
import { transcribeAudio, chatCompletion } from "../lib/openai.js";
import { sanitizeTranscript } from "../lib/sanitize.js";
import { scenarios } from "../data/scenarios.js";
import { personas } from "../data/personas.js";
import type { SessionData } from "express-session";

type Turn = SessionData["turns"][number];

const router: IRouter = Router();

/**
 * multer with in-memory storage — audio is NEVER written to disk.
 * 10 MB is sufficient for a single 60 s turn at typical webm quality.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(
  scenario: (typeof scenarios)[number] | undefined,
  persona: (typeof personas)[number] | undefined,
): string {
  const scenarioBlock = scenario
    ? `Scenario: ${scenario.name}\n${scenario.description}`
    : "Scenario: general HR conversation";

  const personaBlock = persona
    ? `Employee persona: ${persona.name} — ${persona.emotionalStyle}\n${persona.description}`
    : "Employee persona: general employee";

  return [
    "You are an expert HR coaching assistant helping a manager practice a high-stakes conversation.",
    "",
    scenarioBlock,
    "",
    personaBlock,
    "",
    "After each manager turn, you will:",
    "1. Provide a concise coaching tip (2–3 sentences): lead with something specific the manager did well, then give ONE actionable improvement.",
    "2. Rate the employee's emotional intensity after this manager turn on a scale of 1–10, where 1 = calm/composed and 10 = extremely distressed or volatile.",
    "",
    'Respond ONLY with valid JSON in this exact format (no markdown, no other text):\n{"coachingTip": "...", "emotionScore": 5}',
  ].join("\n");
}

function buildUserPrompt(transcript: string, turnIndex: number): string {
  return `Manager's turn ${turnIndex} of 5:\n\n"${transcript}"`;
}

// ─── response parser ──────────────────────────────────────────────────────────

function parseCoachingResponse(raw: string): {
  coachingTip: string;
  emotionScore: number;
} {
  try {
    // Extract the first JSON object from the response (handles extra text / markdown)
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("No JSON object found");

    const parsed: unknown = JSON.parse(match[0]);

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "coachingTip" in parsed &&
      "emotionScore" in parsed &&
      typeof (parsed as Record<string, unknown>)["coachingTip"] === "string" &&
      typeof (parsed as Record<string, unknown>)["emotionScore"] === "number"
    ) {
      const tip = (parsed as { coachingTip: string }).coachingTip;
      const rawScore = (parsed as { emotionScore: number }).emotionScore;
      // Clamp to valid range and round to integer
      const score = Math.min(10, Math.max(1, Math.round(rawScore)));
      return { coachingTip: tip, emotionScore: score };
    }

    throw new Error("Unexpected response shape");
  } catch {
    // Graceful fallback — session continues even if LLM returns malformed output
    return {
      coachingTip:
        raw.trim() || "Keep going — every practice rep builds your confidence.",
      emotionScore: 5,
    };
  }
}

// ─── POST /api/coaching-tip ───────────────────────────────────────────────────

router.post(
  "/coaching-tip",
  llmRateLimit,
  sessionGuard,
  upload.single("audio"),
  async (req, res) => {
    // 1. Session must have scenario + persona (setup flow must be complete)
    if (!req.session.scenario || !req.session.persona) {
      res.status(400).json({
        error:
          "Session not configured — complete scenario and persona selection before starting",
      });
      return;
    }

    // 2. Audio file must be present
    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    // 3. MIME type must be audio/*
    if (!req.file.mimetype.startsWith("audio/")) {
      res.status(400).json({
        error: "Invalid file type — audio files only (audio/*)",
      });
      return;
    }

    // 4. turnIndex must be an integer 1–5
    const turnIndex = parseInt(String(req.body?.turnIndex ?? ""), 10);
    if (isNaN(turnIndex) || turnIndex < 1 || turnIndex > 5) {
      res.status(400).json({
        error: "turnIndex must be an integer between 1 and 5",
      });
      return;
    }

    // 5. Transcribe manager audio with Whisper
    const rawTranscript = await transcribeAudio(
      req.file.buffer,
      req.file.mimetype,
    );

    // 6. Sanitize before LLM submission (strips prompt-injection patterns)
    const transcript = sanitizeTranscript(rawTranscript);

    // 7. Look up scenario + persona details for the system prompt
    const scenario = scenarios.find((s) => s.id === req.session.scenario);
    const persona = personas.find((p) => p.id === req.session.persona);

    // 8. Call GPT-4o-mini for coaching tip + emotion score
    const rawResponse = await chatCompletion(
      [
        { role: "system", content: buildSystemPrompt(scenario, persona) },
        { role: "user", content: buildUserPrompt(transcript, turnIndex) },
      ],
      { temperature: 0.7, max_tokens: 400 },
    );

    // 9. Parse the JSON response (with fallback)
    const { coachingTip, emotionScore } = parseCoachingResponse(rawResponse);

    // 10. Append manager turn to session (single source of truth)
    const turn: Turn = {
      turn_index: turnIndex,
      role: "manager",
      transcript,
      coaching_tip: coachingTip,
      emotion_score: emotionScore,
    };
    req.session.turns = [...(req.session.turns ?? []), turn];

    // 11. Return coaching feedback
    res.status(200).json({ transcript, coachingTip, emotionScore });
  },
);

// ─── POST /api/improved-replay ────────────────────────────────────────────────

router.post("/improved-replay", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #6 Step 6.7" });
});

// ─── POST /api/feedback-summary ──────────────────────────────────────────────

router.post("/feedback-summary", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #6 Step 6.5" });
});

export default router;
