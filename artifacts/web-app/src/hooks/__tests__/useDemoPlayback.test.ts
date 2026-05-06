import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  PHASE_DURATIONS,
  demoPlaybackReducer,
  useDemoPlayback,
  type DemoPlaybackState,
} from "../useDemoPlayback";

describe("demoPlaybackReducer — pure transitions", () => {
  const initial: DemoPlaybackState = { phase: "idle", startedAt: 0 };

  it("idle → title_card on START", () => {
    const next = demoPlaybackReducer(initial, { type: "START" });
    expect(next.phase).toBe("title_card");
  });

  it("title_card → playing_employee_1 on SKIP_TITLE", () => {
    const s = demoPlaybackReducer(initial, { type: "START" });
    const next = demoPlaybackReducer(s, { type: "SKIP_TITLE" });
    expect(next.phase).toBe("playing_employee_1");
  });

  it("playing_employee_1 → showing_tip_1 on AUDIO_ENDED", () => {
    const next = demoPlaybackReducer(
      { phase: "playing_employee_1", startedAt: 0 },
      { type: "AUDIO_ENDED" },
    );
    expect(next.phase).toBe("showing_tip_1");
  });

  it("AUDIO_ENDED is a no-op outside audio phases", () => {
    const s: DemoPlaybackState = { phase: "showing_tip_1", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "AUDIO_ENDED" });
    expect(next).toBe(s); // identity — no state change
  });

  it("SUBMIT_ERROR drops back to lead_capture", () => {
    const s: DemoPlaybackState = { phase: "submitting", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "SUBMIT_ERROR" });
    expect(next.phase).toBe("lead_capture");
  });

  it("PAUSE during title_card is a no-op (spec: pause inactive on title)", () => {
    const s: DemoPlaybackState = { phase: "title_card", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "PAUSE", now: 1000 });
    expect(next.phase).toBe("title_card");
  });

  it("PAUSE on a timed phase records the remaining ms", () => {
    const s: DemoPlaybackState = { phase: "showing_tip_1", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "PAUSE", now: 800 });
    expect(next.phase).toBe("paused");
    if (next.phase === "paused") {
      expect(next.resumeTo).toBe("showing_tip_1");
      expect(next.remainingMs).toBe(PHASE_DURATIONS.showing_tip_1 - 800);
    }
  });

  it("PAUSE on an event-driven phase records remainingMs = 0", () => {
    const s: DemoPlaybackState = { phase: "playing_manager_2", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "PAUSE", now: 1234 });
    expect(next.phase).toBe("paused");
    if (next.phase === "paused") {
      expect(next.resumeTo).toBe("playing_manager_2");
      expect(next.remainingMs).toBe(0);
    }
  });

  it("RESUME restores the resume target", () => {
    const paused: DemoPlaybackState = {
      phase: "paused",
      resumeTo: "showing_tip_1",
      remainingMs: 1500,
    };
    const next = demoPlaybackReducer(paused, { type: "RESUME", now: 5000 });
    expect(next.phase).toBe("showing_tip_1");
  });

  it("CLOSE returns to idle from any phase", () => {
    const s: DemoPlaybackState = { phase: "tease_closing", startedAt: 0 };
    const next = demoPlaybackReducer(s, { type: "CLOSE" });
    expect(next.phase).toBe("idle");
  });
});

// ─── hook integration with fake timers ───────────────────────────────────────

