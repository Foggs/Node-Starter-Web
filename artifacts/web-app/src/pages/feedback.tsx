import { useEffect, useRef, useState, useId } from "react";
import { useLocation } from "wouter";
import { ApiError, generateFeedbackSummary } from "@workspace/api-client-react";
import { isAbortError } from "@/lib/apiErrors";
import { useSlowRequestHint } from "@/hooks/useSlowRequestHint";
import { SlowRequestHint } from "@/components/SlowRequestHint";
import { EmotionArcChart } from "@/components/EmotionArcChart";
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
  Play,
  Volume2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { categorizeApiError } from "@/lib/apiErrors";
import {
  useGenerateFeedbackSummary,
  useGetSession,
  useExportReport,
  type FeedbackSummary,
  type Turn,
} from "@workspace/api-client-react";
import {
  useImprovedReplay,
  type ImprovedReplayStatus,
} from "@/hooks/useImprovedReplay";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import type { ImprovedTurn } from "@workspace/api-client-react";


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

// ─── inline improved voice preview (Y10) ──────────────────────────────────────

/**
 * Inline preview card on the feedback page that autoplays the first improved
 * manager turn the moment the shared `useImprovedReplay()` cache transitions
 * to `success` (Y10). Autoplay fires exactly once per page mount; if the
 * browser blocks the initial `play()` (no user gesture yet), the card
 * degrades to a "Play preview" button instead of erroring.
 */
