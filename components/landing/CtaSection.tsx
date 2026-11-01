import Link from "next/link";
import { CtaContent } from "@/components/landing/data";
import { Accent } from "./SectionHeading";

interface CtaSectionProps {
  content?: CtaContent;
}

export function CtaSection({ content }: CtaSectionProps) {
  return (
    <section
      aria-labelledby="cta-h"
      className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-6 px-4 pb-28 pt-36 text-center md:px-10"
    >
      <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-blue-400">
        {content?.eyebrow ?? "Start your journey"}
      </p>
      <h2
        id="cta-h"
        className="max-w-5xl text-[clamp(3rem,7.5vw,7.5rem)] font-extrabold leading-[0.92] tracking-[-0.05em] text-zinc-50"
      >
        {content?.title ?? (
          <>
            Turn your passion into an <Accent className="text-blue-400">experience</Accent>.
          </>
        )}
      </h2>
      <p className="max-w-xl text-lg leading-relaxed text-zinc-400">
        {content?.description ??
          "Join as a participant or organiser. Build your routine, discover new communities, and reserve your next activity in seconds."}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link
          href={content?.participantHref ?? "/sign-up"}
          className="inline-flex h-[52px] items-center rounded-full bg-zinc-50 px-7 text-base font-semibold text-zinc-950 transition hover:bg-white active:scale-[0.97]"
        >
          {content?.participantLabel ?? "Join as participant"}
        </Link>
        <Link
          href={content?.organiserHref ?? "/sign-up/organisator-sign-up"}
          className="inline-flex h-[52px] items-center rounded-full border border-zinc-700 px-7 text-base font-semibold text-zinc-50 transition hover:border-zinc-500 active:scale-[0.97]"
        >
          {content?.organiserLabel ?? "Become an organiser"}
        </Link>
      </div>
    </section>
  );
}
