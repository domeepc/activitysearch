"use client";

import { useEffect } from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export default function NoScrollWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();

  useEffect(() => {
    // Only prevent scrolling on desktop
    if (isMobile) {
      return;
    }

    // Add class to body to prevent scrolling
    document.body.classList.add("auth-page-no-scroll-body");
    
    return () => {
      // Remove class when component unmounts
      document.body.classList.remove("auth-page-no-scroll-body");
    };
  }, [isMobile]);

  return <>{children}</>;
}

