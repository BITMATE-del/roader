import { ensureSchema, client } from "../_db.mjs";

function extractOutputText(data){
  if(typeof data?.output_text==="string" && data.output_text.trim()) return data.output_text.trim();
  const parts=[];
  for(const item of data?.output||[]){
    for(const content of item?.content||[]){
      if(content?.type==="output_text" && typeof content.text==="string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function cleanHandle(v){
  return String(v||"").replace(/^@/,"");
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});
    if(!process.env.OPENAI_API_KEY) return res.status(503).json({ok:false,error:"openai_not_configured"});

    const body=req.body||{};
    const accountId=Number(body.account_id||0);
    if(!accountId) return res.status(400).json({ok:false,error:"account_id_required"});

    await ensureSchema();
    const sql=client();

    const rows=await sql(
      "select a.id,a.name,a.handle,a.sector,a.target_audience,a.tone,a.persona,coalesce(cp.style_rules,'{}'::jsonb) as style_rules,coalesce(cp.min_chars,180) as min_chars,coalesce(cp.max_chars,420) as max_chars,coalesce(sp.profile,'{}'::jsonb) as learned_style,coalesce(sp.confidence,0) as style_confidence from roader_accounts a left join roader_content_profiles cp on cp.account_id=a.id left join roader_style_profiles sp on sp.account_id=a.id where a.id=$1",
      [accountId]
    );
    const account=rows[0];
    if(!account) return res.status(404).json({ok:false,error:"account_not_found"});

    const recent=await sql(
      "select body from roader_posts where account_id=$1 and status='published' order by published_at desc nulls last,created_at desc limit 8",
      [accountId]
    );

    const postType=String(body.post_type||"정보형");
    const topic=String(body.topic||"").trim();
    const learned=account.learned_style||{};
    const mobile=account.style_rules?.mobile_format||{};
    const recentStarts=recent.map(r=>String(r.body||"").trim().slice(0,120)).filter(Boolean);

    const instructions=[
      "당신은 한국 Threads 투자·경제 정보 계정의 콘텐츠 에디터다.",
      "목표는 광고 티가 강한 글이 아니라, 실제 개인 투자자가 자신의 관점을 공유하는 자연스러운 한국어 글을 만드는 것이다.",
      "항상 1인칭은 '제가/저는'을 사용하고 '저희'는 사용하지 않는다.",
      "수익 보장, 급등 확정, 원금 보장, 100% 같은 단정적 투자 표현은 금지한다.",
      "사용자가 제공하지 않은 실시간 시세·등락률·수급 수치·뉴스 사실을 임의로 만들어내지 않는다.",
      "현재 시장 사실이 부족하면 구체적 숫자를 지어내지 말고 관점형/체크포인트형으로 작성한다.",
      "본문 구조: 시장 또는 섹터 흐름 → 대표 종목/맥락 → 이미 많이 오른 종목과 구분 → 제가 눈여겨보는 조건/구간/종목군 → 왜 보는지 → 독자 질문.",
      "핵심 후킹은 '이미 오른 종목보다 아직 본격적인 상승이 나오기 전 구간에서 수급·실적·모멘텀이 살아나는 종목을 보고 있다'는 관점으로 자연스럽게 녹인다.",
      "본문에서 특정 종목 매수를 권유하거나 상승을 확정하지 않는다.",
      "댓글은 본문을 반복하지 않는다. 제가 섹터와 종목을 수급·실적·모멘텀·시장 관심도 등으로 나눠 점수화해 보고 있다는 점을 설명하고, 궁금한 사람은 프로필에서 무료 정보를 확인해보라는 흐름으로 마무리한다.",
      "댓글도 과장된 광고 문구, VIP/급등주/수익보장 표현은 사용하지 않는다.",
      "모바일 가독성은 필수다: 한 문단 1~2문장, 문단 사이 빈 줄 1개, 긴 문장은 의미 단위로 줄바꿈, 질문과 CTA는 별도 문단.",
      "본문은 대체로 5~7개 문단으로 구성한다.",
      "본문과 댓글에 마크다운 굵게(**), 제목 기호(#), 불릿 남발을 사용하지 않는다.",
      "최근 실제 게시물의 시작 문장과 지나치게 유사한 도입부를 피한다.",
      "최종 출력은 지정된 JSON 스키마만 반환한다."
    ].join("\n");

    const context={
      account:{
        name:account.name,
        handle:cleanHandle(account.handle),
        sector:account.sector,
        target_audience:account.target_audience,
        tone:account.tone,
        persona:account.persona
      },
      requested_post_type:postType,
      user_topic_or_facts:topic||"별도 주제 입력 없음. 계정 섹터와 페르소나 범위에서 시의성 없는 관점형 소재를 선택할 것.",
      target_length:{min:account.min_chars,max:account.max_chars},
      mobile_format:mobile,
      learned_style:account.style_confidence>=50?learned:{},
      recent_published_openings:recentStarts
    };

    const model=process.env.OPENAI_MODEL||"gpt-5.4-mini";
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
        model,
        reasoning:{effort:"low"},
        instructions,
        input:JSON.stringify(context),
        text:{
          format:{
            type:"json_schema",
            name:"roader_threads_draft",
            strict:true,
            schema:{
              type:"object",
              additionalProperties:false,
              properties:{
                body:{type:"string"},
                reply:{type:"string"}
              },
              required:["body","reply"]
            }
          }
        }
      })
    });

    const data=await response.json().catch(()=>({}));
    if(!response.ok){
      const details=data?.error?.message||data?.message||"OpenAI request failed";
      console.error("ai-generate-openai",data);
      return res.status(502).json({ok:false,error:"generation_failed",details});
    }

    const output=extractOutputText(data);
    let parsed;
    try{ parsed=JSON.parse(output); }
    catch{
      console.error("ai-generate-parse",output);
      return res.status(502).json({ok:false,error:"generation_failed",details:"AI 응답 형식을 읽지 못했습니다."});
    }

    return res.status(200).json({
      ok:true,
      body:String(parsed.body||"").trim(),
      reply:String(parsed.reply||"").trim(),
      model
    });
  }catch(error){
    console.error("ai-generate-handler",error);
    return res.status(500).json({ok:false,error:"server_error",details:String(error?.message||"")});
  }
}
