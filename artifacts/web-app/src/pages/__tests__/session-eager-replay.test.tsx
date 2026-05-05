import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
} from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

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
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

// ─── shared mocks ────────────────────────────────────────────────────────────

const synthesizeEmployeeVoice = vi.fn<(opts?: RequestInit) => Promise<unknown>>();
const generateEmployeeTurn = vi.fn();
const getCoachingTip = vi.fn();
const generateImprovedReplay = vi.fn<() => Promise<unknown>>();
const sessionReadyQueryFn = vi.fn<() => Promise<unknown>>();

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
    synthesizeEmployeeVoice: (opts?: RequestInit) =>
      synthesizeEmployeeVoice(opts),
    generateEmployeeTurn: (opts?: RequestInit) => generateEmployeeTurn(opts),
    getCoachingTip: (data: unknown, opts?: RequestInit) =>
      getCoachingTip(data, opts),
    generateImprovedReplay: () => generateImprovedReplay(),
    getGetSessionQueryKey: () => ["session"],
    getListScenariosQueryKey: () => ["scenarios"],
    getListPersonasQueryKey: () => ["personas"],
    getGetSessionReadyQueryKey: () => ["session-ready"],
    useGetSessionReady: () =>
      useQuery({
        queryKey: ["session-ready"],
        queryFn: () => sessionReadyQueryFn(),
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

vi.mock("@/hooks/useAudioPlayer", () => ({
  useAudioPlayer: () => ({
    playbackState: "idle" as const,
    play: vi.fn(),
    stop: vi.fn(),
  }),
}));
vi.mock("@/hooks/useSlowRequestHint", () => ({
  useSlowRequestHint: () => false,
}));

import Session from "../session";

const CHECKPOINT_KEY = "exit-coach-session-checkpoint";

function seedCompletedCheckpoint() {
  // Five manager turns ⇒ applySavedTurns lands directly in `complete`.
  const turns = [];
  for (let i = 1; i <= 5; i++) {
    turns.push({ role: "employee", turnNum: i, text: `e${i}` });
    turns.push({
      role: "manager",
      turnNum: i,
      text: `m${i}`,
      coachingTip: "tip",
      emotionScore: 5,
    });
  }
  sessionStorage.setItem(
    CHECKPOINT_KEY,
    JSON.stringify({ completedTurns: turns, savedAt: Date.now() - 30_000 }),
  );
}

function renderSession() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const { hook, navigate } = memoryLocation({ path: "/session" });
  let currentPath = "/session";
  // Wrap navigate so the test can observe destination changes regardless
  // of which API surface the underlying `memoryLocation` exposes.
  const observedNavigate = (to: string, ...rest: unknown[]) => {
    currentPath = to;
    return (navigate as (to: string, ...rest: unknown[]) => void)(to, ...rest);
  };
  const wrappedHook: typeof hook = (...args) => {
    const [, nav] = hook(...args);
    return [currentPath, observedNavigate as typeof nav];
  };
  render(
    <QueryClientProvider client={queryClient}>
      <Router hook={wrappedHook}>
        <Session />
      </Router>
    </QueryClientProvider>,
  );
  return { queryClient, getPath: () => currentPath };
}

describe("Session — eager improved-replay on completion (R3)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    synthesizeEmployeeVoice.mockReset();
    generateEmployeeTurn.mockReset();
    getCoachingTip.mockReset();
    generateImprovedReplay.mockReset();
    sessionReadyQueryFn.mockReset();
    sessionReadyQueryFn.mockResolvedValue({ ready: true });
    synthesizeEmployeeVoice.mockImplementation(
      () => new Promise(() => undefined),
    );
    generateEmployeeTurn.mockResolvedValue({ transcript: "x", turnIndex: 1 });
    // Never resolve so we can assert "called once before navigate" without
    // needing to await a follow-up.
    generateImprovedReplay.mockImplementation(
      () => new Promise(() => undefined),
    );
  });

  it("fires POST /api/improved-replay exactly once when phase enters complete, before navigating to /feedback", async () => {
    seedCompletedCheckpoint();
    const { getPath } = renderSession();

    await act(async () => {
      await Promise.resolve();
    });

    // Eager call must not have happened yet — phase is still gated on
    // the recovery modal decision.
    expect(generateImprovedReplay).not.toHaveBeenCalled();

    const resume = await screen.findByRole("button", { name: /^resume$/i });
    await act(async () => {
      resume.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(generateImprovedReplay).toHaveBeenCalledTimes(1);
    // Navigation happened (router moved off /session).
    expect(getPath()).toBe("/feedback");
    // Modal is gone (we are no longer rendering Session's gated UI).
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("clears the cached replay when a new session starts so the next completion fires its own request", async () => {
    // First session: pre-populate the shared cache as if it had already
    // completed once (eager fire from a prior run).
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { IMPROVED_REPLAY_QUERY_KEY } = await import(
      "@/hooks/useImprovedReplay"
    );
    queryClient.setQueryData(IMPROVED_REPLAY_QUERY_KEY, [
      { turnIndex: 1, originalTranscript: "stale", improvedTranscript: "stale" },
    ]);

    // Now mount Session for a brand-new run (no checkpoint) — the
    // fresh-start effect must drop the stale cache so the next eager
    // fire actually goes to the network.
    const { hook } = memoryLocation({ path: "/session" });
    render(
      <QueryClientProvider client={queryClient}>
        <Router hook={hook}>
          <Session />
        </Router>
      </QueryClientProvider>,
    );
    // Wait for the readiness query to resolve and the fresh-start
    // effect to wipe the stale cache.
    await waitFor(
      () => {
        expect(
          queryClient.getQueryData(IMPROVED_REPLAY_QUERY_KEY),
        ).toBeUndefined();
      },
      { timeout: 3000 },
    );
    // No eager network call yet — the new session has not reached complete.
    expect(generateImprovedReplay).not.toHaveBeenCalled();
  });

  it("does not re-fire even if the complete-phase effect re-runs", async () => {
    seedCompletedCheckpoint();
    renderSession();

    await act(async () => {
      await Promise.resolve();
    });
    const resume = await screen.findByRole("button", { name: /^resume$/i });
    await act(async () => {
      resume.click();
    });
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Force another tick — the eager-fire ref must keep us at exactly one call.
    await act(async () => {
      await Promise.resolve();
    });

    expect(generateImprovedReplay).toHaveBeenCalledTimes(1);
  });
});
