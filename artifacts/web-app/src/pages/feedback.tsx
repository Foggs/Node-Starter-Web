import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ApiError } from "@workspace/api-client-react";
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
import {
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Lightbulb,
  RefreshCw,
  FileText,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Mic2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  useGenerateFeedbackSummary,
  useGetSession,
  useExportReport,
  type FeedbackSummary,
  type Turn,
} from "@workspace/api-client-react";

// ─── emotion arc chart ────────────────────────────────────────────────────────

function emotionColor(score: number): string {
  if (score <= 3) return "#10b981";
  if (score <= 6) return "#f59e0b";
  return "#ef4444";
}

function EmotionArcChart({ emotionArc }: { emotionArc: number[] }) {
  const data = emotionArc.map((score, i) => ({ turn: `T${i + 1}`, score }));
  const avg = Math.round(
    emotionArc.reduce((a, b) => a + b, 0) / emotionArc.length,
  );

  return (
    <div>
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
            contentStyle={{
              background: "white",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(val: number) => [`${val}/10`, "Intensity"]}
          />
          <ReferenceLine y={5} stroke="#e2e8f0" strokeDasharray="4 2" />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#f59e0b"
            strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, payload } = props as {
                cx: number;
                cy: number;
                payload: { turn: string; score: number };
              };
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

// ─── per-turn coaching recap ──────────────────────────────────────────────────

function CoachingRecap({ turns }: { turns: Turn[] }) {
  const managerTurns = turns
    .filter((t) => t.role === "manager" && t.coaching_tip)
    .sort((a, b) => a.turn_index - b.turn_index);

  if (managerTurns.length === 0) return null;

  return (
    <Card className="border-slate-200 mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-500" />
          Per-turn coaching notes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {managerTurns.map((turn) => (
          <div key={turn.turn_index} className="flex gap-3">
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              {turn.turn_index}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-600 leading-relaxed">
                {turn.coaching_tip}
              </p>
              {turn.emotion_score !== undefined && (
                <p className="text-xs text-slate-400 mt-1">
                  Employee intensity:{" "}
                  <span
                    className={`font-medium ${
                      turn.emotion_score <= 3
                        ? "text-emerald-600"
                        : turn.emotion_score <= 6
                          ? "text-amber-600"
                          : "text-red-600"
                    }`}
                  >
                    {turn.emotion_score}/10
                  </span>
                </p>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function FeedbackSkeleton() {
  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-3 w-48 mx-auto mt-3" />
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i} className="border-slate-200">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    </div>
  );
}

// ─── loaded feedback panel ────────────────────────────────────────────────────

function FeedbackPanel({
  feedback,
  turns,
  onExport,
  onReplay,
  isExporting,
  exportError,
  exportSuccess,
  onDismissExportError,
}: {
  feedback: FeedbackSummary;
  turns: Turn[];
  onExport: () => void;
  onReplay: () => void;
  isExporting?: boolean;
  exportError?: { title: string; body: string } | null;
  exportSuccess?: boolean;
  onDismissExportError?: () => void;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="space-y-6">
      {/* Emotion arc */}
      {feedback.emotionArc.length > 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              Emotion arc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmotionArcChart emotionArc={feedback.emotionArc} />
          </CardContent>
        </Card>
      )}

      {/* Strengths + improvements */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feedback.strengths.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                Keep practising — strengths will emerge.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {feedback.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              Improvements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {feedback.improvements.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No specific improvements flagged.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {feedback.improvements.map((imp, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <ChevronRight className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{imp}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Overall assessment */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" />
            Overall assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-slate-600">
            {feedback.summary}
          </p>
        </CardContent>
      </Card>

      {/* Per-turn coaching recap from session */}
      <CoachingRecap turns={turns} />

      {/* Export error */}
      {exportError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4 pb-4 flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-800">
                {exportError.title}
              </p>
              <p className="text-xs text-red-600 mt-0.5">{exportError.body}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 gap-1"
                onClick={onExport}
                disabled={isExporting}
              >
                <RefreshCw className="w-3.5 h-3.5" /> Try again
              </Button>
              {onDismissExportError && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={onDismissExportError}
                >
                  Dismiss
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live region for assistive tech */}
      <div role="status" aria-live="polite" className="sr-only">
        {isExporting
          ? "Generating your report"
          : exportSuccess
            ? "Report downloaded"
            : exportError
              ? `${exportError.title}. ${exportError.body}`
              : ""}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2 pb-4">
        <Button
          variant="outline"
          className="gap-2 text-slate-600"
          onClick={onExport}
          disabled={isExporting}
          aria-busy={isExporting || undefined}
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <FileText className="w-4 h-4" aria-hidden="true" />
          )}
          {isExporting
            ? "Generating…"
            : exportError
              ? "Try export again"
              : "Export PDF"}
        </Button>
        {exportSuccess && !isExporting && !exportError && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            Report downloaded
          </span>
        )}
        <Button
          variant="outline"
          className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          onClick={onReplay}
        >
          <Mic2 className="w-4 h-4" />
          View improved replay
        </Button>
        <div className="flex-1" />
        <Button
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2"
          onClick={() => navigate("/")}
        >
          <RefreshCw className="w-4 h-4" />
          Practice again
        </Button>
      </div>
    </div>
  );
}

// ─── Feedback page ─────────────────────────────────────────────────────────────

export default function Feedback() {
  const [, navigate] = useLocation();

  const feedbackMutation = useGenerateFeedbackSummary();
  const sessionQuery = useGetSession();
  const exportMutation = useExportReport();

  const turns: Turn[] = sessionQuery.data?.turns ?? [];

  useEffect(() => {
    feedbackMutation.mutate();
    // Run once on mount — the mutation is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only block on the feedback mutation — session turns load in the background
  // and fill in the coaching recap once ready.
  const isLoading = feedbackMutation.isPending;
  const feedback = feedbackMutation.data;
  const isError = feedbackMutation.isError && !isLoading && !feedback;

  function handleRetry() {
    feedbackMutation.reset();
    feedbackMutation.mutate();
  }

  const exportInFlightRef = useRef(false);
  const [exportError, setExportError] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  function categorizeExportError(err: unknown): { title: string; body: string } {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 403) {
        return {
          title: "Your session has expired",
          body: "Start a new session to download a fresh report.",
        };
      }
      if (err.status === 408 || err.status === 504) {
        return {
          title: "The report took too long to generate",
          body: "The server is busy. Wait a moment and try again.",
        };
      }
      if (err.status >= 500) {
        return {
          title: "We couldn't generate your report",
          body: "Something went wrong on our side. Please try again in a moment.",
        };
      }
      return {
        title: "We couldn't generate your report",
        body: "Please try again. If this keeps happening, start a new session.",
      };
    }
    if (err instanceof TypeError) {
      return {
        title: "You appear to be offline",
        body: "Check your internet connection and try again.",
      };
    }
    return {
      title: "We couldn't download your report",
      body: "Please try again in a moment.",
    };
  }

  function handleExport() {
    if (exportInFlightRef.current || exportMutation.isPending) return;
    exportInFlightRef.current = true;
    setExportError(null);
    setExportSuccess(false);

    exportMutation.mutate(undefined, {
      onSuccess: (blob) => {
        try {
          const url = URL.createObjectURL(blob as Blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `exit-coach-report-${Date.now()}.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          // Defer revoke so the browser has time to start the download.
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          setExportSuccess(true);
          if (successTimerRef.current) clearTimeout(successTimerRef.current);
          successTimerRef.current = setTimeout(
            () => setExportSuccess(false),
            4000,
          );
        } catch (err) {
          setExportError(categorizeExportError(err));
        } finally {
          exportInFlightRef.current = false;
        }
      },
      onError: (err) => {
        exportInFlightRef.current = false;
        setExportError(categorizeExportError(err));
      },
    });
  }

  function dismissExportError() {
    setExportError(null);
    exportMutation.reset();
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">
              Session Feedback
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isLoading
                ? "Generating your personalised coaching report…"
                : feedback
                  ? "Here's how your session went."
                  : isError
                    ? "Something went wrong."
                    : "Ready to review your session."}
            </p>
          </div>
          {isLoading && (
            <Loader2 className="w-5 h-5 text-amber-500 animate-spin shrink-0" />
          )}
        </div>

        {/* Error */}
        {isError && (
          <Card className="border-red-200 bg-red-50 mb-6">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800">
                  Could not generate feedback
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  The session may have expired, or the AI is temporarily
                  unavailable.
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 gap-1"
                  onClick={handleRetry}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-600"
                  onClick={() => navigate("/")}
                >
                  Home
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skeleton */}
        {isLoading && <FeedbackSkeleton />}

        {/* Loaded */}
        {!isLoading && feedback && (
          <FeedbackPanel
            feedback={feedback}
            turns={turns}
            onExport={handleExport}
            onReplay={() => navigate("/replay")}
            isExporting={exportMutation.isPending}
            exportError={exportError}
            exportSuccess={exportSuccess}
            onDismissExportError={dismissExportError}
          />
        )}

        {/* Empty — shouldn't normally be visible */}
        {!isLoading && !feedback && !isError && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">No feedback to display yet.</p>
            <Button
              variant="link"
              className="text-amber-600 mt-2"
              onClick={() => navigate("/")}
            >
              Start a session
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
