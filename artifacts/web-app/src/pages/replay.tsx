import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  Play,
  Pause,
  ChevronLeft,
  RefreshCcw,
  Mic2,
  Loader2,
  AlertTriangle,
  Volume2,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  useGenerateImprovedReplay,
  type ImprovedTurn,
} from "@workspace/api-client-react";

// ─── audio player ─────────────────────────────────────────────────────────────

function TurnAudioPlayer({ audioUrl }: { audioUrl?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);

  function toggle() {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      setHasEnded(false);
      void audioRef.current.play();
    }
  }

  if (!audioUrl) {
    return (
      <p className="text-xs text-slate-400 italic mt-2">
        Audio unavailable for this turn.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        onEnded={() => {
          setPlaying(false);
          setHasEnded(true);
        }}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        preload="none"
      />
      <Button
        size="sm"
        variant="outline"
        className={`gap-1.5 text-xs ${
          playing
            ? "border-amber-500 text-amber-800 bg-amber-50"
            : "text-slate-700"
        }`}
        onClick={toggle}
        title={
          playing ? "Pause" : hasEnded ? "Replay audio" : "Play improved version"
        }
        aria-label={
          playing
            ? "Pause improved audio"
            : hasEnded
              ? "Replay improved audio"
              : "Play improved audio in your cloned voice"
        }
        aria-pressed={playing}
      >
        {playing ? (
          <Pause className="w-3.5 h-3.5" aria-hidden="true" />
        ) : hasEnded ? (
          <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <Play className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        {playing ? "Pause" : hasEnded ? "Replay" : "Play"}
      </Button>
      {playing && (
        <span className="flex items-center gap-1 text-xs text-amber-700">
          <Volume2 className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
          Playing…
        </span>
      )}
    </div>
  );
}

// ─── single turn card ─────────────────────────────────────────────────────────

function TurnCard({ turn }: { turn: ImprovedTurn }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="bg-slate-100 text-slate-600 font-semibold"
        >
          Turn {turn.turnIndex}
        </Badge>
        <span className="text-xs text-slate-400">Your turn as manager</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Original */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Original
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {turn.originalTranscript}
          </p>
        </div>

        {/* Improved */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-2">
            Improved
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {turn.improvedTranscript}
          </p>
          <TurnAudioPlayer audioUrl={turn.audioUrl} />
        </div>
      </div>
    </div>
  );
}

// ─── loading skeleton ─────────────────────────────────────────────────────────

function ReplaySkeleton() {
  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-64 mt-1" />
      </CardHeader>
      <CardContent className="space-y-8 pt-0">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-5 w-16" />
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 p-4 space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
              <div className="rounded-lg border border-emerald-200 p-4 space-y-2">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-8 w-20 mt-2" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Replay page ──────────────────────────────────────────────────────────────

export default function Replay() {
  const [, navigate] = useLocation();

  const replayMutation = useGenerateImprovedReplay();

  useEffect(() => {
    replayMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isLoading = replayMutation.isPending;
  const turns = replayMutation.data ?? [];
  const isError = replayMutation.isError && !isLoading && turns.length === 0;

  function handleRetry() {
    replayMutation.reset();
    replayMutation.mutate();
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-start gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
            <Mic2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-slate-900">
              Improved Replay
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isLoading
                ? "Rewriting your turns and generating audio — this may take a moment…"
                : turns.length > 0
                  ? `Compare your original phrasing to an AI-improved version across ${turns.length} turn${turns.length !== 1 ? "s" : ""}.`
                  : isError
                    ? "Something went wrong generating the replay."
                    : "No manager turns found."}
            </p>
          </div>
          {isLoading && (
            <Loader2 className="w-5 h-5 text-emerald-500 animate-spin shrink-0 mt-2" />
          )}
        </div>

        {/* Error */}
        {isError && (
          <Card className="border-red-200 bg-red-50 mb-6">
            <CardContent className="pt-4 pb-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-800">
                  Could not generate improved replay
                </p>
                <p className="text-xs text-red-600 mt-0.5">
                  The session may have expired or the AI is temporarily
                  unavailable.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-red-300 text-red-700 gap-1 shrink-0"
                onClick={handleRetry}
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading skeleton */}
        {isLoading && <ReplaySkeleton />}

        {/* Loaded turns */}
        {!isLoading && turns.length > 0 && (
          <div className="space-y-6">
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Mic2 className="w-4 h-4 text-emerald-500" />
                  Side-by-side comparison
                </CardTitle>
                <p className="text-xs text-slate-400">
                  Green panels have playable AI-voiced audio in your cloned voice.
                </p>
              </CardHeader>
              <CardContent className="space-y-8 pt-0">
                {turns.map((turn) => (
                  <TurnCard key={turn.turnIndex} turn={turn} />
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-3 pb-4">
              <Button
                variant="outline"
                className="gap-2 text-slate-600"
                onClick={() => navigate("/feedback")}
              >
                <ChevronLeft className="w-4 h-4" />
                Back to feedback
              </Button>
              <div className="flex-1" />
              <Button
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2"
                onClick={() => navigate("/")}
              >
                Practice again
              </Button>
            </div>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && turns.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">No manager turns found to replay.</p>
            <Button
              variant="link"
              className="text-amber-600 mt-2"
              onClick={() => navigate("/")}
            >
              Start a session
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
