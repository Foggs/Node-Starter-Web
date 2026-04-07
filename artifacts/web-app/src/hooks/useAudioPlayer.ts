import { useState, useRef, useCallback, useEffect } from "react";

export type PlaybackState = "idle" | "loading" | "playing" | "error";

export interface UseAudioPlayerReturn {
  playbackState: PlaybackState;
  play: (url: string) => void;
  stop: () => void;
}

interface AudioHandlers {
  canplay: () => void;
  playing: () => void;
  ended: () => void;
  error: () => void;
}

function removeHandlers(audio: HTMLAudioElement, handlers: AudioHandlers) {
  audio.removeEventListener("canplay", handlers.canplay);
  audio.removeEventListener("playing", handlers.playing);
  audio.removeEventListener("ended", handlers.ended);
  audio.removeEventListener("error", handlers.error);
}

/**
 * Manages a single HTMLAudioElement lifecycle with clean state tracking.
 *
 * - `play(url)` sets state to "loading", waits for canplay, then starts
 *   playback and transitions to "playing". On `ended` → "idle".
 * - `stop()` pauses audio, removes all listeners, and resets to "idle".
 * - On audio error → "error" (caller can degrade gracefully).
 * - Cleans up (pauses, removes listeners, clears src) on component unmount.
 */
export function useAudioPlayer(): UseAudioPlayerReturn {
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handlersRef = useRef<AudioHandlers | null>(null);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (handlersRef.current) {
      removeHandlers(audio, handlersRef.current);
      handlersRef.current = null;
    }
    audio.pause();
    audio.src = "";
    audioRef.current = null;
    setPlaybackState("idle");
  }, []);

  const play = useCallback(
    (url: string) => {
      stop();

      const audio = new Audio(url);
      audioRef.current = audio;
      setPlaybackState("loading");

      const handlers: AudioHandlers = {
        canplay: () => {
          audio.play().catch(() => {
            if (handlersRef.current) {
              removeHandlers(audio, handlersRef.current);
              handlersRef.current = null;
            }
            audioRef.current = null;
            setPlaybackState("error");
          });
        },
        playing: () => {
          setPlaybackState("playing");
        },
        ended: () => {
          if (handlersRef.current) {
            removeHandlers(audio, handlersRef.current);
            handlersRef.current = null;
          }
          audioRef.current = null;
          setPlaybackState("idle");
        },
        error: () => {
          if (handlersRef.current) {
            removeHandlers(audio, handlersRef.current);
            handlersRef.current = null;
          }
          audioRef.current = null;
          setPlaybackState("error");
        },
      };

      handlersRef.current = handlers;
      audio.addEventListener("canplay", handlers.canplay, { once: true });
      audio.addEventListener("playing", handlers.playing);
      audio.addEventListener("ended", handlers.ended);
      audio.addEventListener("error", handlers.error);
    },
    [stop],
  );

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (handlersRef.current) {
        removeHandlers(audio, handlersRef.current);
        handlersRef.current = null;
      }
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  return { playbackState, play, stop };
}
