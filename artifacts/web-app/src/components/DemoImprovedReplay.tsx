import { useEffect, useRef } from "react";
import { Sparkles, Volume2 } from "lucide-react";
import type { DemoImprovedTurn } from "@/data/demoScript";
import type { Phase } from "@/hooks/useDemoPlayback";

/**
 * DemoImprovedReplay — owns the v4.0 improved-replay view.
 *
 * Visually distinct from the original conversation: amber-tinted background,
 * "Improved version" header banner, manager bubbles get an amber border and
 * a "✨ Improved" label. Employee bubbles are unchanged (same persona name,
 * same neutral surface) so the contrast is unambiguous.
 *
 * No coaching tips, no narration, no Continue buttons — the user is in
 * listening mode. The 2s pauses between turns are owned by this component
 * (single setTimeout per turn, cleared on unmount / phase change / pause)
 * rather than by the playback hook, so the hook stays a clean state-machine.
 *
 * The hook drives playback by transitioning through `playing_improved_e1 →
 * m2 → e3 → m3` on each `notifyAudioEnded()` call. Because we want a 2s
 * silence between segments, we delay the call until the timer elapses.
 */

export interface DemoImprovedReplayProps {
  personaName: string;
  improvedTurns: readonly DemoImprovedTurn[];
  /** Active phase from useDemoPlayback. */
  phase: Phase;
  /** Resume target when phase === "paused". */
  pausedResumeTo: Phase | null;
  /** Called when the inter-turn pause elapses → advances the state machine. */
  onSegmentTransition: () => void;
  /** Called when the final turn's audio + 0ms tail finishes — drives post_replay_pause. */
  onFinalSegmentEnded: () => void;
}

const SEGMENT_PAUSE_MS = 2000;

const PHASE_TO_SEGMENT_ID: Partial<Record<Phase, "e1" | "m2" | "e3" | "m3">> = {
  playing_improved_e1: "e1",
  playing_improved_m2: "m2",
  playing_improved_e3: "e3",
  playing_improved_m3: "m3",
};

const REPLAY_PHASES = new Set<Phase>([
  "playing_improved_e1",
  "playing_improved_m2",
  "playing_improved_e3",
  "playing_improved_m3",
]);

export function DemoImprovedReplay({
  personaName,
  improvedTurns,
  phase,
  pausedResumeTo,
  onSegmentTransition,
  onFinalSegmentEnded,
}: DemoImprovedReplayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const effectivePhase: Phase = phase === "paused" ? (pausedResumeTo ?? phase) : phase;
  const activeId = PHASE_TO_SEGMENT_ID[effectivePhase] ?? null;
  const isActive = activeId !== null;

  // ── audio-src + play/pause control ────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isActive) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }

    const segment = improvedTurns.find((t) => t.id === activeId);
    if (!segment) return;

    if (!audio.src.endsWith(segment.audioSrc)) {
      audio.src = segment.audioSrc;
    }
    if (phase === "paused") {
      audio.pause();
    } else {
      audio.play().catch(() => {
        // Autoplay can fail (no gesture, focus loss). The advance still relies
        // on the `ended` event — silence-fallback is to force-advance.
      });
    }
  }, [activeId, improvedTurns, isActive, phase]);

  // ── audio "ended" → 2s pause → advance state machine ──────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function handleEnded() {
      // Final segment (m3) skips the inter-turn pause — its end transitions
      // straight into the playback-machine's post_replay_pause (1.5s).
      const isFinal = effectivePhase === "playing_improved_m3";
      if (isFinal) {
        onFinalSegmentEnded();
        return;
      }
      // Otherwise: 2s of silence before the next segment.
      if (pauseTimerRef.current !== null) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = setTimeout(() => {
        pauseTimerRef.current = null;
        onSegmentTransition();
      }, SEGMENT_PAUSE_MS);
    }

    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      if (pauseTimerRef.current !== null) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  }, [effectivePhase, onSegmentTransition, onFinalSegmentEnded]);

  // ── pause cancels any in-flight inter-turn timer ──────────────────────────
  useEffect(() => {
    if (phase !== "paused") return;
    if (pauseTimerRef.current !== null) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
  }, [phase]);

  // ── unmount cleanup ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current !== null) {
        clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  }, []);

  // Only show segments up to (and including) the currently-active one, so
  // bubbles arrive as the conversation unfolds.
  const visibleSegments = activeId
    ? improvedTurns.slice(0, improvedTurns.findIndex((t) => t.id === activeId) + 1)
    : [];

  return (
    <div
      data-testid="demo-improved-replay"
      className="bg-[rgba(245,183,48,0.05)]"
    >
      <audio ref={audioRef} preload="auto" data-testid="demo-improved-audio" />

      {/* Header banner */}
      <div className="px-6 py-2 bg-amber-500/10 border-y border-amber-200">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-700 text-center">
          Improved version
        </p>
      </div>

      <div className="px-6 py-6 space-y-3">
        {visibleSegments.map((segment, idx) => {
          const isCurrent = idx === visibleSegments.length - 1;
          const speaking = isCurrent && isActive && phase !== "paused" &&
            REPLAY_PHASES.has(effectivePhase);
          return (
            <ReplayBubble
              key={segment.id}
              segment={segment}
              personaName={personaName}
              speaking={speaking}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── sub-component ───────────────────────────────────────────────────────────

function ReplayBubble({
  segment,
  personaName,
  speaking,
}: {
  segment: DemoImprovedTurn;
  personaName: string;
  speaking: boolean;
}) {
  const isEmployee = segment.speaker === "employee";
  return (
    <div className={`flex ${isEmployee ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[85%]">
        <p
          className={`text-[11px] mb-1 px-1 ${
            isEmployee
              ? "text-slate-400"
              : "inline-flex items-center gap-1 text-amber-700 font-medium"
          }`}
        >
          {isEmployee ? (
            personaName
          ) : (
            <>
              <Sparkles className="w-3 h-3" aria-hidden />
              <span>Improved</span>
            </>
          )}
        </p>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isEmployee
              ? "bg-slate-100 text-slate-700 rounded-tl-sm"
              : "bg-white text-slate-800 rounded-tr-sm border border-amber-400"
          }`}
        >
          {speaking && (
            <>
              <Volume2
                className="inline-block w-3.5 h-3.5 mr-1.5 align-text-bottom animate-pulse"
                aria-hidden
              />
              <span className="sr-only">Now playing — </span>
            </>
          )}
          {segment.transcript}
        </div>
      </div>
    </div>
  );
}
