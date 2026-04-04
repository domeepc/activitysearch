import { LegalSection, LEGAL_SUPPORT_EMAIL } from "./legal-shared";

export function TermsPlaceholderContent() {
  const placeholder =
    "Final legal language for this section is not yet published. This outline is a placeholder until counsel-approved terms are added.";

  return (
    <>
      <LegalSection title="Acceptance of terms">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Description of the service">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="User accounts">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Permitted use">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Activities, bookings, and third parties">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Intellectual property">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Disclaimer and limitation of liability">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Changes to these terms">
        <p>{placeholder}</p>
      </LegalSection>
      <LegalSection title="Contact">
        <p>
          For questions about these terms while the final document is in
          preparation, contact{" "}
          <a
            href={`mailto:${LEGAL_SUPPORT_EMAIL}`}
            className="font-medium text-zinc-800 underline-offset-4 hover:underline"
          >
            {LEGAL_SUPPORT_EMAIL}
          </a>
          .
        </p>
      </LegalSection>
    </>
  );
}
