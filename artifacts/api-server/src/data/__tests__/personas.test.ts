import { describe, it, expect } from "vitest";
import { personas } from "../personas";

const VALID_IDS = [
  "tearful",
  "defensive",
  "withdrawn",
  "professional",
  "angry",
] as const;

describe("personas seed data", () => {
  it("exports exactly 5 personas", () => {
    expect(personas).toHaveLength(5);
  });

  it("each persona has a non-empty id, name, emotionalStyle, and description", () => {
    for (const p of personas) {
      expect(p.id, `id missing on persona ${JSON.stringify(p)}`).toBeTruthy();
      expect(p.name, `name missing on persona "${p.id}"`).toBeTruthy();
      expect(
        p.emotionalStyle,
        `emotionalStyle missing on persona "${p.id}"`,
      ).toBeTruthy();
      expect(
        p.description,
        `description missing on persona "${p.id}"`,
      ).toBeTruthy();
    }
  });

  it("every id is one of the five valid PersonaId enum values", () => {
    for (const p of personas) {
      expect(VALID_IDS).toContain(p.id);
    }
  });

  it("all five enum values are represented exactly once", () => {
    const ids = personas.map((p) => p.id);
    for (const validId of VALID_IDS) {
      expect(
        ids.filter((id) => id === validId),
        `persona "${validId}" should appear exactly once`,
      ).toHaveLength(1);
    }
  });

  it("ids are unique", () => {
    const ids = personas.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(personas.length);
  });

  it("names are unique", () => {
    const names = personas.map((p) => p.name);
    const unique = new Set(names);
    expect(unique.size).toBe(personas.length);
  });

  it("descriptions are at least 20 characters (content check)", () => {
    for (const p of personas) {
      expect(
        p.description.length,
        `description too short for persona "${p.id}"`,
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it("emotionalStyles are unique across personas", () => {
    const styles = personas.map((p) => p.emotionalStyle);
    const unique = new Set(styles);
    expect(unique.size).toBe(personas.length);
  });
});
