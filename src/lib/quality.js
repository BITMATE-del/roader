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
  "여러분은 어떻게 생각하시나요?",
  "여러분은 어떻게 보시나요?",
  "여러분 생각은 어떠신가요?",
  "제가 보는 핵심은",
  "지금 제가 보는 건",
  "확인할 만합니다",
  "확인할 만해요",
  "이어질 수 있다고 봅니다",
  "이어질 가능성이 있습니다",
  "긍정적으로 작용할 수 있습니다",
  "살펴볼 필요가 있습니다",
  "체크해볼 만합니다",
  "체크해볼 구간입니다",
  "라고 봅니다",
  "보입니다"
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

  let naturalness = 92 - aiTickHits * 14;
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
  const warnings = [];

  // 실제 게시를 막아야 하는 치명적 문제만 blockers로 분류한다.
  if (chars < 90) blockers.push("본문이 너무 짧습니다. 최소한 의견·근거가 느껴지도록 내용을 보강하세요.");
  if (substance < 55) blockers.push("근거 또는 설명이 지나치게 부족합니다.");
  if (banned.length) blockers.push("과장·수익 보장성 표현이 감지되었습니다.");
  if (duplicate < 60) blockers.push("최근 게시물과 도입부가 지나치게 유사합니다.");
  if (aiTickHits >= 2) blockers.push("AI·번역·보고서형 상투 표현이 반복됩니다. 한국인이 직접 쓴 자연스러운 문장으로 다시 작성하세요.");
  if (mediaMode === "image" && !hasImage) blockers.push("이미지형 게시물에는 이미지가 필요합니다.");

  // 아래 항목은 자동 포맷 보정이 가능한 문제이므로 게시 차단이 아니라 warnings로 처리한다.
  if (chars >= 180 && paragraphs.count < 5) {
    warnings.push("모바일 가독성을 위해 본문을 5개 안팎의 문단으로 나누면 더 좋습니다.");
  } else if (chars >= 120 && paragraphs.count < 3) {
    warnings.push("본문을 의미 단위 문단으로 나누면 더 읽기 쉽습니다.");
  }
  if (paragraphs.overloaded > 0) {
    warnings.push("한 문단에 3문장 이상 포함된 구간은 자동 줄바꿈 보정 대상입니다.");
  }
  if (lines.veryLong > 0) {
    warnings.push("긴 문장은 자동 줄바꿈 보정 대상입니다.");
  }
  if (readability < 65) {
    warnings.push("모바일 가독성을 조금 더 개선할 수 있습니다.");
  }

  const status = blockers.length > 0
    ? "blocked"
    : score >= 90
      ? "ready"
      : score >= 80
        ? "review"
        : "blocked";

  return {
    score,
    status,
    blockers,
    warnings,
    metrics: { hook, readability, substance, engagement, naturalness, duplicate, visual, safety }
  };
}

export const qualityLabel = {
  empty: "작성 전",
  ready: "게시 가능",
  review: "검토 가능",
  blocked: "게시 차단"
};
