/**
 * sessions table — Phase 2 schema stub.
 *
 * NOT used in the MVP; all runtime state lives in Express sessions (memorystore).
 * Defined now so migrations can be generated and reviewed before Task #6 wires
 * persistence.
 *
 * Security note: voice_id is intentionally ABSENT from this table.
 * It must never be written to disk or any persistent store.
 */
import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const sessionsTable = pgTable("sessions", {
  /** Express session ID — used as the natural primary key. */
  id: text("id").primaryKey(),

  /** True once the manager has accepted the biometric consent prompt. */
  consent_given: boolean("consent_given").notNull().default(false),

  /** Server-side ISO 8601 timestamp of when consent was recorded. */
  consent_timestamp: timestamp("consent_timestamp", { withTimezone: true }),

  /** True once ElevenLabs has confirmed a voice clone for this session. */
  voice_cloned: boolean("voice_cloned").notNull().default(false),

  /**
   * Selected ScenarioId (e.g. "layoff", "pip_failure").
   * Nullable until the manager completes onboarding.
   */
  scenario_id: text("scenario_id"),

  /**
   * Selected PersonaId (e.g. "tearful", "defensive").
   * Nullable until the manager completes onboarding.
   */
  persona_id: text("persona_id"),

  /** When this session was first created. */
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),

  /** When the session cookie expires (mirrors Express session maxAge). */
  expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Zod schema for inserting a new session row.
 * Unknown keys (including any accidental voice_id) are stripped by default.
 */
export const insertSessionSchema = createInsertSchema(sessionsTable);

export type InsertSession = typeof insertSessionSchema.type;
export type Session = typeof sessionsTable.$inferSelect;
