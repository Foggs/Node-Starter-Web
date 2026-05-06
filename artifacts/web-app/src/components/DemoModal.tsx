import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Pause, Play, Lightbulb, Volume2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmotionArcChart } from "@/components/EmotionArcChart";
import { ImprovedReplayTease } from "@/components/ImprovedReplayTease";
import { DemoLeadForm } from "@/components/DemoLeadForm";
import { DEMO_SCRIPT, DEMO_EMOTION_ARC, type DemoTurn } from "@/data/demoScript";
import {
  useDemoPlayback,
  type Phase,
} from "@/hooks/useDemoPlayback";

/**
 * DemoModal — landing-page interactive demo. See demo-feature.md for the
 * full spec. Drives the timed sequence via useDemoPlayback (slice 4),
 * plays pre-generated audio (slice 5), shows EmotionArcChart (slice 6),
 * the ImprovedReplayTease (slice 7), and DemoLeadForm (slice 8a) at the
 * end. On successful submission, closes itself and navigates to /consent.
 */

export interface DemoModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

const PHASE_TO_TURN_AUDIO: Partial<Record<Phase, DemoTurn>> = {
  playing_employee_1: DEMO_SCRIPT.turns[0],
  playing_manager_2: DEMO_SCRIPT.turns[1],
  playing_employee_3: DEMO_SCRIPT.turns[2],
};

const FORWARD_FOR_VISIBILITY: Phase[] = [
  "title_card",
  "playing_employee_1",
  "showing_tip_1",
  "arc_dot_1",
  "playing_manager_2",
  "showing_tip_2",
  "arc_dot_2",
  "playing_employee_3",
  "showing_tip_3",
  "arc_dot_3",
  "arc_done",
  "tease_header",
  "tease_audio",
  "tease_closing",
  "reveal_copy",
  "lead_capture",
  "submitting",
  "complete",
];

/** Returns the index in the forward order, treating `paused` as its resumeTo. */
function rankPhase(p: Phase, resumeTo: Phase | null): number {
  if (p === "idle") return -1;
  if (p === "paused") return resumeTo ? FORWARD_FOR_VISIBILITY.indexOf(resumeTo) : 0;
  return FORWARD_FOR_VISIBILITY.indexOf(p);
}

/** How many turns are visible (have at least started playing) at this phase. */
function visibleTurnCount(rank: number): number {
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("playing_employee_3")) return 3;
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("playing_manager_2")) return 2;
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("playing_employee_1")) return 1;
  return 0;
}

/** How many coaching tips are visible (showing or already shown). */
function visibleTipCount(rank: number): number {
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("showing_tip_3")) return 3;
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("showing_tip_2")) return 2;
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("showing_tip_1")) return 1;
  return 0;
}

/** How many emotion arc dots are visible. */
function visibleArcDotCount(rank: number): number {
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("arc_dot_3")) return 3;
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("arc_dot_2")) return 2;
  if (rank >= FORWARD_FOR_VISIBILITY.indexOf("arc_dot_1")) return 1;
  return 0;
}

