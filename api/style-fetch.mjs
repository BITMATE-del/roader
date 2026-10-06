import crypto from "node:crypto";
import { ensureSchema, client } from "./_db.mjs";

function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,n));}
function median(nums){
  if(!nums.length) return 0;
  const a=[...nums].sort((x,y)=>x-y),m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function pct(n,d){return d?Math.round((n/d)*100):0;}

function analyze(samples){
  const posts=samples.map(s=>String(s.body||"").trim()).filter(Boolean);
  const chars=posts.map(t=>t.length);
  const lineCounts=posts.map(t=>t.split("\n").filter(Boolean).length);
  const paraCounts=posts.map(t=>t.split(/\n\s*\n/).filter(x=>x.trim()).length);
  const questionPosts=posts.filter(t=>/[?？]/.test(t)).length;
  const closingQuestion=posts.filter(t=>/[?？]\s*$/.test(t)).length;
  const emojiPosts=posts.filter(t=>/\p{Extended_Pictographic}/u.test(t)).length;
  const vsPosts=posts.filter(t=>/\bvs\b|대|선택하시겠|어디를 선택/i.test(t)).length;
  const numbered=posts.filter(t=>/(^|\n)\s*(?:\d+[.)]|[-•▪️✅📌])\s*/m.test(t)).length;
  const shortOpen=posts.filter(t=>{
    const first=(t.split("\n").find(Boolean)||"").trim();
    return first.length>0&&first.length<=32;
  }).length;
  const veryShortLines=posts.reduce((acc,t)=>acc+t.split("\n").filter(x=>x.trim()&&x.trim().length<=22).length,0);
  const totalLines=lineCounts.reduce((a,b)=>a+b,0);
  const avgChars=Math.round(chars.reduce((a,b)=>a+b,0)/(posts.length||1));
  const styleTags=[];
  if(avgChars<180) styleTags.push("짧고 빠른 전개");
  else if(avgChars<380) styleTags.push("중간 길이");
  else styleTags.push("설명형 장문");
  if(pct(shortOpen,posts.length)>=60) styleTags.push("짧은 첫 문장 훅");
  if(pct(questionPosts,posts.length)>=45) styleTags.push("질문형 상호작용");
  if(pct(closingQuestion,posts.length)>=35) styleTags.push("질문으로 마무리");
  if(pct(numbered,posts.length)>=30) styleTags.push("목록/포인트 정리");
  if(pct(emojiPosts,posts.length)>=35) styleTags.push("이모지 활용");
  if(pct(vsPosts,posts.length)>=20) styleTags.push("비교형 소재");
  if(totalLines&&veryShortLines/totalLines>=.45) styleTags.push("짧은 줄바꿈 중심");

  return {
    sample_count:posts.length,
    avg_chars:avgChars,
    median_chars:Math.round(median(chars)),
    avg_lines:Math.round((lineCounts.reduce((a,b)=>a+b,0)/(posts.length||1))*10)/10,
    avg_paragraphs:Math.round((paraCounts.reduce((a,b)=>a+b,0)/(posts.length||1))*10)/10,
    question_post_ratio:pct(questionPosts,posts.length),
    closing_question_ratio:pct(closingQuestion,posts.length),
    emoji_ratio:pct(emojiPosts,posts.length),
    comparison_ratio:pct(vsPosts,posts.length),
    numbered_structure_ratio:pct(numbered,posts.length),
    short_hook_ratio:pct(shortOpen,posts.length),
    short_line_ratio: totalLines ? Math.round((veryShortLines/totalLines)*100) : 0,
    style_tags:styleTags,
    writing_rules:{
      target_length: avgChars<180 ? "120~220자" : avgChars<380 ? "180~420자" : "300~650자",
      opening: pct(shortOpen,posts.length)>=60 ? "첫 줄은 32자 이내의 짧은 훅을 우선" : "첫 문장에서 주제를 분명히 제시",
      line_breaks: totalLines&&veryShortLines/totalLines>=.45 ? "모바일 가독성을 위해 짧은 줄바꿈을 자주 사용" : "문단 단위 줄바꿈",
      ending: pct(closingQuestion,posts.length)>=35 ? "마무리에 의견 질문을 자연스럽게 사용" : "요약 또는 관점 제시로 마무리",
      emoji: pct(emojiPosts,posts.length)>=35 ? "이모지는 포인트 용도로 제한적으로 사용" : "이모지는 최소화",
      structure: pct(numbered,posts.length)>=30 ? "핵심 포인트는 목록 구조 허용" : "자연스러운 서술형 우선"
    }
  };
}

