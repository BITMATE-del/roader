const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";
const SETUP_KEY = process.env.SETUP_KEY || "";

function sameOrigin(req){
  const origin=String(req.headers.origin||"");
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"");
  if(!origin||!host) return false;
  try{
    return new URL(origin).host===host;
  }catch{
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error:"method_not_allowed" });
  }

  const headerKey=String(req.headers["x-setup-key"]||"");
  const authorizedByKey=Boolean(SETUP_KEY && headerKey===SETUP_KEY);
  const authorizedByApp=sameOrigin(req) && req.body?.source==="settings";

  if (!authorizedByKey && !authorizedByApp) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  if (!BOT_TOKEN) {
    return res.status(500).json({ ok: false, error: "missing_bot_token" });
  }

  const webhook = "https://roader-delta.vercel.app/api/telegram";

  const r = await fetch(
    "https://api.telegram.org/bot" + BOT_TOKEN + "/setWebhook",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: webhook,
        secret_token: WEBHOOK_SECRET || undefined,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false
      })
    }
  );

  const data = await r.json().catch(()=>({}));

  if(!r.ok || !data.ok){
    return res.status(502).json({
      ok:false,
      error:"telegram_webhook_failed",
      details:data?.description||"Telegram webhook registration failed"
    });
  }

  return res.status(200).json({
    ok:true,
    webhook,
    description:data.description||"Webhook was set"
  });
}
