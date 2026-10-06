import { ensureSchema, client } from "../_db.mjs";

const APP_ID = process.env.META_THREADS_APP_ID;
const APP_SECRET = process.env.META_THREADS_APP_SECRET;
const REDIRECT_URI = process.env.META_THREADS_REDIRECT_URI;

async function exchangeCode(code){
  const body = new URLSearchParams({
    client_id: APP_ID,
    client_secret: APP_SECRET,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code
  });
  const r = await fetch("https://graph.threads.net/oauth/access_token",{
    method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},
    body
  });
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error_message || data?.error?.message || "token_exchange_failed");
  return data;
}

async function getMe(token){
  const r = await fetch("https://graph.threads.net/v1.0/me?fields=id,username,name&access_token="+encodeURIComponent(token));
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error?.message || "profile_fetch_failed");
  return data;
}

export default async function handler(req,res){
  try{
    if(req.method!=="GET") return res.status(405).send("Method not allowed");
    if(!APP_ID || !APP_SECRET || !REDIRECT_URI) return res.status(503).send("Meta Threads integration is not configured.");

    const code = String(req.query?.code || "");
    const state = String(req.query?.state || "");
    if(!code) return res.status(400).send("Missing authorization code.");

    const accountId = Number(state.replace("account_",""));
    if(!accountId) return res.status(400).send("Invalid account state.");

    await ensureSchema();
    const sql = client();

    const tokenData = await exchangeCode(code);
    const shortToken = tokenData.access_token;
    const me = await getMe(shortToken);

    const threadsUserId=String(me.id||"");
    const threadsUsername=me.username ? "@"+String(me.username).replace(/^@/,"") : "";

    const duplicate=await sql(
      "select id,name,handle from roader_accounts where threads_user_id=$1 and id<>$2 limit 1",
      [threadsUserId,accountId]
    );

    if(duplicate[0]){
      const q=new URLSearchParams({
        threads_error:"already_connected",
        connected_name:String(duplicate[0].name||""),
        connected_handle:String(duplicate[0].handle||"")
      });
      return res.redirect(302,"/?"+q.toString());
    }

    await sql(
      "update roader_accounts set threads_user_id=$1, threads_username=$2, threads_access_token_encrypted=$3, updated_at=now() where id=$4",
      [threadsUserId,threadsUsername,String(shortToken||""),accountId]
    );

    return res.redirect(302,"/?threads_connected=1");
  }catch(error){
    console.error("threads-callback",error);
    return res.status(500).send("Threads account connection failed.");
  }
}
