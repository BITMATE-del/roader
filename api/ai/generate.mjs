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

function splitSentenceNaturally(sentence,maxChars=76){
  const text=String(sentence||"").trim();
  if(!text||text.length<=maxChars) return [text];

  const candidates=[
    ", ","다만 ","반대로 ","반면 ","특히 ","때문에 ","그래서 ",
    "하지만 ","그러나 ","이라면 ","하면 ","라면 ","면서 ","는데 ","지만 "
  ];

  let best=-1;
  for(const token of candidates){
    const pos=text.lastIndexOf(token,maxChars+8);
    if(pos>=34) best=Math.max(best,pos+token.length);
  }

  if(best<34) return [text];

  const first=text.slice(0,best).trim();
  const second=text.slice(best).trim();
  return [first,second].filter(Boolean);
}

function sentenceList(paragraph){
  const matches=String(paragraph||"").match(/[^.!?。！？]+(?:[.!?。！？]+|$)/g)||[];
  return matches.map(v=>v.trim()).filter(Boolean);
}

function formatMobileText(value){
  const clean=sanitizeVisibleText(value);
  if(!clean) return "";

  const paragraphs=[];

  for(const rawParagraph of clean.split(/\n{2,}/)){
    const sentences=sentenceList(rawParagraph.replace(/\n+/g," "));
    if(!sentences.length) continue;

    let bucket=[];
    for(const sentence of sentences){
      const parts=splitSentenceNaturally(sentence,76);
      for(const part of parts){
        bucket.push(part);
        if(bucket.length===2){
          paragraphs.push(bucket.join("\n"));
          bucket=[];
        }
      }
    }

    if(bucket.length) paragraphs.push(bucket.join("\n"));
  }

  return paragraphs.join("\n\n").replace(/\n{3,}/g,"\n\n").trim();
}


function normalizeTicker(v){
  return String(v||"").trim().toUpperCase().replace(/[^A-Z0-9]/g,"");
}

async function fetchUpbitKrwTicker(symbol){
  const s=normalizeTicker(symbol);
  if(!s) return null;
  try{
    const r=await fetch("https://api.upbit.com/v1/ticker?markets=KRW-"+encodeURIComponent(s),{
      headers:{"accept":"application/json"}
    });
    if(!r.ok) return null;
    const rows=await r.json().catch(()=>[]);
    const t=Array.isArray(rows)?rows[0]:null;
    if(!t) return null;
    return {
      market:t.market,
      symbol:s,
      trade_price:Number(t.trade_price),
      high_price:Number(t.high_price),
      low_price:Number(t.low_price),
      opening_price:Number(t.opening_price),
      signed_change_price:Number(t.signed_change_price),
      signed_change_rate:Number(t.signed_change_rate),
      acc_trade_price_24h:Number(t.acc_trade_price_24h),
      timestamp:Number(t.timestamp)
    };
  }catch{
    return null;
  }
}

