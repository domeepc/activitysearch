import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { TermsPlaceholderContent } from "@/components/legal/TermsPlaceholderContent";

export const metadata: Metadata = {
  title: "Terms of Service | ActivitySearch",
  description:
    "Terms of Service for ActivitySearch — discover and book activities.",
};

export default function TermsPage() {
  return (
    <LegalDocumentLayout
      title="Terms of Service"
      lastUpdated="April 4, 2026"
      badges={["Legal", "Terms of use"]}
    >
      <TermsPlaceholderContent />
    </LegalDocumentLayout>
  );
}
