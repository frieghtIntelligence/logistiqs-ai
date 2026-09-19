// Non-delivery test harness for src/email.ts (the Resend email transport).
//
// Run with:  bun run scripts/email-harness.ts   (or  bun run test:email)
//
// SAFETY: this harness NEVER sends email. Three independent guards:
//   1. globalThis.fetch is replaced with an in-memory stub for the whole run,
//      so no bytes ever leave this machine (the stub never touches the
//      network; the timeout test aborts via the request signal instead).
//   2. Ambient RESEND_* / NODE_ENV values are removed before any scenario runs,
//      so a developer's real credentials are never read by the transport.
//      Each scenario sets process.env explicitly and restores the sanitized
//      baseline afterwards; env state never leaks between scenarios.
//   3. It asserts that the transport itself refuses to deliver under
//      NODE_ENV=test / RESEND_DISABLE_DELIVERY (the kill-switch).
//
// No secret values are printed or logged by this harness — only "set"/"unset"
// markers and non-secret fixture values.
/// <reference types="node" />
import { createHmac, randomBytes } from "node:crypto";
import {
  sendEmail,
  verifyWebhookSignature,
  isConfigured,
  isWebhookSecretConfigured,
} from "../src/email";

const API_KEY = "re_test_fixture_key";
const FROM = "Logistiqs <logistiqs@logistiqs.live>";
const WEBHOOK_SECRET = "whsec_test_fixture_secret";

const ENV_KEYS = [
  "RESEND_API_KEY",
  "RESEND_EMAIL_FROM",
  "RESEND_WEBHOOK_SECRET",
  "RESEND_DISABLE_DELIVERY",
  "NODE_ENV",
] as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) {
  ORIGINAL_ENV[key] = process.env[key];
}

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

/** Sanitized baseline: every scenario starts here, never with real config. */
function resetEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

/** Put the caller's environment back exactly as it was when we started. */
function restoreEnv() {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) setEnv(key, value);
}

resetEnv();

// --- fetch stub -------------------------------------------------------------
interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

let capturedRequests: CapturedRequest[] = [];
let fetchBehavior:
  | { kind: "ok"; messageId: string }
  | { kind: "provider-error"; status: number; body: unknown }
  | { kind: "network-error" }
  | { kind: "never-resolves" } = { kind: "ok", messageId: "test-id-1" };