async function regenerateCryptoWithLivePrice({model,instructions,context,parsed,live}){
  const correctionContext={
    ...context,
    selected_topic:parsed.selected_topic||"",
    selected_symbol:parsed.symbol||live.symbol,
    authoritative_live_market_data:{
      source:"UPBIT public ticker API",
      market:live.market,
      current_price_krw:live.trade_price,
      day_high_krw:live.high_price,
      day_low_krw:live.low_price,
      opening_price_krw:live.opening_price,
      change_price_krw:live.signed_change_price,
      change_rate_percent:Number((live.signed_change_rate*100).toFixed(2)),
      timestamp_ms:live.timestamp
    },
    correction_rule:"현재가·당일 고가·당일 저가·등락률은 위 UPBIT 실시간 값만 사용하고, 웹검색의 오래된 가격 숫자는 현재가처럼 쓰지 않는다."
  };

  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{
      "content-type":"application/json",
      "authorization":`Bearer ${process.env.OPENAI_API_KEY}`
    },
    body:JSON.stringify({
      model,
      reasoning:{effort:"low"},
      instructions:instructions+"\n코인 가격 숫자는 입력된 authoritative_live_market_data를 최우선으로 사용한다. 현재가를 임의로 추정하거나 웹검색 값으로 덮어쓰지 않는다.",
      input:JSON.stringify(correctionContext),
      tools:[{type:"web_search",search_context_size:"medium"}],
      tool_choice:"auto",
      text:{
        format:{
          type:"json_schema",
          name:"roader_threads_draft_corrected",
          strict:true,
          schema:{
            type:"object",
            additionalProperties:false,
            properties:{
              selected_topic:{type:"string"},
              symbol:{type:"string"},
              body:{type:"string"},
              reply:{type:"string"}
            },
            required:["selected_topic","symbol","body","reply"]
          }
        }
      }
    })
  });

  const data=await r.json().catch(()=>({}));
  if(!r.ok) return null;
  const output=extractOutputText(data);
  try{return JSON.parse(output);}catch{return null;}
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
      "select post_type,body,published_at from roader_posts where account_id=$1 and status='published' order by published_at desc nulls last,created_at desc limit 24",
      [accountId]
    );

    const requestedType=String(body.post_type||"").trim();
    const topicOverride=String(body.topic||"").trim();
    const learned=account.learned_style||{};
    const mobile=account.style_rules?.mobile_format||{};
    const sectorText=String(account.sector||"").toLowerCase();
    const isCrypto=/코인|crypto|가상자산|암호화폐/.test(sectorText);

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
      "본문은 모바일에서 읽기 쉬워야 한다. 한 문단은 보통 1~2문장으로 구성하되 모든 문장을 억지로 짧게 끊지 않는다. 짧은 문장과 중간 길이 문장을 섞어 자연스러운 리듬을 만든다. 글자 수 때문에 문장 중간을 자르지 말고 완전한 문장이 끝난 뒤에만 줄바꿈한다. 질문은 별도 문단으로 둔다.",
      "본문은 대체로 5~7개 문단으로 구성한다.",
      "본문 구조의 기본 골격: 오늘 시장/섹터 핵심 흐름 → 대표 종목 또는 이슈 맥락 → 단순 추격과 구분 → 제가 실제로 체크하는 조건/구간 → 이유/체크포인트 → 독자 질문.",
      "항상 같은 문구를 기계적으로 반복하지 말고 소재에 맞춰 자연스럽게 변형한다.",
      "첫 문장은 반드시 짧고 강한 후킹 문장으로 쓴다. 18~36자 안쪽을 우선하고, 설명형 서두보다 '지금 이 코인을 봐야 하는 이유', '가격이 갈릴 핵심 구간', '시장이 아직 덜 반영한 변수'처럼 독자가 다음 문장을 보게 만드는 내용을 먼저 던진다.",
      "첫 문장 다음에 바로 가격이나 전망 핵심을 연결한다. '며칠 새 올랐습니다' 같은 평범한 사실 전달로 시작하지 않는다.",
      "말투는 기사·리서치 보고서처럼 딱딱하게 쓰지 않는다. 실제 개인 투자자가 Threads에서 말하듯 쉽고 자연스럽게 쓴다.",
      "'~입니다/~합니다/~됩니다' 같은 종결어미를 연속으로 반복하지 않는다. '~죠', '~보입니다', '~볼 수 있습니다', '~가능성이 있습니다', '~체크해볼 만합니다'처럼 자연스럽게 섞는다.",
      "최근 실제 게시물의 도입부와 소재가 겹치면 다른 소재를 선택한다.",
      "댓글은 본문 반복이 아니라 프로필 유입용 1차 댓글이다.",
      "댓글은 단순 설명형 CTA보다 궁금증 유발형 CTA를 우선한다.",
      "댓글 기본 구조: '본문에는 시장 흐름 위주로 적었다' → '실제로는 모든 종목을 같은 기준으로 보지 않는다' → '수급·실적·모멘텀·시장 관심도를 따로 보고 조건이 겹치는 종목만 추린다' → '아직 관심이 크게 붙기 전 구간의 종목을 따로 보고 있다' → '현재 체크 중인 섹터와 종목은 프로필에서 무료로 확인할 수 있다'.",
      "댓글에서 '제가 따로 추려서 보고 있다', '조건별로 우선순위를 나눠 본다', '본문에 다 적지 않은 추가 정보가 있다'는 느낌을 자연스럽게 만든다.",
      "단, VIP, 급등주, 수익보장, 무조건 오른다, 비밀정보처럼 과장되거나 오해를 부르는 표현은 금지한다.",
      "프로필 CTA는 너무 딱딱하게 '확인하세요'로 끝내지 말고 '무료로 확인해보셔도 됩니다', '무료 정보 한번 받아가셔도 됩니다'처럼 자연스럽고 부드럽게 마무리한다.",
      "광고처럼 과장하지 말고 정보 계정의 자연스러운 추가 안내처럼 작성한다.",
      "마크다운 굵게(**), 제목 기호(#), 과도한 이모지와 불릿은 사용하지 않는다.",
      "최종 출력은 지정된 JSON 스키마만 반환한다.",
      "코인 소재라면 symbol 필드에는 거래소에서 사용하는 영문 티커만 넣는다. 예: ORCA, ADA, SOL. 코인 소재가 아니면 빈 문자열로 둔다.",
      ...(isCrypto ? [
        "이 계정은 코인 전용 전망 계정이다. 단순 뉴스 요약이 아니라 '현재 가격이 어디쯤이고, 앞으로 어떻게 볼 것인지'까지 설명해야 한다.",
        "비트코인을 습관적으로 첫 소재로 선택하지 않는다. 최근 24~72시간 코인 시장에서 실제로 관심이 증가한 종목·테마 후보를 여러 개 찾고, 가격과 전망을 설명할 가치가 높은 소재를 고른다.",
        "후보는 알트코인, L1/L2, AI·DePIN·RWA·게임·밈·DEX·스테이블코인·디파이·프라이버시·인프라 등 현재 시장에서 실제로 움직이는 영역을 폭넓게 본다.",
        "본문에는 가능하면 검색으로 확인한 최신 현재가 또는 최근 거래 가격대를 자연스럽게 포함한다. 가격 숫자는 반드시 최신 공개 시장 정보로 확인된 값만 쓰고 임의로 만들지 않는다.",
        "코인 가격은 한국 독자 기준으로 반드시 원화(KRW) 중심으로 표기한다. 달러·USDT 가격만 확인되는 경우 최신 환율을 검색해 원화로 환산하고, 필요하면 괄호 안에 달러 가격을 보조로 짧게 붙인다.",
        "환산 가격은 과도한 소수점 대신 한국 투자자가 읽기 쉬운 단위로 반올림한다. 예: 3,420원, 12만 8천원, 1억 2,300만원.",
        "단순히 '올랐다/내렸다'에서 끝내지 말고 최근 며칠 또는 최근 구간에서 가격이 어떻게 움직였는지 짧게 설명한다.",
        "해당 코인이나 섹터에 최근 24~72시간 내 가격에 영향을 줄 만한 핵심 이슈가 있으면 반드시 확인한다. 상장, 네트워크 업그레이드, 파트너십, 규제, ETF, 토큰 언락, 공급 변화, 온체인 흐름, 거래소 이슈, 개발 일정, 보안 사고 등을 포함한다.",
        "핵심 이슈가 확인되면 단순 뉴스 요약으로 끝내지 말고 '이 이슈가 왜 가격에 영향을 줄 수 있는지'와 '효과가 이어질 조건 또는 소멸할 조건'까지 전망과 연결한다.",
        "관련 이슈가 특별히 없으면 억지로 뉴스를 끼워 넣지 않는다. 대신 가격·거래량·수급·기술적 위치 중심으로 전망한다.",
        "왜 움직였는지 설명한 뒤 반드시 앞으로의 방향성을 다룬다. 독자가 '그래서 이 코인이 앞으로 어떻게 될 것 같은데?'라는 질문에 답을 얻어야 한다.",
        "전망은 긍정 시나리오와 경계 시나리오를 함께 제시한다. 예: 이 가격대를 지키면 추가 상승 가능성, 특정 구간을 넘기면 추세 강화, 반대로 지지가 깨지면 단기 조정 가능성.",
        "가능하면 검색으로 확인 가능한 주요 지지·저항·최근 고점·최근 저점 같은 가격 기준을 활용한다. 확인되지 않은 임의 목표가나 허위 숫자는 절대 만들지 않는다.",
        "이미 급등한 코인은 뒤늦게 추격을 권하지 않는다. 대신 지금 위치가 추격 구간인지, 눌림을 기다릴 구간인지, 추세 확인 구간인지 설명한다.",
        "BTC/ETH는 전체 시장 방향 설명이 꼭 필요할 때만 메인 소재로 쓰고, 그렇지 않으면 알트코인이나 섹터 전망을 우선한다.",
        "최근 게시물과 같은 코인·같은 내러티브를 반복하지 않는다. 새롭게 강한 근거가 없으면 다른 소재로 바꾼다.",
        "본문 기본 구조는 '후킹 → 현재 원화 가격/최근 흐름 → 최근 핵심 이슈가 있으면 그 영향 → 왜 움직였는지 → 앞으로의 상승 시나리오 → 하락·조정 시나리오 → 제가 보는 핵심 가격/조건 → 독자 질문'이다.",
        "본문을 읽은 사람이 이 코인의 현재 위치와 앞으로 확인해야 할 가격 조건을 바로 이해할 수 있어야 한다.",
        "마지막은 매수 권유가 아니라 제가 보는 조건과 판단 기준을 남긴다.",
        "검색 결과가 빈약하면 억지 전망을 만들지 말고 불확실성을 명시하고 관망 조건을 설명한다."
      ] : [])
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
      content_strategy:isCrypto ? "crypto_outlook_analysis" : "general_market_discovery",
      crypto_mode:isCrypto,
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
          search_context_size:isCrypto?"high":"medium"
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
                symbol:{type:"string"},
                body:{type:"string"},
                reply:{type:"string"}
              },
              required:["selected_topic","symbol","body","reply"]
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

    let liveMarket=null;
    if(isCrypto){
      liveMarket=await fetchUpbitKrwTicker(parsed.symbol);
      if(liveMarket){
        const corrected=await regenerateCryptoWithLivePrice({model,instructions,context,parsed,live:liveMarket});
        if(corrected) parsed=corrected;
      }
    }

    return res.status(200).json({
      ok:true,
      selected_topic:sanitizeVisibleText(parsed.selected_topic||""),
      symbol:normalizeTicker(parsed.symbol||""),
      body:formatMobileText(parsed.body||""),
      reply:formatMobileText(parsed.reply||""),
      live_market:liveMarket,
      model
    });
  }catch(error){
    console.error("ai-generate-handler",error);
    return res.status(500).json({ok:false,error:"server_error",details:String(error?.message||"")});
  }
}
