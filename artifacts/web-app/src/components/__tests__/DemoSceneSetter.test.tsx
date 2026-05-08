import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoSceneSetter } from "../DemoSceneSetter";

describe("DemoSceneSetter", () => {
  const defaultProps = {
    headline: "You're about to watch a layoff conversation go wrong.",
    metadata: [
      { label: "Scenario", value: "Layoff / Restructuring" },
      { label: "Employee", value: "Alex — Defensive" },
      { label: "Turns", value: "3" },
    ],
    supportingLine:
      "After the conversation, you'll hear how it could have sounded.",
    primaryAction: "Begin →",
  };

  it("renders the headline, metadata rows, supporting line, and primary action", () => {
    render(<DemoSceneSetter {...defaultProps} onBegin={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        name: /you're about to watch a layoff conversation go wrong/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Scenario:")).toBeInTheDocument();
    expect(screen.getByText("Layoff / Restructuring")).toBeInTheDocument();
    expect(screen.getByText("Employee:")).toBeInTheDocument();
    expect(screen.getByText("Alex — Defensive")).toBeInTheDocument();
    expect(screen.getByText("Turns:")).toBeInTheDocument();
    expect(
      screen.getByText(/after the conversation, you'll hear/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /begin/i })).toBeInTheDocument();
  });

  it("calls onBegin when the primary action is clicked", () => {
    const onBegin = vi.fn();
    render(<DemoSceneSetter {...defaultProps} onBegin={onBegin} />);
    fireEvent.click(screen.getByRole("button", { name: /begin/i }));
    expect(onBegin).toHaveBeenCalledTimes(1);
  });
});
