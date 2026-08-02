// Server-only Twilio transport for transactional SMS and WhatsApp.
// Credentials and sender identities are read at call time from runtime env vars.
// This module deliberately does not send unless every required setting exists.

type Channel = "sms" | "whatsapp";

export interface TwilioSendResult {
  status: "sent" | "not_configured" | "failed";
  sid?: string;
  error?: string;
}

const SITE_URL = process.env.PUBLIC_SITE_URL || "https://logistiqs.live";

function getConfig(channel: Channel) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const sender =
    channel === "sms"
      ? process.env.TWILIO_PHONE_NUMBER?.trim()
      : process.env.TWILIO_WHATSAPP_FROM?.trim();

  if (!accountSid || !authToken || !sender) return null;
  return { accountSid, authToken, sender };
}

function normalizeWhatsAppAddress(value: string) {
  const number = value.replace(/^whatsapp:/i, "").trim();
  return `whatsapp:${number.startsWith("+") ? number : `+${number}`}`;
}

async function send(
  channel: Channel,
  to: string,
  body: string,
): Promise<TwilioSendResult> {
  const config = getConfig(channel);
  if (!config) {
    return {
      status: "not_configured",
      error: `Twilio ${channel} sender is not configured.`,
    };
  }
  if (!to.trim() || !body.trim()) {
    return {
      status: "failed",
      error: "A recipient and message body are required.",
    };
  }

  const params = new URLSearchParams({
    To: channel === "whatsapp" ? normalizeWhatsAppAddress(to) : to.trim(),
    From:
      channel === "whatsapp"
        ? normalizeWhatsAppAddress(config.sender)
        : config.sender,
    Body: body,
  });
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const data = (await response.json().catch(() => ({}))) as {
      sid?: string;
      message?: string;
    };
    if (response.ok) return { status: "sent", sid: data.sid };
    return {
      status: "failed",
      error: data.message || `Twilio request failed (${response.status}).`,
    };
  } catch {
    return {
      status: "failed",
      error: "Twilio request could not be completed.",
    };
  }
}

export function sendSMS(to: string, body: string) {
  return send("sms", to, body);
}

export function sendWhatsApp(to: string, body: string) {
  return send("whatsapp", to, body);
}

export function driverSMSTemplate(name: string): string {
  return `LOGISTIQS: Hi ${name.split(" ")[0]}. Freight loads available on your route. Browse & accept in 1 tap — no broker fees. Free to join: ${SITE_URL}`;
}

export function loadAlertTemplate(
  origin: string,
  destination: string,
  cargo: string,
): string {
  return `NEW LOAD: ${origin}→${destination}, ${cargo}. Reply YES to accept. LOGISTIQS ${SITE_URL}`;
}

export function loadAcceptedTemplate(loadId: string, carrier: string): string {
  return `LOGISTIQS: Load #${loadId} accepted by ${carrier}. Track: ${SITE_URL}/tracking/${loadId}`;
}

export function driverRecruitmentTemplate(name: string, route: string): string {
  return `LOGISTIQS: ${name.split(" ")[0]}, trucks doing ${route}? Find backhaul loads instantly. Stop deadheading. Free: ${SITE_URL}`;
}
