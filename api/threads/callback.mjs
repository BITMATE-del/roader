import { ensureSchema, client } from "../_db.mjs";

const APP_ID=process.env.META_THREADS_APP_ID;
const APP_SECRET=process.env.META_THREADS_APP_SECRET;
const REDIRECT_URI=process.env.META_THREADS_REDIRECT_URI;
const APP_ORIGIN="https://roader-delta.vercel.app";

async function exchangeCode(code){
  const body=new URLSearchParams({client_id:APP_ID,client_secret:APP_SECRET,grant_type:"authorization_code",redirect_uri:REDIRECT_URI,code});
  const r=await fetch("https://graph.threads.net/oauth/access_token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error_message||data?.error?.message||"token_exchange_failed");
  return data;
}

async function exchangeLongLived(shortToken){
  const u=new URL("https://graph.threads.net/access_token");
  u.searchParams.set("grant_type","th_exchange_token");
  u.searchParams.set("client_secret",APP_SECRET);
  u.searchParams.set("access_token",shortToken);
  const r=await fetch(u);
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data?.access_token) throw new Error(data?.error?.message||"long_lived_token_exchange_failed");
  return data;
}

async function getMe(token){
  const r=await fetch("https://graph.threads.net/v1.0/me?fields=id,username,name&access_token="+encodeURIComponent(token));
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data?.error?.message||"profile_fetch_failed");
  return data;
}

function normalizeHandle(v=""){ return String(v).trim().replace(/^@+/,"").toLowerCase(); }

function popupResult(res,payload){
  const json=JSON.stringify(payload).replace(/</g,"\\u003c");
  res.setHeader("content-type","text/html; charset=utf-8");
  const html="<!doctype html><html><head><meta charset=\"utf-8\"><title>ROADER Threads 연결</title></head><body>"+
    "<script>(function(){var data="+json+";try{if(window.opener&&!window.opener.closed){window.opener.postMessage(data,\""+APP_ORIGIN+"\");setTimeout(function(){window.close();},250);}else{location.href=\"/?threads_popup=1&threads_status=\"+encodeURIComponent(data.status||\"error\");}}catch(e){location.href=\"/\";}})();<\/script>"+
    "<p style=\"font-family:sans-serif;padding:24px\">Threads 연결 처리를 완료했습니다. 창이 자동으로 닫힙니다.</p></body></html>";
  return res.status(200).send(html);
}

export default async function handler(req,res){
  try{
    if(req.method!=="GET") return res.status(405).send("Method not allowed");
    if(!APP_ID||!APP_SECRET||!REDIRECT_URI) return res.status(503).send("Meta Threads integration is not configured.");
    const code=String(req.query?.code||"");
    const state=String(req.query?.state||"");
    if(!code) return popupResult(res,{type:"roader_threads_oauth",status:"error",error:"missing_code"});
    const accountId=Number(state.replace("account_",""));
    if(!accountId) return popupResult(res,{type:"roader_threads_oauth",status:"error",error:"invalid_state"});

    await ensureSchema();
    const sql=client();
    const accountRows=await sql("select id,name,handle from roader_accounts where id=$1 limit 1",[accountId]);
    const account=accountRows[0];
    if(!account) return popupResult(res,{type:"roader_threads_oauth",status:"error",error:"account_not_found"});

    const tokenData=await exchangeCode(code);
    const longData=await exchangeLongLived(String(tokenData.access_token||""));
    const longToken=String(longData.access_token||"");
    const me=await getMe(longToken);
    const threadsUserId=String(me.id||"");
    const actual=normalizeHandle(me.username||"");
    const expected=normalizeHandle(account.handle);

    if(expected&&actual&&expected!==actual){
      return popupResult(res,{type:"roader_threads_oauth",status:"handle_mismatch",expected:"@"+expected,actual:"@"+actual});
    }

    const duplicate=await sql("select id,name,handle from roader_accounts where threads_user_id=$1 and id<>$2 limit 1",[threadsUserId,accountId]);
    if(duplicate[0]){
      return popupResult(res,{type:"roader_threads_oauth",status:"already_connected",connected_name:String(duplicate[0].name||""),connected_handle:String(duplicate[0].handle||"")});
    }

    const expiresIn=Math.max(0,Number(longData.expires_in||0));
    const expiresAt=expiresIn?new Date(Date.now()+expiresIn*1000).toISOString():null;
    await sql("update roader_accounts set threads_user_id=$1,threads_username=$2,threads_access_token_encrypted=$3,threads_token_expires_at=$4,threads_token_refreshed_at=now(),updated_at=now() where id=$5",[threadsUserId,actual?"@"+actual:"",longToken,expiresAt,accountId]);
    await sql("update roader_style_sources set last_error=null,updated_at=now() where account_id=$1",[accountId]);

    return popupResult(res,{type:"roader_threads_oauth",status:"connected",account_id:accountId,username:actual?"@"+actual:""});
  }catch(error){
    console.error("threads-callback",error);
    return popupResult(res,{type:"roader_threads_oauth",status:"error",error:String(error?.message||"threads_connection_failed")});
  }
}
