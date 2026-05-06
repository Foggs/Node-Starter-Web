import { useState } from "react";
import { useCreateLead } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/**
 * DemoLeadForm — name + email capture shown at the end of the demo modal.
 * Posts to POST /api/leads (slice 2). On success, calls `onSuccess` so the
 * modal can close and navigate the user to /consent. On error, displays an
 * inline message and keeps the form values so the user can retry without
 * rewatching the demo.
 *
 * Submit is disabled until both fields are valid:
 *  - name: non-empty after trim
 *  - email: matches a basic shape  (server is the source-of-truth validator)
 */

export interface DemoLeadFormProps {
  onSuccess: () => void;
  /** Called when submission begins, ends, or fails — drives modal phase. */
  onSubmittingChange?: (submitting: boolean) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_LOADER_MS = 300;

export function DemoLeadForm({ onSuccess, onSubmittingChange }: DemoLeadFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useCreateLead({
    mutation: {
      onSuccess: async () => {
        // Spec: spinner minimum 300ms so the success state isn't jarring.
        await new Promise((r) => setTimeout(r, MIN_LOADER_MS));
        onSubmittingChange?.(false);
        onSuccess();
      },
      onError: () => {
        onSubmittingChange?.(false);
        setErrorMessage("Something went wrong. Please try again.");
      },
    },
  });

  const isValid =
    name.trim().length >= 2 && EMAIL_RE.test(email.trim()) && email.trim().length <= 254;
  const isSubmitting = mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    setErrorMessage(null);
    onSubmittingChange?.(true);
    mutation.mutate({
      data: { name: name.trim(), email: email.trim().toLowerCase() },
    });
  }

  return (
    <div data-testid="demo-lead-form" className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-slate-600 leading-relaxed">
          You just experienced an AI-powered practice session — emotional pushback,
          real-time coaching, and an improved version of your own words.
        </p>
        <h3 className="text-lg font-semibold text-slate-900">
          That conversation just got a lot harder to avoid.
        </h3>
        <p className="text-sm text-slate-600">
          In a real session, the improved version plays back in your own cloned voice.
          Start practicing free.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
          <label htmlFor="demo-lead-name" className="sr-only">Full name</label>
          <input
            id="demo-lead-name"
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
            autoComplete="name"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
          />
        </div>
        <div>
          <label htmlFor="demo-lead-email" className="sr-only">Email</label>
          <input
            id="demo-lead-email"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            autoComplete="email"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
          />
        </div>

        {errorMessage && (
          <p
            role="alert"
            data-testid="demo-lead-error"
            className="text-xs text-red-600"
          >
            {errorMessage}
          </p>
        )}

        <Button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Setting up your session…
            </>
          ) : (
            <>Start practicing →</>
          )}
        </Button>

        <p className="text-[11px] text-slate-400 leading-relaxed">
          By continuing, you agree to our{" "}
          <a href="/privacy" className="underline">Privacy Policy</a> and may receive
          product updates from Exit Coach.
        </p>
      </form>
    </div>
  );
}
