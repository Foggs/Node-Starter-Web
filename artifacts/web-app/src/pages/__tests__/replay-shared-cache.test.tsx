import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const generateImprovedReplay = vi.fn<() => Promise<unknown>>();

vi.mock("@workspace/api-client-react", () => ({
  generateImprovedReplay: () => generateImprovedReplay(),
}));

import Replay from "../replay";
import { IMPROVED_REPLAY_QUERY_KEY } from "@/hooks/useImprovedReplay";

function renderReplay(queryClient: QueryClient) {
  const memory = memoryLocation({ path: "/replay" });
  render(
    <QueryClientProvider client={queryClient}>
      <Router hook={memory.hook}>
        <Replay />
      </Router>
    </QueryClientProvider>,
  );
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

describe("Replay — shared improved-replay cache (R3)", () => {
  beforeEach(() => {
    generateImprovedReplay.mockReset();
  });

  it("renders cached turns immediately without firing a new request", async () => {
    const queryClient = makeClient();
    queryClient.setQueryData(IMPROVED_REPLAY_QUERY_KEY, [
      {
        turnIndex: 1,
        originalTranscript: "We need to talk.",
        improvedTranscript: "I appreciate you making time today.",
        audioUrl: "blob:fake-1",
      },
      {
        turnIndex: 2,
        originalTranscript: "That's not great.",
        improvedTranscript: "I hear how hard this has been.",
        audioUrl: "blob:fake-2",
      },
    ]);

    renderReplay(queryClient);
    await act(async () => {
      await Promise.resolve();
    });

    expect(generateImprovedReplay).not.toHaveBeenCalled();
    expect(screen.getByText(/i appreciate you making time today/i))
      .toBeInTheDocument();
    expect(screen.getByText(/i hear how hard this has been/i))
      .toBeInTheDocument();
  });

  it("fires the request on cold mount when the cache is empty (deep-link)", async () => {
    let resolve!: (v: unknown) => void;
    generateImprovedReplay.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );

    const queryClient = makeClient();
    renderReplay(queryClient);

    await act(async () => {
      await Promise.resolve();
    });

    expect(generateImprovedReplay).toHaveBeenCalledTimes(1);

    // Resolve so the loading skeleton clears and the populated list renders.
    await act(async () => {
      resolve([
        {
          turnIndex: 1,
          originalTranscript: "raw",
          improvedTranscript: "polished",
          audioUrl: "blob:x",
        },
      ]);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByText("polished")).toBeInTheDocument();
  });
});
