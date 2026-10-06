import { ensureSchema, client } from "../_db.mjs";

const APP_ID=process.env.META_THREADS_APP_ID;
const APP_SECRET=process.env.META_THREADS_APP_SECRET;

const REQUIRED_SCOPES=[
  "threads_basic",
  "threads_content_publish",
  "threads_manage_replies",
  "threads_manage_insights",
  "threads_profile_discovery"
];

async function getAppAccessToken(){
  const u=new URL("https://graph.threads.net/oauth/access_token");
  u.searchParams.set("grant_type","client_credentials");
  u.searchParams.set("client_id",APP_ID);
  u.searchParams.set("client_secret",APP_SECRET);

  const r=await fetch(u);
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data?.access_token){
    throw new Error(data?.error?.message||data?.error_message||"app_access_token_failed");
  }
  return String(data.access_token);
}

async function debugToken(userToken,appToken){
  const u=new URL("https://graph.threads.net/debug_token");
  u.searchParams.set("input_token",userToken);
  u.searchParams.set("access_token",appToken);

  const r=await fetch(u);
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error?.message||"debug_token_failed");
  return data?.data||data||{};
}

export default async function handler(req,res){
  try{
    if(req.method!=="GET") return res.status(405).json({ok:false,error:"method_not_allowed"});
    if(!APP_ID||!APP_SECRET) return res.status(503).json({ok:false,error:"meta_threads_not_configured"});

    const accountId=Number(req.query?.account_id||0);
    if(!accountId) return res.status(400).json({ok:false,error:"account_id_required"});

    await ensureSchema();
    const sql=client();

    const rows=await sql(
      "select id,name,handle,threads_user_id,threads_username,threads_access_token_encrypted,threads_token_expires_at,threads_token_refreshed_at from roader_accounts where id=$1 limit 1",
      [accountId]
    );
    const account=rows[0];
    if(!account) return res.status(404).json({ok:false,error:"account_not_found"});
    if(!account.threads_access_token_encrypted){
      return res.status(409).json({ok:false,error:"threads_account_not_connected"});
    }

    const appToken=await getAppAccessToken();
    const debug=await debugToken(String(account.threads_access_token_encrypted),appToken);

    const scopes=[
      ...(Array.isArray(debug?.scopes)?debug.scopes:[]),
      ...(Array.isArray(debug?.granular_scopes)?debug.granular_scopes.map(x=>x?.scope).filter(Boolean):[])
    ].map(String);
    const uniqueScopes=[...new Set(scopes)];
    const required=Object.fromEntries(REQUIRED_SCOPES.map(s=>[s,uniqueScopes.includes(s)]));

    return res.status(200).json({
      ok:true,
      account:{
        id:account.id,
        name:account.name,
        handle:account.handle,
        threads_user_id:account.threads_user_id,
        threads_username:account.threads_username
      },
      token:{
        is_valid:Boolean(debug?.is_valid),
        user_id:debug?.user_id||account.threads_user_id||null,
        expires_at:debug?.expires_at||null,
        stored_expires_at:account.threads_token_expires_at||null,
        refreshed_at:account.threads_token_refreshed_at||null
      },
      scopes:uniqueScopes,
      required
    });
  }catch(error){
    console.error("threads-permissions",error);
    return res.status(502).json({
      ok:false,
      error:"threads_permission_diagnostic_failed",
      details:String(error?.message||"diagnostic_failed")
    });
  }
}
