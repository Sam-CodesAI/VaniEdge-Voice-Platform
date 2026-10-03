/**
 * VaniEdge-Pro Telephony Platform
 * Twilio Webhook Configuration Utility
 * 
 * Programmatically updates Twilio Inbound Phone Numbers to point to
 * the VaniEdge-Pro voice router and status callback failover endpoints.
 * 
 * Usage:
 *   npx tsx --env-file=.env.local scripts/update-twilio-webhook.ts https://your-domain.vercel.app
 */

export {};

const targetBaseUrl = process.argv[2];

if (!targetBaseUrl) {
  console.log("================================================================================");
  console.log("Usage: npx tsx --env-file=.env.local scripts/update-twilio-webhook.ts <BASE_URL>");
  console.log("Example: npx tsx --env-file=.env.local scripts/update-twilio-webhook.ts https://sam-codes.vercel.app");
  console.log("================================================================================");
  process.exit(1);
}

const cleanBaseUrl = targetBaseUrl.replace(/\/+$/, "");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

if (!accountSid || !authToken) {
  console.error("❌ Error: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing in .env.local");
  process.exit(1);
}

const voiceUrl = `${cleanBaseUrl}/api/voice/incoming`;
const statusCallback = `${cleanBaseUrl}/api/voice/status`;

async function updateTwilio() {
  console.log("================================================================================");
  console.log("📡 Updating Twilio Phone Number Webhooks");
  console.log("================================================================================");
  console.log(`Account SID:     ${accountSid}`);
  console.log(`New Voice URL:   ${voiceUrl}`);
  console.log(`Status Callback: ${statusCallback}\n`);

  const authHeader = "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  // 1. Fetch incoming phone numbers
  const listRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`,
    {
      headers: { Authorization: authHeader },
    }
  );

  if (!listRes.ok) {
    throw new Error(`Failed to list phone numbers: HTTP ${listRes.status} ${await listRes.text()}`);
  }

  const listData = (await listRes.json()) as {
    incoming_phone_numbers?: Array<{
      sid: string;
      phone_number: string;
      friendly_name: string;
      voice_url: string;
    }>;
  };

  const numbers = listData.incoming_phone_numbers || [];
  if (numbers.length === 0) {
    console.error("❌ No incoming phone numbers found on this Twilio account.");
    return;
  }

  for (const num of numbers) {
    console.log(`Updating ${num.phone_number} (${num.friendly_name || num.sid})...`);

    const updateParams = new URLSearchParams({
      VoiceUrl: voiceUrl,
      VoiceMethod: "POST",
      StatusCallback: statusCallback,
      StatusCallbackMethod: "POST",
    });

    const updateRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${num.sid}.json`,
      {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: updateParams.toString(),
      }
    );

    if (!updateRes.ok) {
      console.error(`❌ Failed to update ${num.phone_number}:`, await updateRes.text());
    } else {
      console.log(`✅ SUCCESS: ${num.phone_number} is now wired to ${voiceUrl}`);
    }
  }

  console.log("\n================================================================================");
  console.log("🎉 Twilio Webhooks successfully updated and live!");
  console.log("================================================================================");
}

updateTwilio().catch((err) => {
  console.error("Fatal error updating Twilio:", err);
  process.exit(1);
});
