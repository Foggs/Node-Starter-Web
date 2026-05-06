import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { validateEnv } from "../validateEnv.js";

const REQUIRED_VARS = [
  "ELEVENLABS_API_KEY",
  "OPENAI_API_KEY",
  "ELEVENLABS_AGENT_ID",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "LEADS_SHEET_ID",
];

const VALID_ENV = {
  ELEVENLABS_API_KEY: "el-key",
  OPENAI_API_KEY: "oai-key",
  ELEVENLABS_AGENT_ID: "agent-id",
  GOOGLE_SERVICE_ACCOUNT_JSON: '{"client_email":"x@y.iam.gserviceaccount.com"}',
  LEADS_SHEET_ID: "sheet-id",
};

const ALL_KEYS = [...REQUIRED_VARS, "NODE_ENV"] as const;

function withEnv(overrides: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of ALL_KEYS) {
    saved[key] = process.env[key];
  }
  // Default to 'development' so validateEnv's test-guard does not short-circuit.
  // Individual tests may override NODE_ENV inside their own overrides object.
  const merged = { NODE_ENV: "development", ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    fn();
  } finally {
    for (const key of ALL_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
  }
}

describe("validateEnv", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as () => never);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not exit when all required env vars are present", () => {
    withEnv(VALID_ENV, () => {
      validateEnv();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });

  it("calls process.exit(1) when ELEVENLABS_API_KEY is missing", () => {
    withEnv({ ...VALID_ENV, ELEVENLABS_API_KEY: undefined }, () => {
      validateEnv();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  it("calls process.exit(1) when OPENAI_API_KEY is missing", () => {
    withEnv({ ...VALID_ENV, OPENAI_API_KEY: undefined }, () => {
      validateEnv();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  it("calls process.exit(1) when ELEVENLABS_AGENT_ID is missing", () => {
    withEnv({ ...VALID_ENV, ELEVENLABS_AGENT_ID: undefined }, () => {
      validateEnv();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  it("calls process.exit(1) when GOOGLE_SERVICE_ACCOUNT_JSON is missing", () => {
    withEnv({ ...VALID_ENV, GOOGLE_SERVICE_ACCOUNT_JSON: undefined }, () => {
      validateEnv();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  it("calls process.exit(1) when LEADS_SHEET_ID is missing", () => {
    withEnv({ ...VALID_ENV, LEADS_SHEET_ID: undefined }, () => {
      validateEnv();
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  it("logs a clear error message naming the missing variable", () => {
    withEnv({ ...VALID_ENV, ELEVENLABS_API_KEY: undefined }, () => {
      validateEnv();
      const message = errorSpy.mock.calls.flat().join(" ");
      expect(message).toContain("ELEVENLABS_API_KEY");
    });
  });

  it("calls process.exit(1) once even when multiple vars are missing", () => {
    withEnv(
      {
        ELEVENLABS_API_KEY: undefined,
        OPENAI_API_KEY: undefined,
        ELEVENLABS_AGENT_ID: undefined,
        GOOGLE_SERVICE_ACCOUNT_JSON: undefined,
        LEADS_SHEET_ID: undefined,
      },
      () => {
        validateEnv();
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(exitSpy).toHaveBeenCalledTimes(1);
      },
    );
  });

  it("skips validation entirely when NODE_ENV is 'test'", () => {
    withEnv(
      {
        NODE_ENV: "test",
        ELEVENLABS_API_KEY: undefined,
        OPENAI_API_KEY: undefined,
        ELEVENLABS_AGENT_ID: undefined,
        GOOGLE_SERVICE_ACCOUNT_JSON: undefined,
        LEADS_SHEET_ID: undefined,
      },
      () => {
        validateEnv();
        expect(exitSpy).not.toHaveBeenCalled();
      },
    );
  });
});
