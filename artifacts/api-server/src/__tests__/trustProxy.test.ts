import { describe, it, expect, vi } from "vitest";
import request from "supertest";

import app from "../app.js";

describe("trust proxy / production cookie issuance", () => {
  it("emits a Set-Cookie header with Secure on /api/ping when X-Forwarded-Proto: https is forwarded in production mode", async () => {
    // The session middleware captures `secure: NODE_ENV === "production"` at
    // module-load time, so we must reset the module cache and re-import the
    // app after flipping NODE_ENV. Without this, the imported app has
    // `secure: false` (it was loaded under NODE_ENV=test) and the assertion
    // would never reflect production behaviour.
    vi.resetModules();
    const prev = process.env["NODE_ENV"];
    process.env["NODE_ENV"] = "production";
    try {
      const { default: prodApp } = await import("../app.js");

      const res = await request(prodApp)
        .get("/api/ping")
        .set("X-Forwarded-Proto", "https");

      expect(res.status).toBe(200);
      const setCookie = res.headers["set-cookie"] as string[] | string | undefined;
      expect(setCookie, "Set-Cookie missing — trust proxy likely not configured").toBeDefined();
      const cookies = Array.isArray(setCookie) ? setCookie.join("; ") : String(setCookie);
      expect(cookies).toMatch(/connect\.sid=/);
      expect(cookies).toMatch(/Secure/);
    } finally {
      if (prev === undefined) {
        delete process.env["NODE_ENV"];
      } else {
        process.env["NODE_ENV"] = prev;
      }
      vi.resetModules();
    }
  });

  it("has trust proxy configured (pinned so refactors of app.ts cannot silently remove it)", () => {
    expect(app.get("trust proxy")).toBeTruthy();
  });
});
