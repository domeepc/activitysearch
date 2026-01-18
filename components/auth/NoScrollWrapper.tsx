"use client";

import { useEffect } from "react";

export default function NoScrollWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Add class to body to prevent scrolling
    document.body.classList.add("auth-page-no-scroll-body");
    
    return () => {
      // Remove class when component unmounts
      document.body.classList.remove("auth-page-no-scroll-body");
    };
  }, []);

  return <>{children}</>;
}

