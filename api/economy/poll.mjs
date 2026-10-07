import { ensureSchema, client } from "../_db.mjs";

const TE_KEY=process.env.TRADING_ECONOMICS_API_KEY||"";
const BOT_TOKEN=process.env.TELEGRAM_BOT_TOKEN||"";
const ALERT_CHAT_ID=process.env.ECONOMIC_ALERT_CHAT_ID||"";
const OPENAI_KEY=process.env.OPENAI_API_KEY||"";
const FED_SPEECH_RSS="https://www.federalreserve.gov/feeds/speeches.xml";

function esc(v=""){
  return String(v).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function stripHtml(v=""){
  return String(v)
    .replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ")
    .replace(/&amp;/g,"&")
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/\s+/g," ")
    .trim();
}

function xmlValue(block,tag){
  const m=String(block).match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,"i"));
  return m?stripHtml(m[1].replace(/^<!\[CDATA\[|\]\]>$/g,"")):"";
}

function dayUTC(offset=0){
  const d=new Date(Date.now()+offset*86400000);
  return d.toISOString().slice(0,10);
}

function num(v){
  const x=Number(String(v??"").replace(/[,\s%KMBT]/gi,""));
  return Number.isFinite(x)?x:null;
}

function indicatorDirection(actual,forecast){
  const a=num(actual),f=num(forecast);
  if(a===null||f===null) return "예상치 비교 불가";
  if(a>f) return "예상 상회";
  if(a<f) return "예상 하회";
  return "예상 부합";
}

function isMajorSpeech(title="",body=""){
  const t=(title+" "+body.slice(0,1000)).toLowerCase();
  return /(monetary policy|economic outlook|inflation|employment|labor market|interest rate|federal funds|dual mandate|economy|fomc)/i.test(t);
}

async function sendTelegram(text){
  if(!BOT_TOKEN||!ALERT_CHAT_ID) return {sent:false,reason:"destination_not_configured"};
  const r=await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({
      chat_id:ALERT_CHAT_ID,
      text,
      parse_mode:"HTML",
      disable_web_page_preview:true
    })
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.ok) throw new Error(data.description||"telegram_send_failed");
  return {sent:true};
}

