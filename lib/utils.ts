import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const wholePriceFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});
const centsPriceFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Single place for how activity prices read across the app (all prices are EUR): €45, €65.50. */
export function formatPrice(amount: number) {
  return (Number.isInteger(amount) ? wholePriceFormatter : centsPriceFormatter).format(amount);
}

/** Minutes → "45 min", "2 h", "2 h 30 min". */
export function formatDuration(minutes: number) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
