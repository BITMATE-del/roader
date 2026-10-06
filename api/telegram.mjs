import { ensureSchema, client } from "./_db.mjs";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

const API = BOT_TOKEN ? "https://api.telegram.org/bot" + BOT_TOKEN : "";

const AGE_LABELS = {
  u30: "30대 이하",
  "40": "40대",
  "50": "50대",
  "60p": "60대 이상"
};

const INTEREST_LABELS = {
  kr: "국내주식",
  us: "미국주식",
  macro: "경제/거시",
  crypto: "코인",
  all: "전체"
};

const EXP_LABELS = {
  new: "처음",
  lt1: "1년 미만",
  "1to3": "1~3년",
  "3p": "3년 이상"
};

function kb(rows) {
  return { inline_keyboard: rows };
}

function esc(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function tg(method, payload) {
  const r = await fetch(API + "/" + method, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.description || method);
  return data.result;
}

async function send(chat_id, text, extra = {}) {
  return tg("sendMessage", {
    chat_id,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra
  });
}

async function edit(chat_id, message_id, text, extra = {}) {
  return tg("editMessageText", {
    chat_id,
    message_id,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra
  });
}

async function answer(callback_query_id, text) {
  return tg("answerCallbackQuery", {
    callback_query_id,
    text: text || undefined
  });
}

function parseSource(text = "") {
  const [, source] = text.trim().split(/\s+/);
  return (source || "direct").slice(0, 80);
}

function ageButtons(source) {
  return kb([
    [
      { text: "30대 이하", callback_data: "age|u30|" + source },
      { text: "40대", callback_data: "age|40|" + source }
    ],
    [
      { text: "50대", callback_data: "age|50|" + source },
      { text: "60대 이상", callback_data: "age|60p|" + source }
    ]
  ]);
}

function interestButtons(age, source) {
  return kb([
    [
      { text: "국내주식", callback_data: "int|kr|" + age + "|" + source },
      { text: "미국주식", callback_data: "int|us|" + age + "|" + source }
    ],
    [
      { text: "경제/거시", callback_data: "int|macro|" + age + "|" + source },
      { text: "코인", callback_data: "int|crypto|" + age + "|" + source }
    ],
    [{ text: "전체", callback_data: "int|all|" + age + "|" + source }]
  ]);
}

function expButtons(age, interest, source) {
  return kb([
    [
      { text: "처음", callback_data: "exp|new|" + age + "|" + interest + "|" + source },
      { text: "1년 미만", callback_data: "exp|lt1|" + age + "|" + interest + "|" + source }
    ],
    [
      { text: "1~3년", callback_data: "exp|1to3|" + age + "|" + interest + "|" + source },
      { text: "3년 이상", callback_data: "exp|3p|" + age + "|" + interest + "|" + source }
    ]
  ]);
}

function sourceLabel(source) {
  if (!source || source === "direct") return "직접 유입";
  if (source.startsWith("threads")) return "Threads · " + source;
  return source;
}

function prettyReceipt(raw) {
  const s=String(raw||"").replace(/\D/g,"").padStart(6,"0").slice(-6);
  return s.slice(0,3) + "-" + s.slice(3);
}

async function makeReceipt(sql) {
  for(let i=0;i<20;i++){
    const raw=String(Math.floor(100000+Math.random()*900000));
    const receipt=prettyReceipt(raw);
    const exists=await sql("select 1 from roader_leads where receipt_number=$1 limit 1",[receipt]);
    if(!exists.length) return receipt;
  }
  const fallback=String(Date.now()).slice(-6);
  return prettyReceipt(fallback);
}

async function start(message) {
  const source = parseSource(message.text || "");
  const name = esc(message.from?.first_name || "회원");

  await send(
    message.chat.id,
    "🧭 <b>무료 정보 신청</b>\n\n" +
      name + "님, 간단한 신청 정보를 확인한 뒤\n상담원이 직접 연락드려 정보방 안내를 도와드립니다.\n\n" +
      "신청을 원하시면 아래 버튼을 눌러주세요.",
    {
      reply_markup: kb([
        [{ text: "✅ 무료 정보 신청하기", callback_data: "apply|" + source }]
      ])
    }
  );
}

async function authorizedAdmin(userId) {
  const adminId=String(ADMIN_CHAT_ID||"");
  if(!adminId) return false;
  if(!adminId.startsWith("-")) return String(userId)===adminId;
  try{
    const member=await tg("getChatMember",{chat_id:ADMIN_CHAT_ID,user_id:userId});
    return ["creator","administrator"].includes(member.status);
  }catch{
    return false;
  }
}

async function resolveSourcePost(sql,source){
  if(!source || source==="direct") return null;
  const numeric=String(source).match(/post[_-]?(\d+)$/i);
  if(numeric){
    const rows=await sql("select id from roader_posts where id=$1 limit 1",[Number(numeric[1])]);
    if(rows[0]) return rows[0].id;
  }
  return null;
}

async function submit(query, age, interest, exp, source) {
  await ensureSchema();
  const sql=client();
  const user=query.from;
  const fullName=[user.first_name,user.last_name].filter(Boolean).join(" ")||"미입력";
  const username=user.username ? "@" + user.username : null;

  const existing=await sql(
    "select * from roader_leads where telegram_user_id=$1 and status in ('pending','contacting') order by created_at desc limit 1",
    [String(user.id)]
  );

  let lead=existing[0];
  if(!lead){
    const receipt=await makeReceipt(sql);
    const sourcePostId=await resolveSourcePost(sql,source);
    const rows=await sql(
      "insert into roader_leads (telegram_user_id,receipt_number,telegram_username,display_name,age_group,interest,experience,source_code,source_post_id,status) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending') returning *",
      [
        String(user.id),receipt,username,fullName,
        AGE_LABELS[age]||age,INTEREST_LABELS[interest]||interest,EXP_LABELS[exp]||exp,
        source||"direct",sourcePostId
      ]
    );
    lead=rows[0];
  }

  const now=new Intl.DateTimeFormat("ko-KR",{
    timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",hour12:false
  }).format(new Date());

  await send(
    ADMIN_CHAT_ID,
    "🧭 <b>신규 상담 신청 접수</b>\n\n" +
      "🔖 접수번호 : <b>" + esc(lead.receipt_number) + "</b>\n" +
      "👤 이름 : <b>" + esc(fullName) + "</b>\n" +
      "🪪 Telegram : <b>" + esc(username||"없음") + "</b>\n" +
      "🔢 User ID : <code>" + user.id + "</code>\n" +
      "🎂 연령 : <b>" + esc(AGE_LABELS[age]||age) + "</b>\n" +
      "📊 관심분야 : <b>" + esc(INTEREST_LABELS[interest]||interest) + "</b>\n" +
      "📈 투자경험 : <b>" + esc(EXP_LABELS[exp]||exp) + "</b>\n" +
      "🔗 유입경로 : <b>" + esc(sourceLabel(source)) + "</b>\n" +
      "🕒 신청시간 : <b>" + esc(now) + "</b>",
    {
      reply_markup: kb([[
        { text: "✅ 상담 완료", callback_data: "adm|done|" + lead.id },
        { text: "⏸ 보류", callback_data: "adm|hold|" + lead.id }
      ]])
    }
  );

  await edit(
    query.message.chat.id,
    query.message.message_id,
    "✅ <b>신청이 정상적으로 접수되었습니다.</b>\n\n" +
      "정보방 안내를 도와드릴 상담원이\n확인 후 직접 연락드릴 예정입니다.\n\n" +
      "🔖 <b>접수번호</b>\n" +
      "<code>" + esc(lead.receipt_number) + "</code>\n\n" +
      "상담원에게 연락이 오면\n<b>위 접수번호를 말씀해주세요.</b>\n\n" +
      "접수번호는 상담 확인을 위해 필요하니\n안내가 완료될 때까지 보관해주세요."
  );
}

async function callback(query) {
  const parts=(query.data||"").split("|");
  const action=parts[0];

  if(action==="apply"){
    const source=parts[1]||"direct";
    await answer(query.id);
    return edit(query.message.chat.id,query.message.message_id,"📝 <b>1/3 · 연령대를 선택해주세요.</b>",{reply_markup:ageButtons(source)});
  }

  if(action==="age"){
    const [,age,source="direct"]=parts;
    await answer(query.id);
    return edit(query.message.chat.id,query.message.message_id,"📝 <b>2/3 · 관심 분야를 선택해주세요.</b>",{reply_markup:interestButtons(age,source)});
  }

  if(action==="int"){
    const [,interest,age,source="direct"]=parts;
    await answer(query.id);
    return edit(query.message.chat.id,query.message.message_id,"📝 <b>3/3 · 투자 경험을 선택해주세요.</b>",{reply_markup:expButtons(age,interest,source)});
  }

  if(action==="exp"){
    const [,exp,age,interest,source="direct"]=parts;
    await answer(query.id,"신청서를 접수합니다.");
    return submit(query,age,interest,exp,source);
  }

  if(action==="adm"){
    const [,decision,leadId]=parts;
    if(!(await authorizedAdmin(query.from.id))){
      return answer(query.id,"관리자만 처리할 수 있습니다.");
    }

    await ensureSchema();
    const sql=client();
    const status=decision==="done" ? "completed" : "hold";
    const rows=await sql(
      "update roader_leads set status=$1,processed_by=$2,processed_at=now() where id=$3 returning *",
      [status,String(query.from.username||query.from.first_name||query.from.id),Number(leadId)]
    );
    const lead=rows[0];
    if(!lead) return answer(query.id,"신청내역을 찾지 못했습니다.");

    const resultText=decision==="done" ? "✅ 상담 완료" : "⏸ 보류";
    await answer(query.id,resultText);
    return edit(
      query.message.chat.id,
      query.message.message_id,
      esc(query.message.text||"신청서") +
        "\n\n<b>처리결과 : " + resultText + "</b>\n" +
        "처리자 : " + esc(query.from.first_name||String(query.from.id))
    );
  }

  return answer(query.id);
}

export default async function handler(req,res){
  if(req.method==="GET"){
    return res.status(200).json({ok:true,service:"roader-telegram-application"});
  }
  if(req.method!=="POST") return res.status(405).json({ok:false});

  if(!BOT_TOKEN||!ADMIN_CHAT_ID){
    return res.status(500).json({ok:false,error:"missing_environment"});
  }

  if(WEBHOOK_SECRET){
    const secret=req.headers["x-telegram-bot-api-secret-token"];
    if(secret!==WEBHOOK_SECRET) return res.status(401).json({ok:false,error:"invalid_secret"});
  }

  try{
    const update=req.body||{};
    if(update.message?.text?.startsWith("/start")) await start(update.message);
    else if(update.callback_query) await callback(update.callback_query);
    return res.status(200).json({ok:true});
  }catch(e){
    console.error("telegram-handler",e);
    return res.status(200).json({ok:false,error:"handler_error"});
  }
}
