# Dark Mode Design

**Date:** 2026-06-14  
**Status:** Approved

## Summary

Add dark mode support to ActivitySearch using `next-themes`. The app already has a complete `.dark` CSS variable set in `globals.css` — this spec wires up the provider, fixes hardcoded colors that bypass the theme system, and adds a user-facing toggle.

## Architecture

- **Library:** `next-themes` (`pnpm add next-themes`)
- **Mechanism:** `ThemeProvider` sets `attribute="class"` — adds/removes `.dark` on `<html>`
- **Default:** `defaultTheme="system"` — respects OS preference on first visit
- **Persistence:** `next-themes` writes to `localStorage` automatically
- **SSR:** `suppressHydrationWarning` on `<html>` prevents Next.js hydration mismatch

## Files Changed

### 1. `components/providers/ThemeProvider.tsx` (new)

Thin re-export of `next-themes` `ThemeProvider`. Required to keep `app/layout.tsx` a Server Component (next-themes requires `"use client"`).

```tsx
"use client";
export { ThemeProvider } from "next-themes";
```

### 2. `app/layout.tsx`

- Add `suppressHydrationWarning` to `<html>`
- Wrap body children in `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`

### 3. `components/ui/ThemeToggle.tsx` (new)

Client component. Uses `useTheme()` to toggle between `"dark"` and `"light"`. Renders `Sun` (light mode) / `Moon` (dark mode) icon from lucide-react. Must use `mounted` state guard to prevent SSR icon mismatch.

```
interface: no props
behavior: on click → setTheme(current === 'dark' ? 'light' : 'dark')
icon: Sun when dark (click to go light), Moon when light (click to go dark)
size: ghost variant, small, square button
```

### 4. `components/ui/navBar/NavBar.tsx`

Add `ThemeToggle` as a `DropdownMenuItem` inside the authenticated user dropdown, between the "My Organisation" item and the `DropdownMenuSeparator` before "Sign out".

Render as a row: `Moon/Sun icon | "Dark mode" | toggle switch visual`

### 5. `components/landing/LandingNavbar.tsx`

- Add `ThemeToggle` button between logo and Sign in/Sign up buttons
- Fix hardcoded `bg-white` → `bg-background` (scrolled state) and `border-zinc-200` → `border-border`

### 6. `components/ui/navBar/style.css`

Replace hardcoded colors with CSS variables:

| Hardcoded | Replace with |
|-----------|-------------|
| `color: #000` | `color: var(--foreground)` |
| `background-color: #f3f4f6` | `background-color: var(--muted)` |
| `color: #0077ff` (icons) | keep or use `color: var(--primary)` — decide at implementation |

## Decisions

- Toggle placement: inside user dropdown (authenticated), as icon button in LandingNavbar (unauthenticated)
- No "system" option in the toggle UI — just binary light/dark toggle (system preference is the initial default only)
- `ThemeToggle` is a standalone component, not inlined in either navbar, so it can be reused

## Out of Scope

- Per-user theme preference stored in Convex/database (localStorage only)
- Custom dark theme colors beyond what shadcn already provides in `.dark`
- Any animation on the theme switch beyond what CSS transitions already handle
