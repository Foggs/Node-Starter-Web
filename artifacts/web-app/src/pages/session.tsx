import { Link } from "wouter";
import { Mic, Volume2, Clock, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const PLACEHOLDER_TURNS = [
  {
    role: "employee",
    text: "I… I don't understand. I thought things were going well. Can you explain why this is happening?",
    emotionScore: 6,
  },
];

export default function Session() {
  const currentTurn = 1;
  const totalTurns = 5;
  const progress = ((currentTurn - 1) / totalTurns) * 100;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Session header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Session in Progress
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Turn {currentTurn} of {totalTurns}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="bg-red-100 text-red-700 gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
              Live
            </Badge>
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-700 gap-1"
              >
                <X className="w-3.5 h-3.5" /> End session
              </Button>
            </Link>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={progress} className="h-1.5 mb-6 bg-slate-100" />

        {/* Conversation area */}
        <div className="space-y-4 mb-6 min-h-48">
          {PLACEHOLDER_TURNS.map((turn, i) => (
            <div
              key={i}
              className={`flex gap-3 ${turn.role === "manager" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  turn.role === "employee"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-amber-500 text-slate-950"
                }`}
              >
                {turn.role === "employee" ? "E" : "M"}
              </div>
              <div
                className={`max-w-sm rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  turn.role === "employee"
                    ? "bg-white border border-slate-200 text-slate-700"
                    : "bg-amber-500 text-slate-950"
                }`}
              >
                <p>{turn.text}</p>
                {turn.role === "employee" && (
                  <p className="mt-1.5 text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Emotion score: {turn.emotionScore}/10
                  </p>
                )}
              </div>
            </div>
          ))}

          {/* Waiting indicator */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 text-xs font-bold text-slate-950">
              M
            </div>
            <div className="bg-slate-100 border border-dashed border-slate-300 rounded-2xl px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
              <Mic className="w-4 h-4 text-amber-500" />
              Your turn — press Record to respond
            </div>
          </div>
        </div>

        {/* Controls */}
        <Card className="border-slate-200">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center justify-between gap-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-slate-600"
              >
                <Volume2 className="w-4 h-4" /> Replay
              </Button>

              <Button
                size="lg"
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2"
              >
                <Mic className="w-4 h-4" /> Record Response
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-slate-600"
              >
                Skip →
              </Button>
            </div>

            <p className="text-center text-xs text-slate-400 mt-3">
              Coming in Task #6 — voice recording, Whisper transcription, and coaching tips
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
