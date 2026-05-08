import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";

// Stub the generated lead-capture mutation so DemoModal can mount without a
// QueryClientProvider in this isolated test.
vi.mock("@workspace/api-client-react", () => ({
  useCreateLead: () => ({ mutate: vi.fn(), isPending: false }),
}));

import Landing from "../landing";

function renderAt(path: string) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <Landing />
    </Router>,
  );
}

describe("Landing page", () => {
  it("renders the hero heading and a single Demo CTA", () => {
    renderAt("/");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /practice the conversations/i,
      }),
    ).toBeInTheDocument();

    const cta = screen.getByTestId("demo-cta");
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent(/demo/i);
    // No /consent link in the hero — the demo→form flow is the single entry point.
    expect(screen.queryByRole("link", { name: /start practicing/i })).toBeNull();
  });

  it("renders the four feature cards and scenarios", () => {
    renderAt("/");

    expect(screen.getByText("Voice-first rehearsal")).toBeInTheDocument();
    expect(screen.getByText("Emotionally realistic AI")).toBeInTheDocument();
    expect(screen.getByText("Turn-by-turn coaching")).toBeInTheDocument();
    expect(screen.getByText("20 minutes, not 20 weeks")).toBeInTheDocument();

    expect(
      screen.getByText(/termination for performance/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/layoff \/ role elimination/i)).toBeInTheDocument();
  });

  it("links the past-sessions navigation entry to /history", () => {
    renderAt("/");
    const link = screen.getByRole("link", { name: /past sessions/i });
    expect(link).toHaveAttribute("href", "/history");
  });

  it("renders the FAQ section below the demo CTA", () => {
    renderAt("/");

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /questions we hear a lot/i,
      }),
    ).toBeInTheDocument();

    // Spot-check one objection-handling question is present.
    expect(
      screen.getByRole("button", { name: /is my voice data safe/i }),
    ).toBeInTheDocument();
  });

  it("opens the DemoModal when the Demo CTA is clicked", () => {
    renderAt("/");
    expect(screen.queryByTestId("demo-scene-setter")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("demo-cta"));

    // The scene-setter is the first thing rendered by the modal in v4.0.
    expect(screen.getByTestId("demo-scene-setter")).toBeInTheDocument();
  });
});
