import Link from "next/link";
import { Star } from "lucide-react";
import { landingQuests, QuestItem } from "@/components/landing/data";
import { Accent } from "./SectionHeading";

interface QuestsSectionProps {
  items?: QuestItem[];
}

const QUEST_TINTS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
];

export function QuestsSection({ items }: QuestsSectionProps) {
  const displayQuests = items && items.length > 0 ? items : landingQuests;

  return (
    <section id="quests" aria-labelledby="quests-h" className="mx-auto w-full max-w-[1440px] px-4 pt-28 md:px-10">
      <div className="flex flex-wrap gap-10 rounded-4xl bg-zinc-50 p-6 text-zinc-950 md:p-12">
        <div className="flex flex-[1_1_280px] flex-col gap-4">
          <p className="text-[0.8125rem] font-semibold uppercase tracking-[0.08em] text-blue-700">03 — Quests</p>
          <h2 id="quests-h" className="text-[clamp(2.5rem,5vw,4.25rem)] font-extrabold leading-[0.95] tracking-[-0.045em]">
            Level up <Accent className="text-blue-600">as you go</Accent>.
          </h2>
          <p className="max-w-sm text-base leading-relaxed text-zinc-700">
            Complete simple challenges as you book and join activities. Earn XP, unlock badges and climb levels.
          </p>
          <Link
            href="/sign-in"
            className="mt-2 inline-flex h-12 items-center self-start rounded-full bg-zinc-950 px-6 text-[0.9375rem] font-semibold text-zinc-50 transition hover:bg-zinc-800 active:scale-[0.97]"
          >
            Start exploring
          </Link>
        </div>
        <div className="grid min-w-0 flex-[2_1_520px] gap-3 sm:grid-cols-2">
          {displayQuests.map((quest, i) => {
            const tint = QUEST_TINTS[i % QUEST_TINTS.length];
            return (
              <article key={quest.title} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5">
                <span className="flex items-center justify-between">
                  <span className={`inline-flex size-10 items-center justify-center rounded-xl ${tint}`}>
                    <Star className="size-5" aria-hidden="true" />
                  </span>
                  {quest.badge ? (
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tint}`}>{quest.badge}</span>
                  ) : null}
                </span>
                <h3 className="text-lg font-bold tracking-[-0.01em]">{quest.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-600">{quest.subtitle}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
