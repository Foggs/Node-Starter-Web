import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  /** Hide the standard nav breadcrumb (e.g. on full-screen pages) */
  hideNav?: boolean;
}

const STEPS = [
  { path: "/consent", label: "Consent" },
  { path: "/onboarding", label: "Voice" },
  { path: "/setup", label: "Setup" },
  { path: "/session", label: "Session" },
  { path: "/feedback", label: "Feedback" },
] as const;

export function AppShell({ children, hideNav = false }: AppShellProps) {
  const [location] = useLocation();
  const currentStep = STEPS.findIndex((s) => s.path === location);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b bg-white px-6 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Exit<span className="text-amber-500">Coach</span>
              </span>
            </span>
          </Link>

          {!hideNav && currentStep >= 0 && (
            <nav className="hidden sm:flex items-center gap-1">
              {STEPS.map((step, i) => (
                <div key={step.path} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-slate-300 text-xs mx-1">›</span>
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-1 rounded",
                      i === currentStep
                        ? "bg-amber-100 text-amber-700"
                        : i < currentStep
                          ? "text-slate-400"
                          : "text-slate-300",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </nav>
          )}

          <Link href="/history">
            <span className="text-sm text-slate-500 hover:text-slate-800 cursor-pointer transition-colors">
              History
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="max-w-4xl mx-auto">{children}</div>
      </main>

      <footer className="border-t bg-white px-6 py-3">
        <div className="max-w-4xl mx-auto text-xs text-slate-400 flex justify-between">
          <span>ExitCoach &copy; {new Date().getFullYear()}</span>
          <span>Biometric data is processed locally and never shared.</span>
        </div>
      </footer>
    </div>
  );
}
