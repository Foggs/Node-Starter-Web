import PDFDocument from "pdfkit";
import { Router, type IRouter } from "express";
import { sessionGuard } from "../middlewares/sessionGuard.js";
import { scenarios } from "../data/scenarios.js";
import { personas } from "../data/personas.js";

const router: IRouter = Router();

// ─── colour palette ───────────────────────────────────────────────────────────

const AMBER = "#d97706";
const SLATE_900 = "#0f172a";
const SLATE_600 = "#475569";
const SLATE_300 = "#cbd5e1";
const EMERALD_700 = "#047857";
const RED_600 = "#dc2626";

// ─── helpers ──────────────────────────────────────────────────────────────────

function emotionLabel(score: number): string {
  if (score <= 3) return "Calm";
  if (score <= 6) return "Unsettled";
  return "Distressed";
}

function emotionColor(score: number): string {
  if (score <= 3) return EMERALD_700;
  if (score <= 6) return AMBER;
  return RED_600;
}

// ─── POST /api/export-report ──────────────────────────────────────────────────

router.post("/export-report", sessionGuard, (req, res) => {
  const scenario = scenarios.find((s) => s.id === req.session.scenario);
  const persona = personas.find((p) => p.id === req.session.persona);
  const turns = req.session.turns ?? [];
  const feedback = req.session.feedback;

  const managerTurns = turns
    .filter((t) => t.role === "manager")
    .sort((a, b) => a.turn_index - b.turn_index);

  const emotionArc =
    feedback?.emotionArc ??
    managerTurns.map((t) => t.emotion_score ?? 5);

  const strengths = feedback?.strengths ?? [];
  const improvements = feedback?.improvements ?? [];

  // ── stream PDF to client ─────────────────────────────────────────────────
  const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: true });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="exit-coach-report-${Date.now()}.pdf"`,
  );

  doc.pipe(res);

  // ── header ───────────────────────────────────────────────────────────────
  doc
    .fontSize(22)
    .fillColor(SLATE_900)
    .font("Helvetica-Bold")
    .text("Exit Coach", { continued: true })
    .fillColor(AMBER)
    .text(" — Coaching Report");

  doc
    .moveDown(0.3)
    .fontSize(10)
    .fillColor(SLATE_600)
    .font("Helvetica")
    .text(`Generated: ${new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}`);

  doc
    .moveDown(0.5)
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor(SLATE_300)
    .lineWidth(1)
    .stroke()
    .moveDown(0.8);

  // ── session summary ───────────────────────────────────────────────────────
  doc
    .fontSize(13)
    .fillColor(SLATE_900)
    .font("Helvetica-Bold")
    .text("Session Summary");

  doc.moveDown(0.4);

  const summaryRows: Array<[string, string]> = [
    ["Scenario", scenario?.name ?? "Unknown"],
    ["Employee profile", persona?.emotionalStyle ?? "Unknown"],
    ["Turns completed", String(managerTurns.length)],
    ["Voice cloning", req.session.voice_cloned ? "Enabled" : "Disabled"],
  ];

  for (const [label, value] of summaryRows) {
    doc
      .fontSize(10)
      .fillColor(SLATE_600)
      .font("Helvetica-Bold")
      .text(`${label}:  `, { continued: true })
      .font("Helvetica")
      .fillColor(SLATE_900)
      .text(value);
  }

  doc
    .moveDown(0.8)
    .moveTo(50, doc.y)
    .lineTo(doc.page.width - 50, doc.y)
    .strokeColor(SLATE_300)
    .lineWidth(1)
    .stroke()
    .moveDown(0.8);

  // ── emotion arc ───────────────────────────────────────────────────────────
  if (emotionArc.length > 0) {
    doc
      .fontSize(13)
      .fillColor(SLATE_900)
      .font("Helvetica-Bold")
      .text("Emotion Arc");

    doc.moveDown(0.4);

    emotionArc.forEach((score, i) => {
      const barWidth = (score / 10) * 260;
      const y = doc.y;

      doc
        .fontSize(9)
        .fillColor(SLATE_600)
        .font("Helvetica")
        .text(`Turn ${i + 1}`, 50, y, { width: 45 });

      doc
        .rect(100, y + 1, barWidth, 10)
        .fillColor(emotionColor(score))
        .fill();

      doc
        .fillColor(SLATE_600)
        .text(`${score}/10  ${emotionLabel(score)}`, 370, y, { width: 180 });

      doc.moveDown(0.8);
    });

    doc
      .moveDown(0.4)
      .moveTo(50, doc.y)
      .lineTo(doc.page.width - 50, doc.y)
      .strokeColor(SLATE_300)
      .lineWidth(1)
      .stroke()
      .moveDown(0.8);
  }

  // ── strengths ─────────────────────────────────────────────────────────────
  if (strengths.length > 0) {
    doc
      .fontSize(13)
      .fillColor(SLATE_900)
      .font("Helvetica-Bold")
      .text("Strengths");

    doc.moveDown(0.4);

    for (const s of strengths) {
      doc
        .fontSize(10)
        .fillColor(EMERALD_700)
        .font("Helvetica-Bold")
        .text("✓  ", { continued: true })
        .fillColor(SLATE_900)
        .font("Helvetica")
        .text(s, { indent: 0 });
      doc.moveDown(0.3);
    }

    doc.moveDown(0.5);
  }

  // ── improvements ─────────────────────────────────────────────────────────
  if (improvements.length > 0) {
    doc
      .fontSize(13)
      .fillColor(SLATE_900)
      .font("Helvetica-Bold")
      .text("Areas for Improvement");

    doc.moveDown(0.4);

    for (const imp of improvements) {
      doc
        .fontSize(10)
        .fillColor(AMBER)
        .font("Helvetica-Bold")
        .text("→  ", { continued: true })
        .fillColor(SLATE_900)
        .font("Helvetica")
        .text(imp, { indent: 0 });
      doc.moveDown(0.3);
    }

    doc.moveDown(0.5);
  }

  // ── footer ────────────────────────────────────────────────────────────────
  const footerY = doc.page.height - 60;
  doc
    .fontSize(8)
    .fillColor(SLATE_600)
    .font("Helvetica")
    .text(
      "This report contains no personally identifiable information. Generated by Exit Coach for practice purposes only.",
      50,
      footerY,
      { width: doc.page.width - 100, align: "center" },
    );

  doc.end();
});

export default router;
