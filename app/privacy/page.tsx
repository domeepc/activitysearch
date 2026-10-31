import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { SupportEmailLink, type LegalSectionData } from "@/components/legal/legal-shared";

export const metadata: Metadata = {
  title: "Privacy Policy | ActivitySearch",
  description: "What personal data ActivitySearch collects, why, who it's shared with, and your rights.",
};

const sections: LegalSectionData[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    content: (
      <p>
        ActivitySearch (&quot;we&quot;, &quot;us&quot;) is responsible for your personal data under the EU General Data
        Protection Regulation (GDPR). For anything about your data, email <SupportEmailLink />.
      </p>
    ),
  },
  {
    id: "data-we-collect",
    title: "Data we collect",
    content: (
      <>
        <p>
          <strong>You give us:</strong>
        </p>
        <ul>
          <li>Account details: name, username, email address, password (stored by our sign-in provider, never by us in plain text), profile photo and description.</li>
          <li>If you sign in with Google, Microsoft or Facebook: your name, email and profile photo from that account.</li>
          <li>Organisers: organisation name, address, contact details, tax ID and bank details for payouts (held by Stripe).</li>
          <li>What you create: reservations, teams, reviews, activity listings and photos.</li>
          <li>Payment details: entered directly into Stripe. We only see the card brand, last four digits and country.</li>
        </ul>
        <p>
          <strong>Created when you use the app:</strong>
        </p>
        <ul>
          <li>Friends, blocked users, quests, XP and loyalty points.</li>
          <li>When you were last online, shown to your friends as an online status.</li>
          <li>Usage and device information (pages visited, browser, approximate location from your IP address) and error reports.</li>
        </ul>
        <p>
          <strong>Chat messages</strong> are end-to-end encrypted in your browser. We store only the encrypted text and
          who sent it to whom and when; we can&apos;t read the content. Your encryption key stays in your browsers, and
          another browser only receives it when you approve it from one you already use.
        </p>
      </>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use it and why",
    content: (
      <ul>
        <li><strong>To provide the service</strong> (performing our contract with you): your account, bookings, payments, teams, chat and reviews.</li>
        <li><strong>To meet legal obligations:</strong> keeping payment and tax records, calculating VAT.</li>
        <li><strong>For legitimate interests:</strong> keeping the service secure, preventing fraud and abuse, fixing errors, and understanding which features are used so we can improve them.</li>
        <li><strong>With your consent,</strong> where the law requires it, for example for optional analytics cookies. You can withdraw consent at any time.</li>
      </ul>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    content: (
      <>
        <p>We never sell your personal data. We share it only as needed to run ActivitySearch:</p>
        <ul>
          <li><strong>Organisers</strong> see the name and profile of people booked on their activities, and booking and payment status.</li>
          <li><strong>Other users</strong> see your public profile (name, username, photo, description), your reviews, and your online status if you&apos;re friends.</li>
          <li><strong>Service providers</strong> who process data for us: Clerk (sign-in), Convex (database and hosting), Stripe (payments, payouts and tax calculation), PostHog (product analytics), Sentry (error reports), and OpenStreetMap Nominatim and OpenFreeMap (address search and map tiles).</li>
          <li><strong>Authorities,</strong> when the law requires it.</li>
        </ul>
        <p>
          Some providers are based outside the EU. Where data leaves the EU, it&apos;s protected by the EU Standard
          Contractual Clauses or an adequacy decision.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    content: (
      <ul>
        <li>Your account data, while your account exists. When you delete your account, we delete your profile, friends, messages and personal app data.</li>
        <li>Payment and tax records, for as long as accounting and tax law requires (in Croatia, generally 11 years), even after you delete your account.</li>
        <li>Analytics and error reports, for a limited time set in those tools, after which they are deleted or anonymised.</li>
      </ul>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    content: (
      <>
        <p>Under the GDPR you can:</p>
        <ul>
          <li>access the personal data we hold about you and get a copy of it;</li>
          <li>correct it (most of it you can edit yourself in your profile);</li>
          <li>delete it, by deleting your account or asking us;</li>
          <li>restrict or object to how we use it, including for analytics;</li>
          <li>move it to another service (data portability);</li>
          <li>withdraw consent you gave, at any time.</li>
        </ul>
        <p>
          Email <SupportEmailLink /> and we&apos;ll respond within one month. You can also complain to your data
          protection authority; in Croatia, that&apos;s AZOP (Agencija za zaštitu osobnih podataka).
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    content: (
      <ul>
        <li><strong>Necessary:</strong> sign-in session cookies, and your theme preference.</li>
        <li><strong>Encryption keys:</strong> your chat encryption key is kept in your browser&apos;s local storage and never sent to us unencrypted.</li>
        <li><strong>Analytics:</strong> PostHog uses cookies and local storage to understand how the app is used. Analytics requests go through our own domain.</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    content: (
      <p>
        We use encrypted connections everywhere, end-to-end encryption for chat, and established providers for
        sign-in and payments, so card numbers and passwords never touch our database. No system is perfectly secure;
        if a breach affects your data, we&apos;ll tell you and the authorities as the law requires.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    content: (
      <p>
        ActivitySearch isn&apos;t meant for children under 16, and we don&apos;t knowingly collect their data. If you
        think a child has created an account, contact us and we&apos;ll delete it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to this policy",
    content: (
      <p>
        When we change how we handle your data, we&apos;ll update this page and the date at the top. For significant
        changes, we&apos;ll tell you in the app or by email first.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    content: (
      <p>
        For privacy questions or to use any of your rights, email <SupportEmailLink />.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      href="/privacy"
      lastUpdated="October 31, 2026"
      intro="What personal data ActivitySearch collects, why we need it, who we share it with, and how you stay in control."
      summary={[
        "We collect what's needed to run your account, bookings and payments, and never sell your data.",
        "Card details go straight to Stripe; we never see your full card number.",
        "Chat messages are end-to-end encrypted, so we can't read them.",
        "You can see, correct, download or delete your data at any time.",
        "Payment and tax records are kept as long as the law requires, even after you delete your account.",
      ]}
      sections={sections}
    />
  );
}
