import { ensureSchema, client } from "../_db.mjs";
import { scorePost } from "../../src/lib/quality.js";

function kstNow(){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Seoul",
    year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hour12:false
  }).formatToParts(new Date());
  const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {
    date:`${map.year}-${map.month}-${map.day}`,
    hour:Number(map.hour)
  };
}

function slotsForGoal(goal){
  const n=Math.max(0,Math.min(8,Number(goal||0)));
  if(!n) return [];
  if(n===1) return [12];
  const start=9,end=20;
  const out=[];
  for(let i=0;i<n;i++){
    out.push(Math.round(start+(end-start)*(i/(n-1))));
  }
  return [...new Set(out)];
}

function seededPercent(accountId,date,slot){
  const s=`${accountId}-${date}-${slot}`;
  let h=2166136261;
  for(let i=0;i<s.length;i++){
    h^=s.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return Math.abs(h)%100;
}

function pickPostType(typeMix,seed){
  const entries=Object.entries(typeMix||{}).filter(([,v])=>Number(v)>0);
  if(!entries.length) return "후킹형";
  const total=entries.reduce((a,[,v])=>a+Number(v),0);
  let x=(seed/100)*total;
  for(const [name,w] of entries){
    x-=Number(w);
    if(x<=0) return name;
  }
  return entries[0][0];
}

async function callJson(url,options={}){
  const r=await fetch(url,{
    headers:{"content-type":"application/json",...(options.headers||{})},
    ...options
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok){
    const e=new Error(data.error||"request_failed");
    e.details=data.details||"";
    e.code=data.code||"";
    throw e;
  }
  return data;
}

function originFromReq(req){
  const proto=String(req.headers["x-forwarded-proto"]||"https").split(",")[0];
  const host=String(req.headers["x-forwarded-host"]||req.headers.host||"");
  return `${proto}://${host}`;
}

async function claimRun(sql,accountId,date,slotIndex,slotHour){
  const rows=await sql(
    `insert into roader_automation_runs
      (account_id,run_date,slot_index,slot_hour,status,attempt_count)
     values ($1,$2::date,$3,$4,'running',0)
     on conflict (account_id,run_date,slot_index) do nothing
     returning *`,
    [accountId,date,slotIndex,slotHour]
  );
  return rows[0]||null;
}

async function finishRun(sql,id,patch){
  const status=String(patch.status||"failed");
  const postId=patch.post_id||null;
  const quality=patch.quality_score??null;
  const attempts=Number(patch.attempt_count||0);
  const error=patch.last_error?String(patch.last_error).slice(0,1800):null;
  await sql(
    `update roader_automation_runs
     set status=$1,post_id=$2,quality_score=$3,attempt_count=$4,last_error=$5,updated_at=now()
     where id=$6`,
    [status,postId,quality,attempts,error,id]
  );
}

async function processAccount({sql,origin,account,run,date,slotIndex}){
  const recent=await sql(
    `select body from roader_posts
     where account_id=$1 and status='published'
     order by published_at desc nulls last,created_at desc
     limit 24`,
    [account.id]
  );
  const recentTexts=recent.map(r=>String(r.body||""));

  const seed=seededPercent(account.id,date,slotIndex);
  const postType=pickPostType(account.type_mix,seed);
  const threshold=Number(account.auto_publish_threshold||90);

  let chosen=null;
  let lastQuality=null;
  let generateError=null;

  for(let attempt=1;attempt<=2;attempt++){
    try{
      const draft=await callJson(origin+"/api/ai/generate",{
        method:"POST",
        body:JSON.stringify({
          account_id:Number(account.id),
          post_type:postType,
          topic:""
        })
      });

      const quality=scorePost({
        text:String(draft.body||""),
        mediaMode:"text",
        hasImage:false,
        recentTexts
      });
      lastQuality=quality;

      if(quality.status!=="blocked" && quality.score>=threshold){
        chosen={...draft,quality,attempt};
        break;
      }
    }catch(e){
      generateError=e;
    }
  }

  if(!chosen){
    await finishRun(sql,run.id,{
      status:"quality_failed",
      quality_score:lastQuality?.score??null,
      attempt_count:2,
      last_error:generateError
        ? `generation: ${generateError.message}${generateError.details?" · "+generateError.details:""}`
        : `quality below threshold ${lastQuality?.score??"-"}/${threshold}`
    });
    return {account_id:account.id,status:"quality_failed",score:lastQuality?.score??null};
  }

  try{
    const published=await callJson(origin+"/api/threads/publish",{
      method:"POST",
      body:JSON.stringify({
        account_id:Number(account.id),
        post_type:postType,
        media_mode:"text",
        body:chosen.body,
        quality_score:chosen.quality.score,
        quality_status:chosen.quality.status,
        quality_details:chosen.quality,
        reply_text:String(chosen.reply||"").trim()
      })
    });

    await finishRun(sql,run.id,{
      status:"published",
      post_id:published.post_id||null,
      quality_score:chosen.quality.score,
      attempt_count:chosen.attempt,
      last_error:published.reply_attempted&&!published.reply_ok
        ? `reply_failed: ${published.reply_details||"unknown"}`
        : null
    });

    return {
      account_id:account.id,
      status:"published",
      post_id:published.post_id||null,
      threads_post_id:published.threads_post_id||null,
      score:chosen.quality.score,
      reply_ok:published.reply_ok
    };
  }catch(e){
    await finishRun(sql,run.id,{
      status:"publish_failed",
      quality_score:chosen.quality.score,
      attempt_count:chosen.attempt,
      last_error:`${e.message}${e.details?" · "+e.details:""}`
    });
    return {account_id:account.id,status:"publish_failed",score:chosen.quality.score,error:e.message};
  }
}

export default async function handler(req,res){
  try{
    if(req.method!=="GET"&&req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});

    const secret=process.env.CRON_SECRET;
    if(!secret) return res.status(503).json({ok:false,error:"cron_secret_not_configured"});
    const auth=String(req.headers.authorization||"");
    if(auth!==`Bearer ${secret}`) return res.status(401).json({ok:false,error:"unauthorized"});

    await ensureSchema();
    const sql=client();
    const now=kstNow();
    const origin=originFromReq(req);

    const accounts=await sql(
      `select a.id,a.name,a.handle,a.daily_post_goal,a.cta_ratio,a.threads_user_id,
        coalesce(cp.auto_publish_threshold,90) as auto_publish_threshold,
        coalesce(cp.type_mix,'{}'::jsonb) as type_mix
       from roader_accounts a
       left join roader_content_profiles cp on cp.account_id=a.id
       where a.is_active=true
         and a.daily_post_goal>0
         and a.threads_user_id is not null
         and a.threads_access_token_encrypted is not null
       order by a.id asc`
    );

    const results=[];

    for(const account of accounts){
      const slots=slotsForGoal(account.daily_post_goal);
      if(!slots.length) continue;

      const publishedToday=await sql(
        `select count(*)::int as n from roader_posts
         where account_id=$1 and status='published'
           and published_at >= (date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
           and published_at < ((date_trunc('day',now() at time zone 'Asia/Seoul') + interval '1 day') at time zone 'Asia/Seoul')`,
        [account.id]
      );
      if(Number(publishedToday[0]?.n||0)>=Number(account.daily_post_goal||0)){
        results.push({account_id:account.id,status:"daily_goal_reached"});
        continue;
      }

      const runs=await sql(
        `select slot_index,status from roader_automation_runs
         where account_id=$1 and run_date=$2::date`,
        [account.id,now.date]
      );
      const used=new Set(runs.map(r=>Number(r.slot_index)));

      let dueIndex=-1;
      for(let i=0;i<slots.length;i++){
        if(slots[i]<=now.hour && !used.has(i)){ dueIndex=i; break; }
      }
      if(dueIndex<0){
        results.push({account_id:account.id,status:"not_due"});
        continue;
      }

      const run=await claimRun(sql,account.id,now.date,dueIndex,slots[dueIndex]);
      if(!run){
        results.push({account_id:account.id,status:"already_claimed"});
        continue;
      }

      const result=await processAccount({
        sql,origin,account,run,date:now.date,slotIndex:dueIndex
      });
      results.push(result);
    }

    return res.status(200).json({
      ok:true,
      kst_date:now.date,
      kst_hour:now.hour,
      processed:results.filter(r=>r.status==="published").length,
      results
    });
  }catch(error){
    console.error("automation-run",error);
    return res.status(500).json({ok:false,error:"automation_failed",details:String(error?.message||"")});
  }
}