describe("useDemoPlayback — timed-phase scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("title_card waits for an explicit Continue click — no auto-dismiss", () => {
    const { result } = renderHook(() => useDemoPlayback());

    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe("title_card");

    // No timer should advance the title card on its own.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.phase).toBe("title_card");

    // Only an explicit click advances.
    act(() => {
      result.current.skipTitleCard();
    });
    expect(result.current.phase).toBe("playing_employee_1");
  });

  it("click-to-skip on title_card jumps straight to playing_employee_1", () => {
    const { result } = renderHook(() => useDemoPlayback());
    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.skipTitleCard();
    });
    expect(result.current.phase).toBe("playing_employee_1");
  });

  it("audio-ended event advances out of playing_*", () => {
    const { result } = renderHook(() => useDemoPlayback());
    act(() => {
      result.current.start();
      result.current.skipTitleCard();
    });
    expect(result.current.phase).toBe("playing_employee_1");

    act(() => {
      result.current.notifyAudioEnded();
    });
    expect(result.current.phase).toBe("showing_tip_1");
  });

  it("full happy-path runs through every phase to lead_capture", () => {
    const { result } = renderHook(() => useDemoPlayback());

    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.skipTitleCard();
    });

    // Turn 1: audio → tip → arc dot
    act(() => {
      result.current.notifyAudioEnded();
    });
    expect(result.current.phase).toBe("showing_tip_1");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.showing_tip_1);
    });
    expect(result.current.phase).toBe("arc_dot_1");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.arc_dot_1);
    });
    expect(result.current.phase).toBe("playing_manager_2");

    // Turn 2
    act(() => {
      result.current.notifyAudioEnded();
    });
    expect(result.current.phase).toBe("showing_tip_2");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.showing_tip_2);
    });
    expect(result.current.phase).toBe("arc_dot_2");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.arc_dot_2);
    });
    expect(result.current.phase).toBe("playing_employee_3");

    // Turn 3
    act(() => {
      result.current.notifyAudioEnded();
    });
    expect(result.current.phase).toBe("showing_tip_3");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.showing_tip_3);
    });
    expect(result.current.phase).toBe("arc_dot_3");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.arc_dot_3);
    });
    expect(result.current.phase).toBe("arc_done");

    // Tease
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.arc_done);
    });
    expect(result.current.phase).toBe("tease_header");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.tease_header);
    });
    expect(result.current.phase).toBe("tease_audio");
    act(() => {
      result.current.notifyAudioEnded();
    });
    expect(result.current.phase).toBe("tease_closing");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.tease_closing);
    });
    expect(result.current.phase).toBe("reveal_copy");
    act(() => {
      vi.advanceTimersByTime(PHASE_DURATIONS.reveal_copy);
    });
    expect(result.current.phase).toBe("lead_capture");
  });

  it("pause freezes the timer; resume restarts only the unspent portion", () => {
    const { result } = renderHook(() => useDemoPlayback());
    act(() => {
      result.current.start();
      result.current.skipTitleCard();
      result.current.notifyAudioEnded(); // → showing_tip_1
    });
    expect(result.current.phase).toBe("showing_tip_1");

    // Burn 1000ms of the 2300ms timer, then pause.
    act(() => {
      vi.advanceTimersByTime(1000);
      result.current.pause();
    });
    expect(result.current.phase).toBe("paused");
    expect(result.current.pausedResumeTo).toBe("showing_tip_1");

    // Time passing while paused should not advance the phase.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.phase).toBe("paused");

    // Resume — there are 1300ms left. 1299ms should still be on showing_tip_1.
    act(() => {
      result.current.resume();
    });
    expect(result.current.phase).toBe("showing_tip_1");

    act(() => {
      vi.advanceTimersByTime(1299);
    });
    expect(result.current.phase).toBe("showing_tip_1");

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.phase).toBe("arc_dot_1");
  });

  it("close cancels pending timers and returns to idle", () => {
    const { result } = renderHook(() => useDemoPlayback());
    act(() => {
      result.current.start();
    });
    expect(result.current.phase).toBe("title_card");

    act(() => {
      result.current.close();
    });
    expect(result.current.phase).toBe("idle");

    // Time passing after close should not pull us out of idle (no timers
    // left to fire — title_card is event-driven and would be paused anyway).
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.phase).toBe("idle");
  });

  it("submit-error path returns to lead_capture so the form can retry", () => {
    const { result } = renderHook(() => useDemoPlayback());

    // Walk to lead_capture via a helper that respects act() boundaries.
    const advance = (ms: number) => {
      act(() => {
        vi.advanceTimersByTime(ms);
      });
    };
    const dispatchEvent = (fn: () => void) => {
      act(() => {
        fn();
      });
    };

    dispatchEvent(() => result.current.start());
    dispatchEvent(() => result.current.skipTitleCard());
    dispatchEvent(() => result.current.notifyAudioEnded()); // → showing_tip_1
    advance(PHASE_DURATIONS.showing_tip_1);
    advance(PHASE_DURATIONS.arc_dot_1);
    dispatchEvent(() => result.current.notifyAudioEnded()); // → showing_tip_2
    advance(PHASE_DURATIONS.showing_tip_2);
    advance(PHASE_DURATIONS.arc_dot_2);
    dispatchEvent(() => result.current.notifyAudioEnded()); // → showing_tip_3
    advance(PHASE_DURATIONS.showing_tip_3);
    advance(PHASE_DURATIONS.arc_dot_3);
    advance(PHASE_DURATIONS.arc_done);
    advance(PHASE_DURATIONS.tease_header);
    dispatchEvent(() => result.current.notifyAudioEnded()); // → tease_closing
    advance(PHASE_DURATIONS.tease_closing);
    advance(PHASE_DURATIONS.reveal_copy);

    expect(result.current.phase).toBe("lead_capture");

    dispatchEvent(() => result.current.submit());
    expect(result.current.phase).toBe("submitting");

    dispatchEvent(() => result.current.submitFailed());
    expect(result.current.phase).toBe("lead_capture");

    dispatchEvent(() => result.current.submit());
    dispatchEvent(() => result.current.submitSucceeded());
    expect(result.current.phase).toBe("complete");
  });
});
