import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Mic, BarChart3, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Mic,
    title: "Voice-first rehearsal",
    body: "Speak naturally, just like the real meeting. Your voice is cloned so the AI persona responds in your own tone.",
  },
  {
    icon: ShieldCheck,
    title: "Emotionally realistic AI",
    body: "Practice against tearful, defensive, angry, or withdrawn personas — the full spectrum of real employee reactions.",
  },
  {
    icon: BarChart3,
    title: "Turn-by-turn coaching",
    body: "Receive a coaching tip after every response, plus a final emotion-arc chart and PDF report you can share with HR.",
  },
  {
    icon: Clock,
    title: "20 minutes, not 20 weeks",
    body: "A focused five-turn session fits between meetings. Repeat as often as you need until the conversation feels natural.",
  },
];

const SCENARIOS = [
  "Termination for performance",
  "Layoff / role elimination",
  "Gross misconduct outcome",
  "PIP failure close-out",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* nav */}
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <span className="text-xl font-bold tracking-tight">
          Exit<span className="text-amber-400">Coach</span>
        </span>
        <Link href="/history">
          <span className="text-sm text-slate-400 hover:text-white cursor-pointer transition-colors">
            Past sessions
          </span>
        </Link>
      </header>

      {/* hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center max-w-3xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium px-3 py-1.5 rounded-full mb-8">
          <ShieldCheck className="w-3.5 h-3.5" />
          Biometric consent required · Voice data stays on-device
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight leading-tight text-white">
          Practice the conversations{" "}
          <span className="text-amber-400">no one wants to have.</span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-xl">
          Exit Coach is a secure, voice-first rehearsal platform where managers
          practise terminations, layoffs, and PIPs against emotionally realistic
          AI employee personas — before the real meeting.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center">
          <Link href="/consent">
            <Button
              size="lg"
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-8 gap-2 text-base"
            >
              Begin Rehearsal <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <span className="text-sm text-slate-500">No account needed · Sessions expire in 2 hours</span>
        </div>
      </section>

      {/* scenario strip */}
      <section className="border-t border-slate-800 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-3">
          {SCENARIOS.map((s) => (
            <span
              key={s}
              className="bg-slate-800 text-slate-300 text-sm px-4 py-2 rounded-full"
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="border-t border-slate-800 px-6 py-16">
        <div className="max-w-4xl mx-auto grid sm:grid-cols-2 gap-8">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Icon className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-slate-400 leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-slate-800 px-6 py-5">
        <p className="text-center text-xs text-slate-600">
          ExitCoach &copy; {new Date().getFullYear()} · Biometric data is
          processed in-session only and never retained after the session expires.
        </p>
      </footer>
    </div>
  );
}
