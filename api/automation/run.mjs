import { ensureSchema, client } from "../_db.mjs";
import { scorePost } from "../../src/lib/quality.js";

function kstNow(){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Seoul",
    year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false
  }).formatToParts(new Date());
  const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {date:`${m.year}-${m.month}-${m.day}`,hour:Number(m.hour),minute:Number(m.minute)};
}

function slotsForGoal(goal){
  const n=Math.max(0,Math.min(8,Number(goal||0)));
  if(!n) return [];
  if(n===1) return [12];
  const start=9,end=20,out=[];
  for(let i=0;i<n;i++) out.push(Math.round(start+(end-start)*(i/(n-1))));
  return [...new Set(out)];
}

function slotIso(date,hour){
  return `${date}T${String(hour).padStart(2,"0")}:10:00+09:00`;
}

function seededPercent(accountId,date,slot){
  const s=`${accountId}-${date}-${slot}`;
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return Math.abs(h)%100;
}

function pickPostType(typeMix,seed){
  const entries=Object.entries(typeMix||{}).filter(([,v])=>Number(v)>0);
  if(!entries.length) return "후킹형";
  const total=entries.reduce((a,[,v])=>a+Number(v),0);
  let x=(seed/100)*total;
  for(const [name,w] of entries){ x-=Number(w); if(x<=0) return name; }
  return entries[0][0];
}

