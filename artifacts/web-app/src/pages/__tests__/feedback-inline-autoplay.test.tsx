import React from "react";
import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
  }
});

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  const ResponsiveContainer = ({
    children,
  }: {
    children: React.ReactElement;
  }) => React.cloneElement(children, { width: 500, height: 200 });
  return { ...actual, ResponsiveContainer };
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

const generateImprovedReplay = vi.fn<() => Promise<unknown>>();
const generateFeedbackSummary = vi.fn<() => Promise<unknown>>();

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
    generateFeedbackSummary: () => generateFeedbackSummary(),
    generateImprovedReplay: () => generateImprovedReplay(),
    useGenerateFeedbackSummary: (options?: {
      mutation?: { mutationFn?: () => Promise<unknown> };
    }) =>
      useMutation({
        mutationKey: ["generateFeedbackSummary"],
        mutationFn:
          options?.mutation?.mutationFn ??
          (() => generateFeedbackSummary()),
      }),
    useGetSession: () =>
      useQuery({
        queryKey: ["session"],
        queryFn: async () => ({ session: { turns: [] }, turns: [] }),
        retry: false,
      }),
    useExportReport: () =>
      useMutation({
        mutationKey: ["exportReport"],
        mutationFn: async () => new Blob(),
      }),
  };
});

const playMock = vi.fn();
const stopMock = vi.fn();
const playerStateSetters = new Set<
  (s: "idle" | "loading" | "playing" | "error") => void
>();

vi.mock("@/hooks/useAudioPlayer", async () => {
  const reactMod = await vi.importActual<typeof import("react")>("react");
  return {
    useAudioPlayer: () => {
      const [state, setState] = reactMod.useState<
        "idle" | "loading" | "playing" | "error"
      >("idle");
      reactMod.useEffect(() => {
        playerStateSetters.add(setState);
        return () => {
          playerStateSetters.delete(setState);
        };
      }, []);
      return { playbackState: state, play: playMock, stop: stopMock };
    },
  };
});

function setPlaybackState(s: "idle" | "loading" | "playing" | "error") {
  for (const setter of playerStateSetters) setter(s);
}

vi.mock("@/hooks/useSlowRequestHint", () => ({
  useSlowRequestHint: () => false,
}));

vi.mock("@/components/SlowRequestHint", () => ({
  SlowRequestHint: () => null,
}));

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

import Feedback from "../feedback";
import { IMPROVED_REPLAY_QUERY_KEY } from "@/hooks/useImprovedReplay";

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

const FEEDBACK_RESPONSE = {
  strengths: ["Calm tone"],
  improvements: ["Acknowledge feelings sooner"],
  summary: "You handled the conversation reasonably.",
  emotionArc: [3, 5, 6, 4, 3],
};

const REPLAY_TURNS = [
  {
    turnIndex: 1,
    originalTranscript: "Look, we have to let you go.",
    improvedTranscript: "I appreciate you making time for this conversation.",
    audioUrl: "blob:audio-1",
  },
  {
    turnIndex: 3,
    originalTranscript: "It is what it is.",
    improvedTranscript: "I hear how difficult this news is.",
    audioUrl: "blob:audio-2",
  },
];

