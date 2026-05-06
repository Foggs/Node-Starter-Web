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
  if (typeof URL.createObjectURL !== "function") {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL =
      () => "blob:mock";
  }
  if (typeof URL.revokeObjectURL !== "function") {
    (URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL =
      () => {};
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

const synthesizeEmployeeVoice = vi.fn<(opts?: RequestInit) => Promise<unknown>>();
const generateEmployeeTurn = vi.fn();
const getCoachingTip = vi.fn<(vars: unknown, opts?: RequestInit) => Promise<unknown>>();

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

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
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

// Drive the page from "fetching_employee" all the way into the
// `processing` phase: complete the employee turn, fail voice synth so
// the manual Start Recording button is the active path, run the 3-2-1
// countdown, stop the recorder, and click Submit. The coaching-tip
// mutation never resolves so phase stays in `processing` for the
// duration of the assertions.
async function driveIntoProcessing() {
  for (let i = 0; i < 8; i++) await flush();

  const startBtn = screen.getByRole("button", {
    name: /start recording/i,
  });
  await act(async () => {
    startBtn.click();
  });
  // Tick through the 3-2-1 countdown.
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
  await flush();

  // Stop the recorder → onstop fires → phase becomes "reviewing".
  const stopBtn = screen.getByRole("button", { name: /stop recording/i });
  await act(async () => {
    stopBtn.click();
  });
  await flush();

  // Click Submit → phase becomes "processing".
  const submitBtn = screen.getByRole("button", { name: /submit response/i });
  await act(async () => {
    submitBtn.click();
  });
  await flush();
}

describe("Session — Y5 two-step processing status messages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    synthesizeEmployeeVoice.mockReset();
    generateEmployeeTurn.mockReset();
    getCoachingTip.mockReset();
    mediaRecorderStart.mockReset();
    mediaRecorderStop.mockReset();
    FakeMediaRecorder.instances = [];

    synthesizeEmployeeVoice.mockRejectedValue(
      Object.assign(new Error("voice 502"), { status: 502 }),
    );
    generateEmployeeTurn.mockResolvedValue({
      transcript: "I don't understand. Why is this happening?",
      turnIndex: 1,
    });
    // Coaching-tip request hangs so the page stays in `processing`
    // long enough to assert both message states.
    getCoachingTip.mockImplementation(() => new Promise(() => undefined));
    installMediaMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders 'Transcribing…' immediately and switches to 'Analysing…' after ~2s", async () => {
    renderSession();
    await driveIntoProcessing();

    // Both prominent processing spots show the first message immediately.
    expect(
      screen.getByTestId("processing-bubble-message").textContent,
    ).toMatch(/transcribing your response/i);
    expect(
      screen.getByTestId("processing-bar-message").textContent,
    ).toMatch(/transcribing your response/i);

    // Just before the 2s mark — still on the first message.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1900);
    });
    expect(
      screen.getByTestId("processing-bubble-message").textContent,
    ).toMatch(/transcribing your response/i);

    // Cross the 2s threshold — both spots flip to the second message.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(
      screen.getByTestId("processing-bubble-message").textContent,
    ).toMatch(/analysing tone and phrasing/i);
    expect(
      screen.getByTestId("processing-bar-message").textContent,
    ).toMatch(/analysing tone and phrasing/i);
  });

  it("cancels the pending swap when the component unmounts (no late state updates)", async () => {
    const { unmount } = renderSession();
    await driveIntoProcessing();

    expect(
      screen.getByTestId("processing-bubble-message").textContent,
    ).toMatch(/transcribing your response/i);

    // Unmount before the 2s timer fires.
    unmount();

    // Advancing well past 2s must not throw, warn, or attempt to
    // update state on the unmounted component.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
