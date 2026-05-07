import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

import { FAQAccordion } from "../FAQAccordion";
import { FAQ_ITEMS } from "@/data/faqContent";

describe("FAQAccordion", () => {
  it("renders the section heading and contact prompt", () => {
    render(<FAQAccordion />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /questions we hear a lot/i,
      }),
    ).toBeInTheDocument();

    const mailLink = screen.getByRole("link", { name: /just ask us/i });
    expect(mailLink).toHaveAttribute("href", expect.stringMatching(/^mailto:/));
  });

  it("renders all 5 questions as collapsed buttons on mount", () => {
    render(<FAQAccordion />);

    for (const item of FAQ_ITEMS) {
      const trigger = screen.getByRole("button", { name: item.question });
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    }

    // Body text for any item should not be visible while collapsed.
    expect(
      screen.queryByText(/five-step practice loop/i),
    ).not.toBeInTheDocument();
  });

  it("expands an item when its question is clicked", () => {
    render(<FAQAccordion />);

    const q1 = screen.getByRole("button", {
      name: /how does exit coach actually work/i,
    });
    fireEvent.click(q1);

    expect(q1).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/five-step practice loop/i),
    ).toBeInTheDocument();
  });

  it("opens only one item at a time (opening a new item closes the current one)", () => {
    render(<FAQAccordion />);

    const q1 = screen.getByRole("button", {
      name: /how does exit coach actually work/i,
    });
    const q2 = screen.getByRole("button", { name: /is my voice data safe/i });

    fireEvent.click(q1);
    expect(q1).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(q2);
    expect(q1).toHaveAttribute("aria-expanded", "false");
    expect(q2).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses an open item when its question is clicked again", () => {
    render(<FAQAccordion />);

    const q1 = screen.getByRole("button", {
      name: /how does exit coach actually work/i,
    });

    fireEvent.click(q1);
    expect(q1).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(q1);
    expect(q1).toHaveAttribute("aria-expanded", "false");
  });

  it("renders Q1 as intro text + ordered list (5 steps) + closing sentence", () => {
    render(<FAQAccordion />);

    fireEvent.click(
      screen.getByRole("button", {
        name: /how does exit coach actually work/i,
      }),
    );

    const region = screen.getByRole("region", {
      name: /how does exit coach actually work/i,
    });

    // Intro paragraph.
    expect(
      within(region).getByText(/five-step practice loop/i),
    ).toBeInTheDocument();

    // Ordered list with 5 steps.
    const list = within(region).getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(within(list).getAllByRole("listitem")).toHaveLength(5);

    // Closing sentence rendered after the list.
    expect(
      within(region).getByText(/most sessions take about 10 minutes/i),
    ).toBeInTheDocument();
  });

  it("uses a button (not a div) for each question for keyboard accessibility", () => {
    render(<FAQAccordion />);

    for (const item of FAQ_ITEMS) {
      const trigger = screen.getByRole("button", { name: item.question });
      expect(trigger.tagName).toBe("BUTTON");
    }
  });

  it("emits a Schema.org FAQPage JSON-LD block with one Question per item", () => {
    render(<FAQAccordion />);

    const script = screen.getByTestId("faq-jsonld");
    expect(script.getAttribute("type")).toBe("application/ld+json");

    const data = JSON.parse(script.innerHTML);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(FAQ_ITEMS.length);

    for (const [i, item] of FAQ_ITEMS.entries()) {
      const entry = data.mainEntity[i];
      expect(entry["@type"]).toBe("Question");
      expect(entry.name).toBe(item.question);
      expect(entry.acceptedAnswer["@type"]).toBe("Answer");
      // Answer text always includes the intro.
      expect(entry.acceptedAnswer.text).toContain(item.answer);
      // Steps and closing (when present) are flattened into the JSON-LD answer
      // so AI agents see the full answer, not just the intro.
      if (item.steps) {
        for (const step of item.steps) {
          expect(entry.acceptedAnswer.text).toContain(step);
        }
      }
      if (item.closing) {
        expect(entry.acceptedAnswer.text).toContain(item.closing);
      }
    }
  });
});
