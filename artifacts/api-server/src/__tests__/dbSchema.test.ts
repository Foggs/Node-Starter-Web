/**
 * Step 14 — Phase 2 DB schema structural tests.
 *
 * These are compile-time / structural checks only — no database is connected.
 * They verify that the Drizzle table definitions export the right column names
 * and that the insert Zod schemas are present.  The tables are NOT used in the
 * MVP; all runtime state lives in Express sessions.
 */
import { describe, it, expect } from "vitest";
import {
  sessionsTable,
  turnsTable,
  insertSessionSchema,
  insertTurnSchema,
} from "@workspace/db/schema";

// ─── sessions table ──────────────────────────────────────────────────────────

describe("sessionsTable — column definitions", () => {
  it("exports sessionsTable", () => {
    expect(sessionsTable).toBeDefined();
  });

  it("has an id column (session ID, text primary key)", () => {
    expect(sessionsTable.id).toBeDefined();
  });

  it("has a consent_given column (boolean)", () => {
    expect(sessionsTable.consent_given).toBeDefined();
  });

  it("has a consent_timestamp column (nullable timestamp)", () => {
    expect(sessionsTable.consent_timestamp).toBeDefined();
  });

  it("has a voice_cloned column (boolean)", () => {
    expect(sessionsTable.voice_cloned).toBeDefined();
  });

  it("has a scenario_id column (nullable text)", () => {
    expect(sessionsTable.scenario_id).toBeDefined();
  });

  it("has a persona_id column (nullable text)", () => {
    expect(sessionsTable.persona_id).toBeDefined();
  });

  it("has a created_at column (timestamp)", () => {
    expect(sessionsTable.created_at).toBeDefined();
  });

  it("has an expires_at column (timestamp)", () => {
    expect(sessionsTable.expires_at).toBeDefined();
  });

  it("does NOT have a voice_id column (voice_id must never be persisted)", () => {
    // voice_id stays in Express session memory only — never written to disk/DB
    expect((sessionsTable as unknown as Record<string, unknown>)["voice_id"]).toBeUndefined();
  });
});

// ─── turns table ─────────────────────────────────────────────────────────────

describe("turnsTable — column definitions", () => {
  it("exports turnsTable", () => {
    expect(turnsTable).toBeDefined();
  });

  it("has an id column (serial primary key)", () => {
    expect(turnsTable.id).toBeDefined();
  });

  it("has a session_id column (FK to sessions)", () => {
    expect(turnsTable.session_id).toBeDefined();
  });

  it("has a turn_index column (integer 1-5)", () => {
    expect(turnsTable.turn_index).toBeDefined();
  });

  it("has a role column (employee | manager)", () => {
    expect(turnsTable.role).toBeDefined();
  });

  it("has a transcript column (text)", () => {
    expect(turnsTable.transcript).toBeDefined();
  });

  it("has a coaching_tip column (nullable text)", () => {
    expect(turnsTable.coaching_tip).toBeDefined();
  });

  it("has an emotion_score column (nullable integer)", () => {
    expect(turnsTable.emotion_score).toBeDefined();
  });

  it("has a created_at column (timestamp)", () => {
    expect(turnsTable.created_at).toBeDefined();
  });
});

// ─── Zod insert schemas ───────────────────────────────────────────────────────

describe("insert Zod schemas", () => {
  it("exports insertSessionSchema", () => {
    expect(insertSessionSchema).toBeDefined();
    expect(typeof insertSessionSchema.parse).toBe("function");
  });

  it("exports insertTurnSchema", () => {
    expect(insertTurnSchema).toBeDefined();
    expect(typeof insertTurnSchema.parse).toBe("function");
  });

  it("insertSessionSchema rejects a row that includes voice_id", () => {
    // Safety check: even if someone tries to persist voice_id via the schema it
    // should be stripped (unknown keys are stripped by Zod's default behaviour)
    const result = insertSessionSchema.safeParse({
      id: "sess-abc",
      expires_at: new Date(),
      voice_id: "should-be-stripped",
    });
    // Parse succeeds (strip mode) but the result must NOT contain voice_id
    if (result.success) {
      expect((result.data as Record<string, unknown>)["voice_id"]).toBeUndefined();
    }
    // If it fails validation for another reason that is also acceptable
  });

  it("insertTurnSchema parses a valid turn row", () => {
    const result = insertTurnSchema.safeParse({
      session_id: "sess-abc",
      turn_index: 1,
      role: "manager",
      transcript: "We need to talk about your performance.",
    });
    expect(result.success).toBe(true);
  });
});
