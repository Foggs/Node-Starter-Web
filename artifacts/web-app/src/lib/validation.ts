/**
 * Client-side form validation helpers shared by DemoLeadForm and ContactPage.
 *
 * The server is the source-of-truth validator (Zod schemas generated from
 * the OpenAPI spec). These helpers exist only to gate the submit button and
 * surface inline errors *before* the user clicks — they're a UX nicety,
 * never a security control.
 */

/**
 * Pragmatic email shape check: at least one non-whitespace, non-@ char,
 * then `@`, then non-whitespace, non-@ chars, then `.`, then more of the
 * same. Matches what the leads/contact endpoints accept (Zod `format: email`)
 * for the well-formed cases we care about. Server still enforces the full
 * RFC validation.
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Max email length matching the OpenAPI ContactRequest/LeadRequest cap. */
export const EMAIL_MAX_LENGTH = 254;

export function isValidEmail(raw: string): boolean {
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(trimmed);
}
