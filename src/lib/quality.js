const bannedPatterns = [
  /무조건\s*오른/i,
  /확정\s*수익/i,
  /수익\s*보장/i,
  /급등\s*확정/i,
  /원금\s*보장/i,
  /100%/i
];

const aiTics = [
  "결론부터 말씀드리면",
  "주목해야 할 점은",
  "중요한 것은 바로",
  "단순히 ~가 아니라",
  "여러분은 어떻게 생각하시나요?"
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function paragraphStats(text) {
  const blocks = text.split(/\n\s*\n/).map(v => v.trim()).filter(Boolean);
  const sentenceCounts = blocks.map(block => {
    const matches = block.match(/[^.!?。！？]+(?:[.!?。！？]+|$)/g) || [];
    return matches.map(v => v.trim()).filter(Boolean).length;
  });
  return {
    blocks,
    count: blocks.length,
    overloaded: sentenceCounts.filter(n => n > 2).length,
    maxSentences: sentenceCounts.length ? Math.max(...sentenceCounts) : 0
  };
}

function lineStats(text) {
  const lines = text.split("\n").map(v => v.trim()).filter(Boolean);
  const lengths = lines.map(v => v.length);
  return {
    lines,
    avg: lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0,
    max: lengths.length ? Math.max(...lengths) : 0,
    long: lengths.filter(v => v > 88).length,
    veryLong: lengths.filter(v => v > 110).length
  };
}

export function scorePost({ text = "", mediaMode = "text", hasImage = false, recentTexts = [] }) {
  const trimmed = text.trim();

  if (!trimmed) {
    return {
      score: 0,
      status: "empty",
      blockers: [],
      metrics: {
        hook: 0, readability: 0, substance: 0, engagement: 0,
        naturalness: 0, duplicate: 0, visual: 0, safety: 0
      }
    };
  }

  const chars = trimmed.length;
  const paragraphs = paragraphStats(trimmed);
  const lines = lineStats(trimmed);
  const firstLine = lines.lines[0] || "";
  const lastParagraph = paragraphs.blocks[paragraphs.blocks.length - 1] || "";
  const hasQuestion = /[?？]|궁금|어디|어떻게|어떤 이유|선택|여러분|생각/.test(lastParagraph);
  const banned = bannedPatterns.filter(r => r.test(trimmed)).map(r => r.source);
  const aiTickHits = aiTics.filter(t => trimmed.includes(t)).length;

  let hook = 45;
  if (firstLine.length >= 8 && firstLine.length <= 38) hook += 25;
  if (/지금|오늘|하나만|vs|왜|체크|먼저|기준|돌파|지지|저항|이탈|핵심|가격대/.test(firstLine)) hook += 20;
  if (firstLine.length > 72) hook -= 20;
  hook = clamp(hook);

  let readability = 42;
  if (lines.avg >= 8 && lines.avg <= 34) readability += 18;
  else if (lines.avg <= 42) readability += 10;
  if (lines.max <= 88) readability += 12;
  if (paragraphs.count >= 5) readability += 24;
  else if (paragraphs.count >= 3) readability += 14;
  else if (paragraphs.count === 2) readability += 6;
  readability -= Math.min(24, lines.long * 5);
  readability -= Math.min(30, lines.veryLong * 12);
  readability -= Math.min(30, paragraphs.overloaded * 12);
  readability = clamp(readability);

  let substance = 35;
  if (chars >= 120) substance += 20;
  if (chars >= 180) substance += 15;
  if (/이유|때문|기준|수요|실적|금리|수급|흐름|시장|리스크|반면|모멘텀|업황|현재가|가격|가격대|지지|저항|돌파|이탈|거래량|RSI|EMA|ETF|온체인|언락|고점|저점|조정|반등/.test(trimmed)) substance += 20;
  if (/\d[\d,]*원/.test(trimmed) && /(돌파|지지|저항|이탈)/.test(trimmed) && /(가능성|재확인|조정|상승|반등)/.test(trimmed)) substance += 10;
  if (chars < 70) substance -= 30;
  substance = clamp(substance);

  let engagement = 45;
  if (hasQuestion) engagement += 30;
  if (/vs|선택|여러분|생각|의견|→\s*1|→\s*2|1번|2번/.test(trimmed)) engagement += 15;
  if (/(돌파|지지).{0,40}→\s*1/.test(trimmed) && /(이탈|조정).{0,40}→\s*2/.test(trimmed)) engagement += 10;
  engagement = clamp(engagement);

  let naturalness = 88 - aiTickHits * 8;
  if (paragraphs.count >= 4) naturalness += 5;
  if (/첫째|둘째|셋째/.test(trimmed) && chars < 220) naturalness -= 8;
  naturalness = clamp(naturalness);

  let duplicate = 100;
  const normalized = trimmed.replace(/\s+/g, " ").toLowerCase();
  for (const oldText of recentTexts) {
    const old = String(oldText || "").replace(/\s+/g, " ").toLowerCase();
    if (!old) continue;
    const sample = normalized.slice(0, 45);
    if (sample && old.includes(sample)) duplicate = Math.min(duplicate, 30);
  }

  let visual = mediaMode === "image" ? (hasImage ? 92 : 48) : 88;
  if (mediaMode === "image" && !hasImage) visual -= 10;

  const safety = banned.length ? 25 : 98;
  const score = Math.round(
    hook * 0.15 +
    readability * 0.15 +
    substance * 0.2 +
    engagement * 0.12 +
    naturalness * 0.13 +
    duplicate * 0.1 +
    visual * 0.05 +
    safety * 0.1
  );

  const blockers = [];
  if (chars < 90) blockers.push("본문이 너무 짧습니다. 최소한 의견·근거가 느껴지도록 내용을 보강하세요.");
  if (substance < 65) blockers.push("근거 또는 설명이 부족합니다. 왜 그런지 한 단계 더 설명하세요.");

  if (chars >= 180 && paragraphs.count < 5) {
    blockers.push("모바일 가독성을 위해 본문을 최소 5개 문단으로 나누고 문단 사이에 빈 줄을 넣어주세요.");
  } else if (chars >= 120 && paragraphs.count < 3) {
    blockers.push("본문을 의미 단위 문단으로 나누고 문단 사이에 빈 줄을 넣어주세요.");
  }
  if (paragraphs.overloaded > 0) {
    blockers.push("한 문단에는 최대 1~2문장만 사용해주세요. 긴 문단을 분리하세요.");
  }
  if (lines.veryLong > 0) {
    blockers.push("문장이 지나치게 깁니다. 의미가 크게 바뀌는 지점에서 한 번만 나눠주세요.");
  }
  if (readability < 65 && !blockers.some(v => v.includes("모바일") || v.includes("문단") || v.includes("한 줄"))) {
    blockers.push("모바일 가독성이 낮습니다. 짧은 문단과 줄바꿈으로 읽기 흐름을 조정하세요.");
  }

  if (banned.length) blockers.push("과장·수익 보장성 표현이 감지되었습니다.");
  if (duplicate < 60) blockers.push("최근 게시물과 도입부가 지나치게 유사합니다.");
  if (mediaMode === "image" && !hasImage) blockers.push("이미지형 게시물에는 이미지가 필요합니다.");

  const status = blockers.length === 0 && score >= 90
    ? "ready"
    : blockers.length === 0 && score >= 80
      ? "review"
      : "blocked";

  return {
    score,
    status,
    blockers,
    metrics: { hook, readability, substance, engagement, naturalness, duplicate, visual, safety }
  };
}

export const qualityLabel = {
  empty: "작성 전",
  ready: "게시 가능",
  review: "검토 가능",
  blocked: "게시 차단"
};
