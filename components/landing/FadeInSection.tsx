"use client";

import { ReactNode, useEffect, useState } from "react";

interface FadeInSectionProps {
  children: ReactNode;
  delayMs?: number;
}

export function FadeInSection({ children, delayMs = 0 }: FadeInSectionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => setIsVisible(true), delayMs);
    return () => clearTimeout(timeoutId);
  }, [delayMs]);

  return (
    <div
      className="transition-all duration-700 ease-out"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(12px)",
      }}
    >
      {children}
    </div>
  );
}
