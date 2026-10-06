import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, SlidersHorizontal, Sparkles, CalendarDays, History,
  BarChart3, Send, Settings, Plus, Eye, UserRound, MousePointerClick, ClipboardCheck,
  MoreHorizontal, CheckCircle2, AlertTriangle, Image as ImageIcon, FileText,
  MessageCircle, Newspaper, Heart, UploadCloud, WandSparkles, ShieldCheck, XCircle,
  Search, ChevronDown, Save, RefreshCw, Database, Loader2, BrainCircuit
} from "lucide-react";
import { scorePost, qualityLabel } from "./lib/quality";

const navItems = [
  [LayoutDashboard,"대시보드","dashboard"],
  [Users,"Threads 계정 관리","accounts"],
  [SlidersHorizontal,"콘텐츠 설정","content"],
  [BrainCircuit,"스타일 학습","learning"],
  [Sparkles,"AI 게시물 생성","writer"],
  [CalendarDays,"게시 스케줄러","scheduler"],
  [History,"게시 이력","history"],
  [BarChart3,"성과 분석","analytics"],
  [Send,"텔레그램 신청 관리","leads"],
  [Settings,"설정","settings"]
];

const postTypes = [
  ["후킹형",WandSparkles],["정보형",FileText],["댓글유도형",MessageCircle],
  ["뉴스해설형",Newspaper],["공감형",Heart]
];

const initialAccountForm = {
  name:"", handle:"", sector:"", target_audience:"", tone:"", persona:"",
  daily_post_goal:5, cta_ratio:5, telegram_source_code:""
};

function fmt(n){
  return Number(n || 0).toLocaleString("ko-KR");
}

function fmtDate(v){
  if(!v) return "-";
  return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(v));
}

function fmtTime(v){
  if(!v) return "-";
  return new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(v));
}

async function api(path, options={}){
  const res = await fetch(path,{
    headers:{"content-type":"application/json",...(options.headers||{})},
    ...options
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || "request_failed");
  return data;
}

function EmptyState({title,desc,action}){
  return <div className="empty-state">
    <Database size={34}/>
    <b>{title}</b>
    <p>{desc}</p>
    {action}
  </div>;
}

function Stat({icon:Icon,label,value}){
  return <div className="stat-card">
    <div className="stat-icon"><Icon size={21}/></div>
    <div><div className="muted">{label}</div><div className="stat-value">{fmt(value)}</div><div className="muted">실제 누적 데이터</div></div>
  </div>;
}

function SectionTitle({title,action}){
  return <div className="section-title"><h2>{title}</h2>{action}</div>;
}

function StatusBadge({children}){
  const text=String(children||"");
  const cls = /완료|published|approved/i.test(text) ? "green" : /예약|scheduled|review/i.test(text) ? "blue" : "gray";
  return <span className={`badge ${cls}`}>{text}</span>;
}

function AccountModal({open,onClose,onSaved}){
  const [form,setForm]=useState(initialAccountForm);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{ if(open){ setForm(initialAccountForm); setError(""); } },[open]);
  if(!open) return null;

  const set=(key,value)=>setForm(v=>({...v,[key]:value}));

  async function save(){
    if(!form.name.trim() || !form.handle.trim()){
      setError("계정명과 Threads 핸들은 필수입니다.");
      return;
    }
    setSaving(true); setError("");
    try{
      await api("/api/accounts",{method:"POST",body:JSON.stringify(form)});
      await onSaved();
      onClose();
    }catch(e){
      setError(e.message==="handle_exists"?"이미 등록된 핸들입니다.":"계정 저장에 실패했습니다.");
    }finally{setSaving(false);}
  }

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal-card">
      <SectionTitle title="Threads 계정 추가"/>
      <div className="form-grid">
        <div><label>계정명 *</label><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="예: 부의 길잡이"/></div>
        <div><label>Threads 핸들 *</label><input value={form.handle} onChange={e=>set("handle",e.target.value)} placeholder="@username"/></div>
        <div><label>섹터</label><input value={form.sector} onChange={e=>set("sector",e.target.value)} placeholder="국내주식 / 반도체"/></div>
        <div><label>타깃</label><input value={form.target_audience} onChange={e=>set("target_audience",e.target.value)} placeholder="40~60대 투자자"/></div>
        <div><label>기본 톤</label><input value={form.tone} onChange={e=>set("tone",e.target.value)} placeholder="차분함 · 신뢰감"/></div>
        <div><label>하루 게시 목표</label><input type="number" min="1" max="30" value={form.daily_post_goal} onChange={e=>set("daily_post_goal",Number(e.target.value))}/></div>
      </div>
      <label>계정 페르소나 / 작성 규칙</label>
      <textarea rows="4" value={form.persona} onChange={e=>set("persona",e.target.value)} placeholder="이 계정이 어떤 관점과 말투로 글을 써야 하는지 적어주세요."/>
      <div className="form-grid">
        <div><label>CTA 비율 (%)</label><input type="number" min="0" max="100" value={form.cta_ratio} onChange={e=>set("cta_ratio",Number(e.target.value))}/></div>
        <div><label>Telegram 유입코드</label><input value={form.telegram_source_code} onChange={e=>set("telegram_source_code",e.target.value)} placeholder="threads_profile_01"/></div>
      </div>
      {error&&<div className="form-error">{error}</div>}
      <div className="modal-actions"><button className="ghost" onClick={onClose}>취소</button><button className="primary" onClick={save} disabled={saving}>{saving?<Loader2 className="spin" size={16}/>:<Save size={16}/>} 저장</button></div>
    </div>
  </div>;
}

