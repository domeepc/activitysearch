"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/ui/navBar/NavBar";

export function ConditionalNavbar() {
  const pathname = usePathname();
  // Landing and auth screens bring their own chrome.
  if (
    pathname === "/" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/sso-callback")
  ) {
    return null;
  }
  return (
    <header className="app-site-header">
      <Navbar />
    </header>
  );
}
