import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
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
  it("renders the hero heading and primary CTA pointing at /consent", () => {
    renderAt("/");

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /practice the conversations/i,
      }),
    ).toBeInTheDocument();

    const cta = screen.getByRole("link", { name: /start practicing/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "/consent");
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
});