function normalizeTopic(v){
  return String(v||"").toLowerCase().replace(/\s+/g," ").replace(/[^0-9a-z가-힣 ]/g,"").trim();
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
     on conflict (account_id,run_date,slot_index)
     do update set status='running',attempt_count=0,last_error=null,updated_at=now()
       where roader_automation_runs.status in ('quality_failed','plan_failed','publish_failed')
     returning *`,
    [accountId,date,slotIndex,slotHour]
  );
  return rows[0]||null;
}

async function finishRun(sql,id,patch){
  await sql(
    `update roader_automation_runs
     set status=$1,post_id=$2,quality_score=$3,attempt_count=$4,last_error=$5,updated_at=now()
     where id=$6`,
    [
      String(patch.status||"failed"),
      patch.post_id||null,
      patch.quality_score??null,
      Number(patch.attempt_count||0),
      patch.last_error?String(patch.last_error).slice(0,1800):null,
      id
    ]
  );
}

async function generatePassingDraft({origin,account,postType,recentTexts,excludeTopics,threshold}){
  let draft=null;
  let quality=null;

  try{
    draft=await callJson(origin+"/api/ai/generate",{
      method:"POST",
      body:JSON.stringify({
        account_id:Number(account.id),
        post_type:postType,
        topic:"",
        exclude_topics:excludeTopics
      })
    });
  }catch(error){
    return {failed:true,error,attempt:1,quality:null,draft:null};
  }

  const normalizedExcluded=new Set(excludeTopics.map(normalizeTopic));
  const selectedTopic=String(draft.selected_topic||"").trim();
  if(selectedTopic && normalizedExcluded.has(normalizeTopic(selectedTopic))){
    return {
      failed:true,
      error:new Error("duplicate_topic"),
      attempt:1,
      quality:null,
      draft
    };
  }

  quality=scorePost({
    text:String(draft.body||""),
    mediaMode:"text",
    hasImage:false,
    recentTexts
  });

  if(quality.status!=="blocked" && quality.score>=threshold){
    return {draft,quality,attempt:1};
  }

  try{
    const repaired=await callJson(origin+"/api/ai/repair",{
      method:"POST",
      body:JSON.stringify({
        body:String(draft.body||""),
        reply:String(draft.reply||""),
        blockers:quality.blockers||[],
        metrics:quality.metrics||{},
        is_crypto:/코인|crypto|가상자산|암호화폐/i.test(String(account.sector||""))
      })
    });

    const repairedDraft={...draft,body:repaired.body||draft.body,reply:repaired.reply||draft.reply};
    const repairedQuality=scorePost({
      text:String(repairedDraft.body||""),
      mediaMode:"text",
      hasImage:false,
      recentTexts
    });

    if(repairedQuality.status!=="blocked" && repairedQuality.score>=threshold){
      return {draft:repairedDraft,quality:repairedQuality,attempt:2};
    }

    return {
      failed:true,
      error:new Error("quality_below_threshold_after_repair"),
      attempt:2,
      quality:repairedQuality,
      draft:repairedDraft
    };
  }catch(error){
    return {
      failed:true,
      error,
      attempt:2,
      quality,
      draft
    };
  }
}

async function planAccount({sql,origin,account,date}){
  const slots=slotsForGoal(account.daily_post_goal);
  const todayRows=await sql(
    `select p.generated_topic,p.body,p.status,s.id as schedule_id
     from roader_posts p
     left join roader_schedules s on s.post_id=p.id
     where p.account_id=$1
       and p.created_at >= ($2::date::timestamp at time zone 'Asia/Seoul')
       and p.created_at < (($2::date + interval '1 day')::timestamp at time zone 'Asia/Seoul')
       and p.status in ('scheduled','published','publishing')`,
    [account.id,date]
  );
  const excludeTopics=todayRows.map(r=>String(r.generated_topic||"").trim()).filter(Boolean);
  const recent=await sql(
    `select body from roader_posts
     where account_id=$1 and status='published'
     order by published_at desc nulls last,created_at desc limit 24`,
    [account.id]
  );
  const recentTexts=recent.map(r=>String(r.body||""));

  const existing=await sql(
    `select r.slot_index,r.status,r.post_id
     from roader_automation_runs r
     where r.account_id=$1 and r.run_date=$2::date`,
    [account.id,date]
  );
  const active=new Map(existing.filter(r=>["scheduled","published","publishing"].includes(String(r.status))).map(r=>[Number(r.slot_index),r]));

  const results=[];

  for(let i=0;i<slots.length;i++){
    if(active.has(i)){ results.push({slot:i,status:"already_planned"}); continue; }

    const run=await claimRun(sql,account.id,date,i,slots[i]);
    if(!run){ results.push({slot:i,status:"claimed"}); continue; }

    const postType=pickPostType(account.type_mix,seededPercent(account.id,date,i));
    const threshold=Number(account.auto_publish_threshold||90);
    const generated=await generatePassingDraft({
      origin,account,postType,recentTexts,excludeTopics,threshold
    });

    if(generated.failed){
      await finishRun(sql,run.id,{
        status:"quality_failed",
        quality_score:generated.quality?.score??null,
        attempt_count:generated.attempt,
        last_error:generated.error
          ? `${generated.error.message}${generated.error.details?" · "+generated.error.details:""}`
          : `quality below threshold ${generated.quality?.score??"-"}/${threshold}`
      });
      results.push({slot:i,status:"quality_failed",score:generated.quality?.score??null});
      continue;
    }

    const d=generated.draft;
    const q=generated.quality;
    const postRows=await sql(
      `insert into roader_posts
       (account_id,post_type,media_mode,body,reply_text,generated_topic,
        quality_score,quality_status,quality_details,status,source_code)
       values ($1,$2,'text',$3,$4,$5,$6,$7,$8::jsonb,'scheduled',$9)
       returning *`,
      [
        account.id,
        postType,
        String(d.body||""),
        String(d.reply||""),
        String(d.selected_topic||""),
        q.score,
        q.status,
        JSON.stringify(q),
        String(account.handle||"").replace(/^@/,"")
      ]
    );
    const post=postRows[0];

    const scheduleRows=await sql(
      `insert into roader_schedules(post_id,scheduled_at,timezone,status)
       values ($1,$2,'Asia/Seoul','scheduled')
       on conflict (post_id) do update set scheduled_at=excluded.scheduled_at,status='scheduled',updated_at=now()
       returning *`,
      [post.id,slotIso(date,slots[i])]
    );

    await finishRun(sql,run.id,{
      status:"scheduled",
      post_id:post.id,
      quality_score:q.score,
      attempt_count:generated.attempt
    });

    if(d.selected_topic) excludeTopics.push(String(d.selected_topic));
    recentTexts.unshift(String(d.body||""));
    results.push({
      slot:i,status:"scheduled",post_id:post.id,schedule_id:scheduleRows[0]?.id,
      score:q.score,topic:d.selected_topic
    });
  }

  return results;
}

async function publishDue({sql,origin}){
  const due=await sql(
    `select s.id as schedule_id,s.attempt_count,p.id as post_id,p.account_id,p.post_type,
       p.body,p.reply_text,p.quality_score,p.quality_status,p.quality_details,
       cp.auto_publish_threshold
     from roader_schedules s
     join roader_posts p on p.id=s.post_id
     left join roader_content_profiles cp on cp.account_id=p.account_id
     where s.status='scheduled'
       and p.status='scheduled'
       and s.scheduled_at<=now()
     order by s.scheduled_at asc
     limit 20`
  );

  const results=[];
  for(const row of due){
    try{
      const published=await callJson(origin+"/api/threads/publish",{
        method:"POST",
        body:JSON.stringify({
          post_id:Number(row.post_id),
          account_id:Number(row.account_id),
          post_type:row.post_type,
          media_mode:"text",
          body:row.body,
          reply_text:row.reply_text||"",
          quality_score:row.quality_score,
          quality_status:row.quality_status,
          quality_details:row.quality_details||{}
        })
      });

      await sql(
        `update roader_schedules
         set status='published',attempt_count=attempt_count+1,last_error=null,updated_at=now()
         where id=$1`,
        [row.schedule_id]
      );
      await sql(
        `update roader_automation_runs set status='published',updated_at=now()
         where post_id=$1`,
        [row.post_id]
      );
      results.push({post_id:row.post_id,status:"published",threads_post_id:published.threads_post_id});
    }catch(e){
      await sql(
        `update roader_schedules
         set attempt_count=attempt_count+1,last_error=$1,updated_at=now()
         where id=$2`,
        [String(e.details||e.message||"publish_failed").slice(0,1800),row.schedule_id]
      );
      await sql(
        `update roader_automation_runs set status='publish_failed',last_error=$1,updated_at=now()
         where post_id=$2`,
        [String(e.details||e.message||"publish_failed").slice(0,1800),row.post_id]
      );
      // Leave schedule as scheduled so next cron retries.
      results.push({post_id:row.post_id,status:"publish_failed",error:e.message});
    }
  }
  return results;
}

export default async function handler(req,res){
  try{
    if(req.method!=="GET"&&req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});
    const secret=process.env.CRON_SECRET;
    if(!secret) return res.status(503).json({ok:false,error:"cron_secret_not_configured"});
    if(String(req.headers.authorization||"")!==`Bearer ${secret}`) return res.status(401).json({ok:false,error:"unauthorized"});

    await ensureSchema();
    const sql=client();
    const now=kstNow();
    const origin=originFromReq(req);

    const accounts=await sql(
      `select a.id,a.name,a.handle,a.sector,a.daily_post_goal,a.cta_ratio,a.threads_user_id,
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

    const planning=[];
    for(const account of accounts){
      const rows=await planAccount({sql,origin,account,date:now.date});
      planning.push({account_id:account.id,rows});
    }

    const publishing=await publishDue({sql,origin});

    return res.status(200).json({
      ok:true,
      kst_date:now.date,
      kst_hour:now.hour,
      planning,
      publishing
    });
  }catch(error){
    console.error("automation-run",error);
    return res.status(500).json({ok:false,error:"automation_failed",details:String(error?.message||"")});
  }
}
