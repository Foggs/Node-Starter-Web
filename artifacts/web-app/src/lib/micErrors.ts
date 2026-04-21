/**
 * Maps `getUserMedia` / `MediaRecorder` failures to actionable, user-facing
 * messages. Centralised so onboarding and session show consistent copy.
 *
 * Returns `{ title, body, isPermission }` — `isPermission` lets the caller
 * suppress retry buttons that won't help (the user must change browser
 * settings before another attempt can succeed).
 */
export interface MicErrorInfo {
  title: string;
  body: string;
  isPermission: boolean;
}

export function categorizeMicError(err: unknown): MicErrorInfo {
  const name =
    err instanceof DOMException
      ? err.name
      : err instanceof Error
        ? err.name
        : "";

  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        title: "Microphone access was blocked",
        body: "Allow microphone access for this site in your browser settings, then reload the page.",
        isPermission: true,
      };
    case "NotFoundError":
    case "OverconstrainedError":
      return {
        title: "No microphone detected",
        body: "Plug in or enable a microphone, then try again.",
        isPermission: false,
      };
    case "NotReadableError":
    case "AbortError":
      return {
        title: "Your microphone is in use",
        body: "Another app or browser tab seems to be using the mic. Close it and try again.",
        isPermission: false,
      };
    case "TypeError":
      return {
        title: "Microphone unavailable",
        body: "This browser blocked microphone access. Try a different browser, or open the page over HTTPS.",
        isPermission: true,
      };
    default:
      return {
        title: "We couldn't start your microphone",
        body: "Please try again. If this keeps happening, reload the page.",
        isPermission: false,
      };
  }
}
