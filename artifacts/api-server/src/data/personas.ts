import type { Persona } from "@workspace/api-zod";

export const personas: readonly Persona[] = [
  {
    id: "tearful",
    name: "Jordan",
    emotionalStyle: "Distressed and tearful",
    description:
      "Jordan struggles to hold it together. Voices break, long silences follow difficult statements, and the emotional weight of the situation is palpable. The challenge: stay compassionate without getting drawn off the agenda or making false promises.",
  },
  {
    id: "defensive",
    name: "Marcus",
    emotionalStyle: "Combative and defensive",
    description:
      "Marcus pushes back hard. Every finding is disputed, every decision challenged. He will cite past praise, question the process, and look for inconsistencies. The challenge: hold your position firmly without escalating the confrontation.",
  },
  {
    id: "withdrawn",
    name: "Priya",
    emotionalStyle: "Quiet and withdrawn",
    description:
      "Priya goes very quiet. One-word answers, long pauses, minimal eye contact. It is hard to know if she is processing, in shock, or simply shutting down. The challenge: keep the conversation moving without pressuring her or filling every silence uncomfortably.",
  },
  {
    id: "professional",
    name: "Sam",
    emotionalStyle: "Composed and professional",
    description:
      "Sam receives the news calmly and asks clear, practical questions about severance, references, and next steps. The challenge: maintain the same professional standard, answer questions accurately, and avoid over-explaining or becoming defensive.",
  },
  {
    id: "angry",
    name: "Devon",
    emotionalStyle: "Volatile and confrontational",
    description:
      "Devon reacts with anger: raised voice, accusations of unfair treatment, and threats to involve legal counsel or HR. The challenge: de-escalate without capitulating, stay on script, and end the meeting safely without making promises you cannot keep.",
  },
] as const;
