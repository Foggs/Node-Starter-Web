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
  const showStepper = !hideNav && currentStep >= 0;
  const currentLabel = showStepper ? STEPS[currentStep].label : "";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b bg-white px-6 py-3 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <Link href="/">
            <span className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                Exit<span className="text-amber-600">Coach</span>
              </span>
            </span>
          </Link>

          {showStepper && (
            <>
              {/* Desktop stepper */}
              <nav
                aria-label="Progress"
                className="hidden sm:flex items-center gap-1"
              >
                <ol className="flex items-center gap-1">
                  {STEPS.map((step, i) => {
                    const isCurrent = i === currentStep;
                    const isComplete = i < currentStep;
                    return (
                      <li key={step.path} className="flex items-center gap-1">
                        {i > 0 && (
                          <span
                            aria-hidden="true"
                            className="text-slate-600 text-xs mx-1"
                          >
                            ›
                          </span>
                        )}
                        <span
                          aria-current={isCurrent ? "step" : undefined}
                          className={cn(
                            "text-xs font-medium px-2 py-1 rounded",
                            "transition-colors duration-200 ease-out motion-reduce:transition-none",
                            isCurrent
                              ? "bg-amber-100 text-amber-800"
                              : isComplete
                                ? "text-slate-600"
                                : "text-slate-500",
                          )}
                        >
                          <span className="sr-only">
                            {isComplete
                              ? "Completed: "
                              : isCurrent
                                ? "Current step: "
                                : "Upcoming: "}
                          </span>
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </nav>

              {/* Mobile compact indicator */}
              <p
                aria-label={`Step ${currentStep + 1} of ${STEPS.length}: ${currentLabel}`}
                className="sm:hidden text-xs font-medium text-slate-700 bg-amber-100 text-amber-800 px-2 py-1 rounded whitespace-nowrap"
              >
                Step {currentStep + 1} of {STEPS.length}
                <span className="sr-only">: {currentLabel}</span>
              </p>
            </>
          )}

          <Link href="/history">
            <span className="text-sm text-slate-600 hover:text-slate-900 cursor-pointer transition-colors">
              History
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-10">
        <div className="max-w-4xl mx-auto">{children}</div>
      </main>

      <footer className="border-t bg-white px-6 py-3">
        <div className="max-w-4xl mx-auto text-xs text-slate-600 flex justify-between gap-3">
          <span>ExitCoach &copy; {new Date().getFullYear()}</span>
          <span className="hidden sm:inline">
            Biometric data is processed locally and never shared.
          </span>
        </div>
      </footer>
    </div>
  );
}