export function DemoModal({ open, onOpenChange }: DemoModalProps) {
  const [, navigate] = useLocation();
  const playback = useDemoPlayback();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startedRef = useRef(false);

  // ── start the machine when the modal first opens ─────────────────────────
  useEffect(() => {
    if (open && !startedRef.current) {
      startedRef.current = true;
      playback.start();
    }
    if (!open) {
      startedRef.current = false;
      playback.close();
    }
  }, [open, playback]);

  // ── auto-close + navigate on complete ────────────────────────────────────
  useEffect(() => {
    if (playback.phase === "complete") {
      onOpenChange(false);
      navigate("/consent");
    }
  }, [playback.phase, onOpenChange, navigate]);

  // ── audio playback for the 3 conversation turns ──────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const turn =
      PHASE_TO_TURN_AUDIO[
        playback.phase === "paused"
          ? (playback.pausedResumeTo as Phase)
          : playback.phase
      ];

    if (!turn) {
      audio.pause();
      return;
    }
    if (audio.src.endsWith(turn.audioSrc) === false) {
      audio.src = turn.audioSrc;
    }
    if (playback.phase === "paused") {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [playback.phase, playback.pausedResumeTo]);

  // ── audio "ended" → notify state machine ─────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handler = () => playback.notifyAudioEnded();
    audio.addEventListener("ended", handler);
    return () => audio.removeEventListener("ended", handler);
  }, [playback]);

  const effectivePhase: Phase =
    playback.phase === "paused" ? (playback.pausedResumeTo as Phase) : playback.phase;
  const rank = rankPhase(playback.phase, playback.pausedResumeTo);
  const isPaused = playback.phase === "paused";

  const showTitleCard = effectivePhase === "title_card";
  const showTease =
    rank >= FORWARD_FOR_VISIBILITY.indexOf("arc_done") &&
    rank <= FORWARD_FOR_VISIBILITY.indexOf("tease_closing");
  const showTeaseClosingLine =
    rank >= FORWARD_FOR_VISIBILITY.indexOf("tease_closing") &&
    rank < FORWARD_FOR_VISIBILITY.indexOf("reveal_copy");
  const showRevealCopy = rank >= FORWARD_FOR_VISIBILITY.indexOf("reveal_copy");
  const showLeadForm = rank >= FORWARD_FOR_VISIBILITY.indexOf("lead_capture");

  const turnCount = visibleTurnCount(rank);
  const tipCount = visibleTipCount(rank);
  const arcCount = visibleArcDotCount(rank);

  const canPause =
    rank > FORWARD_FOR_VISIBILITY.indexOf("title_card") &&
    rank < FORWARD_FOR_VISIBILITY.indexOf("lead_capture");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Exit Coach demo</DialogTitle>
        <DialogDescription className="sr-only">
          A scripted preview of an Exit Coach practice session.
        </DialogDescription>

        {/* Hidden conversation-turn audio player */}
        <audio ref={audioRef} preload="auto" />

        {/* Top-right close — Radix Dialog wires Escape automatically */}
        <button
          aria-label="Close demo"
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-50 rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title card overlay — covers everything when active */}
        {showTitleCard && (
          <button
            onClick={() => {
              if (playback.titleCardSkippable) playback.skipTitleCard();
            }}
            className="absolute inset-0 z-40 flex items-center justify-center bg-white text-center p-8 transition-opacity duration-300"
            data-testid="demo-title-card"
            aria-label="Skip introduction"
          >
            <div>
              <p className="text-sm text-slate-500">{DEMO_SCRIPT.titleCard.line1}</p>
              <p className="text-sm text-slate-500 mt-1">
                {DEMO_SCRIPT.titleCard.line2}
              </p>
              <p className="text-xl font-semibold text-slate-900 mt-6">
                {DEMO_SCRIPT.titleCard.line3}
              </p>
              {playback.titleCardSkippable && (
                <p className="text-xs text-slate-400 mt-8">Click to skip</p>
              )}
            </div>
          </button>
        )}

        {/* Conversation view */}
        <div className="p-6 space-y-4">
          {/* Turn bubbles */}
          <div className="space-y-3">
            {DEMO_SCRIPT.turns.slice(0, turnCount).map((turn, i) => (
              <TurnBubble
                key={turn.turnIndex}
                turn={turn}
                speaking={
                  i + 1 === turnCount &&
                  effectivePhase.startsWith("playing_") &&
                  !isPaused
                }
              />
            ))}
          </div>

          {/* Coaching tip — only the latest one is "live", earlier ones are summary cards */}
          {tipCount > 0 && (
            <CoachingTipCard
              tip={DEMO_SCRIPT.turns[tipCount - 1]!.coachingTip}
              turnNumber={tipCount}
            />
          )}

          {/* Arc — visible from arc_dot_1 onward */}
          {arcCount > 0 && (
            <Card className="border-slate-200">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-slate-700">
                    Conversation Arc{" "}
                    <span
                      title="This tracks how emotionally escalated the conversation became turn by turn. A rising line means tension increased. A drop means your response helped."
                      className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] text-slate-500 border border-slate-300 cursor-help"
                      aria-label="Conversation arc info"
                    >
                      ⓘ
                    </span>
                  </p>
                </div>
                <EmotionArcChart emotionArc={DEMO_EMOTION_ARC.slice(0, arcCount)} />
              </CardContent>
            </Card>
          )}

          {/* Tease */}
          {showTease && (
            <ImprovedReplayTease
              originalText={DEMO_SCRIPT.improvedReplay.originalTranscript}
              improvedText={DEMO_SCRIPT.improvedReplay.improvedTranscript}
              improvedAudioSrc={DEMO_SCRIPT.improvedReplay.audioSrc}
              onAudioEnded={playback.notifyAudioEnded}
              paused={isPaused}
            />
          )}

          {/* Closing tease line */}
          {showTeaseClosingLine && (
            <p
              data-testid="tease-closing-line"
              className="text-center text-sm italic text-slate-500"
            >
              In a real session, that voice would be yours.
            </p>
          )}

          {/* Reveal copy + lead form */}
          {showRevealCopy && !showLeadForm && (
            <p className="text-sm text-slate-600 text-center px-4 leading-relaxed">
              You just experienced an AI-powered practice session — emotional pushback,
              real-time coaching, and an improved version of your own words.
            </p>
          )}
          {showLeadForm && (
            <DemoLeadForm
              onSuccess={() => playback.submitSucceeded()}
              onSubmittingChange={(submitting) => {
                if (submitting) playback.submit();
                else if (playback.phase === "submitting") playback.submitFailed();
              }}
            />
          )}
        </div>

        {/* Bottom-center controls — pause/resume only available during active playback */}
        {canPause && (
          <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (isPaused ? playback.resume() : playback.pause())}
              data-testid="demo-pause-button"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 mr-1.5" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5 mr-1.5" />
                  Pause
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function TurnBubble({ turn, speaking }: { turn: DemoTurn; speaking: boolean }) {
  const isEmployee = turn.speaker === "employee";
  return (
    <div className={`flex ${isEmployee ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[85%]">
        <p className="text-[11px] text-slate-400 mb-1 px-1">
          {isEmployee ? DEMO_SCRIPT.personaName : "You (demo)"}
        </p>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isEmployee
              ? "bg-slate-100 text-slate-700 rounded-tl-sm"
              : "bg-amber-100 text-slate-800 rounded-tr-sm"
          }`}
        >
          {speaking && (
            <Volume2
              className="inline-block w-3.5 h-3.5 mr-1.5 align-text-bottom animate-pulse"
              aria-hidden
            />
          )}
          {turn.transcript}
        </div>
      </div>
    </div>
  );
}

function CoachingTipCard({ tip, turnNumber }: { tip: string; turnNumber: number }) {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            Turn {turnNumber} coaching
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700/80">
            <Lightbulb className="w-3 h-3" />
            Exit Coach tip
          </span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{tip}</p>
      </CardContent>
    </Card>
  );
}
