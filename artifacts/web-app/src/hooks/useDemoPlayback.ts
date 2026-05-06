import { useCallback, useEffect, useReducer, useRef } from "react";

/**
 * useDemoPlayback — orchestrates the timed sequence inside the landing
 * page demo modal.
 *
 * The state machine is a discriminated union of named phases. Phases that
 * auto-advance after a fixed duration are listed in `PHASE_DURATIONS`; the
 * single internal effect schedules a timer for whichever timed phase is
 * currently active. Phases that wait on an external signal (audio playback
 * ending, lead form submitting) advance only when the consumer dispatches
 * the matching action.
 *
 * Pause is modelled as a dedicated `paused` state that records the phase
 * to resume into and the millisecond budget remaining for that phase, so
 * resume restarts only the unspent portion of the timer.
 *
 * Source-of-truth timing table: demo-feature.md §"Playback Timing Sequence".
 */

// ─── phase model ─────────────────────────────────────────────────────────────

/** Phases that auto-advance after a fixed duration. */
export type TimedPhase =
  | "showing_tip_1"
  | "arc_dot_1"
  | "showing_tip_2"
  | "arc_dot_2"
  | "showing_tip_3"
  | "arc_dot_3"
  | "arc_done"
  | "tease_header"
  | "tease_closing"
  | "reveal_copy";

/**
 * Phases that wait on an external event (user click, audio end, form submit).
 * `title_card` waits for an explicit Continue click — no auto-dismiss timer.
 */
export type EventDrivenPhase =
  | "title_card"
  | "playing_employee_1"
  | "playing_manager_2"
  | "playing_employee_3"
  | "tease_audio"
  | "lead_capture"
  | "submitting";

export type Phase = "idle" | "complete" | "paused" | TimedPhase | EventDrivenPhase;

/**
 * Durations in ms for each timed phase. Sum + audio runtime ≈ 95s,
 * matching the spec total. (title_card is event-driven now — user clicks
 * Continue when ready.)
 *
 *  - `showing_tip_*`  2300ms =  800 gap + 1500 display
 *  - `arc_dot_*`       800ms (hold before next turn or tease)
 *  - `arc_done`        600ms (gap between arc-3 and tease slide-in)
 *  - `tease_header`    400ms (header fade before improved audio plays)
 *  - `tease_closing`  1500ms ("In a real session, that voice would be yours.")
 *  - `reveal_copy`    1200ms = 400 fade-in + 800 hold
 */
export const PHASE_DURATIONS: Record<TimedPhase, number> = {
  showing_tip_1: 2300,
  arc_dot_1: 800,
  showing_tip_2: 2300,
  arc_dot_2: 800,
  showing_tip_3: 2300,
  arc_dot_3: 800,
  arc_done: 600,
  tease_header: 400,
  tease_closing: 1500,
  reveal_copy: 1200,
};

// ─── state ───────────────────────────────────────────────────────────────────

interface ActivePhaseState {
  phase: Exclude<Phase, "paused">;
  /** When the current timed phase started (Date.now()). 0 for non-timed phases. */
  startedAt: number;
}

interface PausedPhaseState {
  phase: "paused";
  /** Phase to return to on resume. */
  resumeTo: Exclude<Phase, "paused">;
  /**
   * Remaining ms in `resumeTo`'s timer when paused. 0 for event-driven
   * phases (no timer to resume).
   */
  remainingMs: number;
}

export type DemoPlaybackState = ActivePhaseState | PausedPhaseState;

// ─── actions ─────────────────────────────────────────────────────────────────

export type DemoPlaybackAction =
  | { type: "START" }
  | { type: "TIMER_ELAPSED" }
  | { type: "AUDIO_ENDED" }
  | { type: "SKIP_TITLE" }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_OK" }
  | { type: "SUBMIT_ERROR" }
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number }
  | { type: "CLOSE" };

// ─── transitions ─────────────────────────────────────────────────────────────

/**
 * The canonical forward order. Indexing into this array gives the next phase
 * after `TIMER_ELAPSED` for timed phases and after `AUDIO_ENDED` / `SUBMIT_OK`
 * for event-driven phases.
 *
 * Typed as `Exclude<Phase, "paused">[]` to keep `indexOf` callable with any
 * non-paused phase, including the unreachable "idle" branch (which falls
 * through the -1 guard to "complete").
 */
