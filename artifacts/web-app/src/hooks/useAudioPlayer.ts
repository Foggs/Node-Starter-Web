import { useState, useRef, useCallback, useEffect } from "react";

export type PlaybackState = "idle" | "loading" | "playing" | "error";

export interface UseAudioPlayerReturn {
  playbackState: PlaybackState;
  play: (url: string) => void;
  stop: () => void;
}

/**
 * Manages a single HTMLAudioElement lifecycle with clean state tracking.
 *
 * - `play(url)` sets state to "loading", waits for canplay, then starts
 *   playback and transitions to "playing". On `ended` → "idle".
 * - `stop()` pauses audio and resets to "idle".
 * - On audio error → "error" (caller can degrade gracefully).
 * - Cleans up (pauses, clears src) on component unmount.
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = "";
    audioRef.current = null;
    setPlaybackState("idle");
  }, []);

  const play = useCallback((url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    setPlaybackState("loading");

    audio.addEventListener(
      "canplay",
      () => {
        audio.play().catch(() => {
          audioRef.current = null;
          setPlaybackState("error");
        });
      },
      { once: true },
    );

    audio.addEventListener("playing", () => {
      setPlaybackState("playing");
    });

    audio.addEventListener("ended", () => {
      audioRef.current = null;
      setPlaybackState("idle");
    });

    audio.addEventListener("error", () => {
      audioRef.current = null;
      setPlaybackState("error");
    });
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  return { playbackState, play, stop };
}
