import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── sheets mock ─────────────────────────────────────────────────────────────
//
// The handler imports `appendContactRow` from ../lib/sheets.js. We replace
// it (and the sibling exports the leads handler also pulls in) with hoisted
// spies so no test ever touches `googleapis` or the network. Both routers
// import from the same module, so the mock has to expose the leads exports
// too — otherwise just loading `app` blows up before a single test runs.

const appendContactRowSpy = vi.hoisted(() => vi.fn());
const findEmailInSheetSpy = vi.hoisted(() => vi.fn());
const appendLeadRowSpy = vi.hoisted(() => vi.fn());

vi.mock("../lib/sheets.js", () => ({
  appendContactRow: appendContactRowSpy,
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
 * The /api/contact rate limiter is per-IP and the in-memory store persists
 * for the lifetime of `app`. Give every test a unique forwarded IP so the
 * limit doesn't accumulate across describe blocks.
 *
 * Use a different /24 than leads.test.ts (203.0.113.x is RFC 5737 doc range
 * also used by leads; we use 192.0.2.x — the other doc-only /24 — to be
 * extra safe against cross-suite collisions if the test runner ever shares
 * a process).
 */
let ipCounter = 0;
function nextIp(): string {
  ipCounter += 1;
  return `192.0.2.${ipCounter % 254 + 1}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  appendContactRowSpy.mockResolvedValue(undefined);
  findEmailInSheetSpy.mockResolvedValue(false);
  appendLeadRowSpy.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

const validBody = {
  name: "Alice Doe",
  email: "alice@example.com",
  message: "I'd love to hear more about Exit Coach for our HR team.",
};

function postContact(body: object, ip: string = nextIp()) {
  return request(app)
    .post("/api/contact")
    .set("X-Forwarded-For", ip)
    .send(body);
}

// ─── 1. valid name + email + message → 201, row appended ─────────────────────

describe("POST /api/contact — happy path", () => {
  it("returns 201 and appends a row when all fields are valid", async () => {
    const res = await postContact(validBody).expect(201);

    expect(res.body).toEqual({ success: true });
    expect(appendContactRowSpy).toHaveBeenCalledTimes(1);
    expect(appendContactRowSpy).toHaveBeenCalledWith(
      validBody.name,
      validBody.email,
      validBody.message,
    );
  });

  it("trims whitespace from name and message, and lowercases email before write", async () => {
    await postContact({
      name: "  Bob  ",
      email: "BOB@Example.COM",
      message: "  Please get in touch about your enterprise tier.  ",
    }).expect(201);

    expect(appendContactRowSpy).toHaveBeenCalledWith(
      "Bob",
      "bob@example.com",
      "Please get in touch about your enterprise tier.",
    );
  });
});

// ─── 2. missing name → 400 ───────────────────────────────────────────────────

describe("POST /api/contact — missing name", () => {
  it("returns 400 when name is missing", async () => {
    const res = await postContact({
      email: validBody.email,
      message: validBody.message,
    }).expect(400);
    expect(res.body).toHaveProperty("error");
    expect(appendContactRowSpy).not.toHaveBeenCalled();
  });
});

// ─── 3. missing email → 400 ──────────────────────────────────────────────────

describe("POST /api/contact — missing email", () => {
  it("returns 400 when email is missing", async () => {
    const res = await postContact({
      name: validBody.name,
      message: validBody.message,
    }).expect(400);
    expect(res.body).toHaveProperty("error");
    expect(appendContactRowSpy).not.toHaveBeenCalled();
  });
});

// ─── 4. invalid email format → 400 ───────────────────────────────────────────

describe("POST /api/contact — invalid email format", () => {
  it("returns 400 when email has no @ sign", async () => {
    const res = await postContact({ ...validBody, email: "notanemail" }).expect(400);
    expect(res.body).toHaveProperty("error");
    expect(appendContactRowSpy).not.toHaveBeenCalled();
  });
});

// ─── 5. message under 10 chars → 400 ─────────────────────────────────────────

describe("POST /api/contact — message too short", () => {
  it("returns 400 when message is under 10 chars", async () => {
    const res = await postContact({ ...validBody, message: "too short" }).expect(400);
    expect(res.body).toHaveProperty("error");
    expect(appendContactRowSpy).not.toHaveBeenCalled();
  });
});

// ─── 6. message over 2000 chars → 400 ────────────────────────────────────────

describe("POST /api/contact — message too long", () => {
  it("returns 400 when message exceeds 2000 chars", async () => {
    const res = await postContact({
      ...validBody,
      message: "a".repeat(2001),
    }).expect(400);
    expect(res.body).toHaveProperty("error");
    expect(appendContactRowSpy).not.toHaveBeenCalled();
  });
});

// ─── 7. rate limit (4th request) → 429 ───────────────────────────────────────

describe("POST /api/contact — rate limit", () => {
  it("returns 429 on the 4th request from the same IP within the window", async () => {
    const ip = "192.0.2.250"; // unique to this test, avoids nextIp() range
    const send = () => postContact(validBody, ip);

    for (let i = 0; i < 3; i++) {
      await send().expect(201);
    }

    const res = await send().expect(429);
    expect(res.body).toHaveProperty("error");
  });
});

// ─── 8. sheets API throws → 500, no detail in body ───────────────────────────

describe("POST /api/contact — sheets failure", () => {
  it("returns 500 with a generic error when appendContactRow throws", async () => {
    appendContactRowSpy.mockRejectedValueOnce(
      new Error("Sheets API: quota exceeded for service-account@x.iam"),
    );

    const res = await postContact({
      ...validBody,
      email: "fail-append@example.com",
    }).expect(500);

    expect(res.body).toEqual({ error: "Internal error" });
    expect(JSON.stringify(res.body)).not.toMatch(/service-account/);
    expect(JSON.stringify(res.body)).not.toMatch(/Sheets/i);
  });
});

// ─── 9. duplicate email → 201 both times, both rows appended ─────────────────

describe("POST /api/contact — no email deduplication", () => {
  it("returns 201 and appends both times when the same email submits twice", async () => {
    await postContact(validBody).expect(201);
    await postContact({
      ...validBody,
      message: "Following up on my earlier note — any update?",
    }).expect(201);

    expect(appendContactRowSpy).toHaveBeenCalledTimes(2);
  });
});
