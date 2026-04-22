import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { AppShell } from "../AppShell";

function renderAt(path: string, opts?: { hideNav?: boolean }) {
  const { hook } = memoryLocation({ path });
  return render(
    <Router hook={hook}>
      <AppShell hideNav={opts?.hideNav}>
        <p>child content</p>
      </AppShell>
    </Router>,
  );
}

describe("AppShell", () => {
  it("renders children and the brand link", () => {
    renderAt("/consent");
    expect(screen.getByText("child content")).toBeInTheDocument();
    expect(
      screen.getAllByText((_, el) => el?.textContent === "ExitCoach").length,
    ).toBeGreaterThan(0);
  });

  it("marks the current step in the progress nav", () => {
    renderAt("/setup");
    const nav = screen.getByRole("navigation", { name: /progress/i });
    expect(nav).toBeInTheDocument();

    const current = nav.querySelector('[aria-current="step"]');
    expect(current).not.toBeNull();
    expect(current).toHaveTextContent(/setup/i);
  });

  it("hides the stepper on routes that are not part of the flow", () => {
    renderAt("/history");
    expect(
      screen.queryByRole("navigation", { name: /progress/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the stepper when hideNav is true even on a flow route", () => {
    renderAt("/session", { hideNav: true });
    expect(
      screen.queryByRole("navigation", { name: /progress/i }),
    ).not.toBeInTheDocument();
  });
});
