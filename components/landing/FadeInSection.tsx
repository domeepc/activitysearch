"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface FadeInSectionProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

/** Reveals its content once it scrolls into view (no-op for reduced motion). */
export function FadeInSection({ children, delayMs = 0, className }: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        className,
        "motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out",
        isVisible ? "opacity-100 translate-y-0" : "motion-safe:opacity-0 motion-safe:translate-y-6"
      )}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
