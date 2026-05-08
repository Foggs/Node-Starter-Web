import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * DemoSceneSetter — the v4.0 opening card. Sets the scenario / persona /
 * turn-count expectation and waits for an explicit Begin click. Replaces
 * the v3.0 generic title card.
 *
 * Per spec: the modal close (×) is hidden while this card is displayed —
 * that's enforced by the parent (DemoModal), not here.
 */

export interface DemoSceneSetterProps {
  headline: string;
  metadata: { label: string; value: string }[];
  supportingLine: string;
  primaryAction: string;
  onBegin: () => void;
}

export function DemoSceneSetter({
  headline,
  metadata,
  supportingLine,
  primaryAction,
  onBegin,
}: DemoSceneSetterProps) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      buttonRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      data-testid="demo-scene-setter"
      className="flex items-center justify-center px-6 py-8 text-center"
    >
      <div className="max-w-md w-full">
        <h2 className="text-xl font-semibold text-slate-900 mb-6 leading-snug">
          {headline}
        </h2>
        <dl className="text-left mx-auto inline-grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 mb-6 text-[13px] text-slate-500">
          {metadata.map((row) => (
            <div key={row.label} className="contents">
              <dt className="font-medium">{row.label}:</dt>
              <dd className="text-slate-700">{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm italic text-slate-500 leading-relaxed mb-8">
          {supportingLine}
        </p>
        <Button
          ref={buttonRef}
          size="lg"
          onClick={onBegin}
          data-testid="demo-scene-setter-begin"
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
        >
          {primaryAction}
        </Button>
      </div>
    </div>
  );
}
