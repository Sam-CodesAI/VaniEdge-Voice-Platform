/**
 * Real-Time Telegram Admin Lead & Alert Dispatcher for VaniEdge
 * Pushes instant notification alerts to Samarth's personal Telegram chat (@Samarth1306 / 8225901737)
 * whenever a new business lead customizes an agent, registers an account, or triggers a priority ticket.
 */

const DEFAULT_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8756892919:AAEsD9iLuBKN_uzA9fZN9CwuTB37lHgE6z4";
const DEFAULT_ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "8225901737";

export interface TelegramLeadNotification {
  type: "LEAD_CUSTOMIZER" | "NEW_SIGNUP" | "PLAN_INQUIRY" | "EMERGENCY_DISPATCH";
  businessName?: string;
  category?: string;
  callerName?: string;
  contact?: string;
  language?: string;
  planName?: string;
  details?: string;
}

export async function sendTelegramAdminAlert(notification: TelegramLeadNotification): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN || DEFAULT_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID || DEFAULT_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    return false;
  }

  let title = "⚡ *NEW VANIEDGE COMMERCIAL LEAD*";
  if (notification.type === "LEAD_CUSTOMIZER") {
    title = "🎙️ *NEW AGENT CUSTOMIZED & DEPLOYED*";
  } else if (notification.type === "NEW_SIGNUP") {
    title = "👤 *NEW USER REGISTERED ON VANIEDGE*";
  } else if (notification.type === "PLAN_INQUIRY") {
    title = "💳 *HIGH-INTENT COMMERCIAL PLAN INQUIRY*";
  } else if (notification.type === "EMERGENCY_DISPATCH") {
    title = "🚨 *VANIEDGE EMERGENCY DISPATCH ESCALATION*";
  }

  const lines = [
    title,
    "",
    notification.businessName ? `🏢 *Business:* ${notification.businessName}` : null,
    notification.category ? `🏷️ *Category:* ${notification.category}` : null,
    notification.callerName ? `👤 *Contact Name:* ${notification.callerName}` : null,
    notification.contact ? `📬 *Contact / Phone:* ${notification.contact}` : null,
    notification.language ? `🌐 *Language:* ${notification.language}` : null,
    notification.planName ? `💎 *Target Plan:* ${notification.planName}` : null,
    notification.details ? `📝 *Notes / Services:*\n${notification.details.slice(0, 300)}` : null,
    "",
    `🕒 *Timestamp:* ${new Date().toISOString()}`,
    `[Open Studio Live](https://vaniedge.vercel.app)`,
  ].filter(Boolean);

  const messageText = lines.join("\n");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: "Markdown",
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      // Fallback without parse_mode if entity markdown parsing failed
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText.replace(/[*_`\[\]]/g, ""),
        }),
      }).catch(() => null);
    }

    return res.ok;
  } catch {
    clearTimeout(timer);
    return false;
  }
}
