import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { SupportEmailLink, type LegalSectionData } from "@/components/legal/legal-shared";

export const metadata: Metadata = {
  title: "Terms of Service | ActivitySearch",
  description: "The rules for using ActivitySearch to find, book and pay for activities with your team.",
};

const sections: LegalSectionData[] = [
  {
    id: "agreement",
    title: "Agreeing to these terms",
    content: (
      <>
        <p>
          These terms are an agreement between you and ActivitySearch (&quot;we&quot;, &quot;us&quot;). By creating an
          account or booking an activity, you agree to them and to our{" "}
          <Link href="/privacy" className="font-medium text-blue-700 underline underline-offset-4 dark:text-blue-400">
            Privacy Policy
          </Link>
          . If you don&apos;t agree, please don&apos;t use ActivitySearch.
        </p>
        <p>You must be at least 16 years old to create an account.</p>
      </>
    ),
  },
  {
    id: "service",
    title: "What ActivitySearch does",
    content: (
      <>
        <p>
          ActivitySearch is a marketplace. Organisers (businesses and individuals who run activities) list what they
          offer; you can find activities on a map, form teams with friends, book, split the cost and chat.
        </p>
        <p>
          <strong>The organiser runs the activity, not us.</strong> They are responsible for the activity itself, its
          safety, the equipment, any age or skill requirements, and the accuracy of their listing. We provide the
          platform that connects you and handles the payment.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    content: (
      <ul>
        <li>Give accurate information and keep your sign-in details to yourself. You are responsible for activity on your account.</li>
        <li>One person per account. Organiser accounts must represent a real organisation and be able to receive payouts through Stripe.</li>
        <li>You can delete your account at any time from your profile. Some records, such as payments, are kept as the law requires (see the Privacy Policy).</li>
      </ul>
    ),
  },
  {
    id: "bookings",
    title: "Bookings and teams",
    content: (
      <ul>
        <li>A reservation is made for a date and time slot of an activity, by a person or a team, within the organiser&apos;s capacity and age limits.</li>
        <li>The team creator manages the booking. Each member can pay their own share, or one person can pay for several people.</li>
        <li>A reservation is confirmed once everyone&apos;s share is covered. If it isn&apos;t fully paid by the activity date, it is cancelled automatically.</li>
        <li>Follow the organiser&apos;s instructions on the day. They may refuse participation if you don&apos;t meet the stated requirements or if it isn&apos;t safe.</li>
      </ul>
    ),
  },
  {
    id: "payments",
    title: "Prices, fees and payment",
    content: (
      <>
        <p>
          The price per person is set by the organiser. On top of it, we charge a <strong>5% service fee</strong>, and{" "}
          <strong>VAT</strong> is added where it applies. You see the full breakdown before you save your card.
        </p>
        <ul>
          <li>When you book, your card is saved securely with Stripe. <strong>It is charged on the activity date</strong>, not when you book.</li>
          <li>Payments are processed by Stripe; we never see or store your full card number.</li>
          <li>Organisers receive the full activity price; our service fee and VAT are kept separately.</li>
          <li>If a charge on the activity date fails, the reservation may not be confirmed.</li>
        </ul>
      </>
    ),
  },
  {
    id: "cancellations",
    title: "Cancellations and refunds",
    content: (
      <ul>
        <li>The team creator or the organiser can cancel a reservation, giving a reason.</li>
        <li>If a reservation is cancelled before the activity date, your card isn&apos;t charged. If you were already charged, the payment is refunded in full to the same card.</li>
        <li>Refunds usually appear within 5–10 working days, depending on your bank.</li>
        <li>Organisers may have their own rules about weather, minimum group sizes or no-shows, stated in their listing. If something goes wrong with an activity, contact the organiser first, then us.</li>
      </ul>
    ),
  },
  {
    id: "conduct",
    title: "Using ActivitySearch responsibly",
    content: (
      <>
        <p>Please don&apos;t:</p>
        <ul>
          <li>harass, threaten or spam other people, in chat or anywhere else;</li>
          <li>post false listings, fake reviews, or content that is illegal or that you don&apos;t have the rights to;</li>
          <li>try to break, overload or get around the security of the service, or access other people&apos;s accounts;</li>
          <li>use ActivitySearch to arrange payments outside the platform for bookings made on it.</li>
        </ul>
        <p>You can block any user. We may remove content or suspend accounts that break these rules.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "Your content",
    content: (
      <p>
        You keep ownership of what you post: photos, listings, reviews and profile details. You give us permission to
        show it on ActivitySearch so the service works (for example, showing your review on an activity page).
        Chat messages are end-to-end encrypted: we can&apos;t read them and don&apos;t use them for anything.
      </p>
    ),
  },
  {
    id: "rewards",
    title: "Quests, XP and loyalty points",
    content: (
      <p>
        Quests, experience points and loyalty points are a fun extra. Loyalty points can be used for discounts as shown
        in the app; they have no cash value, can&apos;t be transferred or sold, and may be removed if earned through
        misuse. We may change how rewards work, but we won&apos;t take away points you&apos;ve fairly earned without
        notice.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    content: (
      <>
        <p>
          We work hard to keep ActivitySearch running and accurate, but we provide it &quot;as is&quot;. Organisers are
          responsible for their activities, and we aren&apos;t liable for injuries, losses or damage that happen during
          an activity, except where we caused them.
        </p>
        <p>
          Nothing in these terms limits liability that can&apos;t be limited by law, such as for death or personal injury
          caused by negligence, fraud, or your rights as a consumer.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    title: "Changes and ending your use",
    content: (
      <p>
        We may update these terms when the service or the law changes. For significant changes, we&apos;ll let you know
        in the app or by email before they apply. You can stop using ActivitySearch and delete your account at any
        time.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    content: (
      <p>
        These terms are governed by the laws of the Republic of Croatia. If you are a consumer, you also keep the
        protection of the mandatory laws of the country where you live, and you can bring a claim in your local courts.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        Questions, complaints or anything unclear? Email <SupportEmailLink />.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocumentLayout
      title="Terms of Service"
      href="/terms"
      lastUpdated="October 31, 2026"
      intro="The rules for finding, booking and paying for activities on ActivitySearch, written to be read, not skimmed past."
      summary={[
        "Organisers run the activities; ActivitySearch connects you and handles the payment.",
        "You pay the organiser's price plus a 5% service fee and VAT, shown before you save your card.",
        "Your card is charged on the activity date. Cancelled before then? You aren't charged; otherwise you get a full refund.",
        "Be decent to other people. You can block anyone, and we remove abuse.",
        "Your chat messages are end-to-end encrypted, so we can't read them.",
      ]}
      sections={sections}
    />
  );
}
