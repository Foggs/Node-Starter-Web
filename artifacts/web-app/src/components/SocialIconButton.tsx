import { Linkedin } from "lucide-react";
import type { SocialIcon } from "@/data/footerLinks";

/**
 * Amber focus ring tuned for dark-navy surfaces (`#1B2A4A` / `#1E2D4A`).
 * Exported so other dark-surface components (Footer brand link, contact
 * page) can match without redefining the visible-focus pattern.
 */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1E2D4A] rounded-sm";

interface SocialIconButtonProps {
  label: string;
  href: string;
  icon: SocialIcon;
}

/**
 * 34×34 amber-on-hover icon button used in the site footer and the contact
 * page's "CONNECT" column. When `href === "#"` the link is treated as a
 * placeholder (no new tab, click prevented, cursor not-allowed) so we can
 * ship before the client confirms the real social URLs.
 */
export function SocialIconButton({ label, href, icon }: SocialIconButtonProps) {
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

export function XIcon() {
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
