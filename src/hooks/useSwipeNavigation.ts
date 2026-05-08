import { useEffect, useRef } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";

const TAB_ORDER = ["/chat", "/tasks", "/calendar", "/notes", "/settings"] as const;

function activeIndex(pathname: string) {
  return TAB_ORDER.findIndex((t) => pathname.startsWith(t));
}

export function useSwipeNavigation(enabled: boolean = true) {
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const startT = useRef<number>(0);
  const tracking = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const idx = activeIndex(path);
    if (idx === -1) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      // Ignore swipes that begin on interactive scrollable / draggable elements
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-no-swipe], input, textarea, [contenteditable='true'], [role='slider']")) {
        return;
      }
      startX.current = t.clientX;
      startY.current = t.clientY;
      startT.current = Date.now();
      tracking.current = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking.current || startX.current == null || startY.current == null) return;
      tracking.current = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX.current;
      const dy = t.clientY - startY.current;
      const dt = Date.now() - startT.current;
      startX.current = null;
      startY.current = null;

      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      // Require mostly-horizontal, fast-enough or long-enough swipe
      if (absX < 60 || absX < absY * 1.5) return;
      if (dt > 600 && absX < 120) return;

      if (dx < 0 && idx < TAB_ORDER.length - 1) {
        navigate({ to: TAB_ORDER[idx + 1] });
      } else if (dx > 0 && idx > 0) {
        navigate({ to: TAB_ORDER[idx - 1] });
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, path, navigate]);
}