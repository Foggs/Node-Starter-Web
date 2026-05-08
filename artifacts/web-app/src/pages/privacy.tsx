import { useLocation } from "wouter";
import { FOCUS_RING } from "@/components/SocialIconButton";

/**
 * Privacy policy stub. Linked from the demo lead-capture form's implied
 * consent notice. Real policy copy will be authored separately by the
 * client/legal — this page exists so the consent link resolves to a real
 * route instead of a `#` anchor (a bad smell in a consent context).
 */
export default function Privacy() {
  const [, navigate] = useLocation();

  return (
    <main
      aria-label="Privacy policy"
      className="min-h-screen bg-[#1B2A4A] text-[#C8D4E3] px-6 py-16"
    >
      <div className="max-w-[640px] mx-auto">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Privacy Policy
        </h1>

        <p className="mt-6 text-[15px] leading-relaxed text-[#8A9BB5]">
          Our full privacy policy is being prepared. In the meantime, here's
          what you should know about how Exit Coach handles the information
          you share with us during a demo or session:
        </p>

        <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-[#C8D4E3] list-disc pl-5">
          <li>
            We collect your name and email when you sign up so we can send
            you a link to start your first practice session.
          </li>
          <li>
            Voice recordings used to create your cloned voice are stored on
            our voice provider's infrastructure and deleted within two hours
            of session end.
          </li>
          <li>
            We do not sell your data. We may use anonymized usage data to
            improve the product.
          </li>
          <li>
            For questions in the meantime, write to{" "}
            <a
              href="mailto:hello@exitcoach.app"
              className="underline text-[#F5B730]"
            >
              hello@exitcoach.app
            </a>
            .
          </li>
        </ul>

        <button
          type="button"
          onClick={() => navigate("/")}
          className={`mt-10 inline-flex items-center justify-center gap-2 rounded-lg
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
