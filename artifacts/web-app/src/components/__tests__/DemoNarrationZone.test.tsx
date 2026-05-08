import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoNarrationZone } from "../DemoNarrationZone";

describe("DemoNarrationZone", () => {
  const defaultProps = {
    coachingTip:
      "Let the employee finish before responding. Jumping in too quickly signals defensiveness.",
    narration:
      "Alex reacted with shock. The manager is about to respond. See if the approach lands.",
    turnNumber: 1,
  };

  it("renders the coaching tip, narration text, and Continue button (default label)", () => {
    render(<DemoNarrationZone {...defaultProps} onContinue={vi.fn()} />);

    expect(screen.getByText(/turn 1 coaching/i)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.coachingTip)).toBeInTheDocument();
    expect(screen.getByText(defaultProps.narration)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i }),
    ).toBeInTheDocument();
  });

  it("uses a custom continue label when provided", () => {
    render(
      <DemoNarrationZone
        {...defaultProps}
        continueLabel="Begin →"
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /begin/i })).toBeInTheDocument();
  });

  it("calls onContinue when the button is clicked", () => {
    const onContinue = vi.fn();
    render(<DemoNarrationZone {...defaultProps} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("uses aria-live=polite so screen readers announce the staged content", () => {
    render(<DemoNarrationZone {...defaultProps} onContinue={vi.fn()} />);
    const zone = screen.getByTestId("demo-narration-zone");
    expect(zone).toHaveAttribute("aria-live", "polite");
  });
});
