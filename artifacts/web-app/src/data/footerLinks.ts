export type FooterLink =
  | { label: string; href: string; placeholder?: boolean }
  | { label: string; action: "openDemo" };

export const PRODUCT_LINKS: FooterLink[] = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "See a demo", action: "openDemo" },
  { label: "FAQ", href: "/#faq" },
];

export const COMPANY_LINKS: FooterLink[] = [
  { label: "Contact", href: "/contact" },
  { label: "Privacy policy", href: "/privacy", placeholder: true },
  { label: "Terms of use", href: "/terms", placeholder: true },
];

export type SocialIcon = "linkedin" | "x";

export const SOCIAL_LINKS: { label: string; href: string; icon: SocialIcon }[] = [
  { label: "LinkedIn", href: "#", icon: "linkedin" },
  { label: "X / Twitter", href: "#", icon: "x" },
];
