import { createFileRoute } from "@tanstack/react-router";
import {
  PolicyPage,
  PolicySection,
  policyContact,
} from "~/components/PolicyPage";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <PolicyPage
      title="Terms of Use"
      updated="9 August 2026"
      intro="These terms describe the basic rules for using the LOGISTIQS INTELLIGENCE marketplace. By using the service, you agree to use it lawfully and responsibly."
    >
      <PolicySection title="Our role">
        <p>
          LOGISTIQS provides software that helps shippers and carriers discover,
          discuss, and track freight opportunities. We are not a carrier,
          shipper, customs broker, insurer, or party to every transport
          contract. Users remain responsible for their own commercial
          agreements, licences, cargo, vehicles, drivers, rates, and compliance.
        </p>
      </PolicySection>
      <PolicySection title="Accounts and accurate information">
        <p>
          Provide accurate business and contact information, protect your
          credentials, and keep load, route, cargo, and timing details current.
          You are responsible for activity performed through your account and
          must promptly report unauthorized access.
        </p>
      </PolicySection>
      <PolicySection title="Marketplace conduct">
        <p>
          Do not misrepresent a load or capacity, upload unlawful content,
          misuse another user’s data, interfere with the service, evade a
          transaction’s agreed terms, or use the platform for fraud, harassment,
          discrimination, or unsafe transport.
        </p>
      </PolicySection>
      <PolicySection title="Availability and liability">
        <p>
          We aim to provide a reliable service but do not guarantee
          uninterrupted availability, a match, a particular price, delivery
          time, carrier performance, cargo condition, or transport outcome. To
          the extent permitted by law, users are responsible for evaluating
          counterparties and arranging appropriate insurance and documentation.
        </p>
      </PolicySection>
      <PolicySection title="Suspension and termination">
        <p>
          We may restrict or suspend access where necessary to protect users,
          investigate abuse, comply with law, or maintain the service. You may
          stop using the service at any time. Provisions concerning data,
          payment obligations, disputes, and responsible conduct may continue
          where appropriate.
        </p>
      </PolicySection>
      <PolicySection title="Contact and legal review">
        {policyContact}
        <p>
          These general terms are not a substitute for local legal advice. The
          applicable contract and governing law for a specific shipment should
          be agreed by the relevant parties.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