const realFetch = globalThis.fetch;
const stubFetch = async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : String(input);
  const method = init?.method ?? "GET";
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(init?.headers ?? {})) {
    headers[name] = String(value);
  }
  const rawBody = typeof init?.body === "string" ? init.body : "";
  let body: unknown = null;
  try {
    body = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    body = rawBody;
  }
  capturedRequests.push({ url, method, headers, body });

  if (fetchBehavior.kind === "never-resolves") {
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("Aborted", "AbortError"));
      });
    });
  }
  if (fetchBehavior.kind === "network-error") {
    throw new TypeError("fetch failed (simulated)");
  }
  if (fetchBehavior.kind === "provider-error") {
    return new Response(JSON.stringify(fetchBehavior.body), {
      status: fetchBehavior.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ id: fetchBehavior.messageId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

(globalThis as any).fetch = stubFetch;

// --- tiny test framework ----------------------------------------------------
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, label: string, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  console.log(`\n== ${name} ==`);
  resetEnv();
  capturedRequests = [];
  fetchBehavior = { kind: "ok", messageId: "test-id-1" };
  // Safety net: re-install the stub before every scenario so a scenario can
  // never reach the real Resend API even if something replaced fetch.
  if (globalThis.fetch !== stubFetch) (globalThis as any).fetch = stubFetch;
  try {
    await fn();
  } catch (error) {
    assert(false, `scenario threw`, String(error));
  }
}

function lastRequest(): CapturedRequest {
  return capturedRequests[capturedRequests.length - 1]!;
}

const validOptions = {
  to: "carrier@example.com",
  subject: "Load posted: Joburg → Durban",
  text: "A new load is available.",
};

// --- scenarios --------------------------------------------------------------

await scenario(
  "harness is inert: no ambient credentials, fetch is stubbed",
  () => {
    assert(
      process.env.RESEND_API_KEY === undefined &&
        process.env.RESEND_EMAIL_FROM === undefined &&
        process.env.RESEND_WEBHOOK_SECRET === undefined,
      "ambient Resend credentials removed before any scenario",
    );
    assert(isConfigured() === false, "transport is unconfigured at the start");
    assert(
      isWebhookSecretConfigured() === false,
      "webhook secret is unconfigured at the start",
    );
    assert(
      globalThis.fetch === stubFetch,
      "outbound fetch is the in-memory stub",
    );
  },
);

await scenario("isConfigured reflects RESEND_API_KEY presence", () => {
  setEnv("RESEND_API_KEY", API_KEY);
  assert(isConfigured() === true, "configured when key set");
  delete process.env.RESEND_API_KEY;
  assert(isConfigured() === false, "not configured when key unset");
});

await scenario(
  "sendEmail success builds a correct request (fetch stubbed, no delivery)",
  async () => {
    setEnv("RESEND_API_KEY", API_KEY);
    setEnv("RESEND_EMAIL_FROM", FROM);
    delete process.env.RESEND_DISABLE_DELIVERY;
    process.env.NODE_ENV = "development";
    fetchBehavior = { kind: "ok", messageId: "msg_123" };

    const result = await sendEmail({
      ...validOptions,
      html: "<p>Hello</p>",
      replyTo: "dispatch@logistiqs.live",
      tags: [{ name: "type", value: "load_posted" }],
    });
    assert(result.status === "sent", "status is sent");
    assert(result.messageId === "msg_123", "message id returned");
    assert(capturedRequests.length === 1, "exactly one request made");

    const req = lastRequest();
    assert(
      req.url === "https://api.resend.com/emails",
      "URL is Resend emails endpoint",
    );
    assert(req.method === "POST", "method is POST");
    assert(
      req.headers["Authorization"] === `Bearer ${API_KEY}`,
      "Bearer auth header uses the key",
    );
    assert(
      req.headers["Content-Type"] === "application/json",
      "Content-Type is application/json",
    );
    assert(
      Boolean(req.body) && (req.body as any).from === FROM,
      "from falls back to RESEND_EMAIL_FROM",
    );
    assert(
      JSON.stringify((req.body as any).to) ===
        JSON.stringify(["carrier@example.com"]),
      "to is normalized to an array",
    );
    assert(
      (req.body as any).subject === validOptions.subject,
      "subject passed through",
    );
    assert((req.body as any).html === "<p>Hello</p>", "html passed through");
    assert(
      JSON.stringify((req.body as any).reply_to) ===
        JSON.stringify(["dispatch@logistiqs.live"]),
      "reply_to passed through",
    );
    assert(
      JSON.stringify((req.body as any).tags) ===
        JSON.stringify([{ name: "type", value: "load_posted" }]),
      "tags passed through",
    );
  },
);

await scenario(
  "sendEmail not_configured when RESEND_API_KEY is missing",
  async () => {
    delete process.env.RESEND_API_KEY;
    setEnv("RESEND_EMAIL_FROM", FROM);
    const result = await sendEmail(validOptions);
    assert(result.status === "not_configured", "status is not_configured");
    assert(capturedRequests.length === 0, "no network call made");
  },
);

await scenario(
  "sendEmail not_configured when sender is missing (no env, no options.from)",
  async () => {
    setEnv("RESEND_API_KEY", API_KEY);
    delete process.env.RESEND_EMAIL_FROM;
    const result = await sendEmail(validOptions);
    assert(result.status === "not_configured", "status is not_configured");
    assert(capturedRequests.length === 0, "no network call made");
  },
);

await scenario(
  "sendEmail rejects invalid recipient before any network call",
  async () => {
    setEnv("RESEND_API_KEY", API_KEY);
    setEnv("RESEND_EMAIL_FROM", FROM);
    const result = await sendEmail({ ...validOptions, to: "not-an-email" });
    assert(result.status === "failed", "status is failed");
    assert(
      typeof result.error === "string" && /recipient/i.test(result.error),
      "error mentions recipient",
    );
    assert(capturedRequests.length === 0, "no network call made");
  },
);

await scenario("sendEmail rejects empty subject", async () => {
  setEnv("RESEND_API_KEY", API_KEY);
  setEnv("RESEND_EMAIL_FROM", FROM);
  const result = await sendEmail({ ...validOptions, subject: "   " });
  assert(result.status === "failed", "status is failed");
  assert(capturedRequests.length === 0, "no network call made");
});

await scenario(
  "sendEmail rejects missing body (no html, no text)",
  async () => {
    setEnv("RESEND_API_KEY", API_KEY);
    setEnv("RESEND_EMAIL_FROM", FROM);
    const result = await sendEmail({
      to: validOptions.to,
      subject: validOptions.subject,
    });
    assert(result.status === "failed", "status is failed");
    assert(capturedRequests.length === 0, "no network call made");
  },
);

await scenario("sendEmail rejects an invalid options.from", async () => {
  setEnv("RESEND_API_KEY", API_KEY);
  setEnv("RESEND_EMAIL_FROM", FROM);
  const result = await sendEmail({
    ...validOptions,
    from: "not-an-address",
  });
  assert(result.status === "failed", "status is failed");
  assert(
    typeof result.error === "string" && /from must be/i.test(result.error),
    "error explains the bad sender",
  );
  assert(capturedRequests.length === 0, "no network call made");
});

await scenario("sendEmail uses options.from when provided", async () => {
  setEnv("RESEND_API_KEY", API_KEY);
  setEnv("RESEND_EMAIL_FROM", FROM);
  const result = await sendEmail({
    ...validOptions,
    from: "Freight Desk <freight@logistiqs.live>",
  });
  assert(result.status === "sent", "status is sent");
  assert(
    (lastRequest().body as any).from ===
      "Freight Desk <freight@logistiqs.live>",
    "options.from wins over env",
  );
});

await scenario(
  "sendEmail surfaces only a generic error on provider failure",
  async () => {
    setEnv("RESEND_API_KEY", API_KEY);
    setEnv("RESEND_EMAIL_FROM", FROM);
    fetchBehavior = {
      kind: "provider-error",
      status: 422,
      body: { name: "validation_error", message: "dont_leak_me" },
    };
    const result = await sendEmail(validOptions);
    assert(result.status === "failed", "status is failed");
    assert(
      result.error === "Email could not be sent.",
      "generic error message",
    );
    assert(
      !String(result.error).includes("dont_leak_me"),
      "provider error body is not leaked",
    );
  },
);

await scenario(
  "sendEmail surfaces only a generic error on network failure",
  async () => {
    setEnv("RESEND_API_KEY", API_KEY);
    setEnv("RESEND_EMAIL_FROM", FROM);
    fetchBehavior = { kind: "network-error" };
    const result = await sendEmail(validOptions);
    assert(result.status === "failed", "status is failed");
    assert(
      result.error === "Email could not be sent.",
      "generic error message",
    );
  },
);

await scenario("sendEmail times out with a generic error", async () => {
  setEnv("RESEND_API_KEY", API_KEY);
  setEnv("RESEND_EMAIL_FROM", FROM);
  fetchBehavior = { kind: "never-resolves" };
  const started = Date.now();
  const result = await sendEmail({ ...validOptions, timeoutMs: 150 });
  const elapsed = Date.now() - started;
  assert(result.status === "failed", "status is failed");
  assert(result.error === "Email could not be sent.", "generic error message");
  assert(elapsed >= 100 && elapsed < 4000, `timed out promptly (${elapsed}ms)`);
});

await scenario(
  "delivery kill-switch: NODE_ENV=test blocks sending",
  async () => {
    setEnv("RESEND_API_KEY", API_KEY);
    setEnv("RESEND_EMAIL_FROM", FROM);
    process.env.NODE_ENV = "test";
    const result = await sendEmail(validOptions);
    assert(result.status === "not_configured", "status is not_configured");
    assert(
      typeof result.error === "string" && /disabled/i.test(result.error),
      "error mentions disabled",
    );
    assert(capturedRequests.length === 0, "no network call made");
  },
);

await scenario(
  "delivery kill-switch: RESEND_DISABLE_DELIVERY=1 blocks sending",
  async () => {
    setEnv("RESEND_API_KEY", API_KEY);
    setEnv("RESEND_EMAIL_FROM", FROM);
    setEnv("RESEND_DISABLE_DELIVERY", "1");
    process.env.NODE_ENV = "development";
    const result = await sendEmail(validOptions);
    assert(result.status === "not_configured", "status is not_configured");
    assert(capturedRequests.length === 0, "no network call made");
  },
);

await scenario(
  "webhook verification accepts a real Svix-style signature (whsec_ key + svix headers)",
  () => {
    // A genuine Svix/Resend secret: whsec_ followed by base64 key material.
    const keyBytes = randomBytes(32);
    const secret = `whsec_${keyBytes.toString("base64")}`;
    setEnv("RESEND_WEBHOOK_SECRET", secret);
    const svixId = "msg_2abcDEF";
    const svixTimestamp = String(Math.floor(Date.now() / 1000));
    const body = '{"type":"email.delivered","data":{"email_id":"e_1"}}';
    const sign = (payload: string, key: string | Buffer = keyBytes) =>
      createHmac("sha256", key).update(payload).digest("base64");
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;

    assert(
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: `v1,${sign(signedContent)}`,
        svixId,
        svixTimestamp,
      }).valid === true,
      "Svix header-based signature verified",
    );
    assert(
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: `v1=${sign(body)}`,
        svixId,
        svixTimestamp,
      }).valid === false,
      "signature over the body alone rejected when svix ids are supplied",
    );
    assert(
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: `v1,${sign(signedContent, secret)}`,
      }).valid === false,
      "secret is base64-decoded, not used as a literal string",
    );
    assert(
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: `v1,${sign(`${svixId}.9999999999.${body}`)}`,
        svixId,
        svixTimestamp,
      }).valid === false,
      "tampered timestamp rejected",
    );
  },
);

