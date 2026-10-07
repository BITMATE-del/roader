import { ensureSchema, client } from "../_db.mjs";

function clamp(n,min=0,max=100){ return Math.max(min,Math.min(max,n)); }
function median(nums){
  if(!nums.length) return 0;
  const a=[...nums].sort((x,y)=>x-y);
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function percentileRank(value,values){
  if(!values.length) return 50;
  const sorted=[...values].sort((a,b)=>a-b);
  const below=sorted.filter(v=>v<value).length;
  const equal=sorted.filter(v=>v===value).length;
  return Math.round(((below+equal*0.5)/sorted.length)*100);
}
function firstLine(text){
  return String(text||"").split("\n").map(v=>v.trim()).find(Boolean)||"";
}
function featureRow(row){
  const body=String(row.body||"").trim();
  const paragraphs=body.split(/\n\s*\n/).map(v=>v.trim()).filter(Boolean);
  const lines=body.split("\n").map(v=>v.trim()).filter(Boolean);
  const open=firstLine(body);
  const hour=row.published_at
    ? Number(new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",hour:"2-digit",hour12:false}).format(new Date(row.published_at)))
    : null;

  return {
    post_id:Number(row.id),
    topic:String(row.generated_topic||"").trim(),
    post_type:String(row.post_type||""),
    body_chars:Array.from(body).length,
    paragraph_count:paragraphs.length,
    line_count:lines.length,
    opening:open.slice(0,90),
    hook_length:Array.from(open).length,
    question:/[?？]/.test(body),
    closing_question:/[?？]\s*$/.test(body),
    choice_poll:/(→\s*1|1번).*(→\s*2|2번)|(→\s*2|2번).*(→\s*1|1번)/s.test(body),
    number_heavy:(body.match(/\d/g)||[]).length>=8,
    publish_hour_kst:Number.isFinite(hour)?hour:null,
    views:Number(row.views||0),
    likes:Number(row.likes||0),
    replies:Number(row.replies||0),
    reposts:Number(row.reposts||0),
    quotes:Number(row.quotes||0),
    shares:Number(row.shares||0),
    captured_at:row.captured_at,
    published_at:row.published_at
  };
}

function performanceRows(rows){
  const features=rows.map(featureRow);
  const viewValues=features.map(x=>x.views);
  return features.map(x=>{
    const engagementRaw=x.likes+x.replies*2.5+x.reposts*3+x.quotes*3+x.shares*3;
    const engagementRate=engagementRaw/Math.max(100,x.views);
    const viewRank=percentileRank(x.views,viewValues);
    const engagementScore=Math.min(100,Math.round(engagementRate*1000));
    const composite=Math.round(viewRank*0.55+engagementScore*0.45);
    return {...x,engagement_rate:Number(engagementRate.toFixed(4)),view_rank:viewRank,performance_score:composite};
  }).sort((a,b)=>b.performance_score-a.performance_score);
}

function summarizeDeterministic(rows){
  const views=rows.map(r=>r.views);
  const scores=rows.map(r=>r.performance_score);
  const lengths=rows.map(r=>r.body_chars);
  return {
    sample_count:rows.length,
    median_views:Math.round(median(views)),
    median_score:Math.round(median(scores)),
    median_body_chars:Math.round(median(lengths)),
    question_ratio:Math.round(rows.filter(r=>r.question).length/rows.length*100),
    choice_poll_ratio:Math.round(rows.filter(r=>r.choice_poll).length/rows.length*100),
    top_hours:[...new Set(rows.slice(0,6).map(r=>r.publish_hour_kst).filter(Number.isFinite))].slice(0,4),
    top_post_types:[...new Set(rows.slice(0,6).map(r=>r.post_type).filter(Boolean))].slice(0,4)
  };
}

async function analyzeWithAI(account,rows,summary){
  if(!process.env.OPENAI_API_KEY) return null;
  const top=rows.slice(0,5);
  const bottom=[...rows].sort((a,b)=>a.performance_score-b.performance_score).slice(0,5);

  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{
      "content-type":"application/json",
      "authorization":`Bearer ${process.env.OPENAI_API_KEY}`
    },
    body:JSON.stringify({
      model:process.env.OPENAI_LEARNING_MODEL||process.env.OPENAI_MODEL||"gpt-6-luna",
      reasoning:{effort:"low"},
      instructions:[
        "당신은 ROADER 계정별 콘텐츠 성과 분석기다.",
        "입력된 실제 성과 데이터만 근거로 전략을 만든다.",
        "조회수 절대값만 보지 말고 performance_score, engagement_rate, 반복적으로 나타나는 구조를 함께 본다.",
        "표본이 적으면 강한 결론을 내리지 않는다.",
        "한 번 잘 된 사례를 절대 규칙으로 만들지 않는다.",
        "성과가 좋은 패턴은 다음 글에서 우선 활용하되 같은 문구나 같은 주제를 복제하지 않는다.",
        "기본 전략은 검증 패턴 80%, 새로운 훅/주제 실험 20%다.",
        "투자 관련 사실이나 시장 전망을 새로 만들지 않는다. 오직 글쓰기 전략만 분석한다.",
        "JSON만 반환한다."
      ].join("\n"),
      input:JSON.stringify({
        account:{id:account.id,name:account.name,handle:account.handle,sector:account.sector},
        deterministic_summary:summary,
        top_posts:top,
        bottom_posts:bottom
      }),
      text:{format:{
        type:"json_schema",
        name:"roader_performance_strategy",
        strict:true,
        schema:{
          type:"object",
          additionalProperties:false,
          properties:{
            winning_patterns:{type:"array",items:{type:"string"},maxItems:6},
            avoid_patterns:{type:"array",items:{type:"string"},maxItems:6},
            preferred_post_types:{type:"array",items:{type:"string"},maxItems:4},
            preferred_hours_kst:{type:"array",items:{type:"integer"},maxItems:4},
            target_length_min:{type:"integer"},
            target_length_max:{type:"integer"},
            hook_guidance:{type:"string"},
            engagement_guidance:{type:"string"},
            exploration_ratio:{type:"integer"},
            rationale:{type:"string"}
          },
          required:[
            "winning_patterns","avoid_patterns","preferred_post_types","preferred_hours_kst",
            "target_length_min","target_length_max","hook_guidance","engagement_guidance",
            "exploration_ratio","rationale"
          ]
        }
      }}
    })
  });

  const data=await response.json().catch(()=>({}));
  if(!response.ok) return null;
  const output=data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("")||"";
  try{return JSON.parse(output);}catch{return null;}
}

