import React, { useMemo, useState } from "react";
import {
  LayoutDashboard, Users, SlidersHorizontal, Sparkles, CalendarDays, History,
  BarChart3, Send, Settings, Plus, Eye, UserRound, MousePointerClick, ClipboardCheck,
  MoreHorizontal, CheckCircle2, Clock3, AlertTriangle, Image as ImageIcon, FileText,
  MessageCircle, Newspaper, Heart, UploadCloud, WandSparkles, ShieldCheck, XCircle,
  ArrowUpRight, Search, ChevronDown, Save
} from "lucide-react";
import { scorePost, qualityLabel } from "./lib/quality";

const accounts = [
  { id: 1, name: "부의 길잡이", handle: "@wealth_guide", sector: "국내주식 / 경제", followers: "12.4만", today: "5/5", views: "18,420", status: "운영중", accent: "🧭", persona: "40~60대 · 차분하고 신뢰감 있는 설명형", daily: 5 },
  { id: 2, name: "미국주식 레이더", handle: "@us_stock_guide", sector: "미국주식 / 빅테크", followers: "8.7만", today: "4/6", views: "10,312", status: "운영중", accent: "🇺🇸", persona: "30~50대 · 빠르고 직관적인 뉴스형", daily: 6 },
  { id: 3, name: "거시경제 브리핑", handle: "@macro_guide", sector: "거시경제 / 환율", followers: "6.2만", today: "3/5", views: "7,248", status: "운영중", accent: "🌐", persona: "40~60대 · 쉬운 거시 해설", daily: 5 },
  { id: 4, name: "코인 인사이트", handle: "@coin_insight", sector: "코인 / 블록체인", followers: "5.1만", today: "4/5", views: "4,892", status: "운영중", accent: "₿", persona: "30~50대 · 빠른 수급·시장반응형", daily: 5 },
  { id: 5, name: "투자하는 사람들", handle: "@invest_mind", sector: "투자심리 / 공감", followers: "3.8만", today: "2/4", views: "3,120", status: "운영중", accent: "👥", persona: "40~60대 · 생활형·공감형", daily: 4 }
];

const schedules = [
  ["08:10","부의 길잡이","삼성전자 / 반도체 수급","후킹형","게시완료"],
  ["09:00","거시경제 브리핑","미국 10년물 금리 해설","정보형","게시완료"],
  ["09:30","코인 인사이트","BTC 수급 분석","뉴스해설","게시완료"],
  ["10:20","미국주식 레이더","엔비디아 / AI 이슈","댓글유도","예약됨"],
  ["11:00","부의 길잡이","SK하이닉스 vs 삼성전자","댓글유도","예약됨"],
  ["12:30","투자하는 사람들","투자 심리 / 공감","공감형","대기중"],
  ["14:00","코인 인사이트","알트코인 동향","정보형","대기중"],
  ["15:30","거시경제 브리핑","CPI 지표 분석","뉴스해설","대기중"]
];

const recentPosts = [
  { title: "삼성전자 사는 사람은 주가보다 이것부터...", account: "부의 길잡이", views: "18,420", likes: "1,240", comments: "312", visits: "892", leads: "146" },
  { title: "미국 CPI, 시장이 주목하는 이유", account: "거시경제 브리핑", views: "12,310", likes: "842", comments: "198", visits: "612", leads: "88" },
  { title: "BTC 수급 흐름 정리", account: "코인 인사이트", views: "9,842", likes: "612", comments: "145", visits: "420", leads: "76" }
];

const sampleText = `지금 하나만 고르라고 하면

삼성전자
vs
SK하이닉스

어디를 선택하시겠습니까?

단순히 “더 많이 오른 종목” 말고
앞으로 6개월을 본다는 기준으로요.

저라면 현재 기준으로는 SK하이닉스를 조금 더 봅니다.

이유는 주가가 많이 올라서가 아니라
앞으로 6개월 동안 시장이 계속 주목할 핵심이
AI·HBM 수요와 실적 성장이라고 보기 때문입니다.

다만 삼성전자는 체급과 사업 포트폴리오가 있는 만큼
반도체 업황이 더 넓게 회복되면 이야기가 달라질 수 있고요.

여러분은 어떤 이유로 삼성전자 / SK하이닉스를 선택하셨나요?`;

const navItems = [
  [LayoutDashboard,"대시보드","dashboard"],
  [Users,"Threads 계정 관리","accounts"],
  [SlidersHorizontal,"콘텐츠 설정","content"],
  [Sparkles,"AI 게시물 생성","writer"],
  [CalendarDays,"게시 스케줄러","scheduler"],
  [History,"게시 이력","history"],
  [BarChart3,"성과 분석","analytics"],
  [Send,"텔레그램 신청 관리","leads"],
  [Settings,"설정","settings"]
];

