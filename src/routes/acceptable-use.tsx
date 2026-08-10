import { createFileRoute } from "@tanstack/react-router";
import {
  PolicyPage,
  PolicySection,
  policyContact,
} from "~/components/PolicyPage";

export const Route = createFileRoute("/acceptable-use")({
  component: AcceptableUsePage,
});

function AcceptableUsePage() {
  return (
    <PolicyPage
      title="Acceptable Use & Communications"
      updated="9 August 2026"
      intro="LOGISTIQS is built for legitimate freight coordination. These rules protect shippers, carriers, drivers, and the wider logistics community."
    >
      <PolicySection title="Prohibited activity">
        <p>
          Do not use the service for unlawful cargo or transport, fraud,
          impersonation, harassment, discrimination, threats, spam, credential
          abuse, malware, scraping that harms the service, or attempts to bypass
          access controls.
        </p>
      </PolicySection>
      <PolicySection title="Cargo and transport responsibility">
        <p>
          Users must comply with applicable road, customs, safety, employment,
          insurance, dangerous-goods, sanctions, and licensing requirements. Do
          not publish a load unless you are authorized to arrange it and can
          provide accurate information.
        </p>
      </PolicySection>
      <PolicySection title="Communications">
        <p>
          Service messages may be needed for accounts, loads, safety, and
          shipment status. Promotional or outreach messages must be truthful,
          relevant, and sent only through an approved process. We will honor
          opt-out and do-not-contact requests.
        </p>
        {policyContact}
      </PolicySection>
      <PolicySection title="Reporting concerns">
        <p>
          Report suspicious listings, abuse, unsafe behavior, or an unwanted
          communication to our contact address. We may investigate, remove
          content, suspend accounts, and cooperate with lawful requests.
        </p>
      </PolicySection>
      <PolicySection title="Policy scope">
        <p>
          This general policy does not replace a contract or local legal advice.
          We may update it as the marketplace and applicable requirements
          develop.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
