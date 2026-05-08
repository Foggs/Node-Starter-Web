import { useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { Pause, Play, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DemoSceneSetter } from "@/components/DemoSceneSetter";
import { DemoConversation } from "@/components/DemoConversation";
import { DemoTransitionCard } from "@/components/DemoTransitionCard";
import { DemoImprovedReplay } from "@/components/DemoImprovedReplay";
import { DemoLeadForm } from "@/components/DemoLeadForm";
import { DEMO_SCRIPT } from "@/data/demoScript";
import { useDemoPlayback, type Phase } from "@/hooks/useDemoPlayback";

/**
 * DemoModal (v4.0) — landing-page interactive demo. See
 * [demo-feature-revised.md](../../../../demo-feature-revised.md) for the
 * full spec.
 *
 * The modal is a shell. It owns the playback state machine, the audio
 * element for the three original conversation turns, the close button, and
 * the pause control. Each sub-view (scene-setter, conversation, transition
 * card, improved replay, lead form) is a presentational component selected
 * based on the active phase.
 *
 * The improved replay manages its own audio element (separate from the
 * original-conversation one) because it has its own 2s inter-turn pauses.
 *
 * On submission success the modal closes and navigates to /consent.
 */

export interface DemoModalProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

const PHASE_TO_ORIGINAL_AUDIO: Partial<Record<Phase, string>> = {
  playing_turn_1: DEMO_SCRIPT.turns[0].audioSrc,
  playing_turn_2: DEMO_SCRIPT.turns[1].audioSrc,
  playing_turn_3: DEMO_SCRIPT.turns[2].audioSrc,
};

const PLAYING_ORIGINAL_PHASES = new Set<Phase>([
  "playing_turn_1",
  "playing_turn_2",
  "playing_turn_3",
]);

const PLAYING_IMPROVED_PHASES = new Set<Phase>([
  "playing_improved_e1",
  "playing_improved_m2",
  "playing_improved_e3",
  "playing_improved_m3",
]);

const CONVERSATION_PHASES = new Set<Phase>([
  "playing_turn_1",
  "awaiting_continue_1",
  "playing_turn_2",
  "awaiting_continue_2",
  "playing_turn_3",
  "awaiting_continue_3",
]);

const REPLAY_VIEW_PHASES = new Set<Phase>([
  "playing_improved_e1",
  "playing_improved_m2",
  "playing_improved_e3",
  "playing_improved_m3",
  "post_replay_pause",
]);

const LEAD_FORM_PHASES = new Set<Phase>([
  "lead_capture",
  "submitting",
]);

/**
 * After every phase change, scroll to the modal's bottom so newly-appended
 * content (the next bubble, the narration zone, the lead form) is visible.
 *
 * Phases that mount fade-in content (the `awaiting_continue_*` narration zone)
 * need a *second* scroll once the Continue button has finished animating in
 * — its CSS animation-delay is 1700 ms + 350 ms duration. We schedule a
 * follow-up scroll at this delay so the button lands at the bottom of view
 * even on short viewports where it would otherwise sit below the fold.
 */
const NARRATION_FADE_IN_TOTAL_MS = 2050;

export function DemoModal({ open, onOpenChange }: DemoModalProps) {
  const [, navigate] = useLocation();
  const playback = useDemoPlayback();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const deferredScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedRef = useRef(false);

  // Resolve the effective phase once: paused collapses to its resumeTo so
  // visibility / audio decisions stay consistent.
  const effectivePhase: Phase = useMemo(
    () => (playback.phase === "paused" ? (playback.pausedResumeTo ?? "idle") : playback.phase),
    [playback.phase, playback.pausedResumeTo],
  );
  const isPaused = playback.phase === "paused";

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

  // ── audio playback for the 3 original conversation turns ─────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const audioSrc = PHASE_TO_ORIGINAL_AUDIO[effectivePhase];
    if (!audioSrc) {
      audio.pause();
      return;
    }
    if (!audio.src.endsWith(audioSrc)) {
      audio.src = audioSrc;
    }
    if (isPaused) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [effectivePhase, isPaused]);

  // ── audio "ended" → notify state machine ─────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handler = () => {
      if (PLAYING_ORIGINAL_PHASES.has(effectivePhase)) {
        playback.notifyAudioEnded();
      }
    };
    audio.addEventListener("ended", handler);
    return () => audio.removeEventListener("ended", handler);
  }, [playback, effectivePhase]);

  // ── auto-scroll to bottom on every phase change ──────────────────────────
  // The user's intent is explicit: scroll to the bottom after every turn.
  // For phases that mount staggered fade-in content (the narration zone),
  // we schedule a second scroll once that content has finished animating.
  // Suspended while paused — don't yank the user mid-read.
  useEffect(() => {
    if (deferredScrollTimerRef.current !== null) {
      clearTimeout(deferredScrollTimerRef.current);
      deferredScrollTimerRef.current = null;
    }
    if (isPaused) return;

    function scrollToBottom() {
      const el = scrollerRef.current;
      if (!el) return;
      const reduceMotion =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }

    // Immediate scroll: catches new conversation bubbles, the transition
    // card, the scene-setter, and each new improved-replay bubble.
    scrollToBottom();

    // Deferred scroll: re-runs once the narration zone's Continue button
    // has finished its CSS fade-in chain.
    if (
      effectivePhase === "awaiting_continue_1" ||
      effectivePhase === "awaiting_continue_2" ||
      effectivePhase === "awaiting_continue_3"
    ) {
      deferredScrollTimerRef.current = setTimeout(() => {
        deferredScrollTimerRef.current = null;
        scrollToBottom();
      }, NARRATION_FADE_IN_TOTAL_MS);
    }

    return () => {
      if (deferredScrollTimerRef.current !== null) {
        clearTimeout(deferredScrollTimerRef.current);
        deferredScrollTimerRef.current = null;
      }
    };
  }, [effectivePhase, isPaused]);

  // ── visibility flags ─────────────────────────────────────────────────────
  const showSceneSetter = effectivePhase === "scene_setter";
  const showConversation = CONVERSATION_PHASES.has(effectivePhase);
  const showTransitionCard = effectivePhase === "transition_card";
  const showReplay = REPLAY_VIEW_PHASES.has(effectivePhase);
  const showLeadForm = LEAD_FORM_PHASES.has(effectivePhase);

  // Pause is only meaningful when audio is actually playing.
  const isPlayingPhase =
    PLAYING_ORIGINAL_PHASES.has(effectivePhase) ||
    PLAYING_IMPROVED_PHASES.has(effectivePhase);
  const showPauseControl = isPlayingPhase || isPaused;

  // The close (×) button is hidden during the scene-setter (spec) and once
  // the modal is auto-closing on complete.
  const showCloseButton = !showSceneSetter && playback.phase !== "complete";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={scrollerRef}
        className="sm:max-w-2xl min-h-[600px] max-h-[90vh] overflow-y-auto p-0 [&>button]:hidden"
      >
        <DialogTitle className="sr-only">Exit Coach demo</DialogTitle>
        <DialogDescription className="sr-only">
          A scripted preview of an Exit Coach practice session.
        </DialogDescription>

        {/* Hidden audio element for the original conversation turns */}
        <audio ref={audioRef} preload="auto" data-testid="demo-original-audio" />

        {/* Brand header */}
        <div className="flex items-center justify-center px-6 pt-6 pb-2">
          <img
            src="/exit-coach-logo.png"
            alt="Exit Coach"
            className="h-[140px] sm:h-[170px] w-auto"
          />
        </div>

        {/* Top-right close — hidden on scene-setter per spec */}
        {showCloseButton && (
          <button
            aria-label="Close demo"
            onClick={() => onOpenChange(false)}
            data-testid="demo-close-button"
            className="absolute top-3 right-3 z-50 rounded-md p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {showSceneSetter && (
          <DemoSceneSetter
            headline={DEMO_SCRIPT.sceneSetter.headline}
            metadata={DEMO_SCRIPT.sceneSetter.metadata}
            supportingLine={DEMO_SCRIPT.sceneSetter.supportingLine}
            primaryAction={DEMO_SCRIPT.sceneSetter.primaryAction}
            onBegin={playback.notifyContinue}
          />
        )}

        {showConversation && (
          <DemoConversation
            personaName={DEMO_SCRIPT.personaName}
            turns={DEMO_SCRIPT.turns}
            phase={playback.phase}
            pausedResumeTo={playback.pausedResumeTo}
            onContinue={playback.notifyContinue}
          />
        )}

        {showTransitionCard && (
          <DemoTransitionCard
            headline={DEMO_SCRIPT.transitionCard.headline}
            supportingLine={DEMO_SCRIPT.transitionCard.supportingLine}
            primaryAction={DEMO_SCRIPT.transitionCard.primaryAction}
            onShowMe={playback.notifyContinue}
          />
        )}

        {showReplay && (
          <DemoImprovedReplay
            personaName={DEMO_SCRIPT.personaName}
            improvedTurns={DEMO_SCRIPT.improvedTurns}
            phase={playback.phase}
            pausedResumeTo={playback.pausedResumeTo}
            onSegmentTransition={playback.notifyAudioEnded}
            onFinalSegmentEnded={playback.notifyAudioEnded}
          />
        )}

        {showLeadForm && (
          <div className="px-6 py-6">
            <DemoLeadForm
              onSuccess={() => playback.submitSucceeded()}
              onSubmittingChange={(submitting) => {
                if (submitting) playback.submit();
                else if (playback.phase === "submitting") playback.submitFailed();
              }}
            />
          </div>
        )}

        {/* Pause control — only visible during active playback */}
        {showPauseControl && (
          <div className="border-t border-slate-100 px-6 py-3 flex items-center justify-center">
            <Button
              variant="outline"
              size="sm"
              aria-pressed={isPaused}
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
