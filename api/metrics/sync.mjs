import { ensureSchema, client } from "../_db.mjs";

function metricMap(payload){
  const out={views:0,likes:0,replies:0,reposts:0,quotes:0,shares:0};
  for(const item of payload?.data||[]){
    const name=String(item?.name||"");
    if(!(name in out)) continue;
    const values=Array.isArray(item?.values)?item.values:[];
    const value=values.length?values[values.length-1]?.value:item?.value;
    out[name]=Number(value||0);
  }
  return out;
}

async function fetchInsights(threadId,token){
  const url=new URL("https://graph.threads.net/v1.0/"+encodeURIComponent(threadId)+"/insights");
  url.searchParams.set("metric","views,likes,replies,reposts,quotes,shares");
  url.searchParams.set("access_token",token);
  const response=await fetch(url);
  const data=await response.json().catch(()=>({}));
  return {response,data};
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});
    await ensureSchema();
    const sql=client();

    const posts=await sql(
      "select p.id,p.threads_post_id,p.account_id,a.threads_access_token_encrypted from roader_posts p join roader_accounts a on a.id=p.account_id where p.status='published' and p.threads_post_id is not null and a.threads_access_token_encrypted is not null order by p.published_at desc nulls last limit 100"
    );

    let synced=0,failed=0;
    const errors=[];

    for(const post of posts){
      const result=await fetchInsights(String(post.threads_post_id),String(post.threads_access_token_encrypted));
      if(!result.response.ok){
        failed++;
        errors.push({
          post_id:post.id,
          code:result.data?.error?.code||null,
          message:result.data?.error?.message||"insights_failed"
        });
        continue;
      }

      const m=metricMap(result.data);
      const previous=await sql(
        "select profile_visits,bot_entries,applications from roader_metrics where post_id=$1 order by captured_at desc limit 1",
        [post.id]
      );
      const p=previous[0]||{};

      await sql(
        "insert into roader_metrics (post_id,views,likes,replies,reposts,quotes,shares,profile_visits,bot_entries,applications) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [post.id,m.views,m.likes,m.replies,m.reposts,m.quotes,m.shares,Number(p.profile_visits||0),Number(p.bot_entries||0),Number(p.applications||0)]
      );
      synced++;
    }

    return res.status(200).json({ok:true,found:posts.length,synced,failed,errors:errors.slice(0,5)});
  }catch(error){
    console.error("metrics-sync",error);
    return res.status(500).json({ok:false,error:"server_error",details:String(error?.message||"")});
  }
}
