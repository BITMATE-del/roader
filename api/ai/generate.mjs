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

function sanitizeVisibleText(value){
  return String(value||"")
    .replace(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/gi,"")
    .replace(/https?:\/\/\S+/gi,"")
    .replace(/\bwww\.\S+/gi,"")
    .replace(/\[[a-z0-9.-]+\]/gi,"")
    .replace(/(^|\n)\s*(출처|source)\s*:\s*.*(?=\n|$)/gi,"$1")
    .replace(/[ \t]+\n/g,"\n")
    .replace(/\n{3,}/g,"\n\n")
    .trim();
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
      "select a.id,a.name,a.handle,a.sector,a.target_audience,a.tone,a.persona,coalesce(cp.style_rules,'{}'::jsonb) as style_rules,coalesce(cp.min_chars,180) as min_chars,coalesce(cp.max_chars,420) as max_chars,coalesce(cp.type_mix,'{}'::jsonb) as type_mix,coalesce(sp.profile,'{}'::jsonb) as learned_style,coalesce(sp.confidence,0) as style_confidence from roader_accounts a left join roader_content_profiles cp on cp.account_id=a.id left join roader_style_profiles sp on sp.account_id=a.id where a.id=$1",
      [accountId]
    );
    const account=rows[0];
    if(!account) return res.status(404).json({ok:false,error:"account_not_found"});

    const recent=await sql(
      "select post_type,body,published_at from roader_posts where account_id=$1 and status='published' order by published_at desc nulls last,created_at desc limit 12",
      [accountId]
    );

    const requestedType=String(body.post_type||"").trim();
    const topicOverride=String(body.topic||"").trim();
    const learned=account.learned_style||{};
    const mobile=account.style_rules?.mobile_format||{};

    const recentPosts=recent.map(r=>({
      post_type:r.post_type,
      opening:String(r.body||"").trim().slice(0,180),
      published_at:r.published_at
    }));

    const instructions=[
      "당신은 한국 Threads 주식·경제·코인 계정의 자동 콘텐츠 에디터다.",
      "사용자가 매번 소재를 정하지 않아도 되도록, 계정 페르소나와 섹터에 맞는 오늘의 소재를 직접 찾고 선정하는 것이 핵심 임무다.",
      "특정 주제 override가 비어 있으면 반드시 웹 검색을 사용해 최신 공개 시장 정보와 뉴스를 확인한 뒤 소재를 선정한다.",
      "소재 선정 우선순위: 계정 섹터 적합성, 오늘 시의성, 투자자가 왜 봐야 하는지 설명할 여지, 최근 게시물과 비중복, 과도한 단기 시세 추종 회피.",
      "단순 뉴스 복붙이 아니라 '왜 중요한지 / 무엇을 체크해야 하는지 / 이미 오른 종목과 아직 관심이 덜 붙은 구간을 어떻게 구분하는지'를 개인 관점으로 풀어낸다.",
      "뉴스·시장 사실은 검색으로 확인된 내용만 사용한다. 확인되지 않은 숫자, 등락률, 외국인 수급, 실적 수치, 발표 내용은 만들지 않는다.",
      "중요: 검색 출처는 사실 확인용일 뿐 사용자에게 보이는 본문이나 댓글에 절대 노출하지 않는다.",
      "본문과 댓글에는 URL, 도메인명, [출처], 출처:, source:, 마크다운 링크, 괄호 안 링크를 절대 넣지 않는다.",
      "최종 사용자 텍스트에는 오직 자연스러운 한국어 본문과 댓글만 남긴다.",
      "검색 결과가 엇갈리면 단정하지 말고 확인 가능한 사실 수준으로 표현한다.",
      "항상 1인칭은 '제가/저는'을 사용하고 '저희'는 사용하지 않는다.",
      "수익 보장, 급등 확정, 원금 보장, 100%, 무조건 오른다 같은 표현은 금지한다.",
      "특정 종목의 상승을 확정하거나 매수를 직접 권유하지 않는다.",
      "본문은 모바일에서 읽기 쉬워야 한다: 한 문단 1~2문장, 문단 사이 빈 줄 1개, 긴 문장은 의미 단위 줄바꿈, 질문은 별도 문단.",
      "본문은 대체로 5~7개 문단으로 구성한다.",
      "본문 구조의 기본 골격: 오늘 시장/섹터 핵심 흐름 → 대표 종목 또는 이슈 맥락 → 단순 추격과 구분 → 제가 실제로 체크하는 조건/구간 → 이유/체크포인트 → 독자 질문.",
      "항상 같은 문구를 기계적으로 반복하지 말고 소재에 맞춰 자연스럽게 변형한다.",
      "최근 실제 게시물의 도입부와 소재가 겹치면 다른 소재를 선택한다.",
      "댓글은 본문 반복이 아니라 프로필 유입용 1차 댓글이다.",
      "댓글은 단순 설명형 CTA보다 궁금증 유발형 CTA를 우선한다.",
      "댓글 기본 구조: '본문에는 시장 흐름 위주로 적었다' → '실제로는 모든 종목을 같은 기준으로 보지 않는다' → '수급·실적·모멘텀·시장 관심도를 따로 보고 조건이 겹치는 종목만 추린다' → '아직 관심이 크게 붙기 전 구간의 종목을 따로 보고 있다' → '현재 체크 중인 섹터와 종목은 프로필에서 무료로 확인할 수 있다'.",
      "댓글에서 '제가 따로 추려서 보고 있다', '조건별로 우선순위를 나눠 본다', '본문에 다 적지 않은 추가 정보가 있다'는 느낌을 자연스럽게 만든다.",
      "단, VIP, 급등주, 수익보장, 무조건 오른다, 비밀정보처럼 과장되거나 오해를 부르는 표현은 금지한다.",
      "프로필 CTA는 너무 딱딱하게 '확인하세요'로 끝내지 말고 '무료로 확인해보셔도 됩니다', '무료 정보 한번 받아가셔도 됩니다'처럼 자연스럽고 부드럽게 마무리한다.",
      "광고처럼 과장하지 말고 정보 계정의 자연스러운 추가 안내처럼 작성한다.",
      "마크다운 굵게(**), 제목 기호(#), 과도한 이모지와 불릿은 사용하지 않는다.",
      "최종 출력은 지정된 JSON 스키마만 반환한다."
    ].join("\n");

    const context={
      current_date:new Date().toISOString().slice(0,10),
      account:{
        name:account.name,
        handle:cleanHandle(account.handle),
        sector:account.sector,
        target_audience:account.target_audience,
        tone:account.tone,
        persona:account.persona
      },
      automation_mode:topicOverride ? "user_override" : "auto_discovery",
      topic_override:topicOverride||null,
      preferred_post_type:requestedType||null,
      content_mix:account.type_mix||{},
      target_length:{min:account.min_chars,max:account.max_chars},
      mobile_format:mobile,
      learned_style:account.style_confidence>=50?learned:{},
      recent_published_posts:recentPosts
    };

    const model=process.env.OPENAI_MODEL||"gpt-6-luna";
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
        tools:[{
          type:"web_search",
          search_context_size:"medium"
        }],
        tool_choice:topicOverride ? "auto" : "required",
        text:{
          format:{
            type:"json_schema",
            name:"roader_threads_draft",
            strict:true,
            schema:{
              type:"object",
              additionalProperties:false,
              properties:{
                selected_topic:{type:"string"},
                body:{type:"string"},
                reply:{type:"string"}
              },
              required:["selected_topic","body","reply"]
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
      selected_topic:sanitizeVisibleText(parsed.selected_topic||""),
      body:sanitizeVisibleText(parsed.body||""),
      reply:sanitizeVisibleText(parsed.reply||""),
      model
    });
  }catch(error){
    console.error("ai-generate-handler",error);
    return res.status(500).json({ok:false,error:"server_error",details:String(error?.message||"")});
  }
}
