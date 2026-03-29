"use client";

import { HeroSection } from "@/components/landing/HeroSection";
import { CategorySection } from "@/components/landing/CategorySection";
import { TopRatedSection } from "@/components/landing/TopRatedSection";
import { HappeningNowSection } from "@/components/landing/HappeningNowSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  ActivityItem,
  CategoryItem,
  HeroCardItem,
  LiveItem,
  heroCards as defaultHeroCards,
  tonePalette,
} from "@/components/landing/data";
import { useActivities } from "@/lib/hooks/useActivities";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeInSection } from "@/components/landing/FadeInSection";

export function LandingPage() {
  const { activities, isLoading } = useActivities();

  const dynamicContent = useMemo(() => {
    const safeActivities = activities ?? [];

    const heroCards: HeroCardItem[] = safeActivities.slice(0, 2).map((item, index) => ({
      title: item.title,
      subtitle: item.location?.name || "Local spot",
      badge: index === 0 ? "Featured" : "Popular",
      tone: tonePalette[index % tonePalette.length],
      imageUrl: item.images?.[0],
    }));

    const topRatedItems: ActivityItem[] = [...safeActivities]
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3)
      .map((item, index) => ({
        title: item.title,
        category: item.category,
        price: `${item.price?.currency ?? "$"}${item.price?.amount ?? 0}`,
        rating: item.rating.toFixed(1),
        tone: tonePalette[index % tonePalette.length],
        imageUrl: item.images?.[0],
      }));

    const happeningNow: LiveItem[] = safeActivities.slice(0, 3).map((item) => ({
      label: `${item.title} - ${item.location?.name || "Nearby"}`,
    }));

    const byCategory = new Map<string, number>();
    for (const activity of safeActivities) {
      byCategory.set(activity.category, (byCategory.get(activity.category) ?? 0) + 1);
    }

    const categoryItems: CategoryItem[] = [...byCategory.entries()]
      .slice(0, 4)
      .map(([category, count], index) => ({
        title: category,
        subtitle: `${count} active experiences`,
        tone: tonePalette[index % tonePalette.length],
      }));

    return { heroCards, topRatedItems, happeningNow, categoryItems };
  }, [activities]);

  if (isLoading) {
    return (
      <main className="bg-white">
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-14 pt-4 md:grid-cols-2 md:px-6 md:pt-8">
          <div className="space-y-4">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-14 w-full max-w-xl" />
            <Skeleton className="h-14 w-full max-w-md" />
            <Skeleton className="h-10 w-full max-w-lg rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Skeleton className="col-span-2 h-28 rounded-2xl" />
            <Skeleton className="h-[220px] rounded-2xl" />
            <Skeleton className="h-[220px] rounded-2xl" />
          </div>
        </section>

        <section className="bg-zinc-50 py-14">
          <div className="mx-auto w-full max-w-6xl space-y-4 px-4 md:px-6">
            <Skeleton className="h-8 w-56" />
            <div className="grid gap-3 md:grid-cols-3">
              <Skeleton className="min-h-[260px] rounded-2xl md:col-span-2" />
              <div className="grid gap-3">
                <Skeleton className="min-h-[120px] rounded-2xl" />
                <Skeleton className="min-h-[120px] rounded-2xl" />
                <Skeleton className="min-h-[120px] rounded-2xl" />
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const heroCards =
    dynamicContent.heroCards.length > 0
      ? dynamicContent.heroCards
      : defaultHeroCards;

  return (
    <main className="bg-white">
      <FadeInSection delayMs={0}>
        <HeroSection cards={heroCards} />
      </FadeInSection>
      <FadeInSection delayMs={120}>
        <CategorySection items={dynamicContent.categoryItems} />
      </FadeInSection>
      <FadeInSection delayMs={240}>
        <TopRatedSection items={dynamicContent.topRatedItems} />
      </FadeInSection>
      <FadeInSection delayMs={320}>
        <HappeningNowSection items={dynamicContent.happeningNow} />
      </FadeInSection>
      <FadeInSection delayMs={420}>
        <CtaSection />
      </FadeInSection>
      <FadeInSection delayMs={520}>
        <LandingFooter />
      </FadeInSection>
    </main>
  );
}
