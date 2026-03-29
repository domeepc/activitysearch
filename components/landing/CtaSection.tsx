import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CtaContent } from "@/components/landing/data";

interface CtaSectionProps {
  content?: CtaContent;
}

export function CtaSection({ content }: CtaSectionProps) {
  return (
    <section className="py-14">
      <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-900 p-8 text-white shadow-sm md:p-12">
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_top_right,#3b82f6_0%,transparent_45%)]" />
          <div className="relative max-w-2xl space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/70">
              {content?.eyebrow ?? "Start your journey"}
            </p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">
              {content?.title ?? "Turn your passion into an experience."}
            </h2>
            <p className="text-sm text-zinc-300 md:text-base">
              {content?.description ??
                "Join as a participant or organiser. Build your routine, discover new communities, and reserve your next activity in seconds."}
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild size="lg" className="rounded-full">
                <Link href={content?.participantHref ?? "/home"}>
                  {content?.participantLabel ?? "Join as participant"}
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary" className="rounded-full">
                <Link href={content?.organiserHref ?? "/sign-up"}>
                  {content?.organiserLabel ?? "Become an organiser"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
