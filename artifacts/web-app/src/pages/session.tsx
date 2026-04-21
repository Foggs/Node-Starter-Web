import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Mic,
  MicOff,
  Square,
  ChevronRight,
  X,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Volume2,
  SkipForward,
  Send,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ApiError,
  getGetSessionQueryKey,
  useGenerateEmployeeTurn,
  useGetCoachingTip,
  useGetSession,
  useSynthesizeEmployeeVoice,
} from "@workspace/api-client-react";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";

// ─── types ────────────────────────────────────────────────────────────────────

interface CoachingTipData {
  transcript: string;
  coachingTip: string;
  emotionScore: number;
}

interface CompletedTurn {
  role: "employee" | "manager";
  turnNum: number;
  text: string;
  coachingTip?: string;
  emotionScore?: number;
}

type Phase =
  | { tag: "fetching_employee"; turnNum: number }
  | { tag: "employee"; turnNum: number; text: string }
  | { tag: "recording"; turnNum: number }
  | { tag: "reviewing"; turnNum: number; text: string; blob: Blob }
  | { tag: "processing"; turnNum: number }
  | { tag: "coaching_tip"; turnNum: number; tip: CoachingTipData }
  | { tag: "complete" };

// ─── sessionStorage checkpoint ────────────────────────────────────────────────

const CHECKPOINT_KEY = "exit-coach-session-checkpoint";

interface Checkpoint {
  completedTurns: CompletedTurn[];
  savedAt: number;
}

function saveCheckpoint(completedTurns: CompletedTurn[]) {
  try {
    const checkpoint: Checkpoint = { completedTurns, savedAt: Date.now() };
    sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
  } catch {
    // sessionStorage not available — silently ignore
  }
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const raw = sessionStorage.getItem(CHECKPOINT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Checkpoint;
    if (!Array.isArray(data.completedTurns)) return null;
    return data;
  } catch {
    return null;
  }
}

function clearCheckpoint() {
  try {
    sessionStorage.removeItem(CHECKPOINT_KEY);
  } catch {
    // ignore
  }
}

// ─── emotion score badge ──────────────────────────────────────────────────────

function EmotionBadge({ score }: { score: number }) {
  const label =
    score <= 3 ? "Calm" : score <= 6 ? "Unsettled" : "Distressed";
  const cls =
    score <= 3
      ? "bg-emerald-100 text-emerald-700"
      : score <= 6
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}
    >
      {score}/10 {label}
    </span>
  );
}

// ─── SessionRecoveryBanner ────────────────────────────────────────────────────

interface RecoveryBannerProps {
  checkpoint: Checkpoint;
  onResume: () => void;
  onDiscard: () => void;
}

