export interface CategoryItem {
  title: string;
  subtitle: string;
  tone: string;
}

export interface ActivityItem {
  title: string;
  category: string;
  price: string;
  rating: string;
  tone: string;
  imageUrl?: string;
}

export interface LiveItem {
  label: string;
}

export interface HeroCardItem {
  title: string;
  subtitle: string;
  badge: string;
  tone: string;
  imageUrl?: string;
}

export interface CtaContent {
  eyebrow?: string;
  title?: string;
  description?: string;
  participantLabel?: string;
  participantHref?: string;
  organiserLabel?: string;
  organiserHref?: string;
}

export const heroCards: HeroCardItem[] = [
  {
    title: "Basketball",
    subtitle: "Urban Arena",
    badge: "Featured",
    tone: "from-rose-500 to-orange-400",
  },
  {
    title: "Team Sports",
    subtitle: "4.9 rating",
    badge: "Top Picks",
    tone: "from-cyan-500 to-blue-500",
  },
];

export const categories: CategoryItem[] = [
  { title: "High Energy", subtitle: "For thrill seekers", tone: "from-zinc-900 to-zinc-700" },
  { title: "Mindful Flow", subtitle: "Reset and recover", tone: "from-teal-500 to-emerald-500" },
  { title: "Team Sports", subtitle: "Play together", tone: "from-sky-500 to-indigo-500" },
  { title: "Outdoor Pursuit", subtitle: "Fresh air focus", tone: "from-amber-500 to-orange-500" },
];

export const topRated: ActivityItem[] = [
  { title: "Midnight Arena", category: "Adventure", price: "$45", rating: "4.8", tone: "from-slate-800 to-zinc-700" },
  { title: "Sunset Baseball Series", category: "Team Sports", price: "$25", rating: "4.9", tone: "from-indigo-700 to-sky-500" },
  { title: "Precision Shooting Range", category: "Shooting", price: "$30", rating: "4.7", tone: "from-zinc-700 to-stone-500" },
];

export const happeningNow: LiveItem[] = [
  { label: "Yoga by The River - 12 spots left" },
  { label: "Sunset Paddle Session - starts in 45 min" },
  { label: "Neon Climbing Event - starts in 30 min" },
];

export const tonePalette = [
  "from-zinc-900 to-zinc-700",
  "from-indigo-700 to-sky-500",
  "from-teal-600 to-emerald-500",
  "from-amber-500 to-orange-500",
  "from-blue-600 to-cyan-500",
];
