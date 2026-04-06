/**
 * sanitize.ts
 *
 * Sanitizes user-supplied transcripts before they are submitted to any LLM.
 * Guards against prompt-injection attacks and enforces a hard length cap.
 */

export const MAX_TRANSCRIPT_LENGTH = 2_000;

/**
 * Ordered list of prompt-injection patterns.
 * Each match is replaced with "[removed]" so the surrounding text is preserved
 * and the LLM still receives a coherent message.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // "ignore [all] [previous|prior|above] [instructions|prompts|context]"
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|context)/gi,

  // Role-prefix injections: "system:", "user:", "assistant:"
  /\bsystem\s*:/gi,
  /\buser\s*:/gi,
  /\bassistant\s*:/gi,

  // "act as [...]"
  /\bact\s+as\b/gi,

  // "pretend you are [...]" / "pretend to be [...]"
  /\bpretend\s+(?:you\s+are|to\s+be)\b/gi,

  // "you are now [...]"
  /\byou\s+are\s+now\b/gi,

  // "forget [all|everything|your|the] [...]"
  /\bforget\s+(?:all|everything|your|the)\b/gi,

  // "do not follow [...]"
  /\bdo\s+not\s+follow\b/gi,

  // "jailbreak"
  /\bjailbreak\b/gi,

  // "dan mode"
  /\bdan\s+mode\b/gi,

  // "disregard [the|all] [above|previous|all] [...]"
  /\bdisregard\s+(?:the\s+|all\s+)?(?:above|previous|all)/gi,

  // "override [your] [instructions|rules|guidelines]"
  /\boverride\s+(?:your\s+)?(?:instructions?|rules?|guidelines?)\b/gi,

  // "repeat after me"
  /\brepeat\s+after\s+me\b/gi,

  // "translate the [following|above] to [...]"
  /\btranslate\s+the\s+(?:following|above)\s+to\b/gi,
];

/**
 * Sanitize a raw transcript string before LLM submission.
 *
 * 1. Trims leading / trailing whitespace.
 * 2. Replaces all prompt-injection patterns with "[removed]".
 * 3. Truncates to MAX_TRANSCRIPT_LENGTH characters.
 */
export function sanitizeTranscript(raw: string): string {
  let text = raw.trim();

  for (const pattern of INJECTION_PATTERNS) {
    text = text.replace(pattern, "[removed]");
  }

  if (text.length > MAX_TRANSCRIPT_LENGTH) {
    text = text.slice(0, MAX_TRANSCRIPT_LENGTH);
  }

  return text;
}
