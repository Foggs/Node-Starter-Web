import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

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

import { EmotionArcChart } from "../feedback";

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

  it("omits the peak-turn note from the summary when the peak is in the calm band", () => {
    const { container } = render(
      <EmotionArcChart emotionArc={[1, 2, 3, 2]} />,
    );
    const srSummary = container.querySelector(".sr-only");
    expect(srSummary?.textContent).not.toMatch(/occurred at turn/);
  });
});
