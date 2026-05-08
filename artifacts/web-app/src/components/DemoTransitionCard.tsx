import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * DemoTransitionCard — shown after Turn 3 "Continue →" is clicked. Gives
 * the user a moment to commit to the comparison before the improved replay
 * begins. Waits for an explicit Show me click.
 */

export interface DemoTransitionCardProps {
  headline: string;
  supportingLine: string;
  primaryAction: string;
  onShowMe: () => void;
}

export function DemoTransitionCard({
  headline,
  supportingLine,
  primaryAction,
  onShowMe,
}: DemoTransitionCardProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      buttonRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-testid="demo-transition-card"
      className="flex items-center justify-center px-6 py-12 text-center"
    >
      <div className="max-w-md w-full">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 leading-snug">
          {headline}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-8">
          {supportingLine}
        </p>
        <Button
          ref={buttonRef}
          size="lg"
          onClick={onShowMe}
          data-testid="demo-transition-show-me"
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
        >
          {primaryAction}
        </Button>
      </div>
    </div>
  );
}
