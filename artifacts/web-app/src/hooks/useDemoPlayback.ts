import { useCallback, useEffect, useReducer, useRef } from "react";

/**
 * useDemoPlayback — orchestrates the user-paced demo modal sequence (v4.0).
 *
 * The state machine is a discriminated union of named phases. Almost every
 * phase is **click-gated** (waits for an explicit user action). The single
 * exception is `post_replay_pause`, a 1.5s breath between the final improved
 * turn and the lead-capture form sliding in.
 *
 * Three event-shaped advances drive the flow:
 *   - `notifyContinue()` for scene-setter / awaiting_continue_* / transition_card
 *     (Begin → / Continue → / Show me → clicks).
 *   - `notifyAudioEnded()` for `playing_*` phases (audio element fired `ended`).
 *   - `submit*()` callbacks for the lead form.
 *
 * Pause is modelled as a dedicated `paused` state. Per spec, pause is only
 * meaningful during `playing_*` phases — on cards / awaiting_continue / lead
 * form, nothing is in motion to pause.
 *
 * Source-of-truth: demo-feature-revised.md §"useDemoPlayback State Machine".
 */

// ─── phase model ─────────────────────────────────────────────────────────────

/** The only timed phase in the v4.0 flow — 1.5s breath after the improved replay. */
export type TimedPhase = "post_replay_pause";

/** Phases that wait on an external event (user click, audio ended, form submit). */
export type EventDrivenPhase =
  | "scene_setter"
  | "playing_turn_1"
  | "awaiting_continue_1"
  | "playing_turn_2"
  | "awaiting_continue_2"
  | "playing_turn_3"
  | "awaiting_continue_3"
  | "transition_card"
  | "playing_improved_e1"
  | "playing_improved_m2"
  | "playing_improved_e3"
  | "playing_improved_m3"
  | "lead_capture"
  | "submitting";

export type Phase = "idle" | "complete" | "paused" | TimedPhase | EventDrivenPhase;

/** Duration in ms for each timed phase. v4.0 has only one. */
export const PHASE_DURATIONS: Record<TimedPhase, number> = {
  post_replay_pause: 1500,
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
   * phases (no timer to resume — only audio playback resumes).
   */
  remainingMs: number;
}

export type DemoPlaybackState = ActivePhaseState | PausedPhaseState;

// ─── actions ─────────────────────────────────────────────────────────────────

export type DemoPlaybackAction =
  | { type: "START" }
  | { type: "TIMER_ELAPSED" }
  | { type: "AUDIO_ENDED" }
  | { type: "CONTINUE" }
  | { type: "SUBMIT" }
  | { type: "SUBMIT_OK" }
  | { type: "SUBMIT_ERROR" }
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number }
  | { type: "CLOSE" };

// ─── transitions ─────────────────────────────────────────────────────────────

/**
 * The canonical forward order. Indexing into this array gives the next phase
 * after the matching dispatch (CONTINUE for cards / awaiting_continue,
 * AUDIO_ENDED for playing_*, TIMER_ELAPSED for post_replay_pause).
 */
const FORWARD: Exclude<Phase, "paused">[] = [
  "scene_setter",
  "playing_turn_1",
  "awaiting_continue_1",
  "playing_turn_2",
  "awaiting_continue_2",
  "playing_turn_3",
  "awaiting_continue_3",
  "transition_card",
  "playing_improved_e1",
  "playing_improved_m2",
  "playing_improved_e3",
  "playing_improved_m3",
  "post_replay_pause",
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
  return p === "post_replay_pause";
}

const PLAYING_PHASES = new Set<Phase>([
  "playing_turn_1",
  "playing_turn_2",
  "playing_turn_3",
  "playing_improved_e1",
  "playing_improved_m2",
  "playing_improved_e3",
  "playing_improved_m3",
]);

const CONTINUE_PHASES = new Set<Phase>([
  "scene_setter",
  "awaiting_continue_1",
  "awaiting_continue_2",
  "awaiting_continue_3",
  "transition_card",
]);

const initialState: ActivePhaseState = { phase: "idle", startedAt: 0 };

export function demoPlaybackReducer(
  state: DemoPlaybackState,
  action: DemoPlaybackAction,
): DemoPlaybackState {
  switch (action.type) {
    case "START": {
      if (state.phase !== "idle") return state;
      return { phase: "scene_setter", startedAt: Date.now() };
    }

    case "CONTINUE": {
      if (state.phase === "paused") return state;
      if (!CONTINUE_PHASES.has(state.phase)) return state;
      return { phase: nextPhase(state.phase), startedAt: Date.now() };
    }

    case "TIMER_ELAPSED": {
      if (state.phase === "paused") return state;
      if (!isTimedPhase(state.phase)) return state;
      return { phase: nextPhase(state.phase), startedAt: Date.now() };
    }

    case "AUDIO_ENDED": {
      if (state.phase === "paused") return state;
      if (!PLAYING_PHASES.has(state.phase)) return state;
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
      if (state.phase !== "submitting") return state;
      return { phase: "lead_capture", startedAt: Date.now() };
    }

    case "PAUSE": {
      if (state.phase === "paused") return state;
      // Per spec: pause only valid during active audio playback. On cards,
      // awaiting_continue, the lead form, idle, complete — pause is a no-op.
      if (!PLAYING_PHASES.has(state.phase)) return state;

      const remainingMs = isTimedPhase(state.phase)
        ? Math.max(0, PHASE_DURATIONS[state.phase] - (action.now - state.startedAt))
        : 0;
      return { phase: "paused", resumeTo: state.phase, remainingMs };
    }

    case "RESUME": {
      if (state.phase !== "paused") return state;
      const target = state.resumeTo;
      if (isTimedPhase(target)) {
        // Restart the timer's remaining slice by setting startedAt back so
        // (now - startedAt) === (duration - remainingMs).
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
  /** Begin the demo (idle → scene_setter). */
  start: () => void;
  /** User clicked Begin / Continue / Show me on a card or awaiting_continue. */
  notifyContinue: () => void;
  /** Audio finished for the current `playing_*` phase. */
  notifyAudioEnded: () => void;
  /** Submit the lead form (lead_capture → submitting). */
  submit: () => void;
  /** Lead form submission resolved successfully. */
  submitSucceeded: () => void;
  /** Lead form submission failed; UI falls back to lead_capture. */
  submitFailed: () => void;
  /** Pause whatever's playing. No-op outside `playing_*` phases. */
  pause: () => void;
  /** Resume from pause. */
  resume: () => void;
  /** Cancel everything; return to idle. */
  close: () => void;
}

export function useDemoPlayback(): UseDemoPlaybackReturn {
  const [state, dispatch] = useReducer(demoPlaybackReducer, initialState);

  // ── timed-phase scheduler (only post_replay_pause uses this in v4.0) ─────
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Cancel any pending timer when the phase changes (paused, closed, etc.).
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
  const notifyContinue = useCallback(() => dispatch({ type: "CONTINUE" }), []);
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
    notifyContinue,
    notifyAudioEnded,
    submit,
    submitSucceeded,
    submitFailed,
    pause,
    resume,
    close,
  };
}
