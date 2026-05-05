import { useCallback } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import {
  generateImprovedReplay,
  type ImprovedTurn,
} from "@workspace/api-client-react";

// Stable, app-wide cache key for the improved-replay generation. The session
// is server-side and singleton-per-cookie, so a static key is sufficient —
// React Query gives us cross-page de-duping, observer fan-out, and devtools
// visibility for free. (R3)
export const IMPROVED_REPLAY_QUERY_KEY = ["improvedReplay"] as const;

export type ImprovedReplayStatus = "idle" | "pending" | "success" | "error";

export interface UseImprovedReplayResult {
  status: ImprovedReplayStatus;
  data: ImprovedTurn[] | undefined;
  error: unknown;
  /** Kick the request off if it hasn't started (or is not already cached).
   *  Safe to call from multiple components / effects — concurrent callers
   *  receive the same in-flight promise. */
  ensureStarted: () => Promise<ImprovedTurn[]>;
  /** Reset cached state (success or error) and re-fire the request. */
  retry: () => Promise<ImprovedTurn[]>;
}

function fetchImprovedReplay(
  queryClient: QueryClient,
): Promise<ImprovedTurn[]> {
  // fetchQuery dedupes by queryKey: a second concurrent call returns the
  // same in-flight promise instead of issuing a duplicate request.
  return queryClient.fetchQuery<ImprovedTurn[]>({
    queryKey: IMPROVED_REPLAY_QUERY_KEY,
    queryFn: () => generateImprovedReplay(),
    retry: false,
    staleTime: Infinity,
  });
}

/**
 * Shared accessor for the improved-replay generation.
 *
 * Backed by a single React Query cache entry so `session.tsx` (which fires
 * the request eagerly when turn 5 completes), `feedback.tsx` (which renders
 * a "Preparing your replay…" indicator), and `replay.tsx` (which renders
 * the populated list) all observe the same lifecycle and never issue
 * duplicate requests.
 */
export function useImprovedReplay(): UseImprovedReplayResult {
  const queryClient = useQueryClient();

  // `enabled: false` means this observer never triggers a fetch on its
  // own — components that mount without calling `ensureStarted()` simply
  // observe whatever cached state already exists. When `fetchQuery` is
  // running for the same key, every observer reflects `fetchStatus`.
  const query = useQuery<ImprovedTurn[], unknown>({
    queryKey: IMPROVED_REPLAY_QUERY_KEY,
    queryFn: () => generateImprovedReplay(),
    enabled: false,
    retry: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const ensureStarted = useCallback(
    () => fetchImprovedReplay(queryClient),
    [queryClient],
  );

  const retry = useCallback(() => {
    queryClient.removeQueries({ queryKey: IMPROVED_REPLAY_QUERY_KEY });
    return fetchImprovedReplay(queryClient);
  }, [queryClient]);

  const status: ImprovedReplayStatus =
    query.data !== undefined
      ? "success"
      : query.fetchStatus === "fetching"
        ? "pending"
        : query.error
          ? "error"
          : "idle";

  return {
    status,
    data: query.data,
    error: query.error,
    ensureStarted,
    retry,
  };
}

/** Drop any cached improved-replay state. Call from the same lifecycle
 *  hooks that already clear the session checkpoint when a new practice
 *  session is about to begin (Discard, End session, redirect-from-resume). */
export function resetImprovedReplay(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: IMPROVED_REPLAY_QUERY_KEY });
}
