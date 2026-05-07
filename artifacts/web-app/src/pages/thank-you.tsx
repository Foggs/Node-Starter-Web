import { useLocation } from "wouter";
import { Check } from "lucide-react";
import { FOCUS_RING } from "@/components/SocialIconButton";

/**
 * Post-submission confirmation. Renders identically whether the user just
 * submitted /contact or arrived directly via the URL — the copy is generic
 * enough to make sense in either context, so we don't gate or redirect.
 */
export default function ThankYou() {
  const [, navigate] = useLocation();

  return (
    <main
      aria-label="Thank-you confirmation"
      className="min-h-screen bg-[#1B2A4A] text-[#C8D4E3] flex items-center justify-center px-6 py-16"
    >
      <div className="max-w-[480px] w-full text-center">
        <div
          aria-hidden="true"
          className="mx-auto inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#F5B730]/[0.12]"
        >
          <Check className="w-7 h-7 text-[#F5B730]" strokeWidth={2.5} />
        </div>

        <h2 className="mt-6 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Message received
        </h2>

        <p className="mt-3 text-[15px] leading-relaxed text-[#8A9BB5]">
          Thanks for reaching out. We read every message and will get back to
          you soon.
        </p>

        <button
          type="button"
          onClick={() => navigate("/")}
          className={`mt-8 inline-flex items-center justify-center gap-2 rounded-lg
                      border border-white/[0.2] bg-transparent px-6 py-2.5
                      text-[14px] text-[#C8D4E3] transition-colors
                      hover:border-white/[0.4] ${FOCUS_RING}`}
        >
          ← Back to Exit Coach
        </button>
      </div>
    </main>
  );
}
