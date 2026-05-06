import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── sheets mock ─────────────────────────────────────────────────────────────
//
// The handler imports `findEmailInSheet` and `appendLeadRow` from
// ../lib/sheets.js. We replace both with hoisted spies so no test ever
// touches `googleapis` or the network.

const findEmailInSheetSpy = vi.hoisted(() => vi.fn());
const appendLeadRowSpy = vi.hoisted(() => vi.fn());

vi.mock("../lib/sheets.js", () => ({
  findEmailInSheet: findEmailInSheetSpy,
  appendLeadRow: appendLeadRowSpy,
  LeadsConfigError: class LeadsConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "LeadsConfigError";
    }
  },
}));

import request from "supertest";
import app from "../app.js";

/**
 * The /api/leads rate limiter is per-IP and the in-memory store persists
 * for the lifetime of `app`. Give every test a unique forwarded IP so the
 * limit doesn't accumulate across describe blocks.
 *
 * `app.ts` sets `trust proxy = 1`, so the first IP in X-Forwarded-For wins.
 */
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter % 254 + 1}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  findEmailInSheetSpy.mockResolvedValue(false);
  appendLeadRowSpy.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

function postLead(body: object, ip: string = nextIp()) {
  return request(app)
    .post("/api/leads")
    .set("X-Forwarded-For", ip)
    .send(body);
}

// ─── 1. valid name + email → 201, row appended ───────────────────────────────

describe("POST /api/leads — happy path", () => {
  it("returns 201 and appends a row when name + email are valid", async () => {
    const res = await postLead({ name: "Alice Doe", email: "alice@example.com" }).expect(201);

    expect(res.body).toEqual({ success: true });
    expect(findEmailInSheetSpy).toHaveBeenCalledWith("alice@example.com");
    expect(appendLeadRowSpy).toHaveBeenCalledTimes(1);
    expect(appendLeadRowSpy).toHaveBeenCalledWith(
      "Alice Doe",
      "alice@example.com",
    );
  });

  it("trims whitespace from name and lowercases email before write", async () => {
    await postLead({ name: "  Bob  ", email: "BOB@Example.COM" }).expect(201);

    expect(appendLeadRowSpy).toHaveBeenCalledWith("Bob", "bob@example.com");
  });

  it("initialises a session cookie on success (so the user can hit /api/consent next)", async () => {
    const res = await postLead({ name: "Carol", email: "carol@example.com" }).expect(201);

    const setCookie = res.headers["set-cookie"];
    const cookies = Array.isArray(setCookie) ? setCookie : [String(setCookie ?? "")];
    expect(cookies.some((c) => c.startsWith("connect.sid="))).toBe(true);
  });
});

// ─── 2. missing name → 400 ───────────────────────────────────────────────────

describe("POST /api/leads — missing name", () => {
  it("returns 400 when name is missing", async () => {
    const res = await postLead({ email: "alice@example.com" }).expect(400);
    expect(res.body).toHaveProperty("error");
    expect(appendLeadRowSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when name is too short (1 char)", async () => {
    const res = await postLead({ name: "A", email: "alice@example.com" }).expect(400);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── 3. missing email → 400 ──────────────────────────────────────────────────

describe("POST /api/leads — missing email", () => {
  it("returns 400 when email is missing", async () => {
    const res = await postLead({ name: "Alice Doe" }).expect(400);
    expect(res.body).toHaveProperty("error");
    expect(appendLeadRowSpy).not.toHaveBeenCalled();
  });
});

// ─── 4. invalid email format → 400 ───────────────────────────────────────────

describe("POST /api/leads — invalid email format", () => {
  it("returns 400 when email has no @ sign", async () => {
    const res = await postLead({ name: "Alice Doe", email: "notanemail" }).expect(400);
    expect(res.body).toHaveProperty("error");
    expect(appendLeadRowSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when email has whitespace", async () => {
    const res = await postLead({ name: "Alice Doe", email: "alice @example.com" }).expect(400);
    expect(res.body).toHaveProperty("error");
  });

  it("returns 400 when email is missing the TLD", async () => {
    const res = await postLead({ name: "Alice Doe", email: "alice@example" }).expect(400);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── 5. duplicate email → 201, append NOT called ─────────────────────────────

describe("POST /api/leads — duplicate email", () => {
  it("returns 201 silently and does not append when email already exists", async () => {
    findEmailInSheetSpy.mockResolvedValueOnce(true);

    const res = await postLead({ name: "Alice Doe", email: "alice@example.com" }).expect(201);

    expect(res.body).toEqual({ success: true });
    expect(findEmailInSheetSpy).toHaveBeenCalledTimes(1);
    expect(appendLeadRowSpy).not.toHaveBeenCalled();
  });
});

// ─── 6. rate limit (6th request) → 429 ───────────────────────────────────────

describe("POST /api/leads — rate limit", () => {
  it("returns 429 on the 6th request from the same IP within the window", async () => {
    const ip = "203.0.113.99"; // unique to this test
    const send = () => postLead({ name: "RL Tester", email: "rl@example.com" }, ip);

    // First 5 succeed (duplicate detection skips append after first, but
    // the rate limiter counts every request).
    for (let i = 0; i < 5; i++) {
      await send().expect(201);
    }

    const res = await send().expect(429);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── 7. sheets API throws → 500, no detail in body ───────────────────────────

describe("POST /api/leads — sheets failure", () => {
  it("returns 500 with a generic error when findEmailInSheet throws", async () => {
    findEmailInSheetSpy.mockRejectedValueOnce(
      new Error("Internal Sheets API exploded with secret-token=abc123"),
    );

    const res = await postLead({ name: "Alice Doe", email: "fail-find@example.com" }).expect(500);

    // Generic error only — no detail leak
    expect(res.body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(res.body)).not.toMatch(/secret-token/);
    expect(JSON.stringify(res.body)).not.toMatch(/Sheets/i);
  });

  it("returns 500 with a generic error when appendLeadRow throws", async () => {
    appendLeadRowSpy.mockRejectedValueOnce(
      new Error("Sheets API: quota exceeded for service-account@x.iam"),
    );

    const res = await postLead({ name: "Alice Doe", email: "fail-append@example.com" }).expect(500);

    expect(res.body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(res.body)).not.toMatch(/service-account/);
  });
});
