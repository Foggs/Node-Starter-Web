/**
 * FAQ_ITEMS — approved copy for the landing-page FAQ accordion.
 *
 * Source of truth: faq-feature.md (Approved for Implementation).
 * Q1 orients the visitor; Q2–Q5 handle objections in severity order.
 *
 * Update triggers (also documented in the spec):
 *   - Pricing confirmed              → update Q5 ("pricing")
 *   - Team / admin features ship     → update Q4 ("team-use")
 *   - Privacy policy URL goes live   → add link to Q2 ("voice-safety")
 *   - Voice retention policy changes → update Q2 deletion timing
 *   - New scenario types added       → update Q1 step 2 list
 */

export interface FAQItem {
  /** Stable slug — used as DOM id base for trigger/panel and as JSON-LD anchor. */
  id: string;
  question: string;
  /** Intro / body text — always present. */
  answer: string;
  /** Optional numbered list rendered as <ol> after `answer`. */
  steps?: string[];
  /** Optional closing paragraph rendered after the <ol>. */
  closing?: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    id: "how-it-works",
    question: "How does Exit Coach actually work?",
    answer: "It's a five-step practice loop you run entirely in your browser:",
    steps: [
      "Record about 45 seconds of natural speech using your laptop or phone microphone — that's enough to clone your voice.",
      "Pick your scenario (layoff, PIP failure, misconduct, or performance issue) and choose how you expect the employee to react — defensive, tearful, withdrawn, and so on.",
      "The AI plays the employee out loud in a realistic emotional voice — you respond by speaking, just like the real conversation.",
      "After each exchange you get a short coaching note on what you said and how it landed.",
      "At the end, hear an improved version of the conversation played back in your own cloned voice — so you can hear exactly what better sounds like coming from you.",
    ],
    closing:
      "Most sessions take about 10 minutes. No installs, no special equipment.",
  },
  {
    id: "voice-safety",
    question: "Is my voice data safe? What happens to the recording I make?",
    answer:
      "Your voice recording is used only to create a voice clone for your session — and that's it. We don't store your raw audio, we don't share it with anyone, and the clone is permanently deleted when your session ends. The entire process happens over an encrypted connection, and your voice data never leaves the session. If you'd rather not use voice cloning at all, you can skip it and still complete a full practice session — you just won't get the personalised improved replay at the end.",
  },
  {
    id: "legal-language",
    question: "Can this actually help me say the right things legally?",
    answer:
      "Exit Coach doesn't give legal advice — and you should always loop in HR or legal counsel before a termination conversation. What it does do is flag language in your practice responses that tends to create ambiguity or risk — things like referencing performance in a structural layoff, or making comparisons between employees. The improved replay models clearer, more precise phrasing for those moments. Think of it as getting a second set of eyes on your words before the conversation happens, not a legal guarantee.",
  },
  {
    id: "team-use",
    question: "I'm an HR leader. Can I use this with my whole team?",
    answer:
      "Right now Exit Coach is set up for individual practice — each manager creates their own session and clones their own voice. There's no shared dashboard or team admin view yet. That said, several HR teams are already using it by sharing access with managers directly and collecting the PDF coaching reports to review together. If you're thinking about a team rollout, get in touch — we're building team features now and would love to shape them around how you work.",
  },
  {
    id: "pricing",
    question: "How much does it cost?",
    answer:
      "We're in early access right now, which means you can get started free while we finalise pricing. We'll always give early users plenty of notice before anything changes — and anyone who helps shape the product during this period will be looked after. No credit card required to start.",
  },
];
