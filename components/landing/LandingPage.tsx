"use client";

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

const LANDING_SECTIONS = [
  {
    id: "hero",
    delayMs: 0,
    content: <HeroSection />,
  },
  {
    id: "categories",
    delayMs: 120,
    content: <CategorySection items={categories} />,
  },
  {
    id: "top-rated",
    delayMs: 240,
    content: <TopRatedSection items={topRated} />,
  },
  { id: "quests", delayMs: 320, content: <QuestsSection /> },
  { id: "security", delayMs: 400, content: <SecuritySection /> },
  { id: "payments", delayMs: 480, content: <PaymentsSection /> },
  { id: "cta", delayMs: 560, content: <CtaSection /> },
  { id: "footer", delayMs: 640, content: <LandingFooter /> },
] as const;

export function LandingPage() {
  return (
    <main className="bg-background">
      <LandingNavbar />
      {LANDING_SECTIONS.map(({ id, delayMs, content }) => (
        <FadeInSection key={id} delayMs={delayMs}>
          {content}
        </FadeInSection>
      ))}
    </main>
  );
}
