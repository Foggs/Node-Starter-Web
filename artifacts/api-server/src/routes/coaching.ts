import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import multer from "multer";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { llmRateLimit } from "../middlewares/rateLimits.js";
import { transcribeAudio, chatCompletion } from "../lib/openai.js";
import { sanitizeTranscript } from "../lib/sanitize.js";
import { synthesizeSpeech } from "../lib/elevenlabs.js";
import { scenarios } from "../data/scenarios.js";
import { personas } from "../data/personas.js";
import type { SessionData } from "express-session";

/** Generic ElevenLabs voice used as fallback when voice cloning failed. */
const GENERIC_VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam

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

// ─── improved-replay prompt builder ───────────────────────────────────────────

function buildRewriteSystemPrompt(
  scenario: (typeof scenarios)[number] | undefined,
  persona: (typeof personas)[number] | undefined,
): string {
  const scenarioBlock = scenario
    ? `Scenario: ${scenario.name} — ${scenario.description}`
    : "Scenario: a difficult HR conversation";

  const personaBlock = persona
    ? `Employee: ${persona.name} (${persona.emotionalStyle})`
    : "Employee: a distressed team member";

  return [
    "You are an expert HR communication coach.",
    "",
    scenarioBlock,
    personaBlock,
    "",
    "Your task: rewrite the manager's statement to make it more empathetic, clear, and psychologically safe.",
    "RULES:",
    "- Preserve the core message and intent — do NOT change what is being communicated.",
    "- Use plain, warm language. Avoid jargon.",
    "- Keep the length similar to the original (within ±20%).",
    "- Do NOT add preamble such as 'Here is a rewritten version…'.",
    "- Respond ONLY with the rewritten statement — no commentary.",
  ].join("\n");
}

function buildRewriteUserPrompt(transcript: string, turnIndex: number): string {
  return `Manager's turn ${turnIndex}:\n\n"${transcript}"\n\nRewrite:`;
}

// ─── POST /api/improved-replay ────────────────────────────────────────────────

router.post(
  "/improved-replay",
  llmRateLimit,
  sessionGuard,
  async (req, res) => {
    const allTurns = req.session.turns ?? [];
    const managerTurns = allTurns
      .filter((t) => t.role === "manager")
      .sort((a, b) => a.turn_index - b.turn_index);

    if (managerTurns.length === 0) {
      res.status(400).json({
        error: "No manager turns in session — complete at least one turn first",
      });
      return;
    }

    const scenario = scenarios.find((s) => s.id === req.session.scenario);
    const persona = personas.find((p) => p.id === req.session.persona);
    const voiceId = req.session.voice_id ?? GENERIC_VOICE_ID;

    const systemPrompt = buildRewriteSystemPrompt(scenario, persona);

    // Process each manager turn sequentially — yields progressive results
    const results: Array<{
      turnIndex: number;
      originalTranscript: string;
      improvedTranscript: string;
      audioUrl: string;
    }> = [];

    for (const turn of managerTurns) {
      const rawImproved = await chatCompletion(
        [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: buildRewriteUserPrompt(turn.transcript, turn.turn_index),
          },
        ],
        { temperature: 0.7, max_tokens: 300 },
      );

      const improvedTranscript = sanitizeTranscript(rawImproved.trim());

      // TTS audio synthesis — gracefully falls back to generic voice on error
      let audioBuffer: Buffer | undefined;
      try {
        audioBuffer = await synthesizeSpeech(voiceId, improvedTranscript);
      } catch {
        try {
          audioBuffer = await synthesizeSpeech(
            GENERIC_VOICE_ID,
            improvedTranscript,
          );
        } catch {
          // If both fail, continue without audio for this turn
          audioBuffer = undefined;
        }
      }

      // Assign a stable UUID to this turn so the audio can be retrieved
      const turnId = crypto.randomUUID();

      // Store audio as base64 string so it survives session serialization
      const audioBase64 = audioBuffer
        ? audioBuffer.toString("base64")
        : undefined;

      // Mutate the matching turn in session.turns in-place
      req.session.turns = req.session.turns!.map((t) =>
        t.role === "manager" && t.turn_index === turn.turn_index
          ? {
              ...t,
              turn_id: turnId,
              improved_transcript: improvedTranscript,
              audio_buffer: audioBase64,
            }
          : t,
      );

      results.push({
        turnIndex: turn.turn_index,
        originalTranscript: turn.transcript,
        improvedTranscript,
        audioUrl: `/api/audio/${turnId}`,
      });
    }

    res.status(200).json(results);
  },
);

// ─── feedback-summary prompt builders ─────────────────────────────────────────

