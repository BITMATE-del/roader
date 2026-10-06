import { ensureSchema, client } from "./_db.mjs";

const BOT_USERNAME = "pbroad_bot";

export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});

  try{
    await ensureSchema();
    const sql=client();
    const code=String(req.query?.code||"").trim();

    if(!/^[A-Za-z0-9_-]{1,64}$/.test(code)){
      return res.status(404).send("Not found");
    }

    const rows=await sql(
      "select id,telegram_source_code from roader_accounts where telegram_source_code=$1 and is_active=true limit 1",
      [code]
    );
    const account=rows[0];
    if(!account) return res.status(404).send("Not found");

    await sql(
      "insert into roader_referral_clicks (account_id,source_code,referrer,user_agent) values ($1,$2,$3,$4)",
      [
        account.id,
        code,
        String(req.headers.referer||"").slice(0,500),
        String(req.headers["user-agent"]||"").slice(0,500)
      ]
    );

    res.setHeader("Cache-Control","no-store");
    return res.redirect(302,"https://t.me/"+BOT_USERNAME+"?start="+encodeURIComponent(code));
  }catch(error){
    console.error("referral-redirect",error);
    return res.status(500).send("Server error");
  }
}
