import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const specPath = resolve(__dirname, "../../../../lib/api-spec/openapi.yaml");
const specText = readFileSync(specPath, "utf-8");

const REQUIRED_PATHS: { path: string; method: string }[] = [
  { path: "/healthz", method: "get" },
  { path: "/ping", method: "get" },
  { path: "/scenarios", method: "get" },
  { path: "/personas", method: "get" },
  { path: "/session", method: "get" },
  { path: "/session", method: "patch" },
  { path: "/consent", method: "post" },
  { path: "/clone-voice", method: "post" },
  { path: "/voice/preview", method: "get" },
  { path: "/coaching-tip", method: "post" },
  { path: "/improved-replay", method: "post" },
  { path: "/feedback-summary", method: "post" },
  { path: "/export-report", method: "post" },
  { path: "/audio/{turnId}", method: "get" },
];

const REQUIRED_SCHEMAS = [
  "HealthStatus",
  "Scenario",
  "Persona",
  "SessionState",
  "Turn",
  "ConsentRequest",
  "ConsentResponse",
  "CloneVoiceResponse",
  "CoachingTipRequest",
  "CoachingTipResponse",
  "ImprovedTurn",
  "FeedbackSummary",
];

const REQUIRED_TAGS = ["health", "ping", "session", "consent", "voice", "coaching", "report"];

function pathBlock(path: string): string {
  const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^\\s{2}${escaped}:`, "m");
  const match = specText.match(re);
  return match ? specText.slice(match.index!) : "";
}

describe("openapi.yaml — required paths present", () => {
  for (const { path, method } of REQUIRED_PATHS) {
    it(`defines ${method.toUpperCase()} ${path}`, () => {
      const block = pathBlock(path);
      expect(
        block,
        `Path "${path}" not found in openapi.yaml`,
      ).not.toBe("");
      // Scan up to 2 000 chars to cover multi-method path blocks (e.g. GET + PATCH /session)
      expect(
        block.slice(0, 2000).toLowerCase(),
        `Method "${method}" not found under "${path}"`,
      ).toContain(`${method}:`);
    });
  }
});

describe("openapi.yaml — required schemas present", () => {
  for (const schema of REQUIRED_SCHEMAS) {
    it(`defines schema ${schema}`, () => {
      expect(specText, `Schema "${schema}" missing from components/schemas`).toContain(
        `${schema}:`,
      );
    });
  }
});

describe("openapi.yaml — required tags declared", () => {
  for (const tag of REQUIRED_TAGS) {
    it(`declares tag "${tag}"`, () => {
      expect(specText).toContain(`name: ${tag}`);
    });
  }
});

describe("openapi.yaml — 401 responses on protected endpoints", () => {
  const PROTECTED = ["/consent", "/clone-voice", "/coaching-tip", "/session"];
  for (const path of PROTECTED) {
    it(`includes a 401 response on ${path}`, () => {
      const block = pathBlock(path);
      // Scan up to 3 000 chars — responses appear after requestBody which can be verbose
      expect(
        block.slice(0, 3000),
        `No 401 response found under "${path}"`,
      ).toContain('"401"');
    });
  }
});
