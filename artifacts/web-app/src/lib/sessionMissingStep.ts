/**
 * Single source of truth for translating the server's `missingStep` value
 * (1–4) into a human-facing label and the route the user must complete.
 *
 * The numeric contract is owned by the server's `checkSessionReady`
 * middleware (see artifacts/api-server/src/middlewares/sessionReady.ts) and
 * is exposed to the client via the `GET /session/ready` probe and the 400
 * body of every gated POST endpoint (coaching-tip, employee-turn,
 * improved-replay, feedback-summary). The client never derives the step
 * locally — it only renders whatever step the server reports.
 */
export type MissingStep = 1 | 2 | 3 | 4;

export interface MissingStepInfo {
  step: MissingStep;
  label: string;
  target: string;
}

const MAP: Record<MissingStep, { label: string; target: string }> = {
  1: { label: "Biometric Consent", target: "/consent" },
  2: { label: "Scenario selection", target: "/setup" },
  3: { label: "Persona selection", target: "/setup" },
  4: { label: "Voice setup", target: "/onboarding" },
};

export function missingStepInfo(step: MissingStep): MissingStepInfo {
  return { step, ...MAP[step] };
}

/** Type guard for parsing `missingStep` out of an arbitrary error body. */
export function isMissingStep(value: unknown): value is MissingStep {
  return value === 1 || value === 2 || value === 3 || value === 4;
}