await scenario("webhook verification accepts a valid signature", () => {
  setEnv("RESEND_WEBHOOK_SECRET", WEBHOOK_SECRET);
  const body = '{"type":"email.delivered","data":{}}';
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("base64");
  const result = verifyWebhookSignature({
    rawBody: body,
    signatureHeader: `v1=${expected}`,
  });
  assert(result.valid === true, "valid signature verified");
});

await scenario("webhook verification accepts the v1,<sig> header form", () => {
  setEnv("RESEND_WEBHOOK_SECRET", WEBHOOK_SECRET);
  const body = "payload";
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("base64");
  const result = verifyWebhookSignature({
    rawBody: body,
    signatureHeader: `v1,${expected}`,
  });
  assert(result.valid === true, "v1,<sig> form accepted");
});

await scenario(
  "webhook verification accepts a valid signature among rotated keys",
  () => {
    setEnv("RESEND_WEBHOOK_SECRET", WEBHOOK_SECRET);
    const body = "payload";
    const valid = createHmac("sha256", WEBHOOK_SECRET)
      .update(body)
      .digest("base64");
    const stale = createHmac("sha256", "whsec_old_key")
      .update(body)
      .digest("base64");
    const result = verifyWebhookSignature({
      rawBody: body,
      signatureHeader: `v1=${stale} v1=${valid}`,
    });
    assert(result.valid === true, "matches one of multiple signatures");
  },
);

