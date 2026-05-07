import { Link } from "wouter";
import { Linkedin } from "lucide-react";
import {
  PRODUCT_LINKS,
  COMPANY_LINKS,
  SOCIAL_LINKS,
  type FooterLink,
  type SocialIcon,
} from "@/data/footerLinks";

interface FooterProps {
  onOpenDemo: () => void;
}

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E2D4A] rounded-sm";

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

interface SocialIconButtonProps {
  label: string;
  href: string;
  icon: SocialIcon;
}

function SocialIconButton({ label, href, icon }: SocialIconButtonProps) {
  const isPlaceholder = href === "#";
  return (
    <a
      href={href}
      aria-label={label}
      target={isPlaceholder ? undefined : "_blank"}
      rel={isPlaceholder ? undefined : "noopener noreferrer"}
      onClick={isPlaceholder ? (e) => e.preventDefault() : undefined}
      className={`group inline-flex items-center justify-center w-[34px] h-[34px] rounded-lg
                  border border-white/[0.12] text-[#8A9BB5]
                  hover:border-amber-400 hover:text-amber-400
                  transition-colors ${FOCUS_RING}
                  ${isPlaceholder ? "cursor-not-allowed" : ""}`}
    >
      {icon === "linkedin" ? (
        <Linkedin className="w-4 h-4" aria-hidden="true" />
      ) : (
        <XIcon />
      )}
    </a>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="w-3.5 h-3.5 fill-current"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
