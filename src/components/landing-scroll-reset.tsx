"use client";

import { useLayoutEffect } from "react";

export function LandingScrollReset() {
  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    const resetScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };

    resetScroll();
    window.addEventListener("pageshow", resetScroll);

    return () => {
      window.removeEventListener("pageshow", resetScroll);
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  return null;
}
