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

/** The public landing page is always dark: it's an editorial surface, not app chrome. */
export function LandingPage() {
  return (
    <main className="dark min-h-screen bg-zinc-950 font-sans text-zinc-50 antialiased">
      <LandingNavbar />
      <HeroSection />
      <FadeInSection>
        <CategorySection items={categories} />
      </FadeInSection>
      <FadeInSection>
        <TopRatedSection items={topRated} />
      </FadeInSection>
      <FadeInSection>
        <QuestsSection />
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
