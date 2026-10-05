const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const INFO_ROOM_URL = process.env.INFO_ROOM_URL || "";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "";

const API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : "";

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
  const r = await fetch(`${API}/${method}`, {
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
  return (source || "direct").slice(0, 40);
}

function ageButtons(source) {
  return kb([
    [
      { text: "30대 이하", callback_data: `age|u30|${source}` },
      { text: "40대", callback_data: `age|40|${source}` }
    ],
    [
      { text: "50대", callback_data: `age|50|${source}` },
      { text: "60대 이상", callback_data: `age|60p|${source}` }
    ]
  ]);
}

function interestButtons(age, source) {
  return kb([
    [
      { text: "국내주식", callback_data: `int|kr|${age}|${source}` },
      { text: "미국주식", callback_data: `int|us|${age}|${source}` }
    ],
    [
      { text: "경제/거시", callback_data: `int|macro|${age}|${source}` },
      { text: "코인", callback_data: `int|crypto|${age}|${source}` }
    ],
    [{ text: "전체", callback_data: `int|all|${age}|${source}` }]
  ]);
}

function expButtons(age, interest, source) {
  return kb([
    [
      { text: "처음", callback_data: `exp|new|${age}|${interest}|${source}` },
      { text: "1년 미만", callback_data: `exp|lt1|${age}|${interest}|${source}` }
    ],
    [
      { text: "1~3년", callback_data: `exp|1to3|${age}|${interest}|${source}` },
      { text: "3년 이상", callback_data: `exp|3p|${age}|${interest}|${source}` }
    ]
  ]);
}

function sourceLabel(source) {
  if (!source || source === "direct") return "직접 유입";
  if (source.startsWith("threads")) return `Threads · ${source}`;
  return source;
}

async function start(message) {
  const source = parseSource(message.text || "");
  const name = esc(message.from?.first_name || "회원");

  await send(
    message.chat.id,
    `🧭 <b>부의 길잡이</b>에 오신 것을 환영합니다.\n\n` +
      `${name}님께 주식 · 경제 · 코인 시장에서 중요한 정보만 선별해서 전달합니다.\n\n` +
      `무료 정보방 입장을 원하시면 아래 버튼을 눌러 신청해주세요.`,
    {
      reply_markup: kb([
        [{ text: "✅ 무료 정보방 신청하기", callback_data: `apply|${source}` }]
      ])
    }
  );
}

async function isAdmin(userId) {
  const member = await tg("getChatMember", {
    chat_id: ADMIN_CHAT_ID,
    user_id: userId
  });

  return ["creator", "administrator"].includes(member.status);
}

async function submit(query, age, interest, exp, source) {
  const user = query.from;
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || "미입력";
  const username = user.username ? `@${user.username}` : "없음";

  const now = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());

  await send(
    ADMIN_CHAT_ID,
    `🧭 <b>부의 길잡이 신규 신청</b>\n\n` +
      `👤 이름 : <b>${esc(fullName)}</b>\n` +
      `🪪 Telegram : <b>${esc(username)}</b>\n` +
      `🔢 User ID : <code>${user.id}</code>\n` +
      `🎂 연령 : <b>${AGE_LABELS[age]}</b>\n` +
      `📊 관심분야 : <b>${INTEREST_LABELS[interest]}</b>\n` +
      `📈 투자경험 : <b>${EXP_LABELS[exp]}</b>\n` +
      `🔗 유입경로 : <b>${esc(sourceLabel(source))}</b>\n` +
      `🕒 신청시간 : <b>${esc(now)}</b>`,
    {
      reply_markup: kb([
        [
          { text: "✅ 승인", callback_data: `adm|ok|${user.id}` },
          { text: "❌ 거절", callback_data: `adm|no|${user.id}` }
        ]
      ])
    }
  );

  await edit(
    query.message.chat.id,
    query.message.message_id,
    "✅ <b>신청이 완료되었습니다.</b>\n\n관리자 확인 후 이 봇으로 결과를 안내드리겠습니다."
  );
}

async function callback(query) {
  const parts = (query.data || "").split("|");
  const action = parts[0];

  if (action === "apply") {
    const source = parts[1] || "direct";
    await answer(query.id);
    return edit(
      query.message.chat.id,
      query.message.message_id,
      "📝 <b>1/3 · 연령대를 선택해주세요.</b>",
      { reply_markup: ageButtons(source) }
    );
  }

  if (action === "age") {
    const [, age, source = "direct"] = parts;
    await answer(query.id);
    return edit(
      query.message.chat.id,
      query.message.message_id,
      "📝 <b>2/3 · 관심 분야를 선택해주세요.</b>",
      { reply_markup: interestButtons(age, source) }
    );
  }

  if (action === "int") {
    const [, interest, age, source = "direct"] = parts;
    await answer(query.id);
    return edit(
      query.message.chat.id,
      query.message.message_id,
      "📝 <b>3/3 · 투자 경험을 선택해주세요.</b>",
      { reply_markup: expButtons(age, interest, source) }
    );
  }

  if (action === "exp") {
    const [, exp, age, interest, source = "direct"] = parts;
    await answer(query.id, "신청서를 접수합니다.");
    return submit(query, age, interest, exp, source);
  }

  if (action === "adm") {
    const [, decision, targetUserId] = parts;

    if (!(await isAdmin(query.from.id))) {
      return answer(query.id, "관리자만 처리할 수 있습니다.");
    }

    const approved = decision === "ok";
    const resultText = approved ? "✅ 승인 완료" : "❌ 거절";

    await answer(query.id, resultText);

    await edit(
      query.message.chat.id,
      query.message.message_id,
      `${esc(query.message.text || "신청서")}\n\n<b>처리결과 : ${resultText}</b>\n처리자 : ${esc(query.from.first_name || String(query.from.id))}`
    );

    if (approved) {
      await send(
        targetUserId,
        INFO_ROOM_URL
          ? "🎉 <b>신청이 승인되었습니다.</b>\n\n아래 버튼을 눌러 정보방에 입장해주세요."
          : "🎉 <b>신청이 승인되었습니다.</b>\n\n관리자가 정보방 입장 안내를 보내드리겠습니다.",
        INFO_ROOM_URL
          ? {
              reply_markup: kb([
                [{ text: "🧭 정보방 입장하기", url: INFO_ROOM_URL }]
              ])
            }
          : {}
      );
    } else {
      await send(
        targetUserId,
        "신청 검토가 완료되었습니다.\n현재는 정보방 입장이 보류되었습니다."
      );
    }

    return;
  }

  return answer(query.id);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "roader-telegram-application"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    return res.status(500).json({ ok: false, error: "missing_environment" });
  }

  if (WEBHOOK_SECRET) {
    const secret = req.headers["x-telegram-bot-api-secret-token"];
    if (secret !== WEBHOOK_SECRET) {
      return res.status(401).json({ ok: false, error: "invalid_secret" });
    }
  }

  try {
    const update = req.body || {};

    if (update.message?.text?.startsWith("/start")) {
      await start(update.message);
    } else if (update.callback_query) {
      await callback(update.callback_query);
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(200).json({ ok: false, error: "handler_error" });
  }
}
