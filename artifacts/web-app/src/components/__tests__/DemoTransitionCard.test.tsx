import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoTransitionCard } from "../DemoTransitionCard";

describe("DemoTransitionCard", () => {
  const defaultProps = {
    headline: "Here's how that conversation could have gone.",
    supportingLine:
      "The same scenario. A better approach. Listen for the difference.",
    primaryAction: "Show me →",
  };

  it("renders the headline, supporting line, and primary action", () => {
    render(<DemoTransitionCard {...defaultProps} onShowMe={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        name: /here's how that conversation could have gone/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/the same scenario\. a better approach\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /show me/i }),
    ).toBeInTheDocument();
  });

  it("calls onShowMe when the primary action is clicked", () => {
    const onShowMe = vi.fn();
    render(<DemoTransitionCard {...defaultProps} onShowMe={onShowMe} />);
    fireEvent.click(screen.getByRole("button", { name: /show me/i }));
    expect(onShowMe).toHaveBeenCalledTimes(1);
  });
});