function Dashboard({data,loading,onRefresh,onCreate,onAddAccount}){
  const totals=data?.totals||{};
  const accounts=data?.accounts||[];
  const schedules=data?.schedules||[];
  const posts=data?.posts||[];
  const goal=100000;
  const views=Number(totals.views||0);
  const pct=Math.min(100,Math.round((views/goal)*100));

  return <>
    <div className="hero-row">
      <div><h1>대시보드</h1><p>실제 등록 계정과 게시 성과, 텔레그램 전환 데이터를 표시합니다.</p></div>
      <div className="toolbar"><button className="ghost" onClick={onRefresh}><RefreshCw size={15}/> 새로고침</button><button className="primary" onClick={onCreate}><Sparkles size={16}/> 게시물 생성</button></div>
    </div>

    <div className="stats">
      <Stat icon={Eye} label="전체 조회수" value={totals.views}/>
      <Stat icon={UserRound} label="프로필 방문" value={totals.profile_visits}/>
      <Stat icon={MousePointerClick} label="봇 진입 수" value={totals.bot_entries}/>
      <Stat icon={ClipboardCheck} label="신청 완료" value={totals.applications}/>
    </div>

    <div className="panel">
      <SectionTitle title={`계정 현황 (${accounts.length})`} action={<button className="ghost" onClick={onAddAccount}><Plus size={15}/> 계정 추가</button>}/>
      {loading?<div className="loading-line"><Loader2 className="spin"/> 불러오는 중</div>:accounts.length===0?
        <EmptyState title="등록된 Threads 계정이 없습니다." desc="첫 계정을 등록하면 여기부터 실제 운영 데이터가 채워집니다." action={<button className="primary" onClick={onAddAccount}><Plus size={15}/> 첫 계정 등록</button>}/>
      :<div className="account-grid">
        {accounts.map(a=><div className="account-card" key={a.id}>
          <div className="account-head"><div className="avatar">{String(a.name||"?").slice(0,1)}</div><div><b>{a.name}</b><span>{a.handle}</span></div></div>
          <span className="tag">{a.sector||"섹터 미설정"}</span>
          <div className="kv"><span>오늘 게시</span><b>{a.posted_today||0}/{a.daily_post_goal||0}</b></div>
          <div className="kv"><span>최근 집계 조회</span><b>{fmt(a.latest_views)}</b></div>
          <div className={a.is_active?"live-dot":"muted"}>● {a.is_active?"운영중":"중지"}</div>
        </div>)}
      </div>}
    </div>

    <div className="panel">
      <SectionTitle title={`오늘의 게시 일정 (${schedules.length})`}/>
      {schedules.length===0?<EmptyState title="오늘 등록된 게시 일정이 없습니다." desc="게시물을 저장한 뒤 스케줄러에서 예약하면 여기에 표시됩니다."/>:
      <div className="table-wrap"><table><thead><tr><th>시간</th><th>계정</th><th>게시물</th><th>유형</th><th>상태</th><th>품질</th></tr></thead><tbody>
        {schedules.map(s=><tr key={s.id}><td>{fmtTime(s.scheduled_at)}</td><td>{s.account_name}</td><td className="text-cell">{s.body}</td><td><span className="tag">{s.post_type}</span></td><td><StatusBadge>{s.status}</StatusBadge></td><td>{s.quality_score??"-"}</td></tr>)}
      </tbody></table></div>}
    </div>

    <div className="bottom-grid">
      <div className="panel">
        <SectionTitle title="최근 게시 성과"/>
        {posts.length===0?<EmptyState title="저장된 게시물이 없습니다." desc="실제 게시물이 저장되면 최신 성과가 표시됩니다."/>:
        <div className="table-wrap"><table><thead><tr><th>게시물</th><th>계정</th><th>조회수</th><th>좋아요</th><th>댓글</th><th>프로필 방문</th><th>봇 진입</th></tr></thead><tbody>
          {posts.map(p=><tr key={p.id}><td className="text-cell">{p.body}</td><td>{p.account_name}</td><td>{fmt(p.views)}</td><td>{fmt(p.likes)}</td><td>{fmt(p.replies)}</td><td>{fmt(p.profile_visits)}</td><td>{fmt(p.bot_entries)}</td></tr>)}
        </tbody></table></div>}
      </div>
      <div className="panel goal">
        <SectionTitle title="이번 달 목표"/>
        <div className="goal-number">100,000 <span>노출</span></div>
        <div className="progress"><i style={{width:`${pct}%`}}/></div>
        <div className="muted">{fmt(views)} / 100,000 · {pct}%</div>
      </div>
    </div>
  </>;
}

