import { useEffect, useState } from "react";

/**
 * Returns true once `pending` has been continuously true for `thresholdMs`.
 * Resets to false the moment `pending` becomes false (or the threshold changes).
 *
 * Used to surface a "still working — you can cancel and retry" hint after a
 * configurable delay on long-running mutations, so users never feel the UI
 * has frozen on a slow-but-eventually-successful AI request.
 */
export function useSlowRequestHint(
  pending: boolean,
  thresholdMs = 6000,
): boolean {
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    if (!pending) {
      setIsSlow(false);
      return;
    }
    setIsSlow(false);
    const id = window.setTimeout(() => setIsSlow(true), thresholdMs);
    return () => window.clearTimeout(id);
  }, [pending, thresholdMs]);

  return isSlow;
}
