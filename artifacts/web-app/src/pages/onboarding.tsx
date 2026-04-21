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
  RefreshCw,
} from "lucide-react";
import { getVoicePreview, discardVoice } from "@workspace/api-client-react";
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

function uploadErrorMessage(status: number): string {
  if (status === 0) {
    return "We couldn't reach the server. Please check your connection and try again.";
  }
  if (status === 401 || status === 403) {
    return "Your session has expired. Please refresh the page and start again.";
  }
  if (status === 408 || status === 504) {
    return "The upload took too long. Please try again on a stronger connection.";
  }
  if (status === 413) {
    return "That recording is too large to upload. Please try a shorter take.";
  }
  if (status === 429) {
    return "Too many attempts in a short time. Please wait a moment and try again.";
  }
  if (status >= 500) {
    return "Something went wrong on our end while saving your voice. Please try again in a moment.";
  }
  if (status >= 400) {
    return "We couldn't process that recording. Please try again.";
  }
  return "Something went wrong while uploading your voice. Please try again.";
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

/**
 * Upload audio via XHR so we can track real upload progress.
 * Returns the parsed JSON body on success, or throws on network / HTTP error.
 */
function uploadAudio(
  blob: Blob,
  mimeType: string,
  onProgress: (pct: number) => void,
): Promise<{ success: boolean; fallback: boolean }> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("audio", blob, `recording.${mimeType.split("/")[1] ?? "webm"}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/clone-voice");
    xhr.withCredentials = true;

    xhr.timeout = 120_000; // 2-minute ceiling; covers large files on slow connections

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { success: boolean; fallback: boolean });
        } catch {
          reject(new Error("We couldn't read the server's response. Please try recording again."));
        }
      } else {
        reject(new Error(uploadErrorMessage(xhr.status)));
      }
    };

    xhr.onerror = () => reject(new Error("Network error — please check your connection"));
    xhr.ontimeout = () => reject(new Error("Upload timed out — please try again"));

    xhr.send(fd);
  });
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Onboarding() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [shortWarning, setShortWarning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isMicError, setIsMicError] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [, navigate] = useLocation();

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const mimeTypeRef = useRef<string>("");

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

  // ── upload helper ──────────────────────────────────────────────────────────

  const runUpload = useCallback(async (blob: Blob, mimeType: string) => {
    setPhase("uploading");
    setUploadProgress(0);

    try {
      const result = await uploadAudio(blob, mimeType, setUploadProgress);
      setPhase(result.fallback ? "fallback" : "success");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Upload failed — please check your connection and try again.";
      setErrorMsg(msg);
      setIsMicError(false);
      setPhase("error");
    }
  }, []);

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
      setIsMicError(true);
      setPhase("error");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = pickMimeType();
    mimeTypeRef.current = mimeType;
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

      blobRef.current = blob;
      void runUpload(blob, recorder.mimeType || mimeType || "audio/webm");
    };

    recorder.start(250); // collect chunks every 250 ms
    setSeconds(0);
    setPhase("recording");

    timerRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  }, [runUpload]);

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

  // ── retry upload ───────────────────────────────────────────────────────────

  const retryUpload = useCallback(() => {
    if (!blobRef.current) {
      // No blob saved — restart from scratch
      setPhase("idle");
      setSeconds(0);
      setErrorMsg("");
      setIsMicError(false);
      return;
    }
    void runUpload(blobRef.current, mimeTypeRef.current || "audio/webm");
  }, [runUpload]);

  // Accept fallback and move on without retrying
  const acceptFallback = useCallback(() => {
    setPhase("fallback");
    setErrorMsg("");
  }, []);

  // Re-record from the fallback state — discard the saved blob and start fresh
  const reRecordFromFallback = useCallback(() => {
    blobRef.current = null;
    mimeTypeRef.current = "";
    setSeconds(0);
    setPhase("idle");
  }, []);

  // Re-record from the success state — remove the cloned voice and start fresh.
  // Awaits the server discard before resetting to idle so a new recording cannot
  // start while the DELETE is still in-flight (avoids a race where the delayed
  // DELETE overwrites a newly cloned session state).
  const reRecordFromSuccess = useCallback(async () => {
    // Stop any in-progress preview playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewState("idle");
    setDiscardError(null);
    setIsDiscarding(true);

    try {
      await discardVoice();
    } catch {
      setDiscardError("Couldn't remove the cloned voice — please try again.");
      setIsDiscarding(false);
      return;
    }

    setIsDiscarding(false);
    blobRef.current = null;
    mimeTypeRef.current = "";
    setSeconds(0);
    setPhase("idle");
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
              Step 4 of 4
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Record Your Voice
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              One last step before your session begins
            </p>
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
                aria-label={
                  phase === "recording"
                    ? `Stop recording (${formatTime(seconds)} elapsed)`
                    : phase === "requesting"
                      ? "Requesting microphone access"
                      : phase === "uploading"
                        ? "Uploading recording"
                        : phase === "success"
                          ? "Voice cloned successfully"
                          : phase === "fallback"
                            ? "Recording complete, using default voice"
                            : phase === "error"
                              ? "Recording unavailable"
                              : "Start recording your voice sample"
                }
                aria-pressed={phase === "recording"}
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

              {/* Live announcement of phase changes only — keep terse so
                  screen readers aren't flooded during recording/uploading. */}
              <div role="status" aria-live="polite" className="sr-only">
                {phase === "requesting" && "Requesting microphone access"}
                {phase === "recording" && "Recording started"}
                {phase === "uploading" && "Uploading recording"}
                {phase === "success" && "Voice cloned successfully"}
                {phase === "fallback" &&
                  "Recording complete, default voice will be used"}
                {phase === "error" && `Error: ${errorMsg}`}
              </div>

              {/* Status label */}
              <p className="text-sm text-slate-600 text-center min-h-[20px]">
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

              {/* Upload progress bar */}
              {phase === "uploading" && (
                <div className="w-full max-w-xs">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400 text-center mt-1">
                    {uploadProgress < 100
                      ? `Uploading… ${uploadProgress}%`
                      : "Processing…"}
                  </p>
                </div>
              )}

              {/* Progress bar towards 30 s (recording only) */}
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

            {/* Actions: preview + re-record */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={() => void reRecordFromSuccess()}
                disabled={isDiscarding}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-green-400 bg-white text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-wait"
              >
                {isDiscarding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Removing…
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Record again
                  </>
                )}
              </button>

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

            {discardError && (
              <p className="mt-2 text-xs text-red-600">{discardError}</p>
            )}
          </div>
        )}

        {/* Fallback banner — preview disabled */}
        {phase === "fallback" && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-800">
            <div className="flex gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <div>
                <p className="font-semibold">
                  We'll use a default voice — you can still practice.
                </p>
                <p className="text-amber-700 mt-0.5">
                  Voice cloning isn't available right now. The replay at the
                  end of your session will use a generic voice instead of your
                  own. Everything else works as normal.
                </p>
              </div>
            </div>

            {/* Actions: re-record + disabled preview */}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                onClick={reRecordFromFallback}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border border-amber-400 bg-white text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Try recording again
              </button>
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border bg-white text-slate-400 border-slate-200 cursor-not-allowed opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Hear your voice
              </button>
            </div>
            <p className="text-xs text-amber-700 mt-1.5">
              Voice preview is unavailable when using the generic voice.
            </p>
          </div>
        )}

        {/* Error banner */}
        {phase === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
            <div className="flex gap-3">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1">
                <p className="font-semibold">Something went wrong.</p>
                <p className="mt-0.5">{errorMsg}</p>

                {!isMicError && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={retryUpload}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-500 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry upload
                    </button>
                    <button
                      onClick={acceptFallback}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-100 transition-colors"
                    >
                      Use default voice instead
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/setup">
            <Button variant="ghost" className="text-slate-500">
              ← Back
            </Button>
          </Link>
          <Button
            onClick={() => navigate("/session")}
            disabled={!isTerminal || isDiscarding}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2 disabled:opacity-40"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
