import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  PHASE_DURATIONS,
  demoPlaybackReducer,
  useDemoPlayback,
  type DemoPlaybackState,
} from "../useDemoPlayback";

// ─── pure reducer transitions ────────────────────────────────────────────────

describe("demoPlaybackReducer — pure transitions", () => {
  const initial: DemoPlaybackState = { phase: "idle", startedAt: 0 };

  it("idle → scene_setter on START", () => {
    const next = demoPlaybackReducer(initial, { type: "START" });
    expect(next.phase).toBe("scene_setter");
  });

  it("scene_setter → playing_turn_1 on CONTINUE (Begin click)", () => {
    const s = demoPlaybackReducer(initial, { type: "START" });
    const next = demoPlaybackReducer(s, { type: "CONTINUE" });
    expect(next.phase).toBe("playing_turn_1");
  });

  it("playing_turn_1 → awaiting_continue_1 on AUDIO_ENDED", () => {
    const next = demoPlaybackReducer(
      { phase: "playing_turn_1", startedAt: 0 },
      { type: "AUDIO_ENDED" },
    );
    expect(next.phase).toBe("awaiting_continue_1");
  });

  it("awaiting_continue_1 → playing_turn_2 on CONTINUE", () => {
    const next = demoPlaybackReducer(
      { phase: "awaiting_continue_1", startedAt: 0 },
      { type: "CONTINUE" },
    );
    expect(next.phase).toBe("playing_turn_2");
  });

  it("awaiting_continue_3 → transition_card on CONTINUE", () => {
    const next = demoPlaybackReducer(
      { phase: "awaiting_continue_3", startedAt: 0 },
      { type: "CONTINUE" },
    );
    expect(next.phase).toBe("transition_card");
  });

  it("transition_card → playing_improved_e1 on CONTINUE (Show me click)", () => {
    const next = demoPlaybackReducer(
      { phase: "transition_card", startedAt: 0 },
      { type: "CONTINUE" },
    );
    expect(next.phase).toBe("playing_improved_e1");
  });

  it("improved replay walks e1 → m2 → e3 → m3 → post_replay_pause on AUDIO_ENDED", () => {
    let s: DemoPlaybackState = { phase: "playing_improved_e1", startedAt: 0 };
    s = demoPlaybackReducer(s, { type: "AUDIO_ENDED" });
    expect(s.phase).toBe("playing_improved_m2");
    s = demoPlaybackReducer(s, { type: "AUDIO_ENDED" });
    expect(s.phase).toBe("playing_improved_e3");
    s = demoPlaybackReducer(s, { type: "AUDIO_ENDED" });
    expect(s.phase).toBe("playing_improved_m3");
    s = demoPlaybackReducer(s, { type: "AUDIO_ENDED" });
    expect(s.phase).toBe("post_replay_pause");
  });

  it("post_replay_pause → lead_capture on TIMER_ELAPSED", () => {
    const next = demoPlaybackReducer(
      { phase: "post_replay_pause", startedAt: 0 },
      { type: "TIMER_ELAPSED" },
    );
    expect(next.phase).toBe("lead_capture");
  });

  it("AUDIO_ENDED is a no-op on awaiting_continue / cards / lead phases", () => {
    const offPhases: DemoPlaybackState[] = [
      { phase: "scene_setter", startedAt: 0 },
      { phase: "awaiting_continue_2", startedAt: 0 },
      { phase: "transition_card", startedAt: 0 },
      { phase: "lead_capture", startedAt: 0 },
    ];
    for (const s of offPhases) {
      const next = demoPlaybackReducer(s, { type: "AUDIO_ENDED" });
      expect(next).toBe(s);
    }
  });

  it("CONTINUE is a no-op on playing_* phases (audio runs to completion)", () => {
    const s: DemoPlaybackState = { phase: "playing_turn_2", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "CONTINUE" });
    expect(next).toBe(s);
  });

  it("SUBMIT_ERROR drops back to lead_capture", () => {
    const s: DemoPlaybackState = { phase: "submitting", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "SUBMIT_ERROR" });
    expect(next.phase).toBe("lead_capture");
  });

  it("PAUSE on scene_setter / awaiting_continue / cards is a no-op", () => {
    const noPause: DemoPlaybackState[] = [
      { phase: "scene_setter", startedAt: 0 },
      { phase: "awaiting_continue_1", startedAt: 0 },
      { phase: "transition_card", startedAt: 0 },
      { phase: "lead_capture", startedAt: 0 },
    ];
    for (const s of noPause) {
      const next = demoPlaybackReducer(s, { type: "PAUSE", now: 1000 });
      expect(next.phase).toBe(s.phase);
    }
  });

  it("PAUSE on a playing_* phase records remainingMs = 0", () => {
    const s: DemoPlaybackState = { phase: "playing_turn_2", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "PAUSE", now: 1234 });
    expect(next.phase).toBe("paused");
    if (next.phase === "paused") {
      expect(next.resumeTo).toBe("playing_turn_2");
      expect(next.remainingMs).toBe(0);
    }
  });

  it("PAUSE on post_replay_pause records remaining ms (the only timed phase)", () => {
    const s: DemoPlaybackState = { phase: "post_replay_pause", startedAt: 0 };
    // post_replay_pause is timed but PAUSE is gated to playing_* — confirm
    // it stays put even though it is a timed phase.
    const next = demoPlaybackReducer(s, { type: "PAUSE", now: 500 });
    expect(next.phase).toBe("post_replay_pause");
  });

  it("RESUME restores the resume target", () => {
    const paused: DemoPlaybackState = {
      phase: "paused",
      resumeTo: "playing_improved_m3",
      remainingMs: 0,
    };
    const next = demoPlaybackReducer(paused, { type: "RESUME", now: 5000 });
    expect(next.phase).toBe("playing_improved_m3");
  });

  it("CLOSE returns to idle from any phase", () => {
    const s: DemoPlaybackState = { phase: "playing_improved_e3", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "CLOSE" });
    expect(next.phase).toBe("idle");
  });
});

