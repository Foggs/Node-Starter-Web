import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  const ResponsiveContainer = ({
    children,
  }: {
    children: React.ReactElement;
  }) => React.cloneElement(children, { width: 500, height: 200 });
  return { ...actual, ResponsiveContainer };
});

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

import { EmotionArcChart } from "../../components/EmotionArcChart";

describe("EmotionArcChart — peak emotion annotation (Y6)", () => {
  it("renders a red peak marker when the peak is in the distressed band (>7)", () => {
    render(<EmotionArcChart emotionArc={[3, 5, 9, 4]} />);
    const marker = screen.getByTestId("peak-marker");
    expect(marker).toBeInTheDocument();
    // The peak tooltip text is exposed via aria-label so screen-reader
    // users and keyboard-focus users both reach it.
    expect(marker).toHaveAttribute(
      "aria-label",
      "Your tone at turn 3 escalated the conversation — see coaching tip below.",
    );
    // Distressed band uses red.
    const fillCircles = marker.querySelectorAll("circle");
    expect(fillCircles.length).toBeGreaterThan(0);
    expect(fillCircles[0].getAttribute("fill")).toBe("#ef4444");
    // SVG <title> on the inner circle gives a native browser tooltip on hover.
    const title = marker.querySelector("title");
    expect(title?.textContent).toMatch(
      /Your tone at turn 3 escalated the conversation/,
    );
  });

  it("renders an amber peak marker when the peak is in the unsettled band (4–7)", () => {
    render(<EmotionArcChart emotionArc={[2, 6, 5, 3]} />);
    const marker = screen.getByTestId("peak-marker");
    expect(marker).toBeInTheDocument();
    expect(marker).toHaveAttribute(
      "aria-label",
      "Your tone at turn 2 escalated the conversation — see coaching tip below.",
    );
    const fillCircles = marker.querySelectorAll("circle");
    expect(fillCircles[0].getAttribute("fill")).toBe("#f59e0b");
  });

  it("renders no special peak marker when the peak is in the calm band (≤3)", () => {
    render(<EmotionArcChart emotionArc={[1, 2, 3, 2]} />);
    expect(screen.queryByTestId("peak-marker")).not.toBeInTheDocument();
  });

  it("renders no peak marker for a single-turn session", () => {
    render(<EmotionArcChart emotionArc={[9]} />);
    expect(screen.queryByTestId("peak-marker")).not.toBeInTheDocument();
  });

  it("annotates the earliest turn when multiple turns tie for the peak", () => {
    render(<EmotionArcChart emotionArc={[5, 9, 7, 9, 6]} />);
    const marker = screen.getByTestId("peak-marker");
    expect(marker).toHaveAttribute(
      "aria-label",
      "Your tone at turn 2 escalated the conversation — see coaching tip below.",
    );
    // Exactly one peak marker is rendered even with ties.
    expect(screen.getAllByTestId("peak-marker")).toHaveLength(1);
  });

  it("includes the peak turn number in the screen-reader summary", () => {
    const { container } = render(
      <EmotionArcChart emotionArc={[3, 5, 9, 4]} />,
    );
    const srSummary = container.querySelector(".sr-only");
    expect(srSummary?.textContent).toMatch(
      /Peak 9 occurred at turn 3\./,
    );
    // The role="img" wrapper's aria-label also carries the same summary so
    // assistive tech announcing the chart hears the peak turn.
    const chartImg = container.querySelector('[role="img"]');
    expect(chartImg?.getAttribute("aria-label")).toMatch(
      /Peak 9 occurred at turn 3\./,
    );
  });

  it("still names the peak turn in the SR summary when the peak is in the calm band", () => {
    // The visible peak marker is suppressed for calm-band peaks, but
    // assistive-tech users should still hear which turn the peak occurred on
    // so they get the same insight as sighted users (Y6 a11y requirement).
    const { container } = render(
      <EmotionArcChart emotionArc={[1, 2, 3, 2]} />,
    );
    const srSummary = container.querySelector(".sr-only");
    expect(srSummary?.textContent).toMatch(/Peak 3 occurred at turn 3\./);
    // No visible peak marker for calm-band sessions.
    expect(screen.queryByTestId("peak-marker")).not.toBeInTheDocument();
  });

  it("still names the peak turn in the SR summary for a single-turn session", () => {
    const { container } = render(<EmotionArcChart emotionArc={[9]} />);
    const srSummary = container.querySelector(".sr-only");
    expect(srSummary?.textContent).toMatch(/Peak 9 occurred at turn 1\./);
  });

  it("reveals the Y6 guidance text in a visible focus panel when the peak marker receives focus", () => {
    render(<EmotionArcChart emotionArc={[3, 5, 9, 4]} />);
    const marker = screen.getByTestId("peak-marker");
    const panel = screen.getByTestId("peak-focus-panel");

    // Hidden by default — opacity-0 + empty text content so sighted users
    // don't see anything until they focus / hover the marker.
    expect(panel).toHaveClass("opacity-0");
    expect(panel.textContent).toBe("");

    act(() => {
      marker.focus();
      fireEvent.focus(marker);
    });
    expect(panel).toHaveClass("opacity-100");
    expect(panel.textContent).toMatch(
      /Your tone at turn 3 escalated the conversation/,
    );
    // The marker is wired up via aria-describedby to this same panel so
    // screen readers announce the guidance text on focus.
    expect(marker.getAttribute("aria-describedby")).toBe(panel.getAttribute("id"));

    act(() => {
      fireEvent.blur(marker);
    });
    expect(panel).toHaveClass("opacity-0");
    expect(panel.textContent).toBe("");
  });
});
