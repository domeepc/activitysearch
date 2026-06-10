"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/ui/navBar/NavBar";

export function ConditionalNavbar() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <header className="app-site-header">
      <Navbar />
    </header>
  );
}