// ─── hook integration with fake timers ───────────────────────────────────────

describe("useDemoPlayback — hook scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("scene_setter waits for an explicit Begin click — no auto-dismiss", () => {
    const { result } = renderHook(() => useDemoPlayback());

    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe("scene_setter");

    // No timer should advance the scene-setter on its own.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.phase).toBe("scene_setter");

    act(() => {
      result.current.notifyContinue();
    });
    expect(result.current.phase).toBe("playing_turn_1");
  });

  it("audio-ended advances out of playing_turn_1 into awaiting_continue_1", () => {
    const { result } = renderHook(() => useDemoPlayback());
    act(() => {
      result.current.start();
      result.current.notifyContinue();
    });
    expect(result.current.phase).toBe("playing_turn_1");

    act(() => {
      result.current.notifyAudioEnded();
    });
    expect(result.current.phase).toBe("awaiting_continue_1");

    // No timer auto-advances out of awaiting_continue_1.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.phase).toBe("awaiting_continue_1");
  });

  it("full happy-path: every click + audio-ended, walks to lead_capture", () => {
    const { result } = renderHook(() => useDemoPlayback());

    act(() => result.current.start());
    expect(result.current.phase).toBe("scene_setter");

    act(() => result.current.notifyContinue()); // Begin →
    expect(result.current.phase).toBe("playing_turn_1");

    act(() => result.current.notifyAudioEnded());
    expect(result.current.phase).toBe("awaiting_continue_1");

    act(() => result.current.notifyContinue()); // Continue →
    expect(result.current.phase).toBe("playing_turn_2");

    act(() => result.current.notifyAudioEnded());
    expect(result.current.phase).toBe("awaiting_continue_2");

    act(() => result.current.notifyContinue());
    expect(result.current.phase).toBe("playing_turn_3");

    act(() => result.current.notifyAudioEnded());
    expect(result.current.phase).toBe("awaiting_continue_3");

    act(() => result.current.notifyContinue());
    expect(result.current.phase).toBe("transition_card");

    act(() => result.current.notifyContinue()); // Show me →
    expect(result.current.phase).toBe("playing_improved_e1");

    act(() => result.current.notifyAudioEnded());
    expect(result.current.phase).toBe("playing_improved_m2");

    act(() => result.current.notifyAudioEnded());
    expect(result.current.phase).toBe("playing_improved_e3");

    act(() => result.current.notifyAudioEnded());
    expect(result.current.phase).toBe("playing_improved_m3");

    act(() => result.current.notifyAudioEnded());
    expect(result.current.phase).toBe("post_replay_pause");

    // The only timer in the entire flow.
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.post_replay_pause);
    });
    expect(result.current.phase).toBe("lead_capture");
  });

  it("pause during a playing_* phase freezes the machine; resume restores it", () => {
    const { result } = renderHook(() => useDemoPlayback());
    act(() => {
      result.current.start();
      result.current.notifyContinue();
    });
    expect(result.current.phase).toBe("playing_turn_1");

    act(() => result.current.pause());
    expect(result.current.phase).toBe("paused");
    expect(result.current.pausedResumeTo).toBe("playing_turn_1");

    // Time passing while paused must not advance the phase.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(result.current.phase).toBe("paused");

    act(() => result.current.resume());
    expect(result.current.phase).toBe("playing_turn_1");
  });

  it("pause is a no-op on awaiting_continue_* (nothing is in motion)", () => {
    const { result } = renderHook(() => useDemoPlayback());
    act(() => {
      result.current.start();
      result.current.notifyContinue();
      result.current.notifyAudioEnded();
    });
    expect(result.current.phase).toBe("awaiting_continue_1");

    act(() => result.current.pause());
    expect(result.current.phase).toBe("awaiting_continue_1");
  });

  it("close cancels pending timers and returns to idle", () => {
    const { result } = renderHook(() => useDemoPlayback());
    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe("scene_setter");

    act(() => result.current.close());
    expect(result.current.phase).toBe("idle");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.phase).toBe("idle");
  });

  it("submit-error path returns to lead_capture so the form can retry", () => {
    const { result } = renderHook(() => useDemoPlayback());

    const click = (fn: () => void) => act(() => fn());
    click(() => result.current.start());
    click(() => result.current.notifyContinue()); // scene → t1
    click(() => result.current.notifyAudioEnded()); // t1 → awaiting_continue_1
    click(() => result.current.notifyContinue());
    click(() => result.current.notifyAudioEnded());
    click(() => result.current.notifyContinue());
    click(() => result.current.notifyAudioEnded());
    click(() => result.current.notifyContinue()); // → transition_card
    click(() => result.current.notifyContinue()); // → playing_improved_e1
    click(() => result.current.notifyAudioEnded());
    click(() => result.current.notifyAudioEnded());
    click(() => result.current.notifyAudioEnded());
    click(() => result.current.notifyAudioEnded()); // → post_replay_pause
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.post_replay_pause);
    });
    expect(result.current.phase).toBe("lead_capture");

    click(() => result.current.submit());
    expect(result.current.phase).toBe("submitting");

    click(() => result.current.submitFailed());
    expect(result.current.phase).toBe("lead_capture");

    click(() => result.current.submit());
    click(() => result.current.submitSucceeded());
    expect(result.current.phase).toBe("complete");
  });
});