function Stat({icon: Icon,label,value,delta}) {
  return <div className="stat-card">
    <div className="stat-icon"><Icon size={21}/></div>
    <div><div className="muted">{label}</div><div className="stat-value">{value}</div><div className="delta">▲ {delta}</div></div>
  </div>;
}

function SectionTitle({title,action}) {
  return <div className="section-title"><h2>{title}</h2>{action}</div>;
}

function StatusBadge({children}) {
  const cls = children.includes("완료") ? "green" : children.includes("예약") ? "blue" : "gray";
  return <span className={`badge ${cls}`}>{children}</span>;
}

function Dashboard({onCreate}) {
  return <>
    <div className="hero-row">
      <div>
        <h1>대시보드</h1>
        <p>여러 Threads 계정의 콘텐츠를 자동으로 생성하고 게시하며, 텔레그램 유입까지 연결합니다.</p>
      </div>
      <button className="primary" onClick={onCreate}><Sparkles size={16}/> 게시물 생성</button>
    </div>

    <div className="stats">
      <Stat icon={Eye} label="전체 조회수" value="42,360" delta="18.2%"/>
      <Stat icon={UserRound} label="프로필 방문" value="1,842" delta="21.5%"/>
      <Stat icon={MousePointerClick} label="봇 진입 수" value="318" delta="32.1%"/>
      <Stat icon={ClipboardCheck} label="신청 완료" value="142" delta="32.7%"/>
    </div>

    <div className="panel">
      <SectionTitle title="계정 현황 (5)" action={<button className="ghost"><Plus size={15}/> 계정 추가</button>}/>
      <div className="account-grid">
        {accounts.map(a => <div className="account-card" key={a.id}>
          <div className="account-head"><div className="avatar">{a.accent}</div><div><b>{a.name}</b><span>{a.handle}</span></div></div>
          <span className="tag">{a.sector}</span>
          <div className="kv"><span>게시</span><b>{a.today}</b></div>
          <div className="kv"><span>팔로워</span><b>{a.followers}</b></div>
          <div className="kv"><span>오늘 조회</span><b>{a.views}</b></div>
          <div className="live-dot">● {a.status}</div>
        </div>)}
      </div>
    </div>

    <div className="panel">
      <SectionTitle title="오늘의 게시 일정 (12)" action={<div className="tabs"><span className="active">전체</span><span>대기 4</span><span>예약 5</span><span>게시완료 3</span></div>}/>
      <div className="table-wrap">
        <table><thead><tr><th>시간</th><th>계정</th><th>콘텐츠 주제</th><th>유형</th><th>상태</th><th>작업</th></tr></thead>
        <tbody>{schedules.map((r,i)=><tr key={i}>{r.map((c,j)=><td key={j}>{j===3?<span className="tag">{c}</span>:j===4?<StatusBadge>{c}</StatusBadge>:c}</td>)}<td><MoreHorizontal size={18}/></td></tr>)}</tbody></table>
      </div>
    </div>

    <div className="bottom-grid">
      <div className="panel">
        <SectionTitle title="최근 게시 성과"/>
        <table><thead><tr><th>게시물</th><th>계정</th><th>조회수</th><th>좋아요</th><th>댓글</th><th>프로필 방문</th><th>봇 진입</th></tr></thead>
        <tbody>{recentPosts.map((r,i)=><tr key={i}><td>{r.title}</td><td>{r.account}</td><td>{r.views}</td><td>{r.likes}</td><td>{r.comments}</td><td>{r.visits}</td><td>{r.leads}</td></tr>)}</tbody></table>
      </div>
      <div className="panel goal">
        <SectionTitle title="이번 달 목표"/>
        <div className="goal-number">100,000 <span>노출</span></div>
        <div className="progress"><i style={{width:"42.36%"}}/></div>
        <div className="muted">42,360 / 100,000 · 42%</div>
      </div>
    </div>
  </>;
}

function Accounts() {
  return <>
    <div className="hero-row"><div><h1>Threads 계정 관리</h1><p>계정별 페르소나, 섹터, 게시 빈도와 콘텐츠 스타일을 분리해서 관리합니다.</p></div><button className="primary"><Plus size={16}/> 계정 추가</button></div>
    <div className="panel">
      <div className="search-row"><div className="search"><Search size={16}/><input placeholder="계정 검색"/></div><button className="ghost">운영중 <ChevronDown size={14}/></button></div>
      <div className="account-list">{accounts.map(a=><div className="account-list-card" key={a.id}>
        <div className="avatar xl">{a.accent}</div>
        <div className="grow"><div className="line-title"><b>{a.name}</b><span>{a.handle}</span><span className="badge green">{a.status}</span></div><p>{a.persona}</p><div className="chips"><span>{a.sector}</span><span>하루 {a.daily}개</span><span>CTA 5%</span></div></div>
        <button className="ghost">설정</button>
      </div>)}</div>
    </div>
  </>;
}

