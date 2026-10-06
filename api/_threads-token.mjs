export async function getValidThreadsToken(sql,accountId,{refreshWindowDays=7}={}){
  const rows=await sql(
    "select id,threads_user_id,threads_access_token_encrypted,threads_token_expires_at,threads_token_refreshed_at from roader_accounts where id=$1 limit 1",
    [accountId]
  );
  const account=rows[0];
  if(!account?.threads_user_id||!account?.threads_access_token_encrypted){
    const err=new Error("threads_account_not_connected");
    err.code="threads_account_not_connected";
    throw err;
  }

  let token=String(account.threads_access_token_encrypted||"");
  const expiry=account.threads_token_expires_at?new Date(account.threads_token_expires_at):null;
  const now=Date.now();
  const windowMs=refreshWindowDays*24*60*60*1000;

  if(expiry && expiry.getTime()<=now){
    const err=new Error("threads_token_expired");
    err.code="threads_token_expired";
    throw err;
  }

  const shouldRefresh=!expiry || expiry.getTime()-now<=windowMs;
  if(!shouldRefresh) return token;

  try{
    const url=new URL("https://graph.threads.net/refresh_access_token");
    url.searchParams.set("grant_type","th_refresh_token");
    url.searchParams.set("access_token",token);

    const r=await fetch(url);
    const text=await r.text();
    let data={};
    try{ data=text?JSON.parse(text):{}; }catch{}

    if(!r.ok){
      const message=data?.error?.message||data?.error_message||"threads_token_refresh_failed";
      const expired=/expired|session has expired|invalid oauth access token/i.test(message);
      const err=new Error(expired?"threads_token_expired":message);
      err.code=expired?"threads_token_expired":"threads_token_refresh_failed";
      throw err;
    }

    const refreshedToken=String(data?.access_token||token);
    const expiresIn=Number(data?.expires_in||5184000);
    const nextExpiry=new Date(Date.now()+Math.max(3600,expiresIn)*1000).toISOString();

    await sql(
      "update roader_accounts set threads_access_token_encrypted=$1,threads_token_expires_at=$2,threads_token_refreshed_at=now(),updated_at=now() where id=$3",
      [refreshedToken,nextExpiry,accountId]
    );

    return refreshedToken;
  }catch(error){
    if(error?.code) throw error;
    const err=new Error("threads_token_refresh_failed");
    err.code="threads_token_refresh_failed";
    throw err;
  }
}

export function isThreadsExpiredError(message=""){
  return /expired|session has expired|invalid oauth access token/i.test(String(message||""));
}
