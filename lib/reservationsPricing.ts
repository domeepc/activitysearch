/** Activity list price minus loyalty discount applied to the reservation (never negative). */
export function effectiveReservationTotalPrice(
  activityListPrice: number,
  loyaltyDiscountTotal?: number
): number {
  const discount = loyaltyDiscountTotal ?? 0;
  return Math.max(0, activityListPrice - discount);
}
