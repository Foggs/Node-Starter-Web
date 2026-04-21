import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Move keyboard focus to the page's main `<h1>` whenever the route changes.
 * Improves screen-reader and keyboard-user orientation between pages.
 *
 * The h1 is given `tabindex="-1"` (and a no-outline class) so it can receive
 * programmatic focus without becoming a tab stop.
 */
export function useFocusOnRouteChange() {
  const [location] = useLocation();

  useEffect(() => {
    // Defer to next frame so the new page has rendered.
    const id = window.requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading) return;
      if (!heading.hasAttribute("tabindex")) {
        heading.setAttribute("tabindex", "-1");
      }
      heading.style.outline = "none";
      heading.focus({ preventScroll: false });
    });
    return () => window.cancelAnimationFrame(id);
  }, [location]);
}