function SessionRecoveryBanner({
  checkpoint,
  onResume,
  onDiscard,
}: RecoveryBannerProps) {
  const completedManagerTurns = checkpoint.completedTurns.filter(
    (t) => t.role === "manager",
  ).length;
  const savedAgo = Math.round((Date.now() - checkpoint.savedAt) / 60000);
  const agoLabel = savedAgo < 1 ? "just now" : `${savedAgo} min ago`;

  return (
    <Card className="border-amber-300 bg-amber-50 mb-4">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">
              Unsaved session found
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {completedManagerTurns} of 5 manager turn
              {completedManagerTurns !== 1 ? "s" : ""} completed — saved{" "}
              {agoLabel}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-800 hover:bg-amber-100 gap-1"
              onClick={onResume}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Resume
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-amber-700 hover:text-amber-900"
              onClick={onDiscard}
            >
              Start fresh
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── TurnBubble ───────────────────────────────────────────────────────────────

function TurnBubble({ turn }: { turn: CompletedTurn }) {
  const isManager = turn.role === "manager";
  return (
    <div className={`flex gap-3 ${isManager ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
          isManager
            ? "bg-amber-500 text-slate-950"
            : "bg-slate-200 text-slate-600"
        }`}
      >
        {isManager ? "M" : "E"}
      </div>
      <div
        className={`max-w-xs sm:max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isManager
            ? "bg-amber-500 text-slate-950"
            : "bg-white border border-slate-200 text-slate-700"
        }`}
      >
        <p>{turn.text}</p>
        {!isManager && turn.emotionScore !== undefined && (
          <div className="mt-2">
            <EmotionBadge score={turn.emotionScore} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TypingIndicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-xs font-bold text-slate-600">
        E
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// ─── CoachingTipOverlay ───────────────────────────────────────────────────────

const AUTO_ADVANCE_SECONDS = 8;

interface CoachingTipOverlayProps {
  tip: CoachingTipData;
  turnNum: number;
  onContinue: () => void;
}

function CoachingTipOverlay({ tip, turnNum, onContinue }: CoachingTipOverlayProps) {
  const isLastTurn = turnNum >= 5;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    AUTO_ADVANCE_SECONDS,
  );
  const pausedRef = useRef(false);
  const continuedRef = useRef(false);

  // Reset when turn changes
  useEffect(() => {
    continuedRef.current = false;
    setSecondsLeft(AUTO_ADVANCE_SECONDS);
  }, [turnNum]);

  // Tick once per second, pausing while pausedRef is true.
  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      if (continuedRef.current) return;
      continuedRef.current = true;
      onContinue();
      return;
    }
    const id = setTimeout(() => {
      if (!pausedRef.current) {
        setSecondsLeft((s) => (s === null ? null : s - 1));
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [secondsLeft, onContinue]);

  function handleStay() {
    pausedRef.current = true;
    setSecondsLeft(null);
  }

  function handleContinueNow() {
    if (continuedRef.current) return;
    continuedRef.current = true;
    onContinue();
  }

  // Pause auto-advance while pointer is over the card or focus is inside it.
  const cardHandlers = {
    onMouseEnter: () => {
      pausedRef.current = true;
    },
    onMouseLeave: () => {
      // Only resume if the user hasn't explicitly paused via Stay
      if (secondsLeft !== null) pausedRef.current = false;
    },
    onFocus: () => {
      pausedRef.current = true;
    },
    onBlur: (e: React.FocusEvent) => {
      // Resume only when focus leaves the card entirely
      if (
        e.currentTarget instanceof HTMLElement &&
        !e.currentTarget.contains(e.relatedTarget as Node) &&
        secondsLeft !== null
      ) {
        pausedRef.current = false;
      }
    },
  };

  const continueLabel = isLastTurn
    ? "Complete session"
    : `Turn ${turnNum + 1} of 5`;
  const showCountdown = secondsLeft !== null && secondsLeft > 0;
  const ariaCountdown = showCountdown
    ? ` (auto-advancing in ${secondsLeft} seconds)`
    : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coaching-tip-title"
      className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center z-50 p-4"
    >
      <Card
        className="w-full max-w-lg border-slate-200 shadow-2xl"
        {...cardHandlers}
      >
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <p
              id="coaching-tip-title"
              className="text-xs font-semibold text-amber-600 uppercase tracking-wider"
            >
              Turn {turnNum} coaching
            </p>
            <EmotionBadge score={tip.emotionScore} />
          </div>

          <p className="text-sm leading-relaxed text-slate-700 mb-4">
            {tip.coachingTip}
          </p>

          <div className="text-xs text-slate-400 mb-4 border-t border-slate-100 pt-3">
            <span className="font-medium text-slate-500">You said: </span>
            {tip.transcript.length > 120
              ? tip.transcript.slice(0, 120) + "…"
              : tip.transcript}
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2"
              onClick={handleContinueNow}
              aria-label={`${continueLabel}${ariaCountdown}`}
            >
              {continueLabel}
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Button>
            {showCountdown && (
              <Button
                variant="outline"
                className="text-slate-600 border-slate-300"
                onClick={handleStay}
              >
                Stay
              </Button>
            )}
          </div>

          {showCountdown && (
            <p className="text-xs text-slate-400 mt-2 text-center">
              Continuing in {secondsLeft}s — hover or focus to pause
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── RecordingPreview ─────────────────────────────────────────────────────────

interface RecordingPreviewProps {
  blob: Blob;
  isSubmitting?: boolean;
  onSubmit: () => void;
  onRedo: () => void;
}

function RecordingPreview({
  blob,
  isSubmitting,
  onSubmit,
  onRedo,
}: RecordingPreviewProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {url && (
          <audio
            controls
            src={url}
            className="flex-1 h-10"
            aria-label="Preview your recording"
          />
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 gap-2 text-slate-700 border-slate-300"
          onClick={onRedo}
          disabled={isSubmitting}
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          Re-record
        </Button>
        <Button
          className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2"
          onClick={onSubmit}
          disabled={isSubmitting}
          aria-busy={isSubmitting || undefined}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="w-4 h-4" aria-hidden="true" />
          )}
          {isSubmitting ? "Submitting…" : "Submit response"}
        </Button>
      </div>
      <p className="text-xs text-slate-400 text-center">
        Listen back, then submit — or re-record if you'd like to try again.
      </p>
    </div>
  );
}

// ─── RecordingWave ────────────────────────────────────────────────────────────

function RecordingWave() {
  return (
    <div className="flex items-center gap-0.5 h-5">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-red-500 animate-pulse"
          style={{
            height: `${30 + Math.sin(i * 0.9) * 60}%`,
            animationDelay: `${i * 80}ms`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Session page ─────────────────────────────────────────────────────────────

export default function Session() {
  const [, navigate] = useLocation();

  // ── session-readiness gate ──
  // "checking"    = waiting for the GET /session response
  // "ready"       = all four onboarding steps confirmed; session can start
  // "redirecting" = redirect has been triggered; component will unmount
  const [sessionReady, setSessionReady] = useState<
    "checking" | "ready" | "redirecting"
  >("checking");

  const sessionReadyQuery = useGetSession({
    query: {
      queryKey: getGetSessionQueryKey(),
      enabled: sessionReady === "checking",
      retry: false,
    },
  });

  // ── checkpoint recovery ──
  const [pendingCheckpoint, setPendingCheckpoint] = useState<Checkpoint | null>(
    null,
  );

  const [completedTurns, setCompletedTurns] = useState<CompletedTurn[]>([]);
  const [phase, setPhase] = useState<Phase>({ tag: "fetching_employee", turnNum: 1 });
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // ── voice playback ──
  const player = useAudioPlayer();
  const [voiceFetching, setVoiceFetching] = useState(false);
  const voiceSkippedRef = useRef(false);

  // ── api mutations ──
  const employeeTurnMutation = useGenerateEmployeeTurn();
  const coachingTipMutation = useGetCoachingTip();
  const synthesizeEmployeeVoiceMutation = useSynthesizeEmployeeVoice();

  // ── auto-scroll ──
  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [completedTurns, phase]);

  // ── session-readiness check ──
  // Runs once after GET /session resolves. Redirects to the earliest
  // incomplete onboarding step; advances to "ready" when all four steps pass.
  useEffect(() => {
    if (sessionReady !== "checking") return;
    const { data, isError } = sessionReadyQuery;
    if (!data && !isError) return; // still loading

    if (isError || !data) {
      navigate("/");
      setSessionReady("redirecting");
      return;
    }
    if (!data.consent_given) {
      navigate("/consent");
      setSessionReady("redirecting");
      return;
    }
    if (!data.scenario) {
      navigate("/setup");
      setSessionReady("redirecting");
      return;
    }
    if (!data.persona) {
      navigate("/setup");
      setSessionReady("redirecting");
      return;
    }
    if (!data.voice_step_completed) {
      navigate("/onboarding");
      setSessionReady("redirecting");
      return;
    }
    setSessionReady("ready");
  }, [sessionReadyQuery.data, sessionReadyQuery.isError, sessionReady, navigate]);

  // ── checkpoint on mount (deferred until readiness is confirmed) ──
  useEffect(() => {
    if (sessionReady !== "ready") return;
    const checkpoint = loadCheckpoint();
    if (checkpoint && checkpoint.completedTurns.length > 0) {
      setPendingCheckpoint(checkpoint);
    } else {
      // fresh start — fetch first employee turn
      setPhase({ tag: "fetching_employee", turnNum: 1 });
    }
  }, [sessionReady]);

  // ── fetch employee turn whenever phase enters fetching_employee ──
  useEffect(() => {
    if (sessionReady !== "ready") return;
    if (phase.tag !== "fetching_employee") return;
    const { turnNum } = phase;
    setFetchError(null);

    employeeTurnMutation.mutate(undefined, {
      onSuccess: (data) => {
        setPhase({ tag: "employee", turnNum, text: data.transcript });
      },
      onError: () => {
        setFetchError("The AI service is temporarily unavailable — please try again.");
        // Stay in fetching_employee so the user can retry
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.tag === "fetching_employee" ? phase.turnNum : null, retryKey, sessionReady]);

  const autoRecordTriggeredRef = useRef<number | null>(null);

  // ── synthesize & auto-play employee voice when entering employee phase ──
  useEffect(() => {
    if (phase.tag !== "employee") return;

    voiceSkippedRef.current = false;
    setVoiceFetching(true);

    synthesizeEmployeeVoiceMutation.mutate(undefined, {
      onSuccess: (data) => {
        setVoiceFetching(false);
        if (!voiceSkippedRef.current) {
          player.play(data.audioUrl);
        }
      },
      onError: (error) => {
        // 502 is the expected degradation path (ElevenLabs unavailable).
        // Any other status is unexpected — log it for observability while
        // still degrading silently so the session is never blocked.
        const status = error instanceof ApiError ? error.status : 0;
        if (status !== 502) {
          console.warn("[employee-voice] unexpected synthesis error:", error);
        }
        setVoiceFetching(false);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.tag === "employee" ? phase.turnNum : null]);

  // ── complete → navigate to feedback ──
  useEffect(() => {
    if (phase.tag === "complete") {
      clearCheckpoint();
      navigate("/feedback");
    }
  }, [phase.tag, navigate]);

  // ── handlers ──

  function handleResume() {
    if (!pendingCheckpoint) return;
    const saved = pendingCheckpoint.completedTurns;
    setCompletedTurns(saved);
    setPendingCheckpoint(null);
    const completedManagerCount = saved.filter(
      (t) => t.role === "manager",
    ).length;
    if (completedManagerCount >= 5) {
      setPhase({ tag: "complete" });
    } else {
      setPhase({ tag: "fetching_employee", turnNum: completedManagerCount + 1 });
    }
  }

  function handleDiscard() {
    clearCheckpoint();
    setPendingCheckpoint(null);
    setCompletedTurns([]);
    setPhase({ tag: "fetching_employee", turnNum: 1 });
  }

  function handleRetryFetch() {
    if (phase.tag !== "fetching_employee") return;
    setRetryKey((k) => k + 1);
  }

  const startRecording = useCallback(async () => {
    if (phase.tag !== "employee") return;
    const { turnNum, text } = phase;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        // Move to reviewing — user can preview, re-record, or submit.
        setPhase({ tag: "reviewing", turnNum, text, blob });
      };

      recorderRef.current = recorder;
      recorder.start();
      setPhase({ tag: "recording", turnNum });
    } catch {
      // Microphone access denied — show a brief error state
      setFetchError(
        "Microphone access is required. Please allow microphone permission and try again.",
      );
    }
  }, [phase]);

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  // ── auto-start recording once the employee voice has finished ──
  // Mic permission is already granted at this point (the Voice onboarding
  // step required it). This drops one explicit click per turn.
  useEffect(() => {
    if (phase.tag !== "employee") return;
    if (voiceFetching) return;
    if (player.playbackState === "loading" || player.playbackState === "playing")
      return;
    if (autoRecordTriggeredRef.current === phase.turnNum) return;
    autoRecordTriggeredRef.current = phase.turnNum;
    const id = setTimeout(() => {
      startRecording();
    }, 350);
    return () => clearTimeout(id);
  }, [phase, voiceFetching, player.playbackState, startRecording]);

  function submitRecording() {
    if (phase.tag !== "reviewing") return;
    const { turnNum, text, blob } = phase;
    setPhase({ tag: "processing", turnNum });

    coachingTipMutation.mutate(
      { data: { audio: blob, turnIndex: turnNum } },
      {
        onSuccess: (data) => {
          const employeeTurn: CompletedTurn = {
            role: "employee",
            turnNum,
            text,
          };
          const managerTurn: CompletedTurn = {
            role: "manager",
            turnNum,
            text: data.transcript,
            coachingTip: data.coachingTip,
            emotionScore: data.emotionScore,
          };
          const updated = [...completedTurns, employeeTurn, managerTurn];
          setCompletedTurns(updated);
          saveCheckpoint(updated);
          setPhase({
            tag: "coaching_tip",
            turnNum,
            tip: {
              transcript: data.transcript,
              coachingTip: data.coachingTip,
              emotionScore: data.emotionScore,
            },
          });
        },
        onError: () => {
          // Return to reviewing so the user can retry submission or re-record
          setPhase({ tag: "reviewing", turnNum, text, blob });
          setFetchError(
            "We couldn't analyse that response. Try submitting again or re-record.",
          );
        },
      },
    );
  }

  function redoRecording() {
    if (phase.tag !== "reviewing") return;
    const { turnNum, text } = phase;
    setFetchError(null);
    // Reset so auto-start fires again on this turn.
    autoRecordTriggeredRef.current = null;
    setPhase({ tag: "employee", turnNum, text });
  }

  function handleContinueAfterTip() {
    if (phase.tag !== "coaching_tip") return;
    const nextTurn = phase.turnNum + 1;
    if (nextTurn > 5) {
      setPhase({ tag: "complete" });
    } else {
      setPhase({ tag: "fetching_employee", turnNum: nextTurn });
    }
  }

  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  function handleEndSession() {
    clearCheckpoint();
    navigate("/");
  }

  function handleSkipVoice() {
    voiceSkippedRef.current = true;
    player.stop();
    setVoiceFetching(false);
  }

  // ── derived ──
  const completedManagerTurns = completedTurns.filter(
    (t) => t.role === "manager",
  ).length;

  const voiceActive =
    phase.tag === "employee" &&
    (voiceFetching ||
      player.playbackState === "loading" ||
      player.playbackState === "playing");
  const progressPct = (completedManagerTurns / 5) * 100;
  const currentTurnNum =
    phase.tag === "complete"
      ? 5
      : "turnNum" in phase
        ? phase.turnNum
        : 1;

  // ─── render ───────────────────────────────────────────────────────────────

  // Show a minimal spinner while verifying session readiness.
  // All data effects are also gated so nothing fires before this resolves.
  if (sessionReady !== "ready") {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Session in Progress
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Turn {currentTurnNum} of 5
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-red-100 text-red-700 gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
              Live
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-700 gap-1"
              onClick={() => setEndConfirmOpen(true)}
            >
              <X className="w-3.5 h-3.5" /> End
            </Button>
          </div>
        </div>

        {/* Progress */}
        <Progress
          value={progressPct}
          className="h-1.5 mb-5 bg-slate-100"
        />

        {/* Recovery banner */}
        {pendingCheckpoint && (
          <SessionRecoveryBanner
            checkpoint={pendingCheckpoint}
            onResume={handleResume}
            onDiscard={handleDiscard}
          />
        )}

        {/* Error message */}
        {fetchError && (
          <Card className="border-red-200 bg-red-50 mb-4">
            <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-red-700">{fetchError}</p>
              {phase.tag === "fetching_employee" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-300 text-red-700 shrink-0"
                  onClick={handleRetryFetch}
                >
                  Retry
                </Button>
              )}
              <button
                className="text-red-400 hover:text-red-600 shrink-0"
                onClick={() => setFetchError(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </CardContent>
          </Card>
        )}

        {/* Conversation history */}
        <div className="space-y-4 mb-4 min-h-40">
          {completedTurns.map((turn, i) => (
            <TurnBubble key={i} turn={turn} />
          ))}

          {/* Current phase indicators */}
          {phase.tag === "fetching_employee" && !pendingCheckpoint && (
            <TypingIndicator />
          )}

          {phase.tag === "employee" && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-xs font-bold text-slate-600">
                E
              </div>
              <div className="max-w-xs sm:max-w-sm bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm leading-relaxed text-slate-700">
                {phase.text}
                {voiceActive && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                    {voiceFetching || player.playbackState === "loading" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Volume2 className="w-3 h-3 animate-pulse text-amber-500" />
                    )}
                    <span>
                      {voiceFetching || player.playbackState === "loading"
                        ? "Loading voice…"
                        : "Speaking…"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {phase.tag === "recording" && (
            <div className="flex gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 text-xs font-bold text-slate-950">
                M
              </div>
              <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-center gap-3">
                <RecordingWave />
                <span className="text-sm text-amber-700 font-medium">
                  Recording…
                </span>
              </div>
            </div>
          )}

          {phase.tag === "reviewing" && (
            <div className="flex gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 text-xs font-bold text-slate-950">
                M
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
                <Volume2 className="w-4 h-4" />
                Listen back below
              </div>
            </div>
          )}

          {phase.tag === "processing" && (
            <div className="flex gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 text-xs font-bold text-slate-950">
                M
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysing your response…
              </div>
            </div>
          )}

          <div ref={scrollAnchorRef} />
        </div>

        {/* Control bar */}
        {!pendingCheckpoint && (
          <Card className="border-slate-200 sticky bottom-4">
            <CardContent className="pt-4 pb-4">
              {phase.tag === "fetching_employee" && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-1">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  Preparing employee response…
                </div>
              )}

              {phase.tag === "employee" && voiceActive && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      {voiceFetching || player.playbackState === "loading" ? (
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      ) : (
                        <Volume2 className="w-4 h-4 animate-pulse text-amber-500" />
                      )}
                      <span>
                        {voiceFetching || player.playbackState === "loading"
                          ? "Loading employee voice…"
                          : "Employee is speaking…"}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-slate-600 border-slate-300"
                      onClick={handleSkipVoice}
                    >
                      <SkipForward className="w-3.5 h-3.5" /> Skip
                    </Button>
                  </div>
                </div>
              )}

              {phase.tag === "employee" && !voiceActive && (
                <div className="flex flex-col items-center gap-2">
                  {/* Auto-start will fire shortly; show a manual fallback in
                      case mic permission was revoked since onboarding. */}
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full text-slate-700 border-slate-300 gap-2"
                    onClick={startRecording}
                  >
                    <Mic className="w-4 h-4" /> Start Recording
                  </Button>
                  <p className="text-xs text-slate-400">
                    Recording will start automatically — or press to start now
                  </p>
                </div>
              )}

              {phase.tag === "recording" && (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    size="lg"
                    className="w-full bg-red-500 hover:bg-red-400 text-white font-semibold gap-2"
                    onClick={stopRecording}
                  >
                    <Square className="w-4 h-4 fill-current" /> Stop Recording
                  </Button>
                  <p className="text-xs text-slate-400">
                    Press stop when you've finished speaking
                  </p>
                </div>
              )}

              {phase.tag === "reviewing" && (
                <RecordingPreview
                  blob={phase.blob}
                  isSubmitting={coachingTipMutation.isPending}
                  onSubmit={submitRecording}
                  onRedo={redoRecording}
                />
              )}

              {phase.tag === "processing" && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-400 py-1">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                  Getting your coaching tip…
                </div>
              )}

              {phase.tag === "coaching_tip" && (
                <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-1">
                  <MicOff className="w-4 h-4 text-slate-400" />
                  Review your coaching tip above
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Coaching tip overlay */}
      {phase.tag === "coaching_tip" && (
        <CoachingTipOverlay
          tip={phase.tip}
          turnNum={phase.turnNum}
          onContinue={handleContinueAfterTip}
        />
      )}

      {/* End confirmation */}
      <AlertDialog open={endConfirmOpen} onOpenChange={setEndConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End session and lose progress?</AlertDialogTitle>
            <AlertDialogDescription>
              You've completed {completedManagerTurns} of 5 turns. Ending now
              clears this session — you'll start fresh from turn 1 next time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEndSession}
              className="bg-red-500 hover:bg-red-400 text-white"
            >
              End session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
