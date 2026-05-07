import { Link } from "wouter";
import {
  PRODUCT_LINKS,
  COMPANY_LINKS,
  SOCIAL_LINKS,
  type FooterLink,
} from "@/data/footerLinks";
import { SocialIconButton, FOCUS_RING } from "@/components/SocialIconButton";

interface FooterProps {
  onOpenDemo: () => void;
}

export function Footer({ onOpenDemo }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      aria-label="Site footer"
      className="bg-[#1E2D4A] text-[#C8D4E3] mt-auto"
    >
      <div
        className="max-w-[1200px] mx-auto px-6 sm:px-10 pt-10 pb-8
                   grid gap-10 md:grid-cols-2 lg:grid-cols-[1.8fr_1fr_1fr]"
      >
        <BrandColumn />
        <FooterNavColumn
          headingId="footer-product-heading"
          heading="HOW IT WORKS"
          items={PRODUCT_LINKS}
          onOpenDemo={onOpenDemo}
        />
        <FooterNavColumn
          headingId="footer-company-heading"
          heading="COMPANY"
          items={COMPANY_LINKS}
        />
      </div>

      <div className="border-t border-white/[0.08]">
        <div
          className="max-w-[1200px] mx-auto px-6 sm:px-10 py-4
                     flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2
                     text-xs text-[#7A8BA2]"
        >
          <small>© {year} Exit Coach. All rights reserved.</small>
          <span className="sm:italic">
            Built for managers who care about doing it right.
          </span>
        </div>
      </div>
    </footer>
  );
}

function BrandColumn() {
  return (
    <div>
      <Link href="/">
        <span
          className={`inline-block text-xl font-bold tracking-tight text-white cursor-pointer ${FOCUS_RING}`}
        >
          Exit<span className="text-amber-400">Coach</span>
        </span>
      </Link>
      <p className="mt-4 text-[13px] leading-relaxed text-[#8A9BB5] max-w-[260px]">
        Practice the conversations no one wants to have — in a safe, private,
        voice-first environment.
      </p>
      <ul role="list" className="mt-5 flex gap-3">
        {SOCIAL_LINKS.map((social) => (
          <li key={social.label}>
            <SocialIconButton
              label={social.label}
              href={social.href}
              icon={social.icon}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface FooterNavColumnProps {
  headingId: string;
  heading: string;
  items: FooterLink[];
  onOpenDemo?: () => void;
}

function FooterNavColumn({
  headingId,
  heading,
  items,
  onOpenDemo,
}: FooterNavColumnProps) {
  return (
    <nav aria-labelledby={headingId}>
      <h3
        id={headingId}
        className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#8A9BB5]"
      >
        {heading}
      </h3>
      <ul role="list" className="mt-4 space-y-3 text-sm">
        {items.map((item) => (
          <li key={item.label}>
            <FooterLinkItem item={item} onOpenDemo={onOpenDemo} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface FooterLinkItemProps {
  item: FooterLink;
  onOpenDemo?: () => void;
}

function FooterLinkItem({ item, onOpenDemo }: FooterLinkItemProps) {
  const linkClasses = `text-[#C8D4E3] hover:text-amber-400 transition-colors ${FOCUS_RING}`;

  if ("action" in item) {
    return (
      <button
        type="button"
        onClick={onOpenDemo}
        className={`text-left ${linkClasses}`}
      >
        {item.label}
      </button>
    );
  }

  if (item.placeholder) {
    return (
      <a
        href={item.href}
        aria-disabled="true"
        onClick={(e) => e.preventDefault()}
        className={`${linkClasses} cursor-not-allowed`}
      >
        {item.label}
      </a>
    );
  }

  if (item.href.startsWith("/#")) {
    return (
      <a href={item.href} className={linkClasses}>
        {item.label}
      </a>
    );
  }

  return (
    <Link href={item.href}>
      <span className={`cursor-pointer ${linkClasses}`}>{item.label}</span>
    </Link>
  );
}

