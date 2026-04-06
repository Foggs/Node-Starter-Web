import { Link } from "wouter";
import { BarChart3, ThumbsUp, ArrowUpRight, FileText } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Feedback() {
  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Session Feedback
            </h1>
            <p className="text-sm text-slate-500">
              Full feedback available in Task #6
            </p>
          </div>
        </div>

        {/* Emotion arc placeholder */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-500" />
              Emotion Arc
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-24">
              {[4, 6, 7, 5, 3].map((score, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-amber-100 rounded-t"
                    style={{ height: `${score * 10}%` }}
                  />
                  <span className="text-xs text-slate-400">T{i + 1}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3 text-center">
              Simulated data — real scores from GPT-4o-mini in Task #6
            </p>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {/* Strengths */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                <ThumbsUp className="w-4 h-4" /> Strengths
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-4 w-full rounded" />
              ))}
              <p className="text-xs text-slate-400 pt-1">
                Populated by GPT-4o-mini after Task #6
              </p>
            </CardContent>
          </Card>

          {/* Improvements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4" /> Areas to Improve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-4 w-full rounded" />
              ))}
              <p className="text-xs text-slate-400 pt-1">
                Populated by GPT-4o-mini after Task #6
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="flex-1 gap-2 text-slate-600"
            disabled
          >
            <FileText className="w-4 h-4" /> Export PDF Report
          </Button>
          <Link href="/" className="flex-1">
            <Button className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2">
              Practise Again
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
