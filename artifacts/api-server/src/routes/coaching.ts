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

// ─── coaching-tip prompt builders ─────────────────────────────────────────────

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

// ─── coaching-tip response parser ─────────────────────────────────────────────

function parseCoachingResponse(raw: string): {
  coachingTip: string;
  emotionScore: number;
} {
  try {
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
      const score = Math.min(10, Math.max(1, Math.round(rawScore)));
      return { coachingTip: tip, emotionScore: score };
    }

    throw new Error("Unexpected response shape");
  } catch {
    return {
      coachingTip:
        raw.trim() || "Keep going — every practice rep builds your confidence.",
      emotionScore: 5,
    };
  }
}

// ─── employee-turn prompt builders ────────────────────────────────────────────

function buildEmployeeSystemPrompt(
  scenario: (typeof scenarios)[number] | undefined,
  persona: (typeof personas)[number] | undefined,
): string {
  const scenarioDesc = scenario
    ? `${scenario.name}: ${scenario.description}`
    : "A difficult workplace conversation";

  const personaBlock = persona
    ? [
        `You are ${persona.name}.`,
        `Emotional style: ${persona.emotionalStyle}`,
        persona.description,
      ].join("\n")
    : "You are an employee receiving difficult news from your manager.";

  return [
    personaBlock,
    "",
    `Situation: ${scenarioDesc}`,
    "",
    "RULES:",
    "- Stay completely in character. You ARE this person.",
    "- Keep responses SHORT — 1 to 3 sentences maximum.",
    "- React authentically to whatever the manager says.",
    "- Do NOT coach the manager, give advice, or break character.",
    "- Do NOT acknowledge you are an AI or a simulation.",
    "- Let your emotional state evolve naturally across the conversation.",
  ].join("\n");
}

function buildEmployeeUserPrompt(turns: Turn[], turnIndex: number): string {
  if (turnIndex === 1) {
    return "Your manager has just called you into an unexpected meeting. The conversation is beginning. React naturally as your character.";
  }

  const managerTurns = turns
    .filter((t) => t.role === "manager")
    .sort((a, b) => a.turn_index - b.turn_index);

  const lastManagerTurn = managerTurns[managerTurns.length - 1];
  const priorTurns = managerTurns.slice(0, -1);

  const parts: string[] = [];

  if (priorTurns.length > 0) {
    parts.push("Conversation so far:");
    priorTurns.forEach((t, i) => {
      parts.push(`Manager turn ${i + 1}: "${t.transcript}"`);
    });
    parts.push("");
  }

  parts.push(`Manager just said: "${lastManagerTurn?.transcript ?? ""}"`);
  parts.push("");
  parts.push("Respond as your character in 1–3 sentences.");

  return parts.join("\n");
}

// ─── POST /api/coaching-tip ───────────────────────────────────────────────────

router.post(
  "/coaching-tip",
  llmRateLimit,
  sessionGuard,
  upload.single("audio"),
  async (req, res) => {
    if (!req.session.scenario || !req.session.persona) {
      res.status(400).json({
        error:
          "Session not configured — complete scenario and persona selection before starting",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    if (!req.file.mimetype.startsWith("audio/")) {
      res.status(400).json({
        error: "Invalid file type — audio files only (audio/*)",
      });
      return;
    }

    const turnIndex = parseInt(String(req.body?.turnIndex ?? ""), 10);
    if (isNaN(turnIndex) || turnIndex < 1 || turnIndex > 5) {
      res.status(400).json({
        error: "turnIndex must be an integer between 1 and 5",
      });
      return;
    }

    const rawTranscript = await transcribeAudio(
      req.file.buffer,
      req.file.mimetype,
    );

    const transcript = sanitizeTranscript(rawTranscript);

    const scenario = scenarios.find((s) => s.id === req.session.scenario);
    const persona = personas.find((p) => p.id === req.session.persona);

    const rawResponse = await chatCompletion(
      [
        { role: "system", content: buildSystemPrompt(scenario, persona) },
        { role: "user", content: buildUserPrompt(transcript, turnIndex) },
      ],
      { temperature: 0.7, max_tokens: 400 },
    );

    const { coachingTip, emotionScore } = parseCoachingResponse(rawResponse);

    const turn: Turn = {
      turn_index: turnIndex,
      role: "manager",
      transcript,
      coaching_tip: coachingTip,
      emotion_score: emotionScore,
    };
    req.session.turns = [...(req.session.turns ?? []), turn];

    res.status(200).json({ transcript, coachingTip, emotionScore });
  },
);

// ─── POST /api/employee-turn ──────────────────────────────────────────────────

router.post("/employee-turn", llmRateLimit, sessionGuard, async (req, res) => {
  if (!req.session.scenario || !req.session.persona) {
    res.status(400).json({
      error:
        "Session not configured — complete scenario and persona selection before starting",
    });
    return;
  }

  const turns = req.session.turns ?? [];
  const managerTurnCount = turns.filter((t) => t.role === "manager").length;

  if (managerTurnCount >= 5) {
    res.status(400).json({
      error: "Session is complete — no more employee turns",
    });
    return;
  }

  const turnIndex = managerTurnCount + 1;

  const scenario = scenarios.find((s) => s.id === req.session.scenario);
  const persona = personas.find((p) => p.id === req.session.persona);

  const rawResponse = await chatCompletion(
    [
      {
        role: "system",
        content: buildEmployeeSystemPrompt(scenario, persona),
      },
      {
        role: "user",
        content: buildEmployeeUserPrompt(turns, turnIndex),
      },
    ],
    { temperature: 0.85, max_tokens: 150 },
  );

  const transcript = rawResponse.trim();

  const turn: Turn = {
    turn_index: turnIndex,
    role: "employee",
    transcript,
  };
  req.session.turns = [...turns, turn];

  res.status(200).json({ transcript, turnIndex });
});

// ─── POST /api/improved-replay ────────────────────────────────────────────────

router.post("/improved-replay", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #6 Step 6.7" });
});

// ─── POST /api/feedback-summary ──────────────────────────────────────────────

router.post("/feedback-summary", sessionGuard, (_req, res) => {
  res.status(501).json({ error: "Not implemented — coming in Task #6 Step 6.5" });
});

export default router;
