import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Mic,
  MicOff,
  CheckCircle2,
  ArrowRight,
  Info,
  Loader2,
  AlertTriangle,
  WifiOff,
  Play,
  Square,
} from "lucide-react";
import { useCloneVoice, getVoicePreview } from "@workspace/api-client-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ─── types ───────────────────────────────────────────────────────────────────

type Phase =
  | "idle"        // waiting for user to click Start
  | "requesting"  // waiting for mic permission
  | "recording"   // actively capturing audio
  | "uploading"   // sending audio to /api/clone-voice
  | "success"     // voice cloned — ready to continue
  | "fallback"    // cloning failed — generic voice will be used
  | "error";      // unrecoverable (mic denied, network, etc.)

// Minimum seconds before we allow the user to stop without a warning
const MIN_SECONDS = 10;

// ─── helpers ─────────────────────────────────────────────────────────────────

function pickMimeType(): string {
  for (const t of ["audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [shortWarning, setShortWarning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [, navigate] = useLocation();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── voice preview ──────────────────────────────────────────────────────────
  type PreviewState = "idle" | "loading" | "playing" | "error";
  const [previewState, setPreviewState] = useState<PreviewState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop mic stream and timer on unmount
  useEffect(() => {
    return () => {
      timerRef.current && clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const mutation = useCloneVoice({
    mutation: {
      onSuccess: (data) => {
        setPhase(data.fallback ? "fallback" : "success");
      },
      onError: () => {
        setErrorMsg(
          "Upload failed — please check your connection and try again.",
        );
        setPhase("error");
      },
    },
  });

  // ── start recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setPhase("requesting");
    setShortWarning(false);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg(
        "Microphone access was denied. Please allow access in your browser settings and reload.",
      );
      setPhase("error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });

      setPhase("uploading");
      mutation.mutate({ data: { audio: blob } });
    };

    recorder.start(250); // collect chunks every 250 ms
    setSeconds(0);
    setPhase("recording");

    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }, [mutation]);

  // ── stop recording ─────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    if (!recorderRef.current || recorderRef.current.state !== "recording") return;

    if (seconds < MIN_SECONDS) {
      setShortWarning(true);
      return; // let them decide to stop anyway
    }

    timerRef.current && clearInterval(timerRef.current);
    recorderRef.current.stop();
  }, [seconds]);

  // Force-stop even when below minimum (user dismissed warning)
  const forceStop = useCallback(() => {
    setShortWarning(false);
    timerRef.current && clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }, []);

  // ── voice preview handler ──────────────────────────────────────────────────

  const handlePreview = useCallback(async () => {
    // Toggle: if playing, stop
    if (previewState === "playing") {
      audioRef.current?.pause();
      audioRef.current = null;
      setPreviewState("idle");
      return;
    }
    if (previewState === "loading") return;

    setPreviewState("loading");
    let objectUrl: string | null = null;

    try {
      const blob = await getVoicePreview();
      objectUrl = URL.createObjectURL(blob);
      const audio = new Audio(objectUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPreviewState("idle");
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
      audio.onerror = () => {
        setPreviewState("error");
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };

      await audio.play();
      setPreviewState("playing");
    } catch {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setPreviewState("error");
    }
  }, [previewState]);

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  // ── derived UI state ───────────────────────────────────────────────────────

  const isTerminal = phase === "success" || phase === "fallback";

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <AppShell>
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Mic className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Step 2 of 4
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Record Your Voice
            </h1>
          </div>
        </div>

        {/* Instructions card */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-3 text-sm text-slate-600">
              <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <p>
                Read aloud for <strong>30–60 seconds</strong> in a quiet room.
                Speak naturally — as if addressing a colleague. Avoid music,
                background noise, or whispering.
              </p>
            </div>

            {/* Prompt text */}
            <div className="bg-slate-50 rounded-lg p-5 border text-sm text-slate-500 italic leading-relaxed">
              "Good morning. I appreciate you coming in today. What I need to
              share with you is difficult, and I want to make sure we handle
              this conversation with the respect and care it deserves. I've
              been reflecting on how to approach this, and I want to be direct
              and honest with you throughout."
            </div>

            {/* Recorder */}
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Big mic button */}
              <button
                onClick={
                  phase === "idle"
                    ? startRecording
                    : phase === "recording"
                      ? stopRecording
                      : undefined
                }
                disabled={
                  phase === "requesting" ||
                  phase === "uploading" ||
                  isTerminal
                }
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                  phase === "idle" &&
                    "bg-amber-500 hover:bg-amber-400 text-slate-950",
                  phase === "requesting" &&
                    "bg-amber-200 text-slate-400 cursor-wait",
                  phase === "recording" &&
                    "bg-red-500 hover:bg-red-400 text-white animate-pulse",
                  phase === "uploading" &&
                    "bg-slate-200 text-slate-400 cursor-not-allowed",
                  (phase === "success" || phase === "fallback") &&
                    "bg-green-500 text-white cursor-default",
                  phase === "error" &&
                    "bg-slate-200 text-slate-400 cursor-not-allowed",
                )}
              >
                {phase === "uploading" ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isTerminal ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : phase === "recording" ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>

              {/* Status label */}
              <p className="text-sm text-slate-500 text-center min-h-[20px]">
                {phase === "idle" && "Tap to start recording"}
                {phase === "requesting" && "Requesting microphone access…"}
                {phase === "recording" && (
                  <span>
                    Recording…{" "}
                    <span className="font-mono font-semibold text-red-600">
                      {formatTime(seconds)}
                    </span>{" "}
                    — tap to stop
                  </span>
                )}
                {phase === "uploading" && "Uploading and cloning your voice…"}
                {phase === "success" && (
                  <span className="text-green-600 font-medium">
                    Voice cloned successfully ({formatTime(seconds)})
                  </span>
                )}
                {phase === "fallback" && (
                  <span className="text-amber-600 font-medium">
                    Recording complete ({formatTime(seconds)})
                  </span>
                )}
                {phase === "error" && (
                  <span className="text-red-600 font-medium">
                    Recording unavailable
                  </span>
                )}
              </p>

              {/* Progress bar towards 30 s */}
              {phase === "recording" && (
                <div className="w-full max-w-xs">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        seconds >= 30 ? "bg-green-500" : "bg-amber-400",
                      )}
                      style={{ width: `${Math.min((seconds / 60) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-1">
                    <span>0:00</span>
                    <span className={seconds >= 30 ? "text-green-600 font-medium" : ""}>
                      0:30 min
                    </span>
                    <span>1:00</span>
                  </div>
                </div>
              )}
            </div>

            {/* Short-recording warning */}
            {shortWarning && (
              <div className="flex flex-col gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <div className="flex gap-2 items-start">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    Recording is only <strong>{seconds}s</strong> — we recommend
                    at least 30 seconds for best voice quality. Stop anyway?
                  </span>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShortWarning(false)}
                    className="text-xs px-3 py-1 rounded border border-amber-300 hover:bg-amber-100"
                  >
                    Keep recording
                  </button>
                  <button
                    onClick={forceStop}
                    className="text-xs px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-400"
                  >
                    Stop anyway
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Success banner + preview */}
        {phase === "success" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-sm text-green-800">
            <div className="flex gap-3">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-green-600" />
              <div className="flex-1">
                <p className="font-semibold">Your voice has been cloned.</p>
                <p className="text-green-700 mt-0.5">
                  The improved replay at the end of your session will be read
                  back to you in your own voice.
                </p>
              </div>
            </div>

            {/* Preview button */}
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => void handlePreview()}
                disabled={previewState === "loading"}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border",
                  previewState === "playing"
                    ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                    : "bg-white text-green-700 border-green-300 hover:bg-green-100 disabled:opacity-50 disabled:cursor-wait",
                )}
              >
                {previewState === "loading" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading…
                  </>
                ) : previewState === "playing" ? (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    Stop
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Hear your voice
                  </>
                )}
              </button>

              {previewState === "error" && (
                <span className="text-xs text-red-600">
                  Preview failed — you can still continue.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Fallback banner — preview disabled */}
        {phase === "fallback" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
            <div className="flex gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold">
                  Voice cloning isn't available right now.
                </p>
                <p className="text-amber-700 mt-0.5">
                  You can still complete the full practice session — the replay
                  will use a generic voice instead of your own.
                </p>
              </div>
            </div>

            {/* Preview disabled on fallback path */}
            <div className="mt-3">
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border bg-white text-slate-400 border-slate-200 cursor-not-allowed opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Hear your voice
              </button>
              <p className="text-xs text-amber-700 mt-1.5">
                Voice preview is unavailable when using the generic voice.
              </p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {phase === "error" && (
          <div className="flex gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
            <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
            <div>
              <p className="font-semibold">Something went wrong.</p>
              <p className="mt-0.5">{errorMsg}</p>
              {errorMsg.includes("Microphone") ? null : (
                <button
                  onClick={() => {
                    setPhase("idle");
                    setSeconds(0);
                    setErrorMsg("");
                    mutation.reset();
                  }}
                  className="mt-2 text-xs underline underline-offset-2 hover:text-red-900"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/consent">
            <Button variant="ghost" className="text-slate-500">
              ← Back
            </Button>
          </Link>
          <Button
            onClick={() => navigate("/setup")}
            disabled={!isTerminal}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2 disabled:opacity-40"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
