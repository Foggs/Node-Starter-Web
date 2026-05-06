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

// Force voiceFailed → true so the manual "Start Recording" button is the
// active path (no auto-start, no audio playback to wait for). This keeps
// the assertions focused on the countdown gate itself.
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

// ─── MediaRecorder + getUserMedia stubs ──────────────────────────────────────

const mediaRecorderStart = vi.fn();
const mediaRecorderStop = vi.fn();

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    mediaRecorderStart();
  }
  stop() {
    mediaRecorderStop();
    this.onstop?.();
  }
}

function installMediaMocks() {
  (
    globalThis as unknown as { MediaRecorder: typeof FakeMediaRecorder }
  ).MediaRecorder = FakeMediaRecorder;
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: () => {} }],
      } as unknown as MediaStream),
    },
  });
}

describe("Session — Y7 3-2-1 recording countdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    synthesizeEmployeeVoice.mockReset();
    generateEmployeeTurn.mockReset();
    getCoachingTip.mockReset();
    mediaRecorderStart.mockReset();
    mediaRecorderStop.mockReset();
    FakeMediaRecorder.instances = [];

    // Make voice synth fail immediately → voiceFailed=true → manual
    // Start Recording button is rendered and auto-start is suppressed.
    synthesizeEmployeeVoice.mockRejectedValue(
      Object.assign(new Error("voice 502"), { status: 502 }),
    );
    generateEmployeeTurn.mockResolvedValue({
      transcript: "I don't understand. Why is this happening?",
      turnIndex: 1,
    });
    installMediaMocks();
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

  async function flush() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
  }

  it("shows a 3-2-1 overlay and only starts MediaRecorder once the count hits zero", async () => {
    renderSession();
    // Drain readiness + employee turn + voice rejection. We can't use
    // findByRole here because waitFor's internal polling shares the
    // installed fake timers and would never advance on its own.
    for (let i = 0; i < 8; i++) await flush();

    const startBtn = screen.getByRole("button", {
      name: /start recording/i,
    });

    await act(async () => {
      startBtn.click();
    });

    // Right after click: countdown is at 3 and the recorder has NOT started.
    expect(mediaRecorderStart).not.toHaveBeenCalled();
    const overlay = screen.getByRole("status", {
      name: /recording starts in 3/i,
    });
    expect(overlay).toBeInTheDocument();
    // No Stop button yet — the countdown cannot be skipped to recording.
    expect(
      screen.queryByRole("button", { name: /stop recording/i }),
    ).not.toBeInTheDocument();
    // No re-rendered Start button to double-trigger.
    expect(
      screen.queryByRole("button", { name: /start recording/i }),
    ).not.toBeInTheDocument();

    // Tick to "2".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(
      screen.getByRole("status", { name: /recording starts in 2/i }),
    ).toBeInTheDocument();
    expect(mediaRecorderStart).not.toHaveBeenCalled();

    // Tick to "1".
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(
      screen.getByRole("status", { name: /recording starts in 1/i }),
    ).toBeInTheDocument();
    expect(mediaRecorderStart).not.toHaveBeenCalled();

    // Final tick → MediaRecorder.start() fires and overlay is dismissed.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    // Flush the resolved getUserMedia promise so the recorder actually starts.
    await flush();

    expect(mediaRecorderStart).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByRole("status", { name: /recording starts in/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /stop recording/i }),
    ).toBeInTheDocument();
  });

  it("blocks interaction during the countdown — extra clicks on the (now-gone) Start button cannot short-circuit it", async () => {
    renderSession();
    for (let i = 0; i < 8; i++) await flush();

    const startBtn = screen.getByRole("button", {
      name: /start recording/i,
    });
    await act(async () => {
      startBtn.click();
    });

    // The original Start button is detached from the DOM; clicking it
    // again should not enqueue another countdown nor start the recorder.
    await act(async () => {
      startBtn.click();
      startBtn.click();
    });
    expect(mediaRecorderStart).not.toHaveBeenCalled();

    // Advance only 2 of the 3 seconds — recorder still must not have started.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(mediaRecorderStart).not.toHaveBeenCalled();
  });

  it("marks #root as inert during the countdown so underlying controls cannot be activated by pointer or keyboard", async () => {
    // Mount under a real #root so the inert effect has something to grab.
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const { hook } = memoryLocation({ path: "/session" });
    render(
      <QueryClientProvider client={queryClient}>
        <Router hook={hook}>
          <Session />
        </Router>
      </QueryClientProvider>,
      { container: root },
    );
    for (let i = 0; i < 8; i++) await flush();

    // Sanity: an underlying control exists and is reachable before the
    // countdown starts.
    const historyLink = screen.getByRole("link", { name: /history/i });
    expect(root.hasAttribute("inert")).toBe(false);

    const startBtn = screen.getByRole("button", {
      name: /start recording/i,
    });
    await act(async () => {
      startBtn.click();
    });

    // While counting down, the React app root is marked inert — pointer
    // AND keyboard activation of any underlying control are blocked by
    // the platform itself, not by JS handlers we could miss.
    expect(root.hasAttribute("inert")).toBe(true);
    expect(historyLink.closest("[inert]")).toBe(root);

    // After the recorder finally starts, inert is cleared so the rest
    // of the session UI is interactive again. Tick a second at a time so
    // each setTimeout in the countdown chain has a chance to schedule
    // the next one between flushes.
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    await flush();
    expect(mediaRecorderStart).toHaveBeenCalledTimes(1);
    expect(root.hasAttribute("inert")).toBe(false);

    document.body.removeChild(root);
  });
});
