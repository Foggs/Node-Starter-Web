import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Settings2, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import {
  useListScenarios,
  useListPersonas,
  useUpdateSession,
} from "@workspace/api-client-react";
import type { Scenario, Persona } from "@workspace/api-client-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const PERSONA_EMOJI: Record<string, string> = {
  tearful: "😢",
  defensive: "😤",
  withdrawn: "😶",
  professional: "🤝",
  angry: "😡",
};

function SelectionGrid<T extends { id: string; name: string; description: string }>({
  items,
  selected,
  onSelect,
  renderExtra,
}: {
  items: T[];
  selected: string | null;
  onSelect: (id: string) => void;
  renderExtra?: (item: T) => React.ReactNode;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          className={cn(
            "text-left p-4 rounded-xl border-2 transition-all",
            selected === item.id
              ? "border-amber-500 bg-amber-50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          {renderExtra && renderExtra(item)}
          <p className="font-semibold text-slate-900 text-sm">{item.name}</p>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-3">
            {item.description}
          </p>
        </button>
      ))}
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-xl border-2 border-slate-100 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      <AlertCircle className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
}

const PREFS_KEY = "exit-coach-setup-prefs";
const DEFAULT_PERSONA_ORDER = ["professional", "tearful", "defensive", "withdrawn", "angry"];

type Prefs = { scenarioId?: string; personaId?: string };

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function savePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function pickDefaultPersona(personas: Persona[]): string | null {
  for (const id of DEFAULT_PERSONA_ORDER) {
    if (personas.find((p) => p.id === id)) return id;
  }
  return personas[0]?.id ?? null;
}

export default function Setup() {
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [, navigate] = useLocation();
  const defaultsAppliedRef = useRef(false);

  const {
    data: scenarios,
    isLoading: scenariosLoading,
    isError: scenariosError,
  } = useListScenarios<Scenario[]>();

  const {
    data: personas,
    isLoading: personasLoading,
    isError: personasError,
  } = useListPersonas<Persona[]>();

  const { mutate: saveSession, isPending: isSaving } = useUpdateSession({
    mutation: {
      onError: () => setSaveError(true),
      onSuccess: () => setSaveError(false),
    },
  });

  // Apply smart defaults once both lists have loaded — restore the user's last
  // choice (from localStorage), or fall back to the first scenario and a
  // sensible persona. Persists the chosen pair to the server immediately so
  // Continue is enabled with no clicks.
  useEffect(() => {
    if (defaultsAppliedRef.current) return;
    if (!scenarios || !personas) return;
    if (scenarios.length === 0 || personas.length === 0) return;

    const prefs = loadPrefs();
    const scenarioId =
      (prefs.scenarioId && scenarios.find((s) => s.id === prefs.scenarioId)?.id) ||
      scenarios[0].id;
    const personaId =
      (prefs.personaId && personas.find((p) => p.id === prefs.personaId)?.id) ||
      pickDefaultPersona(personas);

    defaultsAppliedRef.current = true;
    setSelectedScenario(scenarioId);
    if (personaId) setSelectedPersona(personaId);
    saveSession({
      data: personaId ? { scenario: scenarioId, persona: personaId } : { scenario: scenarioId },
    });
  }, [scenarios, personas, saveSession]);

  function handleScenarioSelect(id: string) {
    setSelectedScenario(id);
    setSaveError(false);
    saveSession(
      { data: { scenario: id } },
      {
        onSuccess: () => {
          savePrefs({ ...loadPrefs(), scenarioId: id });
        },
      },
    );
  }

  function handlePersonaSelect(id: string) {
    setSelectedPersona(id);
    setSaveError(false);
    saveSession(
      { data: { persona: id } },
      {
        onSuccess: () => {
          savePrefs({ ...loadPrefs(), personaId: id });
        },
      },
    );
  }

  const canBegin = selectedScenario !== null && selectedPersona !== null && !isSaving;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Step 2 of 4
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Choose your scenario &amp; persona
            </h1>
          </div>
        </div>

        {/* Scenario selection */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Scenario
            </h2>
            {selectedScenario && (
              <span className="text-xs text-amber-600 font-medium">
                ✓ Selected
              </span>
            )}
          </div>

          {scenariosLoading && <LoadingGrid />}
          {scenariosError && (
            <ErrorCard message="We can't reach the practice server right now. Check your connection and try again." />
          )}
          {scenarios && (
            <SelectionGrid
              items={scenarios}
              selected={selectedScenario}
              onSelect={handleScenarioSelect}
            />
          )}
        </section>

        {/* Persona selection */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Employee Persona
            </h2>
            {selectedPersona && (
              <span className="text-xs text-amber-600 font-medium">
                ✓ Selected
              </span>
            )}
          </div>

          {personasLoading && <LoadingGrid />}
          {personasError && (
            <ErrorCard message="We can't reach the practice server right now. Check your connection and try again." />
          )}
          {personas && (
            <SelectionGrid
              items={personas}
              selected={selectedPersona}
              onSelect={handlePersonaSelect}
              renderExtra={(p) => (
                <span className="text-2xl mb-2 block">
                  {PERSONA_EMOJI[p.id] ?? "👤"}
                </span>
              )}
            />
          )}
        </section>

        {/* Summary card */}
        {canBegin && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-amber-800">
                <strong>Ready:</strong>{" "}
                {scenarios?.find((s) => s.id === selectedScenario)?.name} ·{" "}
                {personas?.find((p) => p.id === selectedPersona)?.name} (
                {personas?.find((p) => p.id === selectedPersona)?.emotionalStyle})
              </p>
            </CardContent>
          </Card>
        )}

        {saveError && (
          <div className="flex items-center gap-2 mb-4 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Could not save your selection — check your connection and try again.
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link href="/consent">
            <Button variant="ghost" className="text-slate-500">
              ← Back
            </Button>
          </Link>

          <div className="flex items-center gap-3">
            {isSaving && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving…
              </span>
            )}
            <Button
              onClick={() => navigate("/onboarding")}
              disabled={!canBegin}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2 disabled:opacity-40"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