async function aiAnalyzeIndicator(event){
  if(!OPENAI_KEY) return null;
  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${OPENAI_KEY}`},
    body:JSON.stringify({
      model:process.env.OPENAI_MODEL||"gpt-6-luna",
      reasoning:{effort:"low"},
      instructions:[
        "한국 투자자용 경제지표 속보 편집자다.",
        "입력된 실제/예상/이전 값만 사용하고 숫자를 절대 새로 만들지 않는다.",
        "2~4문장으로 아주 짧게 해석한다.",
        "주식, 미국 국채금리, 달러, BTC/코인에 미칠 수 있는 단기 방향을 과장 없이 설명한다.",
        "확정적 투자조언은 금지한다.",
        "JSON만 반환한다."
      ].join("\n"),
      input:JSON.stringify(event),
      text:{format:{
        type:"json_schema",name:"economic_release_analysis",strict:true,
        schema:{
          type:"object",additionalProperties:false,
          properties:{
            classification:{type:"string"},
            summary:{type:"string"},
            stocks:{type:"string"},
            bonds:{type:"string"},
            usd:{type:"string"},
            crypto:{type:"string"}
          },
          required:["classification","summary","stocks","bonds","usd","crypto"]
        }
      }}
    })
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) return null;
  const out=data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("")||"";
  try{return JSON.parse(out);}catch{return null;}
}

async function aiAnalyzeSpeech({title,sourceUrl,body}){
  if(!OPENAI_KEY) return null;
  const clipped=String(body||"").slice(0,18000);
  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"content-type":"application/json","authorization":`Bearer ${OPENAI_KEY}`},
    body:JSON.stringify({
      model:process.env.OPENAI_MODEL||"gpt-6-luna",
      reasoning:{effort:"low"},
      instructions:[
        "미 연준 공식 연설문을 한국 투자자용으로 분석한다.",
        "입력 원문에 있는 내용만 사용한다. 추정 발언을 만들지 않는다.",
        "통화정책과 시장에 의미 있는 핵심만 3개 이내로 요약한다.",
        "성격을 매파/중립/비둘기 중 하나 또는 중간값으로 분류한다.",
        "주식, 미국 국채금리, 달러, BTC/코인의 단기 시장 해석을 간결하게 적는다.",
        "규제·감독 등 통화정책과 무관한 연설이면 market_relevant=false로 반환한다.",
        "JSON만 반환한다."
      ].join("\n"),
      input:JSON.stringify({title,source_url:sourceUrl,body:clipped}),
      text:{format:{
        type:"json_schema",name:"fed_speech_analysis",strict:true,
        schema:{
          type:"object",additionalProperties:false,
          properties:{
            market_relevant:{type:"boolean"},
            classification:{type:"string"},
            summary:{type:"string"},
            key_points:{type:"array",items:{type:"string"},maxItems:3},
            stocks:{type:"string"},
            bonds:{type:"string"},
            usd:{type:"string"},
            crypto:{type:"string"}
          },
          required:["market_relevant","classification","summary","key_points","stocks","bonds","usd","crypto"]
        }
      }}
    })
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) return null;
  const out=data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("")||"";
  try{return JSON.parse(out);}catch{return null;}
}

function indicatorMessage(e,a){
  const compare=indicatorDirection(e.actual,e.forecast);
  const analysis=a?.summary||"발표값을 확인했습니다. 시장의 실제 반응을 함께 확인할 구간입니다.";
  return [
    "🚨 <b>부의 길잡이 | 경제지표 속보</b>",
    "",
    `🇺🇸 <b>${esc(e.event_name)}</b>`,
    "",
    `실제 <b>${esc(e.actual||"-")}</b>`,
    `예상 <b>${esc(e.forecast||"-")}</b>`,
    `이전 <b>${esc(e.previous||"-")}</b>`,
    `결과 <b>${esc(compare)}</b>`,
    "",
    `📌 ${esc(analysis)}`,
    a?"":null,
    a?`주식 ${esc(a.stocks)} · 국채금리 ${esc(a.bonds)}`:null,
    a?`달러 ${esc(a.usd)} · 코인 ${esc(a.crypto)}`:null
  ].filter(v=>v!==null).join("\n");
}

function speechMessage(e,a){
  const points=(a?.key_points||[]).map(x=>`• ${esc(x)}`).join("\n");
  return [
    "🚨 <b>부의 길잡이 | 연준 주요 발언</b>",
    "",
    `🇺🇸 <b>${esc(e.event_name)}</b>`,
    a?.classification?`성격 <b>${esc(a.classification)}</b>`:"",
    "",
    points||esc(a?.summary||"연설 원문이 새로 공개되었습니다."),
    "",
    a?.summary?`📌 ${esc(a.summary)}`:"",
    a?`주식 ${esc(a.stocks)} · 국채금리 ${esc(a.bonds)}`:"",
    a?`달러 ${esc(a.usd)} · 코인 ${esc(a.crypto)}`:""
  ].filter(Boolean).join("\n");
}

async function pollTradingEconomics(sql){
  if(!TE_KEY) return {ok:false,reason:"TRADING_ECONOMICS_API_KEY_missing",events:0,alerts:0};
  const start=dayUTC(-1),end=dayUTC(1);
  const url=`https://api.tradingeconomics.com/calendar/country/united%20states/${start}/${end}?c=${encodeURIComponent(TE_KEY)}&importance=3&values=true&f=json&lang=ko`;
  const r=await fetch(url,{headers:{"accept":"application/json"}});
  if(!r.ok) throw new Error(`trading_economics_${r.status}`);
  const rows=await r.json();
  let alerts=0,events=0;

  for(const x of Array.isArray(rows)?rows:[]){
    const externalId=String(x.CalendarId||x.CalendarID||x.Ticker||x.Symbol||"").trim();
    if(!externalId) continue;
    const actual=String(x.Actual??"").trim();
    const old=await sql("select * from roader_economic_events where provider='tradingeconomics' and external_id=$1",[externalId]);
    const prev=old[0]||null;
    const status=actual?"released":"scheduled";

    const saved=await sql(
      `insert into roader_economic_events
       (provider,external_id,event_kind,event_time,country,category,event_name,importance,actual,previous,forecast,unit,source_url,provider_updated_at,status,raw_data,result_detected_at,updated_at)
       values ('tradingeconomics',$1,'indicator',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,case when $7<>'' then now() else null end,now())
       on conflict(provider,external_id) do update set
         event_time=excluded.event_time,country=excluded.country,category=excluded.category,event_name=excluded.event_name,
         importance=excluded.importance,actual=excluded.actual,previous=excluded.previous,forecast=excluded.forecast,
         unit=excluded.unit,source_url=excluded.source_url,provider_updated_at=excluded.provider_updated_at,
         status=excluded.status,raw_data=excluded.raw_data,
         result_detected_at=case when roader_economic_events.result_detected_at is null and excluded.actual<>'' then now() else roader_economic_events.result_detected_at end,
         updated_at=now()
       returning *`,
      [
        externalId,x.Date||null,String(x.Country||""),String(x.Category||""),String(x.Event||x.Category||"경제지표"),
        Number(x.Importance||0),actual,String(x.Previous??""),String(x.Forecast??""),String(x.Unit??""),
        String(x.SourceURL||""),x.LastUpdate||null,status,JSON.stringify(x)
      ]
    );
    events++;
    const e=saved[0];
    const justReleased=actual && (!prev||!String(prev.actual||"").trim());
    const eventAge=Math.abs(Date.now()-new Date(e.event_time||0).getTime());
    const bootstrapRecent=!prev && eventAge<=15*60*1000;

    if((justReleased||bootstrapRecent)&&!e.alert_sent_at){
      const analysis=await aiAnalyzeIndicator(e);
      const msg=indicatorMessage(e,analysis);
      const sent=await sendTelegram(msg);
      await sql(
        `update roader_economic_events
         set ai_summary=$1,ai_classification=$2,market_impact=$3::jsonb,alert_sent_at=case when $4 then now() else alert_sent_at end,updated_at=now()
         where id=$5`,
        [analysis?.summary||null,analysis?.classification||compareFallback(e),JSON.stringify(analysis||{}),!!sent.sent,e.id]
      );
      if(sent.sent) alerts++;
    }
  }
  return {ok:true,events,alerts};
}