function Accounts({accounts,loading,onAdd,onRefresh}){
  const [q,setQ]=useState("");
  const filtered=accounts.filter(a=>[a.name,a.handle,a.sector,a.persona].join(" ").toLowerCase().includes(q.toLowerCase()));
  return <>
    <div className="hero-row"><div><h1>Threads 계정 관리</h1><p>실제로 운영할 계정만 등록됩니다. 샘플 계정은 사용하지 않습니다.</p></div><div className="toolbar"><button className="ghost" onClick={onRefresh}><RefreshCw size={15}/> 새로고침</button><button className="primary" onClick={onAdd}><Plus size={16}/> 계정 추가</button></div></div>
    <div className="panel">
      <div className="search-row"><div className="search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="계정 검색"/></div></div>
      {loading?<div className="loading-line"><Loader2 className="spin"/> 불러오는 중</div>:filtered.length===0?
        <EmptyState title={accounts.length?"검색 결과가 없습니다.":"등록된 계정이 없습니다."} desc={accounts.length?"다른 검색어를 입력해보세요.":"계정 추가 버튼으로 첫 Threads 계정을 등록하세요."} action={!accounts.length?<button className="primary" onClick={onAdd}><Plus size={15}/> 계정 추가</button>:null}/>
      :<div className="account-list">{filtered.map(a=><div className="account-list-card" key={a.id}>
        <div className="avatar xl">{String(a.name||"?").slice(0,1)}</div>
        <div className="grow"><div className="line-title"><b>{a.name}</b><span>{a.handle}</span><span className={`badge ${a.is_active?"green":"gray"}`}>{a.is_active?"운영중":"중지"}</span></div>
        <p>{a.persona||"페르소나 미설정"}</p><div className="chips"><span>{a.sector||"섹터 미설정"}</span><span>하루 {a.daily_post_goal}개</span><span>CTA {a.cta_ratio}%</span></div></div>
      </div>)}</div>}
    </div>
  </>;
}