function ImprovedVoicePreview({
  status,
  data,
  onRetry,
  onNavigateReplay,
}: {
  status: ImprovedReplayStatus;
  data: ImprovedTurn[] | undefined;
  onRetry: () => void;
  onNavigateReplay: () => void;
}) {
  const player = useAudioPlayer();
  const firstTurn = data?.[0];
  const audioUrl = firstTurn?.audioUrl;

  // Guard: ensures we only kick off the auto `play()` a single time per
  // mount. The flag is set the moment the autoplay attempt is dispatched
  // (regardless of whether the browser accepts it) so subsequent re-renders
  // never restart playback. A new practice session unmounts/remounts this
  // page, naturally re-arming the guard.
  const hasAutoplayedRef = useRef(false);
  // Tracks whether the *initial* autoplay attempt was rejected by the
  // browser's user-gesture policy. When true we render a "Play preview"
  // button in place of the playing pill.
  const [needsFallback, setNeedsFallback] = useState(false);

  useEffect(() => {
    if (status !== "success") return;
    if (hasAutoplayedRef.current) return;
    if (!audioUrl) return;
    hasAutoplayedRef.current = true;
    player.play(audioUrl);
    // player.play is referentially stable; we deliberately depend only on
    // the trigger inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, audioUrl]);

  useEffect(() => {
    if (
      player.playbackState === "error" &&
      hasAutoplayedRef.current &&
      audioUrl
    ) {
      setNeedsFallback(true);
    }
    if (player.playbackState === "playing") {
      setNeedsFallback(false);
    }
  }, [player.playbackState, audioUrl]);

  function handlePlayFallback() {
    if (!audioUrl) return;
    setNeedsFallback(false);
    player.play(audioUrl);
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
          <Mic2 className="w-4 h-4 text-emerald-500" />
          Improved voice preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        {status === "pending" && (
          <div
            className="inline-flex items-center gap-2 text-sm text-slate-600"
            role="status"
            aria-live="polite"
            data-testid="improved-preview-pending"
          >
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" aria-hidden="true" />
            Preparing your improved voice…
          </div>
        )}

        {status === "error" && (
          <div
            className="inline-flex items-center gap-2 text-sm text-amber-700"
            role="status"
            aria-live="polite"
            data-testid="improved-preview-error"
          >
            <AlertTriangle className="w-4 h-4" aria-hidden="true" />
            <span>Couldn't prepare your replay.</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-amber-700"
              onClick={onRetry}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}

        {status === "success" && firstTurn && (
          <div className="space-y-3" data-testid="improved-preview-success">
            <div className="rounded-lg border border-emerald-200 bg-white/70 p-3">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1.5">
                Turn {firstTurn.turnIndex} — improved
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {firstTurn.improvedTranscript}
              </p>
              <div
                className="mt-2 min-h-[1.5rem] flex items-center"
                role="status"
                aria-live="polite"
              >
                {player.playbackState === "playing" && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
                    data-testid="improved-preview-playing"
                  >
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
                    Playing…
                  </span>
                )}
                {needsFallback && audioUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    onClick={handlePlayFallback}
                    data-testid="improved-preview-play-fallback"
                  >
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    Play preview
                  </Button>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={onNavigateReplay}
              data-testid="improved-preview-cta"
            >
              Hear the full replay
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackPanel({
  feedback,
  turns,
  onExport,
  onReplay,
  isExporting,
  exportError,
  exportSuccess,
  onDismissExportError,
  replayStatus,
  replayData,
  onReplayRetry,
}: {
  feedback: FeedbackSummary;
  turns: Turn[];
  onExport: () => void;
  onReplay: () => void;
  isExporting?: boolean;
  exportError?: { title: string; body: string } | null;
  exportSuccess?: boolean;
  onDismissExportError?: () => void;
  replayStatus: ImprovedReplayStatus;
  replayData: ImprovedTurn[] | undefined;
  onReplayRetry: () => void;
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

      {/* Inline improved-voice preview (Y10) */}
      <ImprovedVoicePreview
        status={replayStatus}
        data={replayData}
        onRetry={onReplayRetry}
        onNavigateReplay={onReplay}
      />

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

  // AbortController so the user can cancel a slow feedback-summary request
  // via the SlowRequestHint banner. Each call recreates the controller.
  const feedbackAbortRef = useRef<AbortController | null>(null);
  const feedbackMutation = useGenerateFeedbackSummary({
    mutation: {
      mutationFn: () => {
        feedbackAbortRef.current?.abort();
        const ctrl = new AbortController();
        feedbackAbortRef.current = ctrl;
        return generateFeedbackSummary({ signal: ctrl.signal });
      },
    },
  });
  const sessionQuery = useGetSession();
  const exportMutation = useExportReport();
  const feedbackSlow = useSlowRequestHint(feedbackMutation.isPending);

  // Subscribe to the shared improved-replay cache. The eager fire happens
  // in session.tsx the moment turn 5 completes, so the common case is that
  // status is already "pending" or "success" by the time this page mounts.
  // For deep-link / cold-reload scenarios where the session reached
  // "complete" without going through that effect, kick the request off
  // here as a safety net so the indicator + /replay both work. (R3)
  const improvedReplay = useImprovedReplay();
  useEffect(() => {
    if (improvedReplay.status === "idle") {
      improvedReplay.ensureStarted().catch(() => {});
    }
    // Fire once on mount based on the current cache snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function handleReplayRetry() {
    improvedReplay.retry().catch(() => {});
  }

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

  function cancelFeedback() {
    feedbackAbortRef.current?.abort();
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
    if (
      (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      return {
        title: "The report took too long to generate",
        body: "The server is busy. Wait a moment and try again.",
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
        {isError && (() => {
          const info = isAbortError(feedbackMutation.error)
            ? {
                title: "Cancelled",
                body: "We stopped building your report. Tap Retry whenever you're ready.",
              }
            : categorizeApiError(
                feedbackMutation.error,
                "Generating feedback",
              );
          return (
          <Card className="border-red-200 bg-red-50 mb-6" role="alert">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800">
                  {info.title}
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  {info.body}
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
          );
        })()}

        {/* Skeleton + slow-request hint */}
        {isLoading && (
          <div className="space-y-4">
            {feedbackSlow && (
              <SlowRequestHint
                message="Still building your coaching report — you can cancel and try again."
                onCancel={cancelFeedback}
              />
            )}
            <FeedbackSkeleton />
          </div>
        )}

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
            replayStatus={improvedReplay.status}
            replayData={improvedReplay.data}
            onReplayRetry={handleReplayRetry}
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
