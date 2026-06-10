# Landing Page Redesign — Design Spec

**Date:** 2026-06-10  
**Approach:** Editorial Minimal — light base, blue accent, strong typographic hierarchy

---

## Summary

Redesign the ActivitySearch landing page to improve visual hierarchy, add a navbar, strengthen the hero, and cut low-value sections. No new design language — refine what exists.

**Sections after redesign:**
1. Navbar (new)
2. Hero (redesigned)
3. Categories (minor update)
4. TopRated (minor update)
5. Quests (minor update)
6. CTA (unchanged)
7. Footer (unchanged)

**Removed:** HappeningNow, SecuritySection, PaymentsSection

---

## 1. Navbar

**File to create:** `components/landing/LandingNavbar.tsx`

- Sticky top, full-width, `z-50`
- Inner container: `max-w-6xl mx-auto px-4 md:px-6`, `h-16`, flex row, items-center, justify-between
- Left: "ActivitySearch" logo text — `font-semibold text-zinc-900`
- Right: "Sign in" ghost/text link → `/sign-in`, "Get started" blue button (rounded-full) → `/sign-up`
- Scroll behavior: transparent bg + no border at top; white bg + `border-b border-zinc-200` after scrolling past ~10px. Implemented via `useEffect` + `scroll` event listener (or `useState` tracking `window.scrollY`).
- Add to `LandingPage.tsx` above the sections list, outside the `FadeInSection` wrapper.

---

## 2. Hero (Redesigned)

**File:** `components/landing/HeroSection.tsx` — full rewrite

- Remove the `md:grid-cols-2` split layout and activity image cards entirely
- Full-width centered layout, `min-h-[85vh]`, flex col, items-center, justify-center
- Background: subtle dot-grid CSS pattern on white (`background-image: radial-gradient(circle, #d4d4d8 1px, transparent 1px); background-size: 24px 24px`) — applied via inline style or Tailwind arbitrary value
- Content stack (centered, `max-w-2xl mx-auto text-center`):
  1. Badge pill: "EASY TO EXPERIENCE" — existing blue Badge component
  2. Headline: `text-6xl md:text-8xl font-bold tracking-tight leading-none` — "Find activities" line break "near you." with "near you." in `text-blue-600`
  3. Subline: `text-base text-zinc-500 max-w-lg mx-auto mt-4`
  4. Search bar card: `max-w-xl mx-auto mt-8 rounded-2xl border border-zinc-200 bg-white p-3 shadow-md` — Input + Search Button inline (same as current)
  5. Social proof: `mt-6 text-sm text-zinc-400` — "★ 4.9 · 2,000+ activities · Trusted by local communities"

---

## 3. CategorySection (Minor Update)

**File:** `components/landing/CategorySection.tsx`

- Change `bg-zinc-50` → `bg-white`
- Add left accent border on section heading: wrap `<h2>` in a `<div className="border-l-4 border-blue-600 pl-4">`
- Increase featured tile min-height: `min-h-[260px]` → `min-h-[320px]`
- Replace "Explore all" `Button variant="ghost"` with a plain `<Link>` styled as `text-sm text-zinc-500 hover:text-zinc-900 inline-flex items-center gap-1`

---

## 4. TopRatedSection (Minor Update)

**File:** `components/landing/TopRatedSection.tsx`

- Change section bg from implicit white → `bg-zinc-50` (adds visual break)
- Increase card image height: `h-28` → `h-40`
- Move price Badge: from `CardContent` (below image) → absolute overlay on image, `top-3 right-3 z-10`, white bg badge

---

## 5. QuestsSection (Minor Update)

**File:** `components/landing/QuestsSection.tsx`

- Add decorative divider above the section: a horizontal rule with the Trophy icon centered:
  ```tsx
  <div className="flex items-center gap-4 mb-8">
    <div className="flex-1 h-px bg-zinc-200" />
    <Trophy className="h-5 w-5 text-zinc-300" />
    <div className="flex-1 h-px bg-zinc-200" />
  </div>
  ```
- Remove the existing `border-y border-zinc-200` on the `<section>` (replaced by the decorative divider)
- Otherwise unchanged

---

## 6. LandingPage.tsx Updates

**File:** `components/landing/LandingPage.tsx`

- Import and render `<LandingNavbar />` at the top, before the sections map
- Remove `HappeningNowSection`, `SecuritySection`, `PaymentsSection` from `LANDING_SECTIONS`
- Update `delayMs` values for remaining sections to keep stagger smooth

---

## Out of Scope

- No changes to auth flow, routing, or data
- No changes to CTA, Footer
- No new images or assets required
- No changes to any non-landing components