function ContentSettings({accounts}){
  const [selected,setSelected]=useState("");
  useEffect(()=>{ if(!selected&&accounts[0]) setSelected(String(accounts[0].id)); },[accounts,selected]);
  const a=accounts.find(x=>String(x.id)===selected);
  return <>
    <div className="hero-row"><div><h1>콘텐츠 설정</h1><p>등록된 계정의 현재 콘텐츠 프로필을 확인합니다. 세부 편집 기능은 다음 단계에서 연결합니다.</p></div></div>
    {!a?<div className="panel"><EmptyState title="먼저 Threads 계정을 등록하세요." desc="계정별 페르소나와 품질 기준은 계정 등록 후 설정할 수 있습니다."/></div>:
    <div className="two-col">
      <div className="panel">
        <label>계정 선택</label>
        <select value={selected} onChange={e=>setSelected(e.target.value)}>{accounts.map(x=><option key={x.id} value={x.id}>{x.name} ({x.handle})</option>)}</select>
        <div className="form-grid">
          <div><label>주요 타깃</label><input value={a.target_audience||""} readOnly/></div>
          <div><label>기본 톤</label><input value={a.tone||""} readOnly/></div>
          <div><label>기본 게시물 길이</label><input value={`${a.min_chars||180}~${a.max_chars||420}자`} readOnly/></div>
          <div><label>하루 게시 목표</label><input value={a.daily_post_goal||0} readOnly/></div>
        </div>
        <label>페르소나</label><textarea rows="6" value={a.persona||""} readOnly/>
      </div>
      <div className="panel">
        <SectionTitle title="품질 기준"/>
        <div className="kv"><span>최소 검토 기준</span><b>{a.quality_threshold||80}점</b></div>
        <div className="kv"><span>자동 예약 가능 기준</span><b>{a.auto_publish_threshold||90}점</b></div>
        <div className="kv"><span>CTA 비율</span><b>{a.cta_ratio||0}%</b></div>
        <label>콘텐츠 비중</label>
        {Object.entries(a.type_mix||{}).length?Object.entries(a.type_mix).map(([n,v])=><div className="ratio" key={n}><span>{n}</span><div><i style={{width:`${Math.min(100,Number(v)*2)}%`}}/></div><b>{v}%</b></div>):<div className="muted">기본 프로필 생성 대기</div>}
      </div>
    </div>}
  </>;
}

