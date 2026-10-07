function extractOutputText(data){
  if(typeof data?.output_text==="string") return data.output_text;
  const chunks=[];
  for(const item of data?.output||[]){
    for(const content of item?.content||[]){
      if(typeof content?.text==="string") chunks.push(content.text);
    }
  }
  return chunks.join("");
}

export default async function handler(req,res){
  try{
    if(req.method!=="POST") return res.status(405).json({ok:false,error:"method_not_allowed"});
    if(!process.env.OPENAI_API_KEY) return res.status(503).json({ok:false,error:"openai_not_configured"});

    const b=req.body||{};
    const body=String(b.body||"").trim();
    const reply=String(b.reply||"").trim();
    if(!body) return res.status(400).json({ok:false,error:"body_required"});

    const blockers=Array.isArray(b.blockers)?b.blockers.map(String).slice(0,8):[];
    const metrics=b.metrics&&typeof b.metrics==="object"?b.metrics:{};
    const isCrypto=!!b.is_crypto;

    const model=process.env.OPENAI_REPAIR_MODEL||process.env.OPENAI_MODEL||"gpt-6-luna";
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":`Bearer ${process.env.OPENAI_API_KEY}`
      },
      body:JSON.stringify({
        model,
        reasoning:{effort:"low"},
        instructions:[
          "당신은 ROADER Threads 초안 품질 보정 편집자다.",
          "새 소재를 찾거나 웹검색하지 않는다. 입력된 글의 사실·가격·숫자·날짜·코인명·이슈를 절대 바꾸거나 새로 만들지 않는다.",
          "오직 품질검사에서 부족한 항목만 최소 수정한다.",
          "본문은 380~460자를 목표로 하며 절대 470자를 넘지 않는다. 댓글은 180~280자, 최대 300자다.",
          "첫 줄은 8~38자 정도의 후킹 문장으로 유지한다.",
          "본문은 5~7개 문단, 한 문단 1~2문장, 문단 사이 빈 줄.",
          "마지막 문단은 자연스럽게 의견을 묻는 질문으로 끝낸다.",
          isCrypto
            ?"코인 글이면 원화 가격, 지지/저항 또는 돌파/이탈 조건, 확인된 거래량·RSI·EMA·이슈를 보존한다. 가능하면 마지막에 1/2 선택형 의견 질문을 유지한다."
            :"핵심 주장과 근거를 보존한다.",
          "AI가 쓴 티, 번역체, 기사 번역체, 리서치 보고서체를 절대 만들지 않는다.",
          "영문 원문 구조를 따라가지 말고 한국인이 Threads에서 직접 쓰는 자연스러운 어순으로 다듬는다.",
          "'제가 보는 핵심은', '확인할 만합니다', '이어질 수 있다고 봅니다', '가능성이 있습니다', '주목해야 할 점은', '여러분은 어떻게 보시나요?' 같은 상투적 AI/리포트 표현은 쓰지 않는다.",
          "입력 계정의 반말/존댓말 톤을 유지한다. 말투를 임의로 바꾸지 않는다.",
          "같은 '~입니다/~합니다/~됩니다' 종결을 연속 반복하지 않는다."
          "수익보장·무조건 상승·100%·급등 확정 표현을 추가하지 않는다.",
          "blockers와 metrics에서 낮은 항목만 보완하고 이미 좋은 부분은 건드리지 않는다.",
          "JSON만 반환한다."
        ].join("\n"),
        input:JSON.stringify({
          body,
          reply,
          blockers,
          metrics
        }),
        text:{
          format:{
            type:"json_schema",
            name:"roader_quality_repair",
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
      return res.status(502).json({
        ok:false,
        error:"repair_failed",
        details:data?.error?.message||data?.message||"OpenAI request failed"
      });
    }

    const output=extractOutputText(data);
    const parsed=JSON.parse(output);
    return res.status(200).json({
      ok:true,
      body:String(parsed.body||"").trim(),
      reply:String(parsed.reply||"").trim()
    });
  }catch(error){
    console.error("ai-repair",error);
    return res.status(500).json({ok:false,error:"repair_failed",details:String(error?.message||"")});
  }
}
