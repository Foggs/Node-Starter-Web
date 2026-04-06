/**
 * All endpoints that were once stubs are now implemented:
 *   - POST /api/consent         → consent.test.ts
 *   - POST /api/clone-voice     → cloneVoice.test.ts
 *   - GET  /api/voice/preview   → voicePreview.test.ts
 *   - POST /api/coaching-tip    → coaching.test.ts
 *   - POST /api/employee-turn   → employeeTurn.test.ts
 *   - POST /api/feedback-summary → feedbackSummary.test.ts
 *   - POST /api/improved-replay  → improvedReplay.test.ts
 *   - GET  /api/audio/:turnId   → improvedReplay.test.ts
 *   - POST /api/export-report   → exportReport.test.ts
 *
 * This file now holds lightweight sanity tests covering the session guard
 * behaviour shared by all protected routes.
 */

import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";

const PROTECTED_ROUTES: Array<{ method: "get" | "post" | "patch"; path: string }> = [
  { method: "post", path: "/api/consent" },
  { method: "post", path: "/api/clone-voice" },
  { method: "get", path: "/api/voice/preview" },
  { method: "get", path: "/api/session" },
  { method: "patch", path: "/api/session" },
  { method: "post", path: "/api/coaching-tip" },
  { method: "post", path: "/api/employee-turn" },
  { method: "post", path: "/api/feedback-summary" },
  { method: "post", path: "/api/improved-replay" },
  { method: "get", path: "/api/audio/some-turn-id" },
  { method: "post", path: "/api/export-report" },
];

describe("Session guard — all protected routes return 401 without a session cookie", () => {
  for (const { method, path } of PROTECTED_ROUTES) {
    it(`${method.toUpperCase()} ${path}`, async () => {
      const res = await (request(app)[method] as (url: string) => request.Test)(path);
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("error");
    });
  }
});