function StyleLearning({accounts,onRefresh}){
  const [account,setAccount]=useState("");
  const [sourceHandle,setSourceHandle]=useState("");
  const [label,setLabel]=useState("");
  const [samplesText,setSamplesText]=useState("");
  const [data,setData]=useState({sources:[],profile:null,samples:[]});
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{ if(!account&&accounts[0]) setAccount(String(accounts[0].id)); },[accounts,account]);

  async function load(id=account){
    if(!id) return;
    setLoading(true);setMessage("");
    try{
      const r=await api(`/api/style-learning?account_id=${id}`);
      setData(r);
    }catch{
      setMessage("학습 데이터를 불러오지 못했습니다.");
    }finally{setLoading(false);}
  }

  useEffect(()=>{ if(account) load(account); },[account]);

  async function learn(){
    if(!account||!sourceHandle.trim()||!samplesText.trim()){
      setMessage("참고 계정 핸들과 게시물 샘플을 입력해주세요.");
      return;
    }
    const samples=samplesText.split(/\n\s*===POST===\s*\n/i).map(v=>v.trim()).filter(Boolean);
    setLoading(true);setMessage("");
    try{
      const r=await api("/api/style-learning",{method:"POST",body:JSON.stringify({
        action:"learn",account_id:Number(account),source_handle:sourceHandle.trim(),label:label.trim(),samples
      })});
      setMessage(`학습 완료 · 신규 샘플 ${r.inserted}개 · 신뢰도 ${r.confidence}%`);
      setSamplesText("");
      await load(account);
      await onRefresh();
    }catch{
      setMessage("스타일 학습에 실패했습니다.");
    }finally{setLoading(false);}
  }

  const p=data.profile?.profile||{};
  const rules=p.writing_rules||{};
  const selected=accounts.find(a=>String(a.id)===account);

  if(accounts.length===0) return <><div className="hero-row"><div><h1>스타일 학습</h1><p>참고 Threads 계정의 게시 패턴을 계정별 스타일 프로필로 저장합니다.</p></div></div><div className="panel"><EmptyState title="먼저 운영 계정을 등록하세요." desc="스타일 학습은 등록된 ROADER 계정별로 적용됩니다."/></div></>;

  return <>
    <div className="hero-row"><div><h1>스타일 학습</h1><p>참고 계정의 문장을 복제하지 않고, 반복적으로 나타나는 작성 패턴만 추출해 저장합니다.</p></div><button className="ghost" onClick={()=>load()}><RefreshCw size={15}/> 새로고침</button></div>

    <div className="two-col">
      <div className="panel">
        <SectionTitle title="학습 소스 등록"/>
        <label>적용할 ROADER 계정</label>
        <select value={account} onChange={e=>setAccount(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.handle})</option>)}</select>

        <div className="account-context">
          <b>{selected?.name}</b>
          <span>{selected?.persona||"페르소나 미설정"}</span>
        </div>

        <div className="form-grid">
          <div><label>참고 Threads 계정 *</label><input value={sourceHandle} onChange={e=>setSourceHandle(e.target.value)} placeholder="@reference_account"/></div>
          <div><label>메모</label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="예: 국내주식 질문형 레퍼런스"/></div>
        </div>

        <label>게시물 샘플</label>
        <textarea rows="16" value={samplesText} onChange={e=>setSamplesText(e.target.value)} placeholder={"게시물 원문을 붙여넣으세요.\n\n여러 게시물을 넣을 때는 게시물 사이에\n===POST===\n를 넣어 구분하세요."}/>
        <div className="learning-note">권장: 계정당 최소 10개, 가능하면 20~50개 샘플. 샘플이 많을수록 스타일 신뢰도가 올라갑니다.</div>
        <button className="generate" onClick={learn} disabled={loading}>{loading?<Loader2 className="spin" size={17}/>:<BrainCircuit size={17}/>} 스타일 분석 및 학습</button>
        {message&&<div className="save-message">{message}</div>}
      </div>

      <div className="right-stack">
        <div className="panel">
          <SectionTitle title="학습 상태" action={data.profile?<span className="badge green">신뢰도 {data.profile.confidence}%</span>:<span className="badge gray">미학습</span>}/>
          <div className="learning-summary">
            <div><span>학습 샘플</span><strong>{data.profile?.sample_count||0}</strong></div>
            <div><span>평균 글자수</span><strong>{p.avg_chars||0}</strong></div>
            <div><span>질문형 비율</span><strong>{p.question_post_ratio||0}%</strong></div>
            <div><span>짧은 훅 비율</span><strong>{p.short_hook_ratio||0}%</strong></div>
            <div><span>짧은 줄 비율</span><strong>{p.short_line_ratio||0}%</strong></div>
            <div><span>이모지 사용</span><strong>{p.emoji_ratio||0}%</strong></div>
          </div>

          <label>추출된 스타일 태그</label>
          <div className="topic-grid">{(p.style_tags||[]).length?(p.style_tags||[]).map(t=><span className="topic active" key={t}>{t}</span>):<span className="muted">아직 학습된 스타일이 없습니다.</span>}</div>

          <label>자동 적용 작성 규칙</label>
          <div className="learned-rules">
            <div><span>목표 길이</span><b>{rules.target_length||"-"}</b></div>
            <div><span>첫 문장</span><b>{rules.opening||"-"}</b></div>
            <div><span>줄바꿈</span><b>{rules.line_breaks||"-"}</b></div>
            <div><span>마무리</span><b>{rules.ending||"-"}</b></div>
            <div><span>이모지</span><b>{rules.emoji||"-"}</b></div>
            <div><span>구조</span><b>{rules.structure||"-"}</b></div>
          </div>
        </div>

        <div className="panel">
          <SectionTitle title={`참고 계정 (${data.sources?.length||0})`}/>
          {(data.sources||[]).length?(data.sources||[]).map(s=><div className="style-source" key={s.id}><div><b>{s.source_handle}</b><span>{s.label||"메모 없음"}</span></div><span className="badge green">활성</span></div>):<EmptyState title="등록된 참고 계정이 없습니다." desc="왼쪽에서 참고 Threads 계정과 게시물 샘플을 넣어 학습을 시작하세요."/>}
        </div>
      </div>
    </div>
  </>;
}

