import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ShieldCheck, AlertTriangle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { useRecordConsent } from "@workspace/api-client-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { categorizeApiError } from "@/lib/apiErrors";

export default function Consent() {
  const [checked, setChecked] = useState(false);
  const [, navigate] = useLocation();

  const mutation = useRecordConsent({
    mutation: {
      onSuccess: () => {
        navigate("/setup");
      },
    },
  });

  function handleContinue() {
    if (!checked || mutation.isPending) return;
    mutation.mutate({ data: { consentGiven: true } });
  }

  const apiError = mutation.isError
    ? categorizeApiError(mutation.error, "Recording consent")
    : null;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto page-enter">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              Step 1 of 4
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              Biometric Consent
            </h1>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              What we collect and why
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-600 leading-relaxed">
            <p>
              Exit Coach records a short voice sample (30–60 seconds) to create
              an{" "}
              <strong className="text-slate-800">
                ElevenLabs Instant Voice Clone
              </strong>
              . This clone is used <em>only</em> to generate the AI's improved
              replay audio in your own voice at the end of the session.
            </p>
            <p>
              Your voice recording and the resulting voice ID are{" "}
              <strong className="text-slate-800">
                held in server memory for the duration of your session only
              </strong>{" "}
              (maximum 2 hours). They are never written to disk, never shared
              with third parties beyond ElevenLabs' processing API, and are
              automatically purged when your session expires.
            </p>
            <p>
              No personally identifiable information (name, employee ID, email)
              is collected or stored at any point. The coaching report you can
              export is fully anonymised.
            </p>

            <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4 mt-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-800 text-xs leading-relaxed">
                This application may be subject to the{" "}
                <strong>Illinois Biometric Information Privacy Act (BIPA)</strong>{" "}
                and equivalent EU/UK GDPR provisions. By consenting you
                acknowledge that your employer has authorised this tool for
                professional development purposes.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 mb-6 p-4 bg-white border rounded-lg">
          <Checkbox
            id="consent"
            checked={checked}
            onCheckedChange={(v) => setChecked(Boolean(v))}
            className="mt-0.5"
          />
          <Label
            htmlFor="consent"
            className="text-sm text-slate-700 leading-relaxed cursor-pointer"
          >
            I understand that a short voice recording will be taken, used to
            create a temporary voice clone for this session only, and
            automatically deleted when the session expires. I consent to this
            processing.
          </Label>
        </div>

        {/* Inline API error */}
        {apiError && (
          <div
            role="alert"
            className="flex gap-3 items-start bg-red-50 border border-red-200 rounded-lg p-3 mb-6"
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" aria-hidden="true" />
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-medium text-red-800">{apiError.title}</p>
              <p className="text-xs text-red-600 mt-0.5">{apiError.body}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 gap-1 shrink-0"
              onClick={handleContinue}
              disabled={!checked || mutation.isPending}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Try again
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="text-slate-500">
              ← Back
            </Button>
          </Link>
          <Button
            onClick={handleContinue}
            disabled={!checked || mutation.isPending}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold gap-2 disabled:opacity-40"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                Continue <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