function buildFeedbackSystemPrompt(): string {
  return [
    "You are an expert HR coaching consultant reviewing a manager's practice session.",
    "You will receive the full conversation transcript with per-turn coaching observations.",
    "",
    "Your task is to synthesize the session into structured, actionable feedback:",
    "1. Strengths: 2–4 specific things the manager did well across the entire session.",
    "2. Improvements: 2–4 specific, actionable areas to develop. Be concrete — name the turn and behaviour.",
    "3. Summary: A 2–3 sentence overall qualitative assessment. Lead with the most important takeaway.",
    "",
    'Respond ONLY with valid JSON in this exact format (no markdown, no other text):\n{"strengths":["..."],"improvements":["..."],"summary":"..."}',
  ].join("\n");
}

function buildFeedbackUserPrompt(
  scenario: (typeof scenarios)[number] | undefined,
  persona: (typeof personas)[number] | undefined,
  turns: Turn[],
): string {
  const header = [
    `Session scenario: ${scenario?.name ?? "general HR conversation"}`,
    `Employee persona: ${persona?.name ?? "general employee"} (${persona?.emotionalStyle ?? ""})`,
    "",
    "Conversation transcript:",
    "",
  ].join("\n");

  // Sort all turns by turn_index, then employee before manager within the same index
  const sorted = [...turns].sort((a, b) => {
    if (a.turn_index !== b.turn_index) return a.turn_index - b.turn_index;
    return a.role === "employee" ? -1 : 1;
  });

  const turnLines: string[] = [];
  for (const t of sorted) {
    if (t.role === "employee") {
      turnLines.push(`Employee (turn ${t.turn_index}): "${t.transcript}"`);
    } else {
      turnLines.push(`Manager (turn ${t.turn_index}): "${t.transcript}"`);
      if (t.coaching_tip) {
        turnLines.push(
          `  → Coaching note: "${t.coaching_tip}" (employee emotional intensity: ${t.emotion_score ?? "?"}/10)`,
        );
      }
    }
  }

  return [header, ...turnLines, "", "Provide structured feedback for the manager based on the session above."].join(
    "\n",
  );
}

function parseFeedbackResponse(raw: string): {
  strengths: string[];
  improvements: string[];
  summary: string;
} {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found");

    const parsed: unknown = JSON.parse(match[0]);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "strengths" in parsed &&
      "improvements" in parsed &&
      "summary" in parsed &&
      Array.isArray((parsed as Record<string, unknown>)["strengths"]) &&
      Array.isArray((parsed as Record<string, unknown>)["improvements"]) &&
      typeof (parsed as Record<string, unknown>)["summary"] === "string"
    ) {
      const { strengths, improvements, summary } = parsed as {
        strengths: unknown[];
        improvements: unknown[];
        summary: string;
      };
      return {
        strengths: strengths
          .filter((s) => typeof s === "string")
          .map((s) => String(s)),
        improvements: improvements
          .filter((s) => typeof s === "string")
          .map((s) => String(s)),
        summary,
      };
    }
    throw new Error("Unexpected shape");
  } catch {
    return {
      strengths: ["You completed the practice session — that alone takes courage."],
      improvements: ["Review the per-turn coaching tips above for specific areas to develop."],
      summary:
        raw.trim() ||
        "Session complete. Review your per-turn coaching tips and try another run to track improvement.",
    };
  }
}

// ─── POST /api/feedback-summary ──────────────────────────────────────────────

router.post("/feedback-summary", llmRateLimit, sessionGuard, async (req, res) => {
  const turns = req.session.turns ?? [];
  const managerTurns = turns.filter((t) => t.role === "manager");

  if (managerTurns.length === 0) {
    res.status(400).json({
      error: "No manager turns in session — complete at least one turn before requesting feedback",
    });
    return;
  }

  const scenario = scenarios.find((s) => s.id === req.session.scenario);
  const persona = personas.find((p) => p.id === req.session.persona);

  const rawResponse = await chatCompletion(
    [
      { role: "system", content: buildFeedbackSystemPrompt() },
      { role: "user", content: buildFeedbackUserPrompt(scenario, persona, turns) },
    ],
    { temperature: 0.6, max_tokens: 600 },
  );

  const { strengths, improvements, summary } = parseFeedbackResponse(rawResponse);

  // Emotion arc: emotion_score per manager turn in order (1-indexed)
  const emotionArc = managerTurns
    .sort((a, b) => a.turn_index - b.turn_index)
    .map((t) => t.emotion_score ?? 5);

  // Cache feedback in session so export-report can access it without re-generating
  req.session.feedback = { strengths, improvements, summary, emotionArc };

  res.status(200).json({ strengths, improvements, summary, emotionArc });
});

export default router;