function QualityPanel({quality}){
  const icon=quality.status==="ready"?<CheckCircle2/>:quality.status==="review"?<AlertTriangle/>:<XCircle/>;
  return <div className={`quality-card ${quality.status}`}>
    <div className="quality-head"><div>{icon}<div><span>콘텐츠 품질 점수</span><strong>{quality.score}<small>/100</small></strong></div></div><span className="quality-status">{qualityLabel[quality.status]}</span></div>
    <div className="quality-metrics">{Object.entries(quality.metrics).map(([k,v])=><div key={k}><span>{({hook:"훅",readability:"가독성",substance:"정보량",engagement:"반응유도",naturalness:"자연스러움",duplicate:"중복안전",visual:"시각완성도",safety:"표현안전"})[k]}</span><b>{v}</b></div>)}</div>
    {quality.blockers.length>0&&<div className="blockers">{quality.blockers.map((b,i)=><div key={i}>• {b}</div>)}</div>}
  </div>;
}

function Writer({accounts,posts,onSaved}){
  const [account,setAccount]=useState("");
  const [type,setType]=useState("후킹형");
  const [mediaMode,setMediaMode]=useState("text");
  const [text,setText]=useState("");
  const [image,setImage]=useState(null);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{ if(!account&&accounts[0]) setAccount(String(accounts[0].id)); },[accounts,account]);
  const quality=useMemo(()=>scorePost({text,mediaMode,hasImage:!!image,recentTexts:posts.map(p=>p.body)}),[text,mediaMode,image,posts]);

  async function saveDraft(){
    if(!account||!text.trim()) return;
    setSaving(true);setMessage("");
    try{
      await api("/api/posts",{method:"POST",body:JSON.stringify({
        account_id:Number(account),post_type:type,media_mode:mediaMode,body:text,
        quality_score:quality.score,quality_status:quality.status,quality_details:quality,status:"draft"
      })});
      setMessage("초안이 실제 DB에 저장되었습니다.");
      await onSaved();
    }catch{setMessage("저장에 실패했습니다.");}
    finally{setSaving(false);}
  }

  const selected=accounts.find(a=>String(a.id)===account);
  if(accounts.length===0) return <><div className="hero-row"><div><h1>AI 게시물 생성</h1><p>계정별 콘텐츠 작성 공간입니다.</p></div></div><div className="panel"><EmptyState title="먼저 Threads 계정을 등록하세요." desc="등록 계정이 있어야 계정별 페르소나를 적용한 게시물을 만들 수 있습니다."/></div></>;

  return <>
    <div className="hero-row"><div><h1>AI 게시물 생성</h1><p>현재 단계에서는 실제 계정별 초안 작성·품질검사·DB 저장까지 연결되어 있습니다.</p></div></div>
    <div className="writer-grid">
      <div className="panel composer">
        <label>계정 선택</label><select value={account} onChange={e=>setAccount(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.handle})</option>)}</select>
        <div className="account-context"><b>{selected?.name}</b><span>{selected?.persona||"페르소나 미설정"}</span>{selected?.style_sample_count>0&&<small>학습 스타일 {selected.style_confidence}% · 샘플 {selected.style_sample_count}개 · {(selected.learned_style?.style_tags||[]).join(" · ")}</small>}</div>
        <label>게시물 유형</label><div className="choice-row">{postTypes.map(([n,I])=><button className={type===n?"choice active":"choice"} onClick={()=>setType(n)} key={n}><I size={15}/>{n}</button>)}</div>
        <label>게시 방식</label><div className="choice-row"><button className={mediaMode==="text"?"choice active":"choice"} onClick={()=>setMediaMode("text")}><FileText size={15}/> 텍스트만</button><button className={mediaMode==="image"?"choice active":"choice"} onClick={()=>setMediaMode("image")}><ImageIcon size={15}/> 이미지 + 본문</button></div>
        {mediaMode==="image"&&<label className="upload"><input type="file" accept="image/*" onChange={e=>setImage(e.target.files?.[0]||null)}/><UploadCloud size={24}/><b>{image?image.name:"이미지 선택"}</b><span>이미지 저장소 연결 전까지 품질 검사 용도로만 사용됩니다.</span></label>}
        <label>게시물 본문</label><textarea rows="15" value={text} onChange={e=>setText(e.target.value)} placeholder="게시물 본문을 작성하세요. AI 자동생성 API는 다음 단계에서 이 입력란에 결과를 생성하도록 연결합니다."/>
        <button className="generate" onClick={saveDraft} disabled={saving||!text.trim()||quality.status==="blocked"}>{saving?<Loader2 className="spin" size={17}/>:<Save size={17}/>} 품질검사 후 초안 저장</button>
        {message&&<div className="save-message">{message}</div>}
      </div>
      <div className="right-stack">
        <div className="panel">
          <SectionTitle title="게시물 미리보기" action={<span className="tag">{type}</span>}/>
          <div className="post-preview-head"><div className="avatar">{String(selected?.name||"?").slice(0,1)}</div><div><b>{selected?.name}</b><span>{selected?.handle}</span></div></div>
          <div className="post-live-preview">{text||<span className="muted">작성한 본문이 여기에 표시됩니다.</span>}</div>
          {mediaMode==="image"&&<div className={image?"image-slot loaded":"image-slot"}><ImageIcon/><span>{image?image.name:"이미지가 필요합니다."}</span></div>}
        </div>
        <QualityPanel quality={quality}/>
      </div>
    </div>
  </>;
}

