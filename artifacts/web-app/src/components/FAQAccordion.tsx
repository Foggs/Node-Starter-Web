import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { Plus } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/components/ui/accordion";
import { FAQ_ITEMS, type FAQItem } from "@/data/faqContent";
import { cn } from "@/lib/utils";

function flattenAnswer(item: FAQItem): string {
  const parts: string[] = [item.answer];
  if (item.steps) {
    item.steps.forEach((step, i) => parts.push(`${i + 1}. ${step}`));
  }
  if (item.closing) parts.push(item.closing);
  return parts.join("\n");
}

function buildFaqJsonLd(items: FAQItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      "@id": `#faq-${item.id}`,
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: flattenAnswer(item),
      },
    })),
  };
}

export function FAQAccordion() {
  const jsonLd = JSON.stringify(buildFaqJsonLd(FAQ_ITEMS)).replace(
    /</g,
    "\\u003c",
  );

  return (
    <section
      aria-labelledby="faq-heading"
      className="border-t border-slate-800 px-6 py-16"
    >
      <div className="max-w-[720px] mx-auto w-full">
        <h2
          id="faq-heading"
          className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-center"
        >
          Questions we hear a lot
        </h2>
        <p className="mt-3 text-sm text-slate-400 text-center">
          If something's still unclear,{" "}
          <a
            href="mailto:hello@exitcoach.io"
            className="text-amber-400 hover:underline focus-visible:outline-none focus-visible:underline"
          >
            just ask us
          </a>
          .
        </p>

        <Accordion
          type="single"
          collapsible
          className="mt-10 w-full"
          data-testid="faq-accordion"
        >
          {FAQ_ITEMS.map((item) => (
            <AccordionItem
              key={item.id}
              value={item.id}
              id={`faq-${item.id}`}
              className="border-slate-800"
            >
              <AccordionPrimitive.Header className="flex">
                <AccordionPrimitive.Trigger
                  className={cn(
                    "group flex flex-1 items-center justify-between gap-4 py-5 text-left text-base font-medium text-white",
                    "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  )}
                >
                  <span>{item.question}</span>
                  <Plus
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-45 motion-reduce:transition-none"
                  />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent
                className={cn(
                  "pb-5 pt-0 text-[15px] leading-[1.6] text-slate-300",
                  "motion-reduce:animate-none",
                )}
              >
                <p>{item.answer}</p>
                {item.steps ? (
                  <ol className="mt-3 list-decimal space-y-2 pl-5 marker:text-slate-500">
                    {item.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : null}
                {item.closing ? <p className="mt-3">{item.closing}</p> : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <script
        type="application/ld+json"
        data-testid="faq-jsonld"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
    </section>
  );
}
