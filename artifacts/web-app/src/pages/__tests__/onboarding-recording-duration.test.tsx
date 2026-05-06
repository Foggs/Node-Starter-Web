import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

// ─── api-client-react mock ───────────────────────────────────────────────────

vi.mock("@workspace/api-client-react", () => ({
  getVoicePreview: vi.fn().mockResolvedValue(new Blob()),
  discardVoice: vi.fn().mockResolvedValue(undefined),
}));

// ─── AppShell mock — keep tests focused on the recorder card ────────────────

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import Onboarding from "../onboarding";

// ─── MediaRecorder + getUserMedia stubs ──────────────────────────────────────

const mediaRecorderStart = vi.fn();
const mediaRecorderStop = vi.fn();

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  state: "inactive" | "recording" = "inactive";
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType = "audio/webm";
  constructor(public stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }
  start() {
    this.state = "recording";
    mediaRecorderStart();
  }
  stop() {
    this.state = "inactive";
    mediaRecorderStop();
    this.onstop?.();
  }
  static isTypeSupported(_t: string) {
    return true;
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

function renderOnboarding() {
  const { hook } = memoryLocation({ path: "/onboarding" });
  return render(
    <Router hook={hook}>
      <Onboarding />
    </Router>,
  );
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("Onboarding — Y9 recording duration guidance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mediaRecorderStart.mockReset();
    mediaRecorderStop.mockReset();
    FakeMediaRecorder.instances = [];
    installMediaMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function startRecording() {
    renderOnboarding();
    const startBtn = screen.getByRole("button", {
      name: /start recording your voice sample/i,
    });
    await act(async () => {
      startBtn.click();
    });
    // Drain getUserMedia promise + setState updates.
    for (let i = 0; i < 4; i++) await flush();
    expect(mediaRecorderStart).toHaveBeenCalledTimes(1);
  }

  it("only starts the seconds timer after MediaRecorder.start() — not during permission request", async () => {
    // Hold getUserMedia open so we sit in the "requesting" phase.
    let resolveStream: (s: MediaStream) => void = () => {};
    const pending = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve;
    });
    Object.defineProperty(globalThis.navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockReturnValue(pending) },
    });

    renderOnboarding();
    await act(async () => {
      screen
        .getByRole("button", { name: /start recording your voice sample/i })
        .click();
    });

    // Advance fake time while still in `requesting` — the progress bar
    // must not appear and the recorder must not have started.
    await tick(5_000);
    expect(mediaRecorderStart).not.toHaveBeenCalled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    // Resolve permission → recorder starts → bar appears at 0.
    await act(async () => {
      resolveStream({
        getTracks: () => [{ stop: () => {} }],
      } as unknown as MediaStream);
    });
    for (let i = 0; i < 4; i++) await flush();

    expect(mediaRecorderStart).toHaveBeenCalledTimes(1);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "60");
  });

  it("progress bar is amber under 30s, green at >=30s, and caps full+green past 60s", async () => {
    await startRecording();

    // 10s elapsed — under min, amber.
    await tick(10_000);
    let bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "10");
    let fill = screen.getByTestId("recording-progress-fill");
    expect(fill).toHaveAttribute("data-state", "below-min");
    expect(fill.className).toMatch(/amber/);
    expect(screen.getByText(/30s — minimum/)).toBeInTheDocument();
    expect(screen.getByText(/60s — optimal/)).toBeInTheDocument();

    // Cross the 30s threshold → green + "Minimum reached ✓".
    await tick(20_000);
    bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    fill = screen.getByTestId("recording-progress-fill");
    expect(fill).toHaveAttribute("data-state", "optimal");
    expect(fill.className).toMatch(/green/);
    expect(screen.getByText(/Minimum reached ✓/)).toBeInTheDocument();

    // Cross the 60s threshold → bar caps at valuemax, "Optimal length ✓".
    await tick(45_000);
    bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "60");
    expect(screen.getByText(/Optimal length ✓/)).toBeInTheDocument();
    fill = screen.getByTestId("recording-progress-fill");
    expect(fill.style.width).toBe("100%");
  });

  it("Stop button is gated until 15s, surfacing the early-stop hint, then becomes functional", async () => {
    await startRecording();

    // Under 15s — clicking Stop must NOT stop the recorder; hint appears.
    await tick(5_000);
    const stopBtn = screen.getByRole("button", { name: /stop recording/i });
    expect(stopBtn).toHaveAttribute("aria-disabled", "true");

    await act(async () => {
      fireEvent.click(stopBtn);
    });
    expect(mediaRecorderStop).not.toHaveBeenCalled();
    expect(screen.getByTestId("early-stop-hint")).toHaveTextContent(
      /keep talking for a few more seconds/i,
    );

    // Cross the 15s threshold → button becomes enabled, hint clears.
    await tick(11_000); // total = 16s
    const liveStopBtn = screen.getByRole("button", { name: /stop recording/i });
    expect(liveStopBtn).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByTestId("early-stop-hint")).not.toBeInTheDocument();

    // Advance past the 30s soft-warning threshold so a click stops outright.
    await tick(15_000); // total = 31s
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /stop recording/i }),
      );
    });
    expect(mediaRecorderStop).toHaveBeenCalledTimes(1);
  });

  it("hovering the disabled Stop button reveals the early-stop hint", async () => {
    await startRecording();
    await tick(3_000);
    const stopBtn = screen.getByRole("button", { name: /stop recording/i });
    expect(screen.queryByTestId("early-stop-hint")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.mouseEnter(stopBtn);
    });
    expect(screen.getByTestId("early-stop-hint")).toBeInTheDocument();
    expect(stopBtn).toHaveAttribute(
      "title",
      "Keep talking for a few more seconds…",
    );
  });
});
