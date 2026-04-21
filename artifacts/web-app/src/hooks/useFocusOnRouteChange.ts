import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Move keyboard focus to the page's main heading whenever the route changes.
 * Improves screen-reader and keyboard-user orientation between pages.
 *
 * Resolution order:
 *   1. The first `<h1>` inside `<main>` (preferred — pages wrapped in AppShell).
 *   2. Any `<h1>` on the page (covers landing / not-found which don't render
 *      a `<main>` element).
 *   3. The `<main>` element itself, as a last-resort skip target.
 *
 * The chosen element is given `tabindex="-1"` (and inline `outline:none`) so
 * it can receive programmatic focus without becoming a permanent tab stop or
 * showing a default outline ring.
 */
export function useFocusOnRouteChange() {
  const [location] = useLocation();

  useEffect(() => {
    // Defer to the next frame so the new page has rendered.
    const id = window.requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>("main h1") ??
        document.querySelector<HTMLElement>("h1") ??
        document.querySelector<HTMLElement>("main");
      if (!target) return;
      if (!target.hasAttribute("tabindex")) {
        target.setAttribute("tabindex", "-1");
      }
      target.style.outline = "none";
      target.focus({ preventScroll: false });
    });
    return () => window.cancelAnimationFrame(id);
  }, [location]);
}
