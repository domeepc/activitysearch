import Link from "next/link";
import { Check, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEGAL_SUPPORT_EMAIL, type LegalSectionData } from "./legal-shared";

const DOCUMENTS = [
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
] as const;

interface LegalDocumentLayoutProps {
  title: string;
  /** Which document this is, for the switcher */
  href: (typeof DOCUMENTS)[number]["href"];
  lastUpdated: string;
  intro: string;
  /** "The short version": plain-language highlights shown before the legal text */
  summary: string[];
  sections: LegalSectionData[];
}

export function LegalDocumentLayout({ title, href, lastUpdated, intro, summary, sections }: LegalDocumentLayoutProps) {
  const contents = (
    <ol className="space-y-1 text-sm">
      {sections.map((section, i) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="flex gap-3 rounded-lg px-2 py-1.5 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
          >
            <span className="w-5 shrink-0 tabular-nums text-zinc-400 dark:text-zinc-500">{i + 1}.</span>
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-6xl px-4 py-12 md:px-6 md:py-20">
        <header className="mx-auto max-w-3xl text-center">
          <nav aria-label="Legal documents" className="mb-8 inline-flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
            {DOCUMENTS.map((doc) => (
              <Link
                key={doc.href}
                href={doc.href}
                aria-current={doc.href === href ? "page" : undefined}
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  doc.href === href
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                )}
              >
                {doc.label}
              </Link>
            ))}
          </nav>
          <h1 className="text-balance text-4xl font-bold tracking-[-0.03em] text-zinc-900 md:text-6xl dark:text-zinc-50">
            {title}
          </h1>
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            Last updated
            <span className="rounded-full border border-zinc-200 px-3 py-1 font-medium text-zinc-900 dark:border-zinc-700 dark:text-zinc-50">
              {lastUpdated}
            </span>
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
            {intro}
          </p>
        </header>

        <section
          aria-labelledby="summary-heading"
          className="mx-auto mt-12 max-w-3xl rounded-3xl border border-blue-100 bg-blue-50/60 p-6 md:p-8 dark:border-blue-900/60 dark:bg-blue-950/30"
        >
          <h2 id="summary-heading" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            The short version
          </h2>
          <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300">
            {summary.map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-1 size-4 shrink-0 text-blue-600 dark:text-blue-400" strokeWidth={2.5} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">
            This summary helps you find your way; the full text below is what applies.
          </p>
        </section>

        <div className="mt-16 grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16">
          <aside className="lg:sticky lg:top-[calc(var(--app-navbar-height)+2rem)] lg:self-start">
            {/* Collapsed on phones so the text starts right away; always open on desktop */}
            <details className="group rounded-2xl border border-zinc-200 p-3 lg:hidden dark:border-zinc-800">
              <summary className="cursor-pointer list-none px-2 py-1 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Contents
              </summary>
              <div className="mt-2">{contents}</div>
            </details>
            <nav aria-label="On this page" className="hidden lg:block">
              <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">On this page</p>
              {contents}
            </nav>
          </aside>

          <article className="max-w-3xl">
            {sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                className="scroll-mt-[calc(var(--app-navbar-height)+2rem)] border-t border-zinc-200 py-10 first:border-t-0 first:pt-0 dark:border-zinc-800"
              >
                <h2 className="flex items-baseline gap-3 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                  <span className="text-base tabular-nums text-blue-600 dark:text-blue-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-zinc-700 dark:text-zinc-300 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-50 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                  {section.content}
                </div>
              </section>
            ))}

            <div className="mt-6 flex flex-col items-start gap-4 rounded-3xl bg-zinc-950 p-6 text-zinc-50 sm:flex-row sm:items-center sm:justify-between md:p-8 dark:bg-zinc-900 dark:ring-1 dark:ring-white/10">
              <div>
                <p className="text-lg font-semibold">Questions about this document?</p>
                <p className="mt-1 text-sm text-zinc-400">Email us and a real person will get back to you.</p>
              </div>
              <a
                href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200"
              >
                <Mail className="size-4" aria-hidden="true" />
                {LEGAL_SUPPORT_EMAIL}
              </a>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
