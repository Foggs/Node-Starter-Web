import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoConversation } from "../DemoConversation";
import type { DemoTurn } from "@/data/demoScript";

const turns: [DemoTurn, DemoTurn, DemoTurn] = [
  {
    turnIndex: 1,
    speaker: "employee",
    transcript: "Wait — what exactly are you saying?",
    audioSrc: "/demo/employee-turn-1.mp3",
    coachingTip: "Let the employee finish before responding.",
    narration: "Alex reacted with shock. Watch what happens next.",
    emotionScore: 7,
  },
  {
    turnIndex: 2,
    speaker: "manager",
    transcript: "I understand this is a shock.",
    audioSrc: "/demo/manager-turn-2-original.mp3",
    coachingTip: "Good — you separated the structural reason from performance.",
    narration: "The manager stayed composed — but missed something.",
    emotionScore: 5,
  },
  {
    turnIndex: 3,
    speaker: "employee",
    transcript: "Then why me?",
    audioSrc: "/demo/employee-turn-3.mp3",
    coachingTip: "Don't defend the selection criteria.",
    narration: "The conversation escalated.",
    emotionScore: 8,
  },
];

describe("DemoConversation", () => {
  it("renders only the active turn during playing_turn_1 with the speaker indicator", () => {
    render(
      <DemoConversation
        personaName="Alex — Defensive"
        turns={turns}
        phase="playing_turn_1"
        pausedResumeTo={null}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText(/wait — what exactly/i)).toBeInTheDocument();
    expect(screen.queryByText(/i understand this is a shock/i)).not.toBeInTheDocument();
    // Speaking indicator surfaces for screen readers.
    expect(screen.getByText(/now playing/i)).toBeInTheDocument();
  });

  it("during awaiting_continue_1 shows the narration zone with tip + narration + Continue", () => {
    render(
      <DemoConversation
        personaName="Alex — Defensive"
        turns={turns}
        phase="awaiting_continue_1"
        pausedResumeTo={null}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText(/turn 1 coaching/i)).toBeInTheDocument();
    expect(screen.getByText(/let the employee finish/i)).toBeInTheDocument();
    expect(screen.getByText(/alex reacted with shock/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue/i }),
    ).toBeInTheDocument();
    // Speaking indicator suppressed — audio has ended.
    expect(screen.queryByText(/now playing/i)).not.toBeInTheDocument();
  });

  it("calls onContinue when the Continue button is clicked from the narration zone", () => {
    const onContinue = vi.fn();
    render(
      <DemoConversation
        personaName="Alex — Defensive"
        turns={turns}
        phase="awaiting_continue_2"
        pausedResumeTo={null}
        onContinue={onContinue}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("reveals previous turns as the phase advances (turn 2 → turns 1 + 2 visible)", () => {
    render(
      <DemoConversation
        personaName="Alex — Defensive"
        turns={turns}
        phase="playing_turn_2"
        pausedResumeTo={null}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText(/wait — what exactly/i)).toBeInTheDocument();
    expect(screen.getByText(/i understand this is a shock/i)).toBeInTheDocument();
    expect(screen.queryByText(/then why me\?/i)).not.toBeInTheDocument();
  });

  it("collapses paused → resumeTo so the right turn stays visible while paused", () => {
    render(
      <DemoConversation
        personaName="Alex — Defensive"
        turns={turns}
        phase="paused"
        pausedResumeTo="awaiting_continue_3"
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText(/then why me\?/i)).toBeInTheDocument();
    expect(screen.getByText(/turn 3 coaching/i)).toBeInTheDocument();
  });
});
