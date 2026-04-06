import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Mic, MicOff, CheckCircle2, ArrowRight, Info } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RecordingState = "idle" | "recording" | "done";

export default function Onboarding() {
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [, navigate] = useLocation();

  function handleRecord() {
    if (recordingState === "idle") {
      setRecordingState("recording");
      setSeconds(0);
      const interval = setInterval(() => {
        setSeconds((s) => {
          if (s >= 59) {
            clearInterval(interval);
            setRecordingState("done");
            return 60;
          }
          return s + 1;
        });
      }, 1000);
    } else if (recordingState === "recording") {
      setRecordingState("done");
    }
  }

  return (
    <AppShell>
      <div className="max-w-xl mx-auto">
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

            <div className="bg-slate-50 rounded-lg p-5 border text-sm text-slate-500 italic leading-relaxed">
              "Good morning. I appreciate you coming in today. What I need to
              share with you is difficult, and I want to make sure we handle
              this conversation with the respect and care it deserves. I've
              been reflecting on how to approach this, and I want to be direct
              and honest with you throughout."
            </div>

            {/* Recording button */}
            <div className="flex flex-col items-center gap-4 py-4">
              <button
                onClick={handleRecord}
                disabled={recordingState === "done"}
                className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-md",
                  recordingState === "idle" &&
                    "bg-amber-500 hover:bg-amber-400 text-slate-950",
                  recordingState === "recording" &&
                    "bg-red-500 hover:bg-red-400 text-white animate-pulse",
                  recordingState === "done" &&
                    "bg-green-500 text-white cursor-default",
                )}
              >
                {recordingState === "done" ? (
                  <CheckCircle2 className="w-8 h-8" />
                ) : recordingState === "recording" ? (
                  <MicOff className="w-8 h-8" />
                ) : (
                  <Mic className="w-8 h-8" />
                )}
              </button>

              <p className="text-sm text-slate-500">
                {recordingState === "idle" && "Tap to start recording"}
                {recordingState === "recording" &&
                  `Recording… ${seconds}s (tap to stop)`}
                {recordingState === "done" && (
                  <span className="text-green-600 font-medium">
                    Recording complete ({seconds}s)
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Link href="/consent">
            <Button variant="ghost" className="text-slate-500">
              ← Back
            </Button>
          </Link>
          <Button
            onClick={() => navigate("/setup")}
            disabled={recordingState !== "done"}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2 disabled:opacity-40"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