async function rebuild(sql,accountId){
  const samples=await sql("select body from roader_style_samples where account_id=$1 order by created_at desc limit 200",[accountId]);
  const profile=analyze(samples);
  const confidence=clamp(35+profile.sample_count*5,0,95);
  await sql(
    "insert into roader_style_profiles (account_id,profile,sample_count,confidence,updated_at) values ($1,$2::jsonb,$3,$4,now()) on conflict (account_id) do update set profile=excluded.profile,sample_count=excluded.sample_count,confidence=excluded.confidence,updated_at=now()",
    [accountId,JSON.stringify(profile),profile.sample_count,confidence]
  );
  await sql(
    "update roader_content_profiles set style_rules=coalesce(style_rules,'{}'::jsonb)||jsonb_build_object('learned_style',$1::jsonb),updated_at=now() where account_id=$2",
    [JSON.stringify(profile),accountId]
  );
  return {profile,confidence};
}

async function fetchPublicPosts(username, token){
  const params = new URLSearchParams({
    username,
    fields:"id,text,permalink,timestamp,media_type",
    limit:"50",
    access_token:token
  });
  const response = await fetch("https://graph.threads.net/v1.0/profile_posts?"+params.toString());
  const data = await response.json().catch(()=>({}));
  if(!response.ok){
    const message=data?.error?.message||"threads_api_error";
    const err=new Error(message);
    err.code=data?.error?.code;
    throw err;
  }
  return Array.isArray(data?.data)?data.data:[];
}

export default async function handler(req,res){
  try{
    await ensureSchema();
    if(req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});

    const token=process.env.THREADS_ACCESS_TOKEN;
    if(!token) return res.status(503).json({ok:false,error:"threads_access_token_missing"});

    const b=req.body||{};
    const accountId=Number(b.account_id||0);
    const sourceHandle=String(b.source_handle||"").trim().replace(/^@/,"");
    if(!accountId||!sourceHandle) return res.status(400).json({ok:false,error:"account_and_source_required"});

    const sql=client();
    const sourceRows=await sql(
      "insert into roader_style_sources (account_id,source_handle,label) values ($1,$2,$3) on conflict (account_id,source_handle) do update set is_active=true,updated_at=now() returning *",
      [accountId,"@"+sourceHandle,String(b.label||"")]
    );
    const source=sourceRows[0];

    try{
      const posts=await fetchPublicPosts(sourceHandle,token);
      const textPosts=posts.map(p=>String(p?.text||"").trim()).filter(t=>t.length>=20);

      let inserted=0;
      for(const body of textPosts){
        const hash=crypto.createHash("sha256").update(body.replace(/\s+/g," ").trim()).digest("hex");
        const rows=await sql(
          "insert into roader_style_samples (account_id,source_id,body,sample_hash) values ($1,$2,$3,$4) on conflict (source_id,sample_hash) do nothing returning id",
          [accountId,source.id,body,hash]
        );
        if(rows.length) inserted++;
      }

      await sql(
        "update roader_style_sources set last_synced_at=now(),last_sync_count=$1,last_error=null,updated_at=now() where id=$2",
        [textPosts.length,source.id]
      );

      const rebuilt=await rebuild(sql,accountId);
      return res.status(200).json({
        ok:true,
        source_handle:"@"+sourceHandle,
        fetched:posts.length,
        usable:textPosts.length,
        inserted,
        ...rebuilt
      });
    }catch(error){
      await sql(
        "update roader_style_sources set last_error=$1,updated_at=now() where id=$2",
        [String(error?.message||"threads_api_error").slice(0,500),source.id]
      );
      const permission = String(error?.message||"").toLowerCase().includes("permission");
      return res.status(permission?403:502).json({
        ok:false,
        error:permission?"threads_profile_discovery_required":"threads_fetch_failed",
        message:String(error?.message||"threads_api_error")
      });
    }
  }catch(error){
    console.error("style-fetch",error);
    return res.status(500).json({ok:false,error:"server_error"});
  }
}
