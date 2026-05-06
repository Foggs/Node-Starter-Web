import { useEffect, useRef, useState } from "react";
import { Play, Sparkles } from "lucide-react";

/**
 * ImprovedReplayTease — the side-by-side payoff shown after Turn 3.
 *
 * Props:
 *  - originalText:      Turn 2 manager transcript as said in the demo
 *  - improvedText:      GPT-rewritten Turn 2 (applies the coaching tip)
 *  - improvedAudioSrc:  pre-generated Adam @ stability 0.70 audio
 *  - onAudioEnded:      called when the improved audio finishes (drives
 *                       the demo's tease_audio → tease_closing transition)
 *  - paused:            when true, the audio pauses; resumes on false
 *
 * The right-panel transcript reveals word-by-word, evenly distributed
 * across the audio's actual duration so reveal pace matches voice pace
 * regardless of file length.
 *
 * Spec: demo-feature.md §"Improved Replay Tease".
 */

export interface ImprovedReplayTeaseProps {
  originalText: string;
  improvedText: string;
  improvedAudioSrc: string;
  onAudioEnded: () => void;
  /** External pause/resume signal driven by the modal's pause button. */
  paused?: boolean;
}

export function ImprovedReplayTease({
  originalText,
  improvedText,
  improvedAudioSrc,
  onAudioEnded,
  paused = false,
}: ImprovedReplayTeaseProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [revealedWordCount, setRevealedWordCount] = useState(0);

  const improvedWords = improvedText.split(/\s+/);

  // ── playback control ─────────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (paused) {
      audio.pause();
    } else {
      // The user/spec expects this to start automatically when the tease
      // mounts. play() returns a promise we deliberately swallow — most
      // failure modes (autoplay policy, transient network) are acceptable
      // here because the transcripts still render and onAudioEnded fires
      // via the audio element's `ended` listener.
      audio.play().catch(() => {});
    }
  }, [paused]);

  // ── word-by-word reveal driven by audio time ─────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const dur = audio.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const ratio = Math.min(1, audio.currentTime / dur);
      const next = Math.max(
        revealedWordCount,
        Math.floor(ratio * improvedWords.length),
      );
      if (next !== revealedWordCount) setRevealedWordCount(next);
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setRevealedWordCount(improvedWords.length);
      setIsPlaying(false);
      onAudioEnded();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [improvedWords.length, onAudioEnded]);

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <p className="mb-4 text-sm text-slate-500 italic">
        ↩ Here's how Turn 2 could have sounded.
      </p>

      <audio ref={audioRef} src={improvedAudioSrc} preload="auto" />

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {/* Left — original */}
        <div className="pr-0 sm:pr-4 pb-4 sm:pb-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            What you said
          </p>
          <p className="text-sm text-slate-400 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all">
            {originalText}
          </p>
        </div>

        {/* Right — improved */}
        <div className="pl-0 sm:pl-4 pt-4 sm:pt-0">
          <div className="flex items-center justify-between mb-2">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <Sparkles className="w-3 h-3" />
              Exit Coach rewrite
            </span>
            <span
              data-testid="improved-play-icon"
              className={`inline-flex items-center gap-1 text-xs ${
                isPlaying ? "text-emerald-700 animate-pulse" : "text-slate-400"
              }`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span className="text-[10px] uppercase tracking-wide">
                {isPlaying ? "Playing" : "Paused"}
              </span>
            </span>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            {improvedWords.slice(0, revealedWordCount).join(" ")}
            <span className="text-slate-300">
              {revealedWordCount > 0 && revealedWordCount < improvedWords.length ? " " : ""}
              {improvedWords.slice(revealedWordCount).join(" ")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
