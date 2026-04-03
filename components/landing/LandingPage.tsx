"use client";

import { HeroSection } from "@/components/landing/HeroSection";
import { CategorySection } from "@/components/landing/CategorySection";
import { TopRatedSection } from "@/components/landing/TopRatedSection";
import { HappeningNowSection } from "@/components/landing/HappeningNowSection";
import { QuestsSection } from "@/components/landing/QuestsSection";
import { SecuritySection } from "@/components/landing/SecuritySection";
import { PaymentsSection } from "@/components/landing/PaymentsSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";
import {
  categories,
  happeningNow,
  heroCards,
  topRated,
} from "@/components/landing/data";
import { FadeInSection } from "@/components/landing/FadeInSection";

const LANDING_SECTIONS = [
  {
    id: "hero",
    delayMs: 0,
    content: <HeroSection cards={heroCards} />,
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
  {
    id: "happening-now",
    delayMs: 320,
    content: <HappeningNowSection items={happeningNow} />,
  },
  { id: "quests", delayMs: 400, content: <QuestsSection /> },
  { id: "security", delayMs: 480, content: <SecuritySection /> },
  { id: "payments", delayMs: 560, content: <PaymentsSection /> },
  { id: "cta", delayMs: 640, content: <CtaSection /> },
  { id: "footer", delayMs: 720, content: <LandingFooter /> },
] as const;

export function LandingPage() {
  return (
    <main className="bg-white">
      {LANDING_SECTIONS.map(({ id, delayMs, content }) => (
        <FadeInSection key={id} delayMs={delayMs}>
          {content}
        </FadeInSection>
      ))}
    </main>
  );
}