const FORWARD: Exclude<Phase, "paused">[] = [
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

function nextPhase(current: Exclude<Phase, "paused">): Exclude<Phase, "paused"> {
  const idx = FORWARD.indexOf(current);
  if (idx === -1 || idx === FORWARD.length - 1) return "complete";
  return FORWARD[idx + 1]!;
}

function isTimedPhase(p: Phase): p is TimedPhase {
  return p in PHASE_DURATIONS;
}

const initialState: ActivePhaseState = { phase: "idle", startedAt: 0 };

export function demoPlaybackReducer(
  state: DemoPlaybackState,
  action: DemoPlaybackAction,
): DemoPlaybackState {
  switch (action.type) {
    case "START": {
      if (state.phase !== "idle") return state;
      return { phase: "title_card", startedAt: Date.now() };
    }

    case "SKIP_TITLE": {
      if (state.phase !== "title_card") return state;
      return { phase: nextPhase("title_card"), startedAt: Date.now() };
    }

    case "TIMER_ELAPSED": {
      if (state.phase === "paused") return state;
      if (!isTimedPhase(state.phase)) return state;
      return { phase: nextPhase(state.phase), startedAt: Date.now() };
    }

    case "AUDIO_ENDED": {
      if (state.phase === "paused") return state;
      const audioPhases: Phase[] = [
        "playing_employee_1",
        "playing_manager_2",
        "playing_employee_3",
        "tease_audio",
      ];
      if (!audioPhases.includes(state.phase)) return state;
      return { phase: nextPhase(state.phase), startedAt: Date.now() };
    }

    case "SUBMIT": {
      if (state.phase !== "lead_capture") return state;
      return { phase: "submitting", startedAt: Date.now() };
    }

    case "SUBMIT_OK": {
      if (state.phase !== "submitting") return state;
      return { phase: "complete", startedAt: Date.now() };
    }

    case "SUBMIT_ERROR": {
      // Drop back to lead_capture so the form can show an error and retry.
      if (state.phase !== "submitting") return state;
      return { phase: "lead_capture", startedAt: Date.now() };
    }

    case "PAUSE": {
      if (state.phase === "paused") return state;
      if (state.phase === "idle" || state.phase === "complete") return state;
      // Title card has no pause button per spec — do nothing if asked.
      if (state.phase === "title_card") return state;

      const remainingMs = isTimedPhase(state.phase)
        ? Math.max(0, PHASE_DURATIONS[state.phase] - (action.now - state.startedAt))
        : 0;
      return { phase: "paused", resumeTo: state.phase, remainingMs };
    }

    case "RESUME": {
      if (state.phase !== "paused") return state;
      // Restart the timer for the resumed phase by setting startedAt to a
      // value such that (now - startedAt) === (duration - remainingMs).
      // For event-driven phases, startedAt is irrelevant.
      const target = state.resumeTo;
      if (isTimedPhase(target)) {
        const elapsed = PHASE_DURATIONS[target] - state.remainingMs;
        return { phase: target, startedAt: action.now - elapsed };
      }
      return { phase: target, startedAt: action.now };
    }

    case "CLOSE": {
      return initialState;
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ─── hook ────────────────────────────────────────────────────────────────────

export interface UseDemoPlaybackReturn {
  /** Current phase name. `paused` collapses every paused-from phase. */
  phase: Phase;
  /** When paused, the phase that will be resumed into. Otherwise null. */
  pausedResumeTo: Exclude<Phase, "paused"> | null;
  /** Begin the demo (idle → title_card). */
  start: () => void;
  /** User clicked Continue on the title card → start playback. */
  skipTitleCard: () => void;
  /** Tell the machine the audio for the current `playing_*` / `tease_audio` phase finished. */
  notifyAudioEnded: () => void;
  /** Submit the lead form (lead_capture → submitting). */
  submit: () => void;
  /** Lead form submission resolved successfully. */
  submitSucceeded: () => void;
  /** Lead form submission failed; UI will fall back to lead_capture. */
  submitFailed: () => void;
  /** Pause whatever's running. No-op during title_card / idle / complete. */
  pause: () => void;
  /** Resume from pause. */
  resume: () => void;
  /** Cancel everything; return to idle. */
  close: () => void;
}

export function useDemoPlayback(): UseDemoPlaybackReturn {
  const [state, dispatch] = useReducer(demoPlaybackReducer, initialState);

  // ── timed-phase scheduler ─────────────────────────────────────────────────
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Always cancel a pending timer when the phase changes — paused, closed,
    // or otherwise.
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (state.phase === "paused") return;
    if (!isTimedPhase(state.phase)) return;

    const elapsed = Date.now() - state.startedAt;
    const remaining = Math.max(0, PHASE_DURATIONS[state.phase] - elapsed);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      dispatch({ type: "TIMER_ELAPSED" });
    }, remaining);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  const start = useCallback(() => dispatch({ type: "START" }), []);
  const skipTitleCard = useCallback(() => dispatch({ type: "SKIP_TITLE" }), []);
  const notifyAudioEnded = useCallback(
    () => dispatch({ type: "AUDIO_ENDED" }),
    [],
  );
  const submit = useCallback(() => dispatch({ type: "SUBMIT" }), []);
  const submitSucceeded = useCallback(() => dispatch({ type: "SUBMIT_OK" }), []);
  const submitFailed = useCallback(() => dispatch({ type: "SUBMIT_ERROR" }), []);
  const pause = useCallback(
    () => dispatch({ type: "PAUSE", now: Date.now() }),
    [],
  );
  const resume = useCallback(
    () => dispatch({ type: "RESUME", now: Date.now() }),
    [],
  );
  const close = useCallback(() => dispatch({ type: "CLOSE" }), []);

  return {
    phase: state.phase,
    pausedResumeTo: state.phase === "paused" ? state.resumeTo : null,
    start,
    skipTitleCard,
    notifyAudioEnded,
    submit,
    submitSucceeded,
    submitFailed,
    pause,
    resume,
    close,
  };
}