await scenario("webhook verification rejects a tampered body", () => {
  setEnv("RESEND_WEBHOOK_SECRET", WEBHOOK_SECRET);
  const body = '{"type":"email.delivered"}';
  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("base64");
  const result = verifyWebhookSignature({
    rawBody: '{"type":"email.bounced"}',
    signatureHeader: `v1=${expected}`,
  });
  assert(result.valid === false, "tampered body rejected");
  assert(
    result.reason === "Signature mismatch.",
    "reason is signature mismatch",
  );
});

await scenario(
  "webhook verification rejects a signature from the wrong key",
  () => {
    setEnv("RESEND_WEBHOOK_SECRET", WEBHOOK_SECRET);
    const body = "payload";
    const wrong = createHmac("sha256", "whsec_wrong_key")
      .update(body)
      .digest("base64");
    const result = verifyWebhookSignature({
      rawBody: body,
      signatureHeader: `v1=${wrong}`,
    });
    assert(result.valid === false, "wrong key rejected");
  },
);

await scenario("webhook verification rejects malformed headers", () => {
  setEnv("RESEND_WEBHOOK_SECRET", WEBHOOK_SECRET);
  const malformed = verifyWebhookSignature({
    rawBody: "x",
    signatureHeader: "garbage",
  });
  assert(malformed.valid === false, "unparseable entry rejected");
  const empty = verifyWebhookSignature({ rawBody: "x", signatureHeader: "" });
  assert(empty.valid === false, "empty header rejected");
});

await scenario(
  "webhook verification not_configured when secret missing",
  () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const result = verifyWebhookSignature({
      rawBody: "x",
      signatureHeader: "v1=abc",
    });
    assert(result.valid === false, "fails closed");
    assert(
      isWebhookSecretConfigured() === false,
      "isWebhookSecretConfigured reflects state",
    );
  },
);

// --- summary ----------------------------------------------------------------
restoreEnv();
(globalThis as any).fetch = realFetch;

console.log(`\n========================================`);
console.log(`Email transport harness: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log("Failures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
assert(globalThis.fetch === realFetch, "real fetch restored after the run");
console.log(
  "No email was delivered: fetch was stubbed, delivery kill-switch verified.",
);
