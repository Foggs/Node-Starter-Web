import { describe, it, expect } from "vitest";
import { scenarios } from "../scenarios";

const VALID_IDS = [
  "performance_issue",
  "layoff",
  "misconduct",
  "pip_failure",
] as const;

describe("scenarios seed data", () => {
  it("exports exactly 4 scenarios", () => {
    expect(scenarios).toHaveLength(4);
  });

  it("each scenario has a non-empty id, name, and description", () => {
    for (const s of scenarios) {
      expect(s.id, `id missing on scenario ${JSON.stringify(s)}`).toBeTruthy();
      expect(
        s.name,
        `name missing on scenario "${s.id}"`,
      ).toBeTruthy();
      expect(
        s.description,
        `description missing on scenario "${s.id}"`,
      ).toBeTruthy();
    }
  });

  it("every id is one of the four valid ScenarioId enum values", () => {
    for (const s of scenarios) {
      expect(VALID_IDS).toContain(s.id);
    }
  });

  it("all four enum values are represented exactly once", () => {
    const ids = scenarios.map((s) => s.id);
    for (const validId of VALID_IDS) {
      expect(
        ids.filter((id) => id === validId),
        `scenario "${validId}" should appear exactly once`,
      ).toHaveLength(1);
    }
  });

  it("ids are unique", () => {
    const ids = scenarios.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(scenarios.length);
  });

  it("names are unique", () => {
    const names = scenarios.map((s) => s.name);
    const unique = new Set(names);
    expect(unique.size).toBe(scenarios.length);
  });

  it("descriptions are at least 20 characters (content check)", () => {
    for (const s of scenarios) {
      expect(
        s.description.length,
        `description too short for scenario "${s.id}"`,
      ).toBeGreaterThanOrEqual(20);
    }
  });
});
