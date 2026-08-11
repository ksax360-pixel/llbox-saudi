"use client";

import { useEffect, useState } from "react";

const DESKTOP_MIN_WIDTH = 1024;

export function useIsDesktop(minWidth = DESKTOP_MIN_WIDTH) {
  const [ready, setReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${minWidth}px)`);

    const update = () => setIsDesktop(media.matches);
    update();
    setReady(true);

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [minWidth]);

  return { ready, isDesktop };
}
