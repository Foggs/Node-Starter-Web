import { useState, useId } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Badge } from "@/components/ui/badge";

// ─── colour bands ────────────────────────────────────────────────────────────

export function emotionColor(score: number): string {
  if (score <= 3) return "#10b981";
  if (score <= 6) return "#f59e0b";
  return "#ef4444";
}

export function emotionLabel(score: number): string {
  if (score <= 3) return "calm";
  if (score <= 6) return "unsettled";
  return "distressed";
}

// ─── chart ───────────────────────────────────────────────────────────────────

export function EmotionArcChart({ emotionArc }: { emotionArc: number[] }) {
  const data = emotionArc.map((score, i) => ({ turn: `T${i + 1}`, score }));
  const avg = Math.round(
    emotionArc.reduce((a, b) => a + b, 0) / emotionArc.length,
  );
  const peak = Math.max(...emotionArc);
  const low = Math.min(...emotionArc);
  const first = emotionArc[0];
  const last = emotionArc[emotionArc.length - 1];
  const trend =
    last < first - 1
      ? "decreased"
      : last > first + 1
        ? "increased"
        : "stayed roughly steady";

  // Y6 — peak annotation. First-occurrence tie-break via indexOf. We always
  // know which turn the peak landed on (used for the SR summary), but the
  // visible marker is only rendered when there are 2+ turns AND the peak
  // crossed out of the calm band — a single-turn session has nothing to
  // compare against, and a calm-band peak doesn't need to be visually
  // distinguished from the regular line dots.
  const peakIndexAbsolute = emotionArc.length > 0 ? emotionArc.indexOf(peak) : -1;
  const peakIndex = emotionArc.length > 1 ? peakIndexAbsolute : -1;
  const peakBand: "calm" | "unsettled" | "distressed" =
    peak > 7 ? "distressed" : peak >= 4 ? "unsettled" : "calm";
  const showPeakMarker = peakIndex >= 0 && peakBand !== "calm";
  const peakColor = peakBand === "distressed" ? "#ef4444" : "#f59e0b";
  const peakTurnNumber = peakIndex + 1;
  const peakTooltipText = showPeakMarker
    ? `Your tone at turn ${peakTurnNumber} escalated the conversation — see coaching tip below.`
    : null;

  // SR summary always names the peak turn whenever there is at least one
  // turn — even for calm-band or single-turn sessions, where the visible
  // marker is intentionally suppressed.
  const peakSummary =
    peakIndexAbsolute >= 0
      ? ` Peak ${peak} occurred at turn ${peakIndexAbsolute + 1}.`
      : "";

  // Focus-driven tooltip: when a keyboard user tabs onto the peak marker we
  // surface the Y6 guidance text in a visible inline panel above the chart so
  // they get the same insight as a mouse-hover user (the SVG <title> only
  // renders on hover in browsers). Hidden again on blur.
  const [peakFocused, setPeakFocused] = useState(false);
  const peakFocusPanelId = useId();

  const turnSummary = emotionArc
    .map(
      (s, i) =>
        `Turn ${i + 1}: ${s} out of 10 (${emotionLabel(s)})`,
    )
    .join("; ");

  const summary = `Employee emotional intensity across ${emotionArc.length} turn${emotionArc.length !== 1 ? "s" : ""}. Average ${avg} out of 10. Peak ${peak}, low ${low}.${peakSummary} Intensity ${trend} from start to end. ${turnSummary}.`;

  return (
    <div
      role="img"
      aria-label={`Emotion arc chart. ${summary}`}
    >
      <p className="sr-only">{summary}</p>
      {peakTooltipText && (
        <div
          id={peakFocusPanelId}
          role="status"
          aria-live="polite"
          data-testid="peak-focus-panel"
          className={`mb-2 rounded-md border px-3 py-2 text-xs leading-relaxed transition-opacity ${
            peakBand === "distressed"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          } ${peakFocused ? "opacity-100" : "opacity-0 pointer-events-none h-0 m-0 p-0 border-0 overflow-hidden"}`}
        >
          {peakFocused ? peakTooltipText : ""}
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-slate-500">
          Employee emotional intensity across your turns
        </p>
        <Badge
          variant="secondary"
          className={`text-xs ${
            avg <= 3
              ? "bg-emerald-100 text-emerald-700"
              : avg <= 6
                ? "bg-amber-100 text-amber-700"
                : "bg-red-100 text-red-700"
          }`}
        >
          Avg {avg}/10
        </Badge>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="turn"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[1, 10]}
            ticks={[1, 3, 5, 7, 10]}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const score = Number(payload[0]?.value ?? 0);
              const turnNum = Number(String(label ?? "").replace(/^T/, ""));
              const isPeak =
                showPeakMarker && Number.isFinite(turnNum) && turnNum - 1 === peakIndex;
              return (
                <div
                  style={{
                    background: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    fontSize: 12,
                    padding: "6px 10px",
                    maxWidth: 220,
                  }}
                >
                  <div className="text-slate-700">{score}/10 Intensity</div>
                  {isPeak && peakTooltipText && (
                    <div
                      className="text-xs mt-1 text-red-700"
                      data-testid="peak-tooltip-text"
                    >
                      {peakTooltipText}
                    </div>
                  )}
                </div>
              );
            }}
          />
          <ReferenceLine y={5} stroke="#e2e8f0" strokeDasharray="4 2" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#f59e0b"
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={(props) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: { turn: string; score: number };
              };
              const turnNum = Number(payload.turn.replace(/^T/, ""));
              const isPeak = showPeakMarker && turnNum - 1 === peakIndex;
              if (isPeak) {
                return (
                  <g
                    key={payload.turn}
                    tabIndex={0}
                    role="img"
                    aria-label={peakTooltipText ?? undefined}
                    aria-describedby={peakFocusPanelId}
                    data-testid="peak-marker"
                    style={{ outline: "none" }}
                    onFocus={() => setPeakFocused(true)}
                    onBlur={() => setPeakFocused(false)}
                    onMouseEnter={() => setPeakFocused(true)}
                    onMouseLeave={() => setPeakFocused(false)}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={11}
                      fill={peakColor}
                      fillOpacity={0.35}
                    >
                      <animate
                        attributeName="r"
                        values="9;15;9"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="fill-opacity"
                        values="0.45;0;0.45"
                        dur="1.6s"
                        repeatCount="indefinite"
                      />
                    </circle>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={8}
                      fill={peakColor}
                      stroke="white"
                      strokeWidth={2.5}
                    >
                      <title>{peakTooltipText}</title>
                    </circle>
                  </g>
                );
              }
              return (
                <circle
                  key={payload.turn}
                  cx={cx}
                  cy={cy}
                  r={5}
                  fill={emotionColor(payload.score)}
                  stroke="white"
                  strokeWidth={2}
                />
              );
            }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: "white" }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
          1–3 Calm
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
          4–6 Unsettled
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
          7–10 Distressed
        </span>
      </div>
    </div>
  );
}
