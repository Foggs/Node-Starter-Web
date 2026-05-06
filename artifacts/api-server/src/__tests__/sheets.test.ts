import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── googleapis mock ─────────────────────────────────────────────────────────
//
// Hoisted via `vi.mock` so every dynamic import of `../lib/sheets.js` sees the
// stub. The mock exposes `__sheetsCalls` and `__authCalls` so tests can
// assert that lazy initialisation only occurs at call sites, never at import.

const sheetsApiSpy = vi.hoisted(() => vi.fn());
const authSpy = vi.hoisted(() => vi.fn());
const valuesGetSpy = vi.hoisted(() => vi.fn());
const valuesAppendSpy = vi.hoisted(() => vi.fn());

vi.mock("googleapis", () => {
  return {
    google: {
      auth: {
        GoogleAuth: class {
          constructor(opts: unknown) {
            authSpy(opts);
          }
        },
      },
      sheets: (opts: unknown) => {
        sheetsApiSpy(opts);
        return {
          spreadsheets: {
            values: {
              get: valuesGetSpy,
              append: valuesAppendSpy,
            },
          },
        };
      },
    },
  };
});

// ─── helpers ─────────────────────────────────────────────────────────────────

const VALID_SA = JSON.stringify({
  type: "service_account",
  client_email: "test@test.iam.gserviceaccount.com",
  private_key: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n",
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── module-load side-effect tests ───────────────────────────────────────────

describe("lib/sheets — module import", () => {
  it("does not throw or call googleapis when imported with no env set", async () => {
    // Crucially, no env stubs at all. Importing must not crash CI.
    const mod = await import("../lib/sheets.js");
    expect(mod.LeadsConfigError).toBeDefined();
    expect(authSpy).not.toHaveBeenCalled();
    expect(sheetsApiSpy).not.toHaveBeenCalled();
  });
});

// ─── getSheetsClient ─────────────────────────────────────────────────────────

describe("getSheetsClient", () => {
  it("lazy-inits with valid env and memoises the client", async () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", VALID_SA);

    const mod = await import("../lib/sheets.js");
    const a = mod.getSheetsClient();
    const b = mod.getSheetsClient();

    expect(a).toBe(b);
    expect(authSpy).toHaveBeenCalledTimes(1);
    expect(sheetsApiSpy).toHaveBeenCalledTimes(1);
  });

  it("throws LeadsConfigError when GOOGLE_SERVICE_ACCOUNT_JSON is missing", async () => {
    const mod = await import("../lib/sheets.js");
    expect(() => mod.getSheetsClient()).toThrow(mod.LeadsConfigError);
    expect(() => mod.getSheetsClient()).toThrow(
      /GOOGLE_SERVICE_ACCOUNT_JSON/,
    );
    expect(authSpy).not.toHaveBeenCalled();
  });

  it("throws LeadsConfigError when GOOGLE_SERVICE_ACCOUNT_JSON is malformed", async () => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", "{not json");

    const mod = await import("../lib/sheets.js");
    expect(() => mod.getSheetsClient()).toThrow(mod.LeadsConfigError);
    expect(() => mod.getSheetsClient()).toThrow(/not valid JSON/);
  });
});

// ─── getSheetId ──────────────────────────────────────────────────────────────

describe("getSheetId", () => {
  it("returns the sheet ID from env", async () => {
    vi.stubEnv("LEADS_SHEET_ID", "abc123sheetid");

    const mod = await import("../lib/sheets.js");
    expect(mod.getSheetId()).toBe("abc123sheetid");
  });

  it("throws LeadsConfigError when LEADS_SHEET_ID is missing", async () => {
    const mod = await import("../lib/sheets.js");
    expect(() => mod.getSheetId()).toThrow(mod.LeadsConfigError);
    expect(() => mod.getSheetId()).toThrow(/LEADS_SHEET_ID/);
  });
});

// ─── findEmailInSheet ────────────────────────────────────────────────────────

describe("findEmailInSheet", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", VALID_SA);
    vi.stubEnv("LEADS_SHEET_ID", "sheetid");
  });

  it("returns true when the email is present (case-insensitive)", async () => {
    valuesGetSpy.mockResolvedValueOnce({
      data: { values: [["alice@example.com"], ["BOB@Example.COM"]] },
    });

    const mod = await import("../lib/sheets.js");
    const found = await mod.findEmailInSheet("bob@example.com");
    expect(found).toBe(true);
  });

  it("returns false when the email is absent", async () => {
    valuesGetSpy.mockResolvedValueOnce({
      data: { values: [["alice@example.com"]] },
    });

    const mod = await import("../lib/sheets.js");
    const found = await mod.findEmailInSheet("nobody@example.com");
    expect(found).toBe(false);
  });

  it("returns false when the sheet has no rows", async () => {
    valuesGetSpy.mockResolvedValueOnce({ data: {} });

    const mod = await import("../lib/sheets.js");
    const found = await mod.findEmailInSheet("anything@example.com");
    expect(found).toBe(false);
  });
});

// ─── appendLeadRow ───────────────────────────────────────────────────────────

describe("appendLeadRow", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", VALID_SA);
    vi.stubEnv("LEADS_SHEET_ID", "sheetid");
  });

  it("appends a row with [ISO timestamp, name, email, demo_modal]", async () => {
    valuesAppendSpy.mockResolvedValueOnce({});

    const mod = await import("../lib/sheets.js");
    await mod.appendLeadRow("Alice Doe", "alice@example.com");

    expect(valuesAppendSpy).toHaveBeenCalledTimes(1);
    const call = valuesAppendSpy.mock.calls[0]?.[0];
    expect(call).toMatchObject({
      spreadsheetId: "sheetid",
      range: "Sheet1!A:D",
      valueInputOption: "USER_ENTERED",
    });

    const row = call.requestBody.values[0];
    expect(row[0]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(row[1]).toBe("Alice Doe");
    expect(row[2]).toBe("alice@example.com");
    expect(row[3]).toBe("demo_modal");
  });
});