export default async function handler(req,res){
  try{
    if(req.method!=="GET"&&req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});
    const secret=process.env.CRON_SECRET||"";
    if(!secret||String(req.headers.authorization||"")!==`Bearer ${secret}`){
      return res.status(401).json({ok:false,error:"unauthorized"});
    }

    await ensureSchema();
    const sql=client();
    const force=String(req.query?.force||"")==="1";

    const accounts=await sql(
      `select a.id,a.name,a.handle,a.sector,p.last_learned_at,p.sample_count as previous_sample_count
       from roader_accounts a
       left join roader_performance_profiles p on p.account_id=a.id
       where a.is_active=true
       order by a.id`
    );

    const results=[];

    for(const account of accounts){
      if(!force && account.last_learned_at && Date.now()-new Date(account.last_learned_at).getTime()<20*60*60*1000){
        results.push({account_id:account.id,status:"recently_learned"});
        continue;
      }

      const metricRows=await sql(
        `select p.id,p.post_type,p.body,p.generated_topic,p.published_at,
          m.captured_at,m.views,m.likes,m.replies,m.reposts,m.quotes,m.shares
         from roader_posts p
         join lateral (
           select *
           from roader_metrics rm
           where rm.post_id=p.id
           order by rm.captured_at desc
           limit 1
         ) m on true
         where p.account_id=$1
           and p.status='published'
           and p.published_at >= now()-interval '30 days'
           and m.captured_at >= p.published_at + interval '2 hours'
         order by p.published_at desc
         limit 80`,
        [account.id]
      );

      if(metricRows.length<6){
        results.push({account_id:account.id,status:"insufficient_data",sample_count:metricRows.length});
        continue;
      }

      const rows=performanceRows(metricRows);
      const summary=summarizeDeterministic(rows);
      const ai=await analyzeWithAI(account,rows,summary);

      const topLengths=rows.slice(0,Math.min(8,rows.length)).map(r=>r.body_chars);
      const fallbackMin=clamp(Math.round(median(topLengths)-60),140,430);
      const fallbackMax=clamp(Math.round(median(topLengths)+60),Math.max(fallbackMin+40,220),470);
      const strategy={
        version:1,
        basis:"account_performance_30d",
        generated_at:new Date().toISOString(),
        deterministic:summary,
        winning_patterns:ai?.winning_patterns||[],
        avoid_patterns:ai?.avoid_patterns||[],
        preferred_post_types:ai?.preferred_post_types||summary.top_post_types,
        preferred_hours_kst:ai?.preferred_hours_kst||summary.top_hours,
        target_length_min:clamp(Number(ai?.target_length_min||fallbackMin),120,440),
        target_length_max:clamp(Number(ai?.target_length_max||fallbackMax),220,470),
        hook_guidance:String(ai?.hook_guidance||"상위 성과 글의 짧고 분명한 도입 구조를 우선한다."),
        engagement_guidance:String(ai?.engagement_guidance||"자연스러운 질문으로 의견 참여를 유도한다."),
        exploration_ratio:clamp(Number(ai?.exploration_ratio??20),10,30),
        rationale:String(ai?.rationale||"실제 계정 성과 데이터를 기준으로 자동 계산된 전략")
      };
      if(strategy.target_length_min>=strategy.target_length_max){
        strategy.target_length_min=Math.max(120,strategy.target_length_max-80);
      }

      const confidence=clamp(35+metricRows.length*3,0,92);
      const lastMetric=metricRows.map(r=>new Date(r.captured_at).getTime()).reduce((a,b)=>Math.max(a,b),0);

      await sql(
        `insert into roader_performance_profiles
         (account_id,strategy,sample_count,confidence,last_metric_at,last_learned_at,updated_at)
         values ($1,$2::jsonb,$3,$4,$5,now(),now())
         on conflict(account_id) do update set
           strategy=excluded.strategy,sample_count=excluded.sample_count,confidence=excluded.confidence,
           last_metric_at=excluded.last_metric_at,last_learned_at=now(),updated_at=now()`,
        [account.id,JSON.stringify(strategy),metricRows.length,confidence,lastMetric?new Date(lastMetric).toISOString():null]
      );
      await sql(
        `insert into roader_learning_runs(account_id,sample_count,confidence,status,summary)
         values ($1,$2,$3,'completed',$4::jsonb)`,
        [account.id,metricRows.length,confidence,JSON.stringify({strategy,top_posts:rows.slice(0,3).map(x=>x.post_id)})]
      );

      results.push({account_id:account.id,status:"learned",sample_count:metricRows.length,confidence});
    }

    return res.status(200).json({ok:true,results});
  }catch(error){
    console.error("performance-learn",error);
    return res.status(500).json({ok:false,error:"learning_failed",details:String(error?.message||"")});
  }
}