function Scheduler({schedules}){
  return <>
    <div className="hero-row"><div><h1>게시 스케줄러</h1><p>실제 DB에 저장된 예약 일정만 표시됩니다.</p></div></div>
    <div className="panel">{schedules.length===0?<EmptyState title="예약된 게시물이 없습니다." desc="게시물 초안의 예약 기능을 연결하면 여기에 일정이 표시됩니다."/>:<div className="table-wrap"><table><thead><tr><th>예약시간</th><th>계정</th><th>게시물</th><th>유형</th><th>상태</th><th>품질</th></tr></thead><tbody>
      {schedules.map(s=><tr key={s.id}><td>{fmtDate(s.scheduled_at)}</td><td>{s.account_name}</td><td className="text-cell">{s.body}</td><td><span className="tag">{s.post_type}</span></td><td><StatusBadge>{s.status}</StatusBadge></td><td>{s.quality_score??"-"}</td></tr>)}
    </tbody></table></div>}</div>
  </>;
}

function HistoryPage({posts}){
  return <><div className="hero-row"><div><h1>게시 이력</h1><p>DB에 저장된 실제 게시물 초안과 게시 상태입니다.</p></div></div><div className="panel">
    {posts.length===0?<EmptyState title="게시 이력이 없습니다." desc="첫 게시물을 저장하면 여기에 나타납니다."/>:<div className="table-wrap"><table><thead><tr><th>생성일</th><th>계정</th><th>본문</th><th>유형</th><th>상태</th><th>품질</th></tr></thead><tbody>
      {posts.map(p=><tr key={p.id}><td>{fmtDate(p.created_at)}</td><td>{p.account_name}</td><td className="text-cell">{p.body}</td><td>{p.post_type}</td><td><StatusBadge>{p.status}</StatusBadge></td><td>{p.quality_score??"-"}</td></tr>)}
    </tbody></table></div>}</div></>;
}

function Analytics({data}){
  const t=data?.totals||{};
  return <><div className="hero-row"><div><h1>성과 분석</h1><p>샘플 수치 없이 실제 집계값만 표시합니다.</p></div></div>
    <div className="stats"><Stat icon={Eye} label="전체 조회수" value={t.views}/><Stat icon={UserRound} label="프로필 방문" value={t.profile_visits}/><Stat icon={MousePointerClick} label="봇 진입" value={t.bot_entries}/><Stat icon={ClipboardCheck} label="신청 완료" value={t.applications}/></div>
    <div className="panel"><EmptyState title="성과 데이터 수집 준비 완료" desc="Threads 게시/인사이트 연동 후 게시물별 조회·반응·전환 그래프를 이 영역에 표시합니다."/></div>
  </>;
}

function Leads({leads,onRefresh}){
  return <><div className="hero-row"><div><h1>텔레그램 신청 관리</h1><p>Telegram 신청봇에서 저장된 실제 신청자만 표시합니다.</p></div><button className="ghost" onClick={onRefresh}><RefreshCw size={15}/> 새로고침</button></div>
    <div className="panel">{leads.length===0?<EmptyState title="아직 접수된 신청이 없습니다." desc="Telegram 신청봇 저장 연동 후 실제 신청자가 여기에 표시됩니다."/>:<div className="table-wrap"><table><thead><tr><th>신청일</th><th>이름</th><th>Telegram</th><th>연령</th><th>관심분야</th><th>경험</th><th>유입코드</th><th>상태</th></tr></thead><tbody>
      {leads.map(l=><tr key={l.id}><td>{fmtDate(l.created_at)}</td><td>{l.display_name||"-"}</td><td>{l.telegram_username||l.telegram_user_id}</td><td>{l.age_group||"-"}</td><td>{l.interest||"-"}</td><td>{l.experience||"-"}</td><td>{l.source_code||"-"}</td><td><StatusBadge>{l.status}</StatusBadge></td></tr>)}
    </tbody></table></div>}</div>
  </>;
}

