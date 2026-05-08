import { useEffect, useRef } from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * DemoNarrationZone — the staged reveal block shown after a turn's audio
 * finishes (v4.0). Three pieces fade in sequentially via CSS animations:
 *
 *   1. Divider + coaching tip       (delay  200ms)
 *   2. Second divider + narration   (delay 1100ms)
 *   3. Continue button              (delay 1700ms)
 *
 * The CSS keyframe `demo-fade-in` lives in [src/index.css](../index.css)
 * and is opt-out under `prefers-reduced-motion: reduce` (everything
 * appears immediately so screen readers / reduced-motion users still
 * hear the same content).
 *
 * The block is `aria-live="polite"` so the coaching tip + narration are
 * announced when they arrive, but the Continue button is auto-focused so
 * keyboard users don't have to tab through the bubbles to advance.
 */

export interface DemoNarrationZoneProps {
  coachingTip: string;
  narration: string;
  /** 1-indexed turn number used in the small "Turn N coaching" label. */
  turnNumber: number;
  /** Button text — defaults to "Continue →" but the first turn uses "Begin →" elsewhere. */
  continueLabel?: string;
  onContinue: () => void;
}

export function DemoNarrationZone({
  coachingTip,
  narration,
  turnNumber,
  continueLabel = "Continue →",
  onContinue,
}: DemoNarrationZoneProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Move keyboard focus to the Continue button once it's rendered. We use
  // requestAnimationFrame so the call lands after the browser has laid out
  // the new node (the staged fade-ins won't have run yet, but the button is
  // already focusable — it's only its opacity that's animating). Skipped in
  // tests where the element is removed before rAF fires.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      buttonRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-testid="demo-narration-zone"
      aria-live="polite"
      className="space-y-3 pt-2"
    >
      {/* 1. divider + coaching tip */}
      <div
        className="opacity-0 demo-fade-in [animation-delay:200ms]"
        data-testid="demo-narration-tip"
      >
        <div className="border-t border-slate-200 mb-3" />
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            <Lightbulb className="w-3 h-3" aria-hidden />
            <span>Turn {turnNumber} coaching</span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{coachingTip}</p>
        </div>
      </div>

      {/* 2. second divider + narration */}
      <div
        className="opacity-0 demo-fade-in [animation-delay:1100ms]"
        data-testid="demo-narration-text"
      >
        <div className="border-t border-slate-200 mb-3" />
        <p className="text-sm italic text-slate-500 leading-relaxed px-1">
          {narration}
        </p>
      </div>

      {/* 3. Continue button */}
      <div
        className="opacity-0 demo-fade-in [animation-delay:1700ms] pt-1"
        data-testid="demo-narration-continue-wrapper"
      >
        <Button
          ref={buttonRef}
          size="lg"
          onClick={onContinue}
          data-testid="demo-narration-continue"
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
