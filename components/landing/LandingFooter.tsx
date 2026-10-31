import Link from "next/link";
import { LEGAL_SUPPORT_EMAIL } from "@/components/legal/legal-shared";
import Image from "next/image";

const linkClass = "text-zinc-400 underline-offset-4 transition-colors hover:text-zinc-50 hover:underline";

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-800">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-x-8 gap-y-4 px-4 py-7 text-[13px] text-zinc-400 md:px-10">
        <Image src="/full-logo-dark.svg" alt="ActivitySearch" width={112} height={28} />
        <p>© {year} ActivitySearch. All rights reserved.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-1 md:ml-auto" aria-label="Legal">
          <Link href="/terms" className={linkClass}>Terms of Service</Link>
          <Link href="/privacy" className={linkClass}>Privacy Policy</Link>
          <a href={`mailto:${LEGAL_SUPPORT_EMAIL}`} className={linkClass}>Support</a>
        </nav>
      </div>
    </footer>
  );
}
