const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const SETUP_KEY = process.env.SETUP_KEY || "";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  if (!SETUP_KEY || req.headers["x-setup-key"] !== SETUP_KEY) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  if (!BOT_TOKEN) {
    return res.status(500).json({ ok: false, error: "missing_bot_token" });
  }

  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const webhook = `${proto}://${host}/api/telegram`;

  const r = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: webhook,
        secret_token: WEBHOOK_SECRET || undefined,
        allowed_updates: ["message", "callback_query"]
      })
    }
  );

  const data = await r.json();

  return res.status(r.ok ? 200 : 500).json({
    ...data,
    webhook
  });
}