function ContentSettings() {
  const [selected,setSelected]=useState(accounts[0].id);
  return <>
    <div className="hero-row"><div><h1>콘텐츠 설정</h1><p>계정마다 다른 말투·길이·주제 비중·금지표현을 저장합니다.</p></div><button className="primary"><Save size={16}/> 저장</button></div>
    <div className="two-col">
      <div className="panel">
        <label>계정 선택</label>
        <select value={selected} onChange={e=>setSelected(Number(e.target.value))}>{accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select>
        <div className="form-grid">
          <div><label>주요 타깃</label><input value="40~60대 투자자" readOnly/></div>
          <div><label>기본 톤</label><input value="차분함 · 신뢰감 · 쉬운 설명" readOnly/></div>
          <div><label>기본 게시물 길이</label><select><option>중간 (180~420자)</option></select></div>
          <div><label>하루 게시 목표</label><input value="5" readOnly/></div>
        </div>
        <label>핵심 주제</label>
        <div className="topic-grid">{["국내주식","반도체","거시경제","환율","금리","수급","실적"].map(t=><span className="topic active" key={t}>{t}</span>)}</div>
      </div>
      <div className="panel">
        <SectionTitle title="콘텐츠 비중"/>
        {[["정보형",35],["후킹형",25],["댓글유도형",20],["뉴스해설형",15],["CTA",5]].map(([n,v])=><div className="ratio" key={n}><span>{n}</span><div><i style={{width:`${v*2}%`}}/></div><b>{v}%</b></div>)}
        <label>금지 표현</label>
        <textarea rows="5" value={"수익 보장\n무조건 오른다\n급등 확정\n원금 보장\n과도한 광고성 CTA"} readOnly/>
      </div>
    </div>
  </>;
}

function QualityPanel({quality}) {
  const icon = quality.status==="ready"?<CheckCircle2/>:quality.status==="review"?<AlertTriangle/>:<XCircle/>;
  return <div className={`quality-card ${quality.status}`}>
    <div className="quality-head"><div>{icon}<div><span>콘텐츠 품질 점수</span><strong>{quality.score}<small>/100</small></strong></div></div><span className="quality-status">{qualityLabel[quality.status]}</span></div>
    <div className="quality-metrics">{Object.entries(quality.metrics).map(([k,v])=><div key={k}><span>{({hook:"훅",readability:"가독성",substance:"정보량",engagement:"반응유도",naturalness:"자연스러움",duplicate:"중복안전",visual:"시각완성도",safety:"표현안전"})[k]}</span><b>{v}</b></div>)}</div>
    {quality.blockers.length>0&&<div className="blockers">{quality.blockers.map((b,i)=><div key={i}>• {b}</div>)}</div>}
  </div>;
}

function Writer() {
  const [account,setAccount]=useState(accounts[0].id);
  const [type,setType]=useState("후킹형");
  const [mediaMode,setMediaMode]=useState("text");
  const [text,setText]=useState(sampleText);
  const [image,setImage]=useState(null);
  const quality=useMemo(()=>scorePost({text,mediaMode,hasImage:!!image,recentTexts:recentPosts.map(r=>r.title)}),[text,mediaMode,image]);
  const canSchedule=quality.status!=="blocked";

  function generate() {
    setText(sampleText);
  }

  return <>
    <div className="hero-row"><div><h1>AI 게시물 생성</h1><p>자동화하되 저품질 게시물은 만들지 않습니다. 생성 후 품질 검사를 통과해야 예약할 수 있습니다.</p></div></div>
    <div className="writer-grid">
      <div className="panel composer">
        <div className="stepper"><span className="active">1 주제 선택</span><span>2 스타일 설정</span><span>3 생성 결과</span><span>4 검토 및 예약</span></div>
        <label>계정 선택</label>
        <select value={account} onChange={e=>setAccount(Number(e.target.value))}>{accounts.map(a=><option value={a.id} key={a.id}>{a.name} ({a.handle})</option>)}</select>
        <label>콘텐츠 주제</label>
        <select><option>반도체 / 삼성전자</option><option>미국 금리</option><option>BTC 수급</option></select>

        <label>게시물 유형</label>
        <div className="choice-row">{[["후킹형",WandSparkles],["정보형",FileText],["댓글유도형",MessageCircle],["뉴스해설형",Newspaper],["공감형",Heart]].map(([n,I])=><button className={type===n?"choice active":"choice"} onClick={()=>setType(n)} key={n}><I size={15}/>{n}</button>)}</div>

        <label>게시 방식</label>
        <div className="choice-row"><button className={mediaMode==="text"?"choice active":"choice"} onClick={()=>setMediaMode("text")}><FileText size={15}/> 텍스트만</button><button className={mediaMode==="image"?"choice active":"choice"} onClick={()=>setMediaMode("image")}><ImageIcon size={15}/> 이미지 + 본문</button></div>

        {mediaMode==="image"&&<label className="upload">
          <input type="file" accept="image/*" onChange={e=>setImage(e.target.files?.[0]||null)}/>
          <UploadCloud size={24}/><b>{image?image.name:"이미지 업로드"}</b><span>뉴스카드·비교카드·차트이미지 등</span>
        </label>}

        <label>추가 키워드</label><input placeholder="HBM, AI, 외국인 수급"/>
        <label>참고 뉴스 / 메모</label><textarea rows="4" placeholder="URL 또는 핵심 메모를 입력하면 게시물 생성 시 참고합니다."/>
        <button className="generate" onClick={generate}><Sparkles size={17}/> AI 게시물 생성하기</button>
      </div>

      <div className="right-stack">
        <div className="panel">
          <SectionTitle title="생성된 게시물" action={<span className="tag">{type}</span>}/>
          <div className="post-preview-head"><div className="avatar">🧭</div><div><b>{accounts.find(a=>a.id===account)?.name}</b><span>{accounts.find(a=>a.id===account)?.handle}</span></div></div>
          <textarea className="post-editor" value={text} onChange={e=>setText(e.target.value)} />
          {mediaMode==="image"&&<div className={image?"image-slot loaded":"image-slot"}>{image?<><ImageIcon/><span>{image.name}</span></>:<><ImageIcon/><span>이미지가 필요합니다.</span></>}</div>}
          <div className="preview-actions"><button className="ghost">다른 버전</button><button className="ghost">수정 저장</button><button className="primary" disabled={!canSchedule}><CalendarDays size={15}/> 예약 등록</button></div>
        </div>
        <QualityPanel quality={quality}/>
      </div>
    </div>
  </>;
}

function Scheduler() {
  return <><div className="hero-row"><div><h1>게시 스케줄러</h1><p>계정별 게시 시간과 상태를 한 화면에서 관리합니다.</p></div><button className="primary"><Plus size={16}/> 일정 추가</button></div><div className="panel"><div className="table-wrap"><table><thead><tr><th>시간</th><th>계정</th><th>주제</th><th>유형</th><th>상태</th><th>품질</th></tr></thead><tbody>{schedules.map((r,i)=><tr key={i}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td><span className="tag">{r[3]}</span></td><td><StatusBadge>{r[4]}</StatusBadge></td><td>{i<3?<span className="score good">92</span>:<span className="score">86</span>}</td></tr>)}</tbody></table></div></div></>;
}

function Placeholder({title,desc}) {
  return <div className="panel placeholder"><ShieldCheck size={42}/><h1>{title}</h1><p>{desc}</p><button className="ghost">MVP 연결 준비중</button></div>;
}

export default function App() {
  const [page,setPage]=useState("dashboard");
  const pageNode = {
    dashboard:<Dashboard onCreate={()=>setPage("writer")}/>,
    accounts:<Accounts/>,
    content:<ContentSettings/>,
    writer:<Writer/>,
    scheduler:<Scheduler/>,
    history:<Placeholder title="게시 이력" desc="게시 완료/실패/수정 이력을 계정별로 추적할 영역입니다."/>,
    analytics:<Placeholder title="성과 분석" desc="조회 → 프로필 방문 → 봇 진입 → 신청 완료까지 전환 성과를 연결합니다."/>,
    leads:<Placeholder title="텔레그램 신청 관리" desc="ROADER Telegram 신청봇과 연결해 유입 게시물별 신청자를 관리합니다."/>,
    settings:<Placeholder title="설정" desc="API 연동, 관리자 권한, 기본 품질 기준을 관리합니다."/>
  }[page];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">R</div><div><strong>ROADER</strong><span>Threads Content & Lead Automation</span></div></div>
      <nav>{navItems.map(([Icon,label,key])=><button key={key} className={page===key?"active":""} onClick={()=>setPage(key)}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-goal"><span>이번 달 목표</span><strong>100,000 <small>노출</small></strong><div><i style={{width:"42.36%"}}/></div><small>42,360 (42%)</small></div>
    </aside>
    <main>
      <header><div className="date-pill">2026. 10. 05 (월)</div><div className="admin"><div>●</div><span>관리자</span><ChevronDown size={14}/></div></header>
      <div className="content">{pageNode}</div>
    </main>
  </div>;
}
