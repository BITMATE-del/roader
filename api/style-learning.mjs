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
  const exclaimPosts=posts.filter(t=>/!/.test(t)).length;
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
  const avgLines=Math.round((lineCounts.reduce((a,b)=>a+b,0)/(posts.length||1))*10)/10;
  const avgParas=Math.round((paraCounts.reduce((a,b)=>a+b,0)/(posts.length||1))*10)/10;
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
    avg_lines:avgLines,
    avg_paragraphs:avgParas,
    question_post_ratio:pct(questionPosts,posts.length),
    closing_question_ratio:pct(closingQuestion,posts.length),
    exclamation_ratio:pct(exclaimPosts,posts.length),
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

async function rebuildProfile(sql, accountId){
  const samples=await sql("select body from roader_style_samples where account_id=$1 order by created_at desc limit 200",[accountId]);
  const profile=analyze(samples);
  const confidence=clamp(35+profile.sample_count*5,0,95);

  await sql(
    "insert into roader_style_profiles (account_id,profile,sample_count,confidence,updated_at) values ($1,$2::jsonb,$3,$4,now()) on conflict (account_id) do update set profile=excluded.profile,sample_count=excluded.sample_count,confidence=excluded.confidence,updated_at=now()",
    [accountId,JSON.stringify(profile),profile.sample_count,confidence]
  );
  await sql(
    "update roader_content_profiles set style_rules = coalesce(style_rules,'{}'::jsonb) || jsonb_build_object('learned_style',$1::jsonb), updated_at=now() where account_id=$2",
    [JSON.stringify(profile),accountId]
  );
  return {profile,confidence};
}

export default async function handler(req,res){
  try{
    await ensureSchema();
    const sql=client();

    if(req.method==="GET"){
      const accountId=Number(req.query?.account_id||0);
      if(!accountId) return res.status(400).json({ok:false,error:"account_id_required"});
      const [sources,profile,samples]=await Promise.all([
        sql("select * from roader_style_sources where account_id=$1 order by created_at asc",[accountId]),
        sql("select * from roader_style_profiles where account_id=$1",[accountId]),
        sql("select id,source_id,body,created_at from roader_style_samples where account_id=$1 order by created_at desc limit 50",[accountId])
      ]);
      return res.status(200).json({ok:true,sources,profile:profile[0]||null,samples});
    }

    if(req.method==="POST"){
      const b=req.body||{};
      const accountId=Number(b.account_id||0);
      if(!accountId) return res.status(400).json({ok:false,error:"account_id_required"});

      if(b.action==="add_source"){
        const handle=String(b.source_handle||"").trim();
        if(!handle) return res.status(400).json({ok:false,error:"source_handle_required"});
        const rows=await sql(
          "insert into roader_style_sources (account_id,source_handle,label) values ($1,$2,$3) on conflict (account_id,source_handle) do update set label=excluded.label,is_active=true,updated_at=now() returning *",
          [accountId,handle,String(b.label||"")]
        );
        return res.status(201).json({ok:true,source:rows[0]});
      }

      if(b.action==="learn"){
        const handle=String(b.source_handle||"").trim();
        const raw=Array.isArray(b.samples)?b.samples:[];
        const samples=raw.map(x=>String(x||"").trim()).filter(x=>x.length>=20);
        if(!handle||!samples.length) return res.status(400).json({ok:false,error:"source_and_samples_required"});

        const sourceRows=await sql(
          "insert into roader_style_sources (account_id,source_handle,label) values ($1,$2,$3) on conflict (account_id,source_handle) do update set is_active=true,updated_at=now() returning *",
          [accountId,handle,String(b.label||"")]
        );
        const source=sourceRows[0];

        let inserted=0;
        for(const body of samples){
          const hash=crypto.createHash("sha256").update(body.replace(/\s+/g," ").trim()).digest("hex");
          const rows=await sql(
            "insert into roader_style_samples (account_id,source_id,body,sample_hash) values ($1,$2,$3,$4) on conflict (source_id,sample_hash) do nothing returning id",
            [accountId,source.id,body,hash]
          );
          if(rows.length) inserted++;
        }
        const rebuilt=await rebuildProfile(sql,accountId);
        return res.status(200).json({ok:true,inserted,...rebuilt});
      }

      if(b.action==="rebuild"){
        const rebuilt=await rebuildProfile(sql,accountId);
        return res.status(200).json({ok:true,...rebuilt});
      }

      return res.status(400).json({ok:false,error:"invalid_action"});
    }

    return res.status(405).json({ok:false,error:"method_not_allowed"});
  }catch(error){
    console.error("style-learning",error);
    return res.status(500).json({ok:false,error:"server_error"});
  }
}
