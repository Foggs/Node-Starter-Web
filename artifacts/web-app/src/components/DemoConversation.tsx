import { Volume2 } from "lucide-react";
import { DemoNarrationZone } from "@/components/DemoNarrationZone";
import type { DemoTurn } from "@/data/demoScript";
import type { Phase } from "@/hooks/useDemoPlayback";

/**
 * DemoConversation — owns the 3-turn original conversation view (v4.0).
 * Renders past + current turn bubbles, the speaking indicator on the
 * currently-playing bubble, and (when the phase is `awaiting_continue_*`)
 * the DemoNarrationZone block at the bottom.
 *
 * Auto-scroll lives in DemoModal (the modal owns the scroll container);
 * this component is purely presentational with respect to scrolling.
 *
 * Phase-driven rendering:
 *   - playing_turn_N        → bubble N is rendered + animated speaker icon
 *   - awaiting_continue_N   → bubble N is static, narration zone appears below
 */

export interface DemoConversationProps {
  personaName: string;
  turns: readonly DemoTurn[];
  /** Active phase from useDemoPlayback. Used to decide what to render. */
  phase: Phase;
  /** Resume target when phase === "paused" so the speaking icon stays accurate. */
  pausedResumeTo: Phase | null;
  onContinue: () => void;
}

const PHASE_TURN_INDEX: Partial<Record<Phase, 1 | 2 | 3>> = {
  playing_turn_1: 1,
  awaiting_continue_1: 1,
  playing_turn_2: 2,
  awaiting_continue_2: 2,
  playing_turn_3: 3,
  awaiting_continue_3: 3,
};

const AWAITING_PHASES = new Set<Phase>([
  "awaiting_continue_1",
  "awaiting_continue_2",
  "awaiting_continue_3",
]);

const PLAYING_TURN_PHASES = new Set<Phase>([
  "playing_turn_1",
  "playing_turn_2",
  "playing_turn_3",
]);

export function DemoConversation({
  personaName,
  turns,
  phase,
  pausedResumeTo,
  onContinue,
}: DemoConversationProps) {
  // The "effective" phase collapses paused into its resumeTo so visibility
  // calculations behave the same whether we're paused or actively playing.
  const effectivePhase: Phase = phase === "paused" ? (pausedResumeTo ?? phase) : phase;

  const visibleCount = PHASE_TURN_INDEX[effectivePhase] ?? 0;
  const visibleTurns = turns.slice(0, visibleCount);

  const currentTurn = visibleCount > 0 ? turns[visibleCount - 1] : null;
  const isAwaitingContinue = AWAITING_PHASES.has(effectivePhase);
  const isCurrentSpeaking =
    PLAYING_TURN_PHASES.has(effectivePhase) && phase !== "paused";

  return (
    <div data-testid="demo-conversation" className="px-6 pb-6 space-y-4">
      <div className="space-y-3">
        {visibleTurns.map((turn, idx) => {
          const isCurrent = idx === visibleTurns.length - 1;
          return (
            <TurnBubble
              key={turn.turnIndex}
              turn={turn}
              personaName={personaName}
              speaking={isCurrent && isCurrentSpeaking}
            />
          );
        })}
      </div>

      {isAwaitingContinue && currentTurn && (
        <div data-testid="demo-narration-anchor">
          <DemoNarrationZone
            coachingTip={currentTurn.coachingTip}
            narration={currentTurn.narration}
            turnNumber={currentTurn.turnIndex}
            onContinue={onContinue}
          />
        </div>
      )}
    </div>
  );
}

// ─── sub-components ──────────────────────────────────────────────────────────

function TurnBubble({
  turn,
  personaName,
  speaking,
}: {
  turn: DemoTurn;
  personaName: string;
  speaking: boolean;
}) {
  const isEmployee = turn.speaker === "employee";
  return (
    <div className={`flex ${isEmployee ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[85%]">
        <p className="text-[11px] text-slate-400 mb-1 px-1">
          {isEmployee ? personaName : "You (demo)"}
        </p>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isEmployee
              ? "bg-slate-100 text-slate-700 rounded-tl-sm"
              : "bg-amber-100 text-slate-800 rounded-tr-sm"
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
          {turn.transcript}
        </div>
      </div>
    </div>
  );
}
