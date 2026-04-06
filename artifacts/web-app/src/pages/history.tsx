import { Link } from "wouter";
import { History as HistoryIcon, ArrowRight, Clock, Layers } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function History() {
  return (
    <AppShell hideNav>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <HistoryIcon className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Session History
            </h1>
            <p className="text-sm text-slate-500">Your past rehearsal sessions</p>
          </div>
        </div>

        {/* Empty state */}
        <Card className="border-dashed border-2 border-slate-200">
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Layers className="w-7 h-7 text-slate-400" />
            </div>
            <h2 className="text-lg font-semibold text-slate-700 mb-2">
              No sessions yet
            </h2>
            <p className="text-sm text-slate-500 max-w-xs mb-6">
              Your completed rehearsal sessions will appear here. Each session
              stores your scenario, persona, turn transcripts, and feedback
              summary.
            </p>

            <div className="flex flex-col items-center gap-2 text-xs text-slate-400 mb-8">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Session history is stored for the duration of your browser
                session only (2 hours max)
              </div>
              <p className="text-slate-300">
                Persistent history across sessions is a Phase 2 feature
              </p>
            </div>

            <Link href="/consent">
              <Button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2">
                Start Your First Rehearsal <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
