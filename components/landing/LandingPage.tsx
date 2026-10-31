import { HeroSection } from "@/components/landing/HeroSection";
import { CategorySection } from "@/components/landing/CategorySection";
import { TopRatedSection } from "@/components/landing/TopRatedSection";
import { QuestsSection } from "@/components/landing/QuestsSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { PaymentsSection } from "@/components/landing/PaymentsSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { categories, topRated } from "@/components/landing/data";
import { FadeInSection } from "@/components/landing/FadeInSection";
import { ReviewsSection } from "@/components/landing/ReviewsSection";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

/** The public landing page is always dark: it's an editorial surface, not app chrome. */
export function LandingPage({
  showcase,
}: {
  /**
   * Real activities, quests and reviews; null (backend unreachable) falls back to samples.
   * Fields may be missing when a cached response predates them, so every field is optional here.
   */
  showcase: Partial<FunctionReturnType<typeof api.landing.showcase>> | null;
}) {
  return (
    <main className="landing-root dark min-h-screen bg-zinc-950 font-sans text-zinc-50 antialiased">
      <LandingNavbar />
      <HeroSection
        tiles={showcase?.heroActivities?.map((a) => ({ ...a, href: `/activities/${a.id}` }))}
        marquee={showcase?.activityNames}
        quest={showcase?.quests?.[0]}
      />
      <FadeInSection>
        <CategorySection
          items={
            showcase?.categories?.length
              ? showcase.categories.map((c, i) => ({
                  ...c,
                  // Tags without a photo borrow a stock one so every tile has an image
                  imageUrl: c.imageUrl ?? categories[i % categories.length].imageUrl,
                }))
              : categories
          }
        />
      </FadeInSection>
      <FadeInSection>
        <TopRatedSection
          items={
            showcase?.topActivities?.length
              ? showcase.topActivities.map((a) => ({ ...a, href: `/activities/${a.id}` }))
              : topRated
          }
        />
      </FadeInSection>
      <FadeInSection>
        <QuestsSection items={showcase?.quests} />
      </FadeInSection>
      <FadeInSection>
        <ReviewsSection items={showcase?.reviews ?? []} />
      </FadeInSection>
      <div className="mx-auto grid w-full max-w-[1440px] gap-3 px-4 pt-28 md:px-10 lg:grid-cols-12">
        <FadeInSection className="lg:col-span-7">
          <SecuritySection />
        </FadeInSection>
        <FadeInSection delayMs={120} className="lg:col-span-5">
          <PaymentsSection />
        </FadeInSection>
      </div>
      <FadeInSection>
        <CtaSection />
      </FadeInSection>
      <LandingFooter />
    </main>
  );
}
