import Link from "next/link";
import { Trophy, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { landingQuests, QuestItem } from "@/components/landing/data";
import { cn } from "@/lib/utils";

interface QuestsSectionProps {
  items?: QuestItem[];
}

export function QuestsSection({ items }: QuestsSectionProps) {
  const displayQuests = items && items.length > 0 ? items : landingQuests;

  return (
    <section className="border-y border-zinc-200 bg-white py-14">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 text-blue-600">
              <Trophy className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Quests
              </span>
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Level up as you go
            </h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-600">
              Complete simple challenges as you book and join activities. Earn
              recognition and discover new experiences along the way.
            </p>
          </div>
          <Button asChild variant="ghost" className="shrink-0 rounded-full">
            <Link href="/home">
              Start exploring
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {displayQuests.map((quest) => (
            <article
              key={quest.title}
              className={cn(
                "relative flex min-h-full flex-col justify-end overflow-hidden rounded-2xl border border-zinc-200 p-5 text-white shadow-sm",
                "bg-linear-to-br",
                quest.tone
              )}
            >
              <div className="relative z-10 flex flex-col">
                {quest.badge ? (
                  <Badge className="mb-3 w-fit border-0 bg-white/20 text-xs text-white hover:bg-white/25">
                    {quest.badge}
                  </Badge>
                ) : null}
                <h3 className="text-lg font-semibold leading-snug">{quest.title}</h3>
                <p className="mt-2 text-sm text-white/85">{quest.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
