# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the ActivitySearch landing page by adding a navbar, replacing the hero with a centered full-width layout, tightening three content sections, and removing three unused sections.

**Architecture:** Six focused changes across six files in `components/landing/`. One new file (LandingNavbar), one full rewrite (HeroSection), four minor edits. No changes to data, routing, auth, or non-landing components.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui (Badge, Button, Input, Card), Lucide icons

> **Note:** No test framework is configured. Verification steps use `pnpm lint` + visual check in the dev server.

---

## File Map

| Action | File |
|--------|------|
| Create | `components/landing/LandingNavbar.tsx` |
| Rewrite | `components/landing/HeroSection.tsx` |
| Modify | `components/landing/CategorySection.tsx` |
| Modify | `components/landing/TopRatedSection.tsx` |
| Modify | `components/landing/QuestsSection.tsx` |
| Modify | `components/landing/LandingPage.tsx` |

---

### Task 1: Create LandingNavbar

**Files:**
- Create: `components/landing/LandingNavbar.tsx`

- [ ] **Step 1: Create the navbar component**

Create `components/landing/LandingNavbar.tsx` with this exact content:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled ? "bg-white border-b border-zinc-200 shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="text-lg font-semibold text-zinc-900">
          ActivitySearch
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
          >
            Sign in
          </Link>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: no errors on the new file.

- [ ] **Step 3: Commit**

```bash
git add components/landing/LandingNavbar.tsx
git commit -m "feat(landing): add sticky transparent navbar with scroll effect"
```

---

### Task 2: Rewrite HeroSection

**Files:**
- Modify: `components/landing/HeroSection.tsx` (full replacement)

- [ ] **Step 1: Replace HeroSection with centered full-width layout**

Replace the entire contents of `components/landing/HeroSection.tsx` with:

```tsx
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HeroSection() {
  return (
    <section
      className="flex min-h-[85vh] w-full flex-col items-center justify-center px-4 pt-16"
      style={{
        backgroundImage:
          "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <Badge className="mb-6 rounded-full bg-blue-600 px-3 py-1 text-xs tracking-wide text-white">
          EASY TO EXPERIENCE
        </Badge>
        <h1 className="text-6xl font-bold leading-none tracking-tight text-zinc-900 md:text-8xl">
          Find activities{" "}
          <span className="text-blue-600">near you.</span>
        </h1>
        <p className="mt-6 max-w-lg text-base text-zinc-500">
          Discover sports and local activities, compare options, and book your
          next experience in a few taps.
        </p>
        <div className="mt-8 w-full max-w-xl rounded-2xl border border-zinc-200 bg-white p-3 shadow-md">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input
              placeholder="What are you looking for?"
              className="h-11 rounded-xl border-zinc-200"
            />
            <Button asChild className="h-11 rounded-xl px-6">
              <Link href="/home">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Link>
            </Button>
          </div>
        </div>
        <p className="mt-6 text-sm text-zinc-400">
          ★ 4.9 · 2,000+ activities · Trusted by local communities
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: no errors. (TypeScript will complain about the removed `cards` prop only once LandingPage.tsx is updated in Task 6 — that's fine, fix it there.)

- [ ] **Step 3: Commit**

```bash
git add components/landing/HeroSection.tsx
git commit -m "feat(landing): rewrite hero to centered full-width with dot-grid background"
```

---

### Task 3: Update CategorySection

**Files:**
- Modify: `components/landing/CategorySection.tsx`

Three changes: white bg, accent border on heading, taller featured tile, text link instead of ghost button.

- [ ] **Step 1: Apply all three CategorySection changes**

In `components/landing/CategorySection.tsx`, make these edits:

**Change 1** — line 48, `bg-zinc-50` → `bg-white`:
```tsx
// Before
<section className="bg-zinc-50 py-14">
// After
<section className="bg-white py-14">
```

**Change 2** — wrap `<h2>` in accent border div (lines 51-54):
```tsx
// Before
<div>
  <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
    Explore by Category
  </h2>
  <p className="mt-1 text-sm text-zinc-600">
    Browse experiences by vibe and energy level.
  </p>
</div>

// After
<div>
  <div className="border-l-4 border-blue-600 pl-4">
    <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
      Explore by Category
    </h2>
    <p className="mt-1 text-sm text-zinc-600">
      Browse experiences by vibe and energy level.
    </p>
  </div>
</div>
```

**Change 3** — featured tile min-height (line 68):
```tsx
// Before
className="group relative min-h-[260px] overflow-hidden rounded-2xl border border-zinc-200 shadow-sm md:col-span-2"
// After
className="group relative min-h-[320px] overflow-hidden rounded-2xl border border-zinc-200 shadow-sm md:col-span-2"
```

**Change 4** — the inner `min-h-[260px]` on the content div (line 87):
```tsx
// Before
<div className="relative z-10 flex h-full min-h-[260px] flex-col justify-end p-6 text-white">
// After
<div className="relative z-10 flex h-full min-h-[320px] flex-col justify-end p-6 text-white">
```

**Change 5** — replace ghost Button with plain Link. Remove the `Button` import if it's no longer used elsewhere in this file. Replace (lines 59-64):
```tsx
// Before
<Button asChild variant="ghost" className="rounded-full">
  <Link href="/home">
    Explore all
    <ArrowRight className="ml-2 h-4 w-4" />
  </Link>
