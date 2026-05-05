import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { render, screen, act } from "@testing-library/react";

// jsdom doesn't implement scrollIntoView; the Session page calls it inside an
// auto-scroll effect on every phase change.
beforeAll(() => {
  if (!("scrollIntoView" in Element.prototype)) {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      value: () => {},
      writable: true,
    });
  } else {
    Element.prototype.scrollIntoView = () => {};
  }
});
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";

// ─── mock @workspace/api-client-react ────────────────────────────────────────
//
// The Session page pulls a wide surface from the generated client. We stub the
// query hooks with success states so the readiness gate immediately resolves
// to "ready", and we delegate the mutation hooks to React Query's useMutation
// so the page's custom mutationFn (which wires the AbortController + 8 s
// timeout for voice synthesis) is exercised end-to-end.

const synthesizeEmployeeVoice = vi.fn<(opts?: RequestInit) => Promise<unknown>>();
const generateEmployeeTurn = vi.fn();
const getCoachingTip = vi.fn();

vi.mock("@workspace/api-client-react", () => {
  class ApiError extends Error {
    status: number;
    data: unknown;
    constructor(status: number, data: unknown = null) {
      super(`ApiError ${status}`);
      this.status = status;
      this.data = data;
    }
  }
  return {
    ApiError,
    // Bare functions
    synthesizeEmployeeVoice: (opts?: RequestInit) =>
      synthesizeEmployeeVoice(opts),
    generateEmployeeTurn: (opts?: RequestInit) => generateEmployeeTurn(opts),
    getCoachingTip: (data: unknown, opts?: RequestInit) =>
      getCoachingTip(data, opts),
    // Query-key builders — value doesn't matter, just needs to be array-like.
    getGetSessionQueryKey: () => ["session"],
    getListScenariosQueryKey: () => ["scenarios"],
    getListPersonasQueryKey: () => ["personas"],
    getGetSessionReadyQueryKey: () => ["session-ready"],
    // Hooks — minimal pass-throughs that satisfy the page's usage.
    useGetSessionReady: () =>
      useQuery({
        queryKey: ["session-ready"],
        queryFn: async () => ({ ready: true }),
        retry: false,
      }),
    useGetSession: () =>
      useQuery({
        queryKey: ["session"],
        queryFn: async () => ({ session: { turns: [] } }),
        retry: false,
      }),
    useListScenarios: () =>
      useQuery({
        queryKey: ["scenarios"],
        queryFn: async () => [] as unknown[],
        retry: false,
      }),
    useListPersonas: () =>
      useQuery({
        queryKey: ["personas"],
        queryFn: async () => [] as unknown[],
        retry: false,
      }),
    useGenerateEmployeeTurn: (options?: {
      mutation?: { mutationFn?: () => Promise<unknown> };
    }) =>
      useMutation({
        mutationKey: ["generateEmployeeTurn"],
        mutationFn:
          options?.mutation?.mutationFn ?? (() => generateEmployeeTurn()),
      }),
    useGetCoachingTip: (options?: {
      mutation?: { mutationFn?: (vars: unknown) => Promise<unknown> };
    }) =>
      useMutation({
        mutationKey: ["getCoachingTip"],
        mutationFn:
          options?.mutation?.mutationFn ??
          ((vars: unknown) => getCoachingTip(vars)),
      }),
    useSynthesizeEmployeeVoice: (options?: {
      mutation?: { mutationFn?: () => Promise<unknown> };
    }) =>
      useMutation({
        mutationKey: ["synthesizeEmployeeVoice"],
        mutationFn:
          options?.mutation?.mutationFn ?? (() => synthesizeEmployeeVoice()),
      }),
  };
});

// Stub out useAudioPlayer so jsdom doesn't try to load real audio elements.
vi.mock("@/hooks/useAudioPlayer", () => ({
  useAudioPlayer: () => ({
    playbackState: "idle" as const,
    play: vi.fn(),
    stop: vi.fn(),
  }),
}));

// Slow-request hint relies on timers — the default behaviour of returning
// `false` until 6s is fine, but we replace it with a constant `false` so the
// timer-driven assertions below aren't muddied by hint state changes.
vi.mock("@/hooks/useSlowRequestHint", () => ({
  useSlowRequestHint: () => false,
}));

import Session from "../session";

describe("Session — employee voice fetch timeout (R1)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    synthesizeEmployeeVoice.mockReset();
    generateEmployeeTurn.mockReset();
    getCoachingTip.mockReset();

    // First employee turn resolves immediately so the page enters the
    // "employee" phase and triggers voice synthesis.
    generateEmployeeTurn.mockResolvedValue({
      transcript: "I don't understand. Why is this happening?",
      turnIndex: 1,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderSession() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { hook } = memoryLocation({ path: "/session" });
    return render(
      <QueryClientProvider client={queryClient}>
        <Router hook={hook}>
          <Session />
        </Router>
      </QueryClientProvider>,
    );
  }

  it("aborts the voice fetch after 8s, marks voice unavailable, and unblocks the recording UI", async () => {
    // Capture the AbortSignal handed to the voice synthesis call so we can
    // assert it's actually aborted by the timeout.
    let capturedSignal: AbortSignal | undefined;
    synthesizeEmployeeVoice.mockImplementation((opts) => {
      capturedSignal = opts?.signal ?? undefined;
      // Never resolves on its own — the only termination path is abort.
      return new Promise((_resolve, reject) => {
        capturedSignal?.addEventListener("abort", () => {
          const err = new DOMException("Aborted", "AbortError");
          reject(err);
        });
      });
    });

    renderSession();

    // Drain the readiness query + employee-turn mutation so the page lands
    // on the "employee" phase and kicks off voice synthesis.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // The synthesis call should have been issued with an AbortSignal.
    expect(synthesizeEmployeeVoice).toHaveBeenCalled();
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);

    // While we're under the 8s ceiling, the recording UI is still gated on
    // voiceFetching → "Loading employee voice…" is the live status.
    expect(screen.getByText(/loading employee voice/i)).toBeInTheDocument();

    // Advance past the 8s fetch timeout — controller should fire abort,
    // promise rejects with AbortError, and onError treats it as a graceful
    // voice failure (no console.warn, no error toast).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    // Flush the rejected promise microtasks.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(capturedSignal!.aborted).toBe(true);

    // Voice unavailable hint is shown (same UI path as a 502).
    expect(
      screen.getByText(/voice unavailable/i),
    ).toBeInTheDocument();

    // The manual "Start Recording" control is reachable — recording UI is
    // unblocked so the user can speak immediately.
    const recordBtn = screen.getByRole("button", { name: /start recording/i });
    expect(recordBtn).toBeInTheDocument();
    expect(recordBtn).not.toBeDisabled();
  });

  it("does not surface an error banner on timeout (graceful degradation)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    synthesizeEmployeeVoice.mockImplementation((opts) => {
      const signal = opts?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });

    renderSession();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Aborts are expected — they should not log a warning. Real network
    // errors (non-502, non-abort) are the only path that warns.
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
