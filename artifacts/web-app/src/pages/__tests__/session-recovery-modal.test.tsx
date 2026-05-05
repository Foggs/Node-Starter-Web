import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
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
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";

// ─── mock @workspace/api-client-react ────────────────────────────────────────

const synthesizeEmployeeVoice = vi.fn<(opts?: RequestInit) => Promise<unknown>>();
const generateEmployeeTurn = vi.fn();
const getCoachingTip = vi.fn();
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

function seedCheckpoint() {
  const checkpoint = {
    completedTurns: [
      { role: "employee", turnNum: 1, text: "I quit because of pay." },
      {
        role: "manager",
        turnNum: 1,
        text: "I hear you — let's talk about that.",
        coachingTip: "Acknowledge first.",
        emotionScore: 0.4,
      },
      { role: "employee", turnNum: 2, text: "And the long hours." },
    ],
    savedAt: Date.now() - 30_000,
  };
  sessionStorage.setItem(CHECKPOINT_KEY, JSON.stringify(checkpoint));
}

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

describe("Session — recovery modal (R2)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    synthesizeEmployeeVoice.mockReset();
    generateEmployeeTurn.mockReset();
    getCoachingTip.mockReset();
    sessionReadyQueryFn.mockReset();
    sessionReadyQueryFn.mockResolvedValue({ ready: true });
    // Default voice: never resolves — irrelevant once Discard is clicked.
    synthesizeEmployeeVoice.mockImplementation(
      () => new Promise(() => undefined),
    );
    generateEmployeeTurn.mockResolvedValue({
      transcript: "I don't understand. Why is this happening?",
      turnIndex: 1,
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it("renders as a blocking alertdialog with Resume + Discard, hides the practice control bar, and is not Esc-dismissible", async () => {
    seedCheckpoint();
    renderSession();
    await act(async () => {
      await Promise.resolve();
    });

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/resume turn 2 of 5/i);

    // Both required controls are present, scoped to the dialog.
    const resume = screen.getByRole("button", { name: /^resume$/i });
    const discard = screen.getByRole("button", {
      name: /discard and start fresh/i,
    });
    expect(resume).toBeEnabled();
    expect(discard).toBeEnabled();

    // The practice container is gated: the recording control bar must not
    // be reachable while the modal is open.
    expect(
      screen.queryByRole("button", { name: /start recording/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^end$/i }),
    ).not.toBeInTheDocument();

    // Esc must not dismiss the modal.
    await act(async () => {
      dialog.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    // Backdrop click must not dismiss the modal either. Radix
    // AlertDialog hard-codes this, but lock it down via test.
    const overlay = document.querySelector(
      "[data-radix-popper-content-wrapper], [data-state=open]",
    );
    if (overlay) {
      await act(async () => {
        overlay.dispatchEvent(
          new MouseEvent("pointerdown", { bubbles: true }),
        );
        overlay.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        overlay.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
    }
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("does not fire any background employee-turn fetch while the modal is open", async () => {
    seedCheckpoint();
    renderSession();
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // Critical: the practice engine must not advance behind the modal.
    expect(generateEmployeeTurn).not.toHaveBeenCalled();
    expect(synthesizeEmployeeVoice).not.toHaveBeenCalled();
  });

  it("Discard clears the checkpoint, dismisses the modal, and returns focus to the practice surface", async () => {
    seedCheckpoint();
    renderSession();
    await act(async () => {
      await Promise.resolve();
    });

    const discard = await screen.findByRole("button", {
      name: /discard and start fresh/i,
    });
    await act(async () => {
      discard.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(sessionStorage.getItem(CHECKPOINT_KEY)).toBeNull();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // After Discard, focus must leave the now-unmounted modal. Radix
    // restores focus to the previously-focused element (or document
    // body when there was none) — either way it must not still be
    // pinned inside the dismissed dialog.
    expect(document.activeElement?.closest("[role='alertdialog']")).toBeNull();
  });

  it("Resume keeps the modal open with an inline error + Retry when the readiness refetch fails with a network error", async () => {
    seedCheckpoint();
    // First mount call succeeds; the Resume refetch then fails with a
    // network-style error. React Query resolves refetch() with
    // { isError: true, error } rather than throwing, so this exercises
    // the error-branch path of handleResume.
    let call = 0;
    sessionReadyQueryFn.mockImplementation(async () => {
      call += 1;
      if (call === 1) return { ready: true };
      throw new TypeError("Failed to fetch");
    });

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
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Modal must remain mounted.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    // Inline error visible with a Retry control.
    expect(
      screen.getByText(/couldn't verify your session/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /retry/i }),
    ).toBeInTheDocument();
    // No redirect occurred — checkpoint is still in storage.
    expect(sessionStorage.getItem(CHECKPOINT_KEY)).not.toBeNull();
  });

  it("Resume routes through the onboarding redirect when readiness returns 400 with a missingStep", async () => {
    seedCheckpoint();
    let call = 0;
    sessionReadyQueryFn.mockImplementation(async () => {
      call += 1;
      if (call === 1) return { ready: true };
      const ApiErrorCtor = (await import("@workspace/api-client-react"))
        .ApiError;
      throw new ApiErrorCtor(400, { missingStep: 2 });
    });

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
    });
    await act(async () => {
      await Promise.resolve();
    });

    // Modal closes — page transitioned into the redirect interstitial.
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    // Checkpoint cleared as part of the redirect path.
    expect(sessionStorage.getItem(CHECKPOINT_KEY)).toBeNull();
    // The interstitial is on screen rather than the practice surface.
    expect(
      screen.queryByRole("button", { name: /start recording/i }),
    ).not.toBeInTheDocument();
  });

  it("Resume reconciles with the readiness query, then applies saved turns and unmounts the modal", async () => {
    seedCheckpoint();
    renderSession();
    await act(async () => {
      await Promise.resolve();
    });

    // Initial mount called readiness once. Resume should refetch.
    const initialCalls = sessionReadyQueryFn.mock.calls.length;

    const resume = await screen.findByRole("button", { name: /^resume$/i });
    await act(async () => {
      resume.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(sessionReadyQueryFn.mock.calls.length).toBeGreaterThan(initialCalls);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    // Restored manager turn body is now part of the session transcript.
    expect(
      screen.getByText(/i hear you — let's talk about that/i),
    ).toBeInTheDocument();
  });
});
