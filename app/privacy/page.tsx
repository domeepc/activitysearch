import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { PrivacyPlaceholderContent } from "@/components/legal/PrivacyPlaceholderContent";

export const metadata: Metadata = {
  title: "Privacy Policy | ActivitySearch",
  description:
    "Privacy Policy for ActivitySearch — how we handle personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      lastUpdated="April 4, 2026"
      badges={["Legal", "Privacy & data"]}
    >
      <PrivacyPlaceholderContent />
    </LegalDocumentLayout>
  );
}
