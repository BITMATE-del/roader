import { ensureSchema, client } from "./_db.mjs";

function kstDate(){
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"
  }).formatToParts(new Date());
  const m=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return `${m.year}-${m.month}-${m.day}`;
}

function slotsForGoal(goal,preferredHours=[],confidence=0){
  const n=Math.max(0,Math.min(8,Number(goal||0)));
  if(!n) return [];
  const learned=Number(confidence||0)>=50
    ? [...new Set((Array.isArray(preferredHours)?preferredHours:[])
        .map(Number).filter(h=>Number.isInteger(h)&&h>=9&&h<=20))]
    : [];
  const base=n===1?[12]:(()=>{
    const out=[],start=9,end=20;
    for(let i=0;i<n;i++) out.push(Math.round(start+(end-start)*(i/(n-1))));
    return out;
  })();
  return [...new Set([...learned,...base])].slice(0,n).sort((a,b)=>a-b);
}

export default async function handler(req,res){
  try{
    await ensureSchema();
    const sql=client();

    if(req.method==="GET"){
      const rows=await sql(`
        select s.id,s.scheduled_at,s.timezone,s.status,s.last_error,s.attempt_count,
          p.id as post_id,p.post_type,p.body,p.reply_text,p.generated_topic,p.quality_score,p.quality_status,
          a.id as account_id,a.name as account_name,a.handle,
          coalesce(cp.auto_publish_threshold,90) as auto_publish_threshold
        from roader_schedules s
        join roader_posts p on p.id=s.post_id
        join roader_accounts a on a.id=p.account_id
        left join roader_content_profiles cp on cp.account_id=a.id
        where s.scheduled_at >= (date_trunc('day',now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul')
          and s.scheduled_at < ((date_trunc('day',now() at time zone 'Asia/Seoul') + interval '2 day') at time zone 'Asia/Seoul')
        order by s.scheduled_at asc
        limit 200
      `);

      const accounts=await sql(`
        select a.id,a.name,a.handle,a.daily_post_goal,
          coalesce(pp.strategy,'{}'::jsonb) as performance_strategy,
          coalesce(pp.confidence,0) as performance_confidence,
          coalesce(cp.auto_publish_threshold,90) as auto_publish_threshold
        from roader_accounts a
        left join roader_performance_profiles pp on pp.account_id=a.id
        left join roader_content_profiles cp on cp.account_id=a.id
        where a.is_active=true and a.daily_post_goal>0
        order by a.id
      `);

      const today=kstDate();
      const runs=await sql(`
        select id,account_id,slot_index,slot_hour,status,post_id,quality_score,attempt_count,last_error,updated_at
        from roader_automation_runs
        where run_date=$1::date
        order by account_id,slot_index
      `,[today]);

      const actualByPost=new Map(rows.filter(x=>x.post_id).map(x=>[Number(x.post_id),x]));
      const runByKey=new Map(runs.map(r=>[`${r.account_id}:${r.slot_index}`,r]));
      const synthetic=[];

      for(const a of accounts){
        const hours=slotsForGoal(
          a.daily_post_goal,
          a.performance_strategy?.preferred_hours_kst||[],
          a.performance_confidence
        );
        for(let i=0;i<hours.length;i++){
          const run=runByKey.get(`${a.id}:${i}`);
          if(run?.post_id&&actualByPost.has(Number(run.post_id))) continue;
          synthetic.push({
            id:`slot-${a.id}-${i}`,
            scheduled_at:`${today}T${String(hours[i]).padStart(2,"0")}:10:00+09:00`,
            timezone:"Asia/Seoul",
            status:run?.status||"generation_pending",
            last_error:run?.last_error||null,
            attempt_count:Number(run?.attempt_count||0),
            post_id:run?.post_id||null,
            post_type:null,
            body:"",
            reply_text:"",
            generated_topic:"",
            quality_score:run?.quality_score??null,
            quality_status:null,
            account_id:a.id,
            account_name:a.name,
            handle:a.handle,
            auto_publish_threshold:Number(a.auto_publish_threshold||90),
            is_placeholder:true
          });
        }
      }

      return res.status(200).json({
        ok:true,
        schedules:[...rows,...synthetic].sort((a,b)=>new Date(a.scheduled_at)-new Date(b.scheduled_at))
      });
    }

    if(req.method==="POST"){
      const b=req.body||{};
      if(!b.post_id||!b.scheduled_at) return res.status(400).json({ok:false,error:"post_id_and_scheduled_at_required"});
      const rows=await sql(
        "insert into roader_schedules (post_id,scheduled_at,timezone,status) values ($1,$2,$3,$4) returning *",
        [Number(b.post_id),String(b.scheduled_at),String(b.timezone||"Asia/Seoul"),String(b.status||"scheduled")]
      );
      return res.status(201).json({ok:true,schedule:rows[0]});
    }

    return res.status(405).json({ok:false,error:"method_not_allowed"});
  }catch(error){
    console.error("schedules-api",error);
    return res.status(500).json({ok:false,error:"server_error",details:String(error?.message||"")});
  }
}
