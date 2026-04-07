import { useCallback, useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ApiError,
  useGenerateEmployeeTurn,
  useGetCoachingTip,
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

interface CoachingTipOverlayProps {
  tip: CoachingTipData;
  turnNum: number;
  onContinue: () => void;
}

function CoachingTipOverlay({ tip, turnNum, onContinue }: CoachingTipOverlayProps) {
  const isLastTurn = turnNum >= 5;
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-end sm:items-center justify-center z-50 p-4">
      <Card className="w-full max-w-lg border-slate-200 shadow-2xl">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
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

          <Button
            className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2"
            onClick={onContinue}
          >
            {isLastTurn ? "Complete session" : `Turn ${turnNum + 1} of 5`}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>
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

  // ── checkpoint on mount ──
  useEffect(() => {
    const checkpoint = loadCheckpoint();
    if (checkpoint && checkpoint.completedTurns.length > 0) {
      setPendingCheckpoint(checkpoint);
    } else {
      // fresh start — fetch first employee turn
      setPhase({ tag: "fetching_employee", turnNum: 1 });
    }
  }, []);

  // ── fetch employee turn whenever phase enters fetching_employee ──
  useEffect(() => {
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
  }, [phase.tag === "fetching_employee" ? phase.turnNum : null, retryKey]);

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
        setPhase({ tag: "processing", turnNum });

        coachingTipMutation.mutate(
          { data: { audio: blob, turnIndex: turnNum } },
          {
            onSuccess: (data) => {
              // Add the employee turn that just finished speaking
              const employeeTurn: CompletedTurn = {
                role: "employee",
                turnNum,
                text,
              };
              // Add the manager turn with its coaching context
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
              // Return to employee phase so the manager can retry
              setPhase({ tag: "employee", turnNum, text });
            },
          },
        );
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
  }, [phase, completedTurns, coachingTipMutation]);

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
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
              onClick={handleEndSession}
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
                  <Button
                    size="lg"
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2"
                    onClick={startRecording}
                  >
                    <Mic className="w-4 h-4" /> Record Your Response
                  </Button>
                  <p className="text-xs text-slate-400">
                    Press record when you're ready to respond
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
    </AppShell>
  );
}
