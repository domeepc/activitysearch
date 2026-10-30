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