function renderFeedback(queryClient: QueryClient, location = "/feedback") {
  const memory = memoryLocation({ path: location });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <Router hook={memory.hook}>
        <Feedback />
      </Router>
    </QueryClientProvider>,
  );
  return { ...utils, memory };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("Feedback — inline improved-voice autoplay (Y10)", () => {
  beforeEach(() => {
    generateImprovedReplay.mockReset();
    generateFeedbackSummary.mockReset();
    playMock.mockReset();
    stopMock.mockReset();
    playerStateSetters.clear();
    generateFeedbackSummary.mockResolvedValue(FEEDBACK_RESPONSE);
  });

  it("autoplays the first turn exactly once when the cache transitions to success", async () => {
    // Cache is empty on mount, the page kicks off the request as a safety net.
    let resolveReplay!: (v: unknown) => void;
    generateImprovedReplay.mockImplementation(
      () =>
        new Promise((r) => {
          resolveReplay = r;
        }),
    );

    const queryClient = makeClient();
    const { rerender } = renderFeedback(queryClient);

    await flush();
    // Pending state — no autoplay yet.
    expect(playMock).not.toHaveBeenCalled();
    expect(
      await screen.findByTestId("improved-preview-pending"),
    ).toBeInTheDocument();

    // Resolve the replay request → success state.
    await act(async () => {
      resolveReplay(REPLAY_TURNS);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledWith("blob:audio-1");
    });
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText(/i appreciate you making time/i),
    ).toBeInTheDocument();

    // Re-rendering the same tree must not trigger another autoplay.
    rerender(
      <QueryClientProvider client={queryClient}>
        <Router hook={memoryLocation({ path: "/feedback" }).hook}>
          <Feedback />
        </Router>
      </QueryClientProvider>,
    );
    await flush();
    expect(playMock).toHaveBeenCalledTimes(1);
  });

  it("does not call play() when the first turn is missing audioUrl", async () => {
    const queryClient = makeClient();
    queryClient.setQueryData(IMPROVED_REPLAY_QUERY_KEY, [
      {
        turnIndex: 1,
        originalTranscript: "raw",
        improvedTranscript: "polished but silent",
        audioUrl: undefined,
      },
    ]);

    renderFeedback(queryClient);
    await flush();

    expect(
      await screen.findByText(/polished but silent/i),
    ).toBeInTheDocument();
    expect(playMock).not.toHaveBeenCalled();
    // CTA is still rendered.
    expect(screen.getByTestId("improved-preview-cta")).toBeInTheDocument();
  });

  it("renders the Play preview fallback when the autoplay attempt errors", async () => {
    const queryClient = makeClient();
    queryClient.setQueryData(IMPROVED_REPLAY_QUERY_KEY, REPLAY_TURNS);

    // Start with idle; flip to error after the autoplay attempt.
    renderFeedback(queryClient);
    await flush();

    await waitFor(() => {
      expect(playMock).toHaveBeenCalledWith("blob:audio-1");
    });
    expect(playMock).toHaveBeenCalledTimes(1);

    // Simulate the browser rejecting autoplay → useAudioPlayer enters "error".
    await act(async () => {
      setPlaybackState("error");
      await Promise.resolve();
    });

    const fallback = await screen.findByTestId(
      "improved-preview-play-fallback",
    );
    expect(fallback).toBeInTheDocument();

    // Clicking the fallback button calls play() under a real user gesture.
    fireEvent.click(fallback);
    expect(playMock).toHaveBeenCalledTimes(2);
    expect(playMock).toHaveBeenLastCalledWith("blob:audio-1");
  });

  it("renders the Retry affordance and does not call play() on error status", async () => {
    generateImprovedReplay.mockRejectedValue(new Error("nope"));

    const queryClient = makeClient();
    renderFeedback(queryClient);
    await flush();

    expect(
      await screen.findByTestId("improved-preview-error"),
    ).toBeInTheDocument();
    expect(playMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("navigates to /replay when the 'Hear the full replay' CTA is clicked", async () => {
    const queryClient = makeClient();
    queryClient.setQueryData(IMPROVED_REPLAY_QUERY_KEY, REPLAY_TURNS);

    const memory = memoryLocation({ path: "/feedback", record: true });
    render(
      <QueryClientProvider client={queryClient}>
        <Router hook={memory.hook}>
          <Feedback />
        </Router>
      </QueryClientProvider>,
    );
    await flush();

    const cta = await screen.findByTestId("improved-preview-cta");
    fireEvent.click(cta);
    const history = memory.history ?? [];
    expect(history[history.length - 1]).toBe("/replay");
  });
});