function SettingsPage(){
  return <><div className="hero-row"><div><h1>설정</h1><p>ROADER 운영 연결 상태입니다.</p></div></div><div className="panel settings-list">
    <div><b>Vercel Production</b><span className="badge green">연결됨</span></div>
    <div><b>Neon Postgres</b><span className="badge green">연결됨</span></div>
    <div><b>Threads API</b><span className="badge gray">연결 전</span></div>
    <div><b>AI 생성 API</b><span className="badge gray">연결 전</span></div>
    <div><b>Vercel Blob 이미지 저장</b><span className="badge gray">연결 전</span></div>
    <div><b>Telegram 신청 DB 저장</b><span className="badge gray">연결 예정</span></div>
  </div></>;
}

export default function App(){
  const [page,setPage]=useState("dashboard");
  const [dashboard,setDashboard]=useState({totals:{},accounts:[],schedules:[],posts:[],leads:{}});
  const [accounts,setAccounts]=useState([]);
  const [posts,setPosts]=useState([]);
  const [schedules,setSchedules]=useState([]);
  const [leads,setLeads]=useState([]);
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false);
  const [error,setError]=useState("");

  async function loadAll(){
    setLoading(true);setError("");
    try{
      const [d,a,p,s,l]=await Promise.all([
        api("/api/dashboard"),api("/api/accounts"),api("/api/posts"),api("/api/schedules"),api("/api/leads")
      ]);
      setDashboard(d);setAccounts(a.accounts||[]);setPosts(p.posts||[]);setSchedules(s.schedules||[]);setLeads(l.leads||[]);
    }catch(e){
      setError("실제 DB 데이터를 불러오지 못했습니다. 배포/DB 연결 상태를 확인해주세요.");
    }finally{setLoading(false);}
  }

  useEffect(()=>{loadAll();},[]);

  const pageNode={
    dashboard:<Dashboard data={dashboard} loading={loading} onRefresh={loadAll} onCreate={()=>setPage("writer")} onAddAccount={()=>setModal(true)}/>,
    accounts:<Accounts accounts={accounts} loading={loading} onAdd={()=>setModal(true)} onRefresh={loadAll}/>,
    content:<ContentSettings accounts={accounts}/>,
    learning:<StyleLearning accounts={accounts} onRefresh={loadAll}/>,
    writer:<Writer accounts={accounts} posts={posts} onSaved={loadAll}/>,
    scheduler:<Scheduler schedules={schedules}/>,
    history:<HistoryPage posts={posts}/>,
    analytics:<Analytics data={dashboard}/>,
    leads:<Leads leads={leads} onRefresh={loadAll}/>,
    settings:<SettingsPage/>
  }[page];

  const views=Number(dashboard?.totals?.views||0);
  const pct=Math.min(100,Math.round(views/1000));

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">R</div><div><strong>ROADER</strong><span>Threads Content & Lead Automation</span></div></div>
      <nav>{navItems.map(([Icon,label,key])=><button key={key} className={page===key?"active":""} onClick={()=>setPage(key)}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-goal"><span>이번 달 목표</span><strong>100,000 <small>노출</small></strong><div><i style={{width:`${pct}%`}}/></div><small>{fmt(views)} ({pct}%)</small></div>
    </aside>
    <main>
      <header><div className="date-pill">{new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).format(new Date())}</div><div className="admin"><div>●</div><span>관리자</span><ChevronDown size={14}/></div></header>
      {error&&<div className="global-error">{error}</div>}
      <div className="content">{pageNode}</div>
    </main>
    <AccountModal open={modal} onClose={()=>setModal(false)} onSaved={loadAll}/>
  </div>;
}
