import { createFileRoute } from "@tanstack/react-router";
import {
  PolicyPage,
  PolicySection,
  policyContact,
} from "~/components/PolicyPage";

export const Route = createFileRoute("/refunds")({ component: RefundsPage });

function RefundsPage() {
  return (
    <PolicyPage
      title="Refunds & Cancellations"
      updated="9 August 2026"
      intro="This policy explains the general approach to cancellations, fees, and disputes on LOGISTIQS. The specific commercial agreement for a shipment or paid feature controls where it contains different terms."
    >
      <PolicySection title="Marketplace services">
        <p>
          Posting or reviewing a load does not by itself create a transport
          contract. A cancellation, failure to perform, delay, cargo issue, or
          rate dispute between a shipper and carrier should be handled under
          their agreed terms and applicable law.
        </p>
      </PolicySection>
      <PolicySection title="Paid services and refunds">
        <p>
          If LOGISTIQS introduces a paid feature, its checkout or order terms
          will state the price, billing period, cancellation method, and refund
          rules before payment. Where a refund is approved, it will normally be
          returned to the original payment method, subject to payment-provider
          timing and applicable law.
        </p>
      </PolicySection>
      <PolicySection title="Requesting a review">
        <p>
          Send the relevant account, transaction, and reason for the request to
          our support address as soon as possible. We may request supporting
          records and will assess the request fairly against the applicable
          agreement. We do not promise a refund for a transport service supplied
          by an independent carrier unless LOGISTIQS is the contracting provider
          for that service.
        </p>
        {policyContact}
      </PolicySection>
      <PolicySection title="No invented promise">
        <p>
          There are currently no specific subscription prices or automatic
          refund amounts stated in this general policy. Any future plan-specific
          terms will be displayed before purchase.
        </p>
      </PolicySection>
      <PolicySection title="Important notice">
        <p>
          This is general platform information, not jurisdiction-specific legal
          advice. Local consumer, payment, transport, and commercial rules may
          apply.
        </p>
      </PolicySection>
    </PolicyPage>
  );
}