function compareFallback(e){
  return indicatorDirection(e.actual,e.forecast);
}

async function pollFedSpeeches(sql){
  const hadRows=await sql("select 1 from roader_economic_events where provider='federalreserve' limit 1");
  const bootstrap=hadRows.length===0;
  const r=await fetch(FED_SPEECH_RSS,{headers:{"user-agent":"ROADER/1.0 economic-event-monitor"}});
  if(!r.ok) throw new Error(`fed_rss_${r.status}`);
  const xml=await r.text();
  const items=xml.match(/<item>[\s\S]*?<\/item>/gi)||[];
  let events=0,alerts=0;

  for(const item of items.slice(0,20)){
    const title=xmlValue(item,"title");
    const link=xmlValue(item,"link");
    const guid=xmlValue(item,"guid")||link||title;
    const pubDate=xmlValue(item,"pubDate");
    if(!guid||!title) continue;

    const old=await sql("select * from roader_economic_events where provider='federalreserve' and external_id=$1",[guid]);
    if(old[0]) continue;

    let speechBody="";
    if(link){
      try{
        const page=await fetch(link,{headers:{"user-agent":"ROADER/1.0 economic-event-monitor"}});
        if(page.ok) speechBody=stripHtml(await page.text());
      }catch{}
    }

    const major=isMajorSpeech(title,speechBody);
    const rows=await sql(
      `insert into roader_economic_events
       (provider,external_id,event_kind,event_time,country,category,event_name,importance,source_url,status,raw_data,result_detected_at,updated_at)
       values ('federalreserve',$1,'speech',$2,'United States','Federal Reserve Speech',$3,$4,$5,'released',$6::jsonb,now(),now())
       on conflict(provider,external_id) do nothing
       returning *`,
      [guid,pubDate||null,title,major?3:1,link,JSON.stringify({title,link,pubDate})]
    );
    if(!rows[0]) continue;
    events++;
    const e=rows[0];

    if(bootstrap||!major) continue;
    const analysis=await aiAnalyzeSpeech({title,sourceUrl:link,body:speechBody});
    if(analysis && !analysis.market_relevant){
      await sql(
        "update roader_economic_events set ai_summary=$1,ai_classification=$2,market_impact=$3::jsonb,updated_at=now() where id=$4",
        [analysis.summary,analysis.classification,JSON.stringify(analysis),e.id]
      );
      continue;
    }
    const sent=await sendTelegram(speechMessage(e,analysis));
    await sql(
      `update roader_economic_events
       set ai_summary=$1,ai_classification=$2,market_impact=$3::jsonb,alert_sent_at=case when $4 then now() else null end,updated_at=now()
       where id=$5`,
      [analysis?.summary||null,analysis?.classification||null,JSON.stringify(analysis||{}),!!sent.sent,e.id]
    );
    if(sent.sent) alerts++;
  }
  return {ok:true,events,alerts,bootstrap};
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

    const results={};
    try{ results.calendar=await pollTradingEconomics(sql); }
    catch(e){ results.calendar={ok:false,error:String(e.message||e)}; }
    try{ results.fed_speeches=await pollFedSpeeches(sql); }
    catch(e){ results.fed_speeches={ok:false,error:String(e.message||e)}; }

    return res.status(200).json({
      ok:true,
      telegram_destination_configured:!!ALERT_CHAT_ID,
      trading_economics_configured:!!TE_KEY,
      results
    });
  }catch(error){
    console.error("economy-poll",error);
    return res.status(500).json({ok:false,error:"economy_poll_failed",details:String(error?.message||"")});
  }
}
