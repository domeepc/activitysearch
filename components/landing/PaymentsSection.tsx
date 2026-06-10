import { CreditCard, Zap, BadgeCheck } from "lucide-react";

const points = [
  {
    icon: Zap,
    title: "Fast checkout",
    description:
      "Save a payment method and confirm reservations in a few taps — no friction at the door.",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
  },
  {
    icon: CreditCard,
    title: "Powered by Stripe",
    description:
      "Card details are handled by Stripe's secure infrastructure. We never store full card numbers.",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
  },
  {
    icon: BadgeCheck,
    title: "Clear payouts",
    description:
      "Organisers get a straightforward flow for getting paid, with full visibility into each booking.",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
  },
] as const;

export function PaymentsSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto w-full max-w-6xl space-y-10 px-4 md:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Payments
            </p>
            <h2 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">
              Simple, reliable payments.
            </h2>
            <p className="mt-2 max-w-lg text-sm text-zinc-500">
              Whether you are booking your next session or running a venue —
              payments are fast for participants and dependable for organisers.
            </p>
          </div>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2">
            <CreditCard className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
            <span className="text-xs font-medium text-zinc-500">
              Powered by Stripe
            </span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {points.map(({ icon: Icon, title, description, iconBg, iconColor }) => (
            <div
              key={title}
              className="space-y-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-6"
            >
              <div
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}
              >
                <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900">{title}</h3>
                <p className="mt-1 text-sm text-zinc-500">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