</Button>

// After
<Link
  href="/home"
  className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
>
  Explore all
  <ArrowRight className="h-4 w-4" />
</Link>
```

Then remove the `Button` import from the top of the file:
```tsx
// Remove this line:
import { Button } from "@/components/ui/button";
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/CategorySection.tsx
git commit -m "feat(landing): update category section — white bg, accent heading, taller featured tile"
```

---

### Task 4: Update TopRatedSection

**Files:**
- Modify: `components/landing/TopRatedSection.tsx`

Three changes: zinc-50 section bg, taller card image, price badge moves to image overlay.

- [ ] **Step 1: Apply all TopRatedSection changes**

Replace the entire contents of `components/landing/TopRatedSection.tsx` with:

```tsx
import { MapPin, Star } from "lucide-react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ActivityItem, topRated } from "@/components/landing/data";

interface TopRatedSectionProps {
  items?: ActivityItem[];
}

export function TopRatedSection({ items }: TopRatedSectionProps) {
  const displayItems = items && items.length > 0 ? items : topRated;

  return (
    <section className="bg-zinc-50 py-14">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 md:px-6">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
            Top Rated Activities
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Popular experiences trusted by the community.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {displayItems.map((activity) => (
            <Card
              key={activity.title}
              className="overflow-hidden gap-0 border-zinc-200 pt-0 pb-0 shadow-sm"
            >
              <div
                className={`relative h-40 ${
                  activity.imageUrl
                    ? "bg-zinc-100"
                    : `bg-linear-to-br ${activity.tone}`
                }`}
              >
                {activity.imageUrl ? (
                  <Image
                    src={activity.imageUrl}
                    alt={activity.title}
                    loading="eager"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="h-full w-full object-cover object-center"
                  />
                ) : null}
                <Badge className="absolute right-3 top-3 z-10 border-0 bg-white/90 text-xs font-semibold text-zinc-800 shadow-sm">
                  {activity.price}
                </Badge>
              </div>
              <CardContent className="space-y-3 p-4">
                <h3 className="line-clamp-1 font-semibold text-zinc-900">
                  {activity.title}
                </h3>
                <p className="text-sm text-zinc-600">{activity.category}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    Nearby
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-zinc-700">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {activity.rating}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/TopRatedSection.tsx
git commit -m "feat(landing): top rated cards — zinc-50 bg, taller images, price badge on image"
```

---

### Task 5: Update QuestsSection

**Files:**
- Modify: `components/landing/QuestsSection.tsx`

Two changes: remove `border-y` from section, add decorative trophy divider above the quest grid.

- [ ] **Step 1: Apply QuestsSection changes**

In `components/landing/QuestsSection.tsx`:

**Change 1** — remove `border-y border-zinc-200` from the section tag (line 17):
```tsx
// Before
<section className="border-y border-zinc-200 bg-white py-14">
// After
<section className="bg-white py-14">
```

**Change 2** — add the decorative divider between the header block and the quest grid. Find the closing `</div>` of the header block (after the `<Button>`) and insert before `<div className="grid gap-4 ...">`:

```tsx
        {/* decorative divider */}
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-zinc-200" />
          <Trophy className="h-5 w-5 text-zinc-300" />
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
```

The `Trophy` icon is already imported at the top of the file — no new import needed.

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/landing/QuestsSection.tsx
git commit -m "feat(landing): quests section — remove border, add decorative trophy divider"
```

---

### Task 6: Wire LandingPage — add navbar, remove three sections

**Files:**
- Modify: `components/landing/LandingPage.tsx`

- [ ] **Step 1: Update LandingPage.tsx**

Replace the entire contents of `components/landing/LandingPage.tsx` with:

```tsx
"use client";

import { HeroSection } from "@/components/landing/HeroSection";
import { CategorySection } from "@/components/landing/CategorySection";
import { TopRatedSection } from "@/components/landing/TopRatedSection";
import { QuestsSection } from "@/components/landing/QuestsSection";
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
  { id: "cta", delayMs: 400, content: <CtaSection /> },
  { id: "footer", delayMs: 480, content: <LandingFooter /> },
] as const;

export function LandingPage() {
  return (
    <main className="bg-white">
      <LandingNavbar />
      {LANDING_SECTIONS.map(({ id, delayMs, content }) => (
        <FadeInSection key={id} delayMs={delayMs}>
          {content}
        </FadeInSection>
      ))}
    </main>
  );
}
```

- [ ] **Step 2: Verify lint passes**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Visual check — start dev server**

```bash
pnpm dev
```

Open `http://localhost:3000` in a browser. Verify:
- Navbar appears transparent at top, turns white with border on scroll
- Hero is centered, full-height, dot-grid background, large headline, search bar, social proof line
- Categories section: white bg, blue left border on heading, featured tile is taller
- TopRated: zinc-50 bg, taller images, price badge overlays image top-right
- Quests: trophy divider above cards, no border-y on section
- CTA and Footer unchanged
- HappeningNow, Security, Payments sections gone

- [ ] **Step 4: Commit**

```bash
git add components/landing/LandingPage.tsx
git commit -m "feat(landing): wire navbar, remove happeningNow/security/payments sections"
```
