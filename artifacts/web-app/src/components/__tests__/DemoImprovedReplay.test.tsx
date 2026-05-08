import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { DemoImprovedReplay } from "../DemoImprovedReplay";
import type { DemoImprovedTurn } from "@/data/demoScript";
import type { Phase } from "@/hooks/useDemoPlayback";

const segments: DemoImprovedTurn[] = [
  { id: "e1", speaker: "employee", transcript: "Wait, what?", audioSrc: "/demo/employee-turn-1.mp3" },
  { id: "m2", speaker: "manager", transcript: "Six years is significant.", audioSrc: "/demo/manager-turn-2-improved.mp3" },
  { id: "e3", speaker: "employee", transcript: "Then why me?", audioSrc: "/demo/employee-turn-3-replay.mp3" },
  { id: "m3", speaker: "manager", transcript: "I hear you — and that frustration makes complete sense.", audioSrc: "/demo/manager-turn-3-improved.mp3" },
];

function renderReplay(phase: Phase, overrides: Partial<{ pausedResumeTo: Phase }> = {}) {
  const onSegmentTransition = vi.fn();
  const onFinalSegmentEnded = vi.fn();
  const utils = render(
    <DemoImprovedReplay
      personaName="Alex — Defensive"
      improvedTurns={segments}
      phase={phase}
      pausedResumeTo={overrides.pausedResumeTo ?? null}
      onSegmentTransition={onSegmentTransition}
      onFinalSegmentEnded={onFinalSegmentEnded}
    />,
  );
  return { ...utils, onSegmentTransition, onFinalSegmentEnded };
}

describe("DemoImprovedReplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // jsdom's HTMLMediaElement has no real play/pause/load — stub them so
    // the effect-driven src/play/pause calls don't throw.
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the Improved version banner and the first bubble at e1", () => {
    renderReplay("playing_improved_e1");
    expect(screen.getByText(/improved version/i)).toBeInTheDocument();
    expect(screen.getByText(/wait, what\?/i)).toBeInTheDocument();
    // m2 / e3 / m3 not visible yet
    expect(screen.queryByText(/six years is significant/i)).not.toBeInTheDocument();
  });

  it("reveals subsequent bubbles as the phase advances", () => {
    const { rerender } = renderReplay("playing_improved_e1");
    rerender(
      <DemoImprovedReplay
        personaName="Alex — Defensive"
        improvedTurns={segments}
        phase={"playing_improved_m2"}
        pausedResumeTo={null}
        onSegmentTransition={vi.fn()}
        onFinalSegmentEnded={vi.fn()}
      />,
    );
    expect(screen.getByText(/wait, what\?/i)).toBeInTheDocument();
    expect(screen.getByText(/six years is significant/i)).toBeInTheDocument();
    expect(screen.queryByText(/then why me\?/i)).not.toBeInTheDocument();
  });

  it("renders the manager bubbles with the ✨ Improved label", () => {
    renderReplay("playing_improved_m2");
    // Two "improved" texts in the DOM: the header banner and the bubble
    // label. Both should be present.
    expect(screen.getByText(/improved version/i)).toBeInTheDocument();
    const matches = screen.getAllByText(/^Improved$/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it("on audio ended for a non-final segment, schedules a 2s pause then fires onSegmentTransition", () => {
    const { onSegmentTransition, onFinalSegmentEnded } = renderReplay(
      "playing_improved_e1",
    );
    const audio = screen.getByTestId("demo-improved-audio");

    act(() => {
      audio.dispatchEvent(new Event("ended"));
    });
    // No transition yet — we're inside the 2s silence.
    expect(onSegmentTransition).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onSegmentTransition).toHaveBeenCalledTimes(1);
    expect(onFinalSegmentEnded).not.toHaveBeenCalled();
  });

  it("on audio ended for the final segment (m3), fires onFinalSegmentEnded immediately — no inter-turn pause", () => {
    const { onSegmentTransition, onFinalSegmentEnded } = renderReplay(
      "playing_improved_m3",
    );
    const audio = screen.getByTestId("demo-improved-audio");

    act(() => {
      audio.dispatchEvent(new Event("ended"));
    });
    expect(onFinalSegmentEnded).toHaveBeenCalledTimes(1);
    expect(onSegmentTransition).not.toHaveBeenCalled();
  });

  it("clears the pending inter-turn timer when the phase becomes paused", () => {
    const { onSegmentTransition, rerender } = renderReplay("playing_improved_e1");
    const audio = screen.getByTestId("demo-improved-audio");

    act(() => {
      audio.dispatchEvent(new Event("ended"));
    });

    // Before the 2s elapses, the user pauses.
    rerender(
      <DemoImprovedReplay
        personaName="Alex — Defensive"
        improvedTurns={segments}
        phase={"paused"}
        pausedResumeTo={"playing_improved_e1"}
        onSegmentTransition={onSegmentTransition}
        onFinalSegmentEnded={vi.fn()}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(onSegmentTransition).not.toHaveBeenCalled();
  });
});
