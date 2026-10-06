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
  daily_post_goal:"", cta_ratio:"", telegram_source_code:""
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
  if(!res.ok){
    const error=new Error(data.error || "request_failed");
    error.details=data.details || "";
    error.code=data.code || "";
    throw error;
  }
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
  const [sectorPreset,setSectorPreset]=useState("");
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  const sectorOptions=["주식 · 경제","국내주식","미국주식","코인","거시경제"];
  const toneOptions=["차분함 · 신뢰감","쉽고 친근함","데이터 중심","직설적 · 간결함"];
  const goalOptions=[2,4,6];

  useEffect(()=>{
    if(open){
      setForm(initialAccountForm);
      setSectorPreset("");
      setError("");
    }
  },[open]);
  if(!open) return null;

  const set=(key,value)=>setForm(v=>({...v,[key]:value}));

  async function save(){
    if(!form.name.trim() || !form.handle.trim()){
      setError("계정명과 Threads 핸들은 필수입니다.");
      return;
    }
    setSaving(true);
    setError("");

    let account;
    try{
      const saved=await api("/api/accounts",{method:"POST",body:JSON.stringify(form)});
      account=saved.account;
    }catch(e){
      setSaving(false);
      setError(e.message==="handle_exists"
        ?"이미 등록된 핸들입니다. 계정 관리에서 기존 계정을 확인해주세요."
        :`계정 저장 실패 · ${e.message||"server_error"}`);
      return;
    }

    // 계정 저장 성공 이후의 화면 새로고침 실패는 저장 실패로 취급하지 않는다.
    Promise.resolve(onSaved()).catch(()=>{});

    try{
      const oauth=await api(`/api/threads/connect?state=account_${account.id}`);
      if(!oauth.url) throw new Error("missing_oauth_url");
      window.location.href=oauth.url;
      return;
    }catch(e){
      setError(`계정 저장 완료 · Threads 연결 시작 실패 (${e.message||"oauth_error"}). 계정 관리에서 다시 연결할 수 있습니다.`);
      setSaving(false);
    }
  }

  function chooseSector(value){
    setSectorPreset(value);
    if(value!=="직접입력") set("sector",value);
    else set("sector","");
  }

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="modal-card quick-account-modal">
      <div className="modal-heading">
        <div><h2>Threads 계정 빠른 등록</h2><p>기본 운영정보만 설정하면 저장 후 바로 Threads 연결로 이동합니다.</p></div>
      </div>

      <div className="form-grid">
        <div><label>계정명 *</label><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="계정 표시 이름"/></div>
        <div><label>Threads 핸들 *</label><input value={form.handle} onChange={e=>set("handle",e.target.value)} placeholder="@username"/></div>
      </div>

      <div className="form-grid">
        <div>
          <label>섹터</label>
          <select value={sectorPreset} onChange={e=>chooseSector(e.target.value)}>
            <option value="">선택</option>
            {sectorOptions.map(v=><option key={v} value={v}>{v}</option>)}
            <option value="직접입력">직접 입력</option>
          </select>
          {sectorPreset==="직접입력"&&<input className="sub-input" value={form.sector} onChange={e=>set("sector",e.target.value)} placeholder="운영 섹터 입력"/>}
        </div>
        <div><label>주요 타깃</label><input value={form.target_audience} onChange={e=>set("target_audience",e.target.value)} placeholder="이 계정이 주로 보여질 대상"/></div>
      </div>

      <label>기본 톤</label>
      <div className="quick-buttons">
        {toneOptions.map(v=><button key={v} className={form.tone===v?"choice active":"choice"} onClick={()=>set("tone",form.tone===v?"":v)}>{v}</button>)}
      </div>

      <div className="form-grid compact-fields">
        <div>
          <label>하루 게시 목표</label>
          <div className="quick-buttons">
            {goalOptions.map(v=><button key={v} className={Number(form.daily_post_goal)===v?"choice active":"choice"} onClick={()=>set("daily_post_goal",v)}>하루 {v}개</button>)}
            <input className="mini-number" type="number" min="0" max="30" value={form.daily_post_goal} onChange={e=>set("daily_post_goal",e.target.value===""?"":Number(e.target.value))} placeholder="직접"/>
          </div>
        </div>
        <div>
          <label>CTA 비율 <span className="field-value">{form.cta_ratio===""?"미설정":`${form.cta_ratio}%`}</span></label>
          <div className="range-row">
            <span>0%</span>
            <input type="range" min="0" max="100" step="5" value={form.cta_ratio===""?0:form.cta_ratio} onChange={e=>set("cta_ratio",Number(e.target.value))}/>
            <span>100%</span>
          </div>
        </div>
      </div>

      <label>계정 페르소나 / 작성 규칙</label>
      <textarea rows="4" value={form.persona} onChange={e=>set("persona",e.target.value)} placeholder="어떤 관점과 말투로 글을 작성할지 입력하세요."/>

      <div className="auto-note">
        <b>Telegram 유입코드</b>
        <span>직접 입력하지 않아도 됩니다. 계정 저장 시 Threads 핸들과 계정 ID를 기준으로 자동 생성됩니다.</span>
      </div>

      {error&&<div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>취소</button>
        <button className="primary" onClick={save} disabled={saving}>
          {saving?<Loader2 className="spin" size={16}/>:<Send size={16}/>} 저장 후 Threads 연결
        </button>
      </div>
    </div>
  </div>;
}

function Dashboard({data,loading,onRefresh,onCreate,onAddAccount}){
  const totals=data?.totals||{};
  const accounts=data?.accounts||[];
  const schedules=data?.schedules||[];
  const posts=data?.posts||[];
  const views=Number(totals.views||0);

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
          <div className="kv"><span>오늘 게시</span><b>{a.daily_post_goal ? `${a.posted_today||0}/${a.daily_post_goal}` : fmt(a.posted_today||0)}</b></div>
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

    <div>
      <div className="panel">
        <SectionTitle title="최근 게시 성과"/>
        {posts.length===0?<EmptyState title="저장된 게시물이 없습니다." desc="실제 게시물이 저장되면 최신 성과가 표시됩니다."/>:
        <div className="table-wrap"><table><thead><tr><th>게시물</th><th>계정</th><th>조회수</th><th>좋아요</th><th>댓글</th><th>프로필 방문</th><th>봇 진입</th></tr></thead><tbody>
          {posts.map(p=><tr key={p.id}><td className="text-cell">{p.body}</td><td>{p.account_name}</td><td>{fmt(p.views)}</td><td>{fmt(p.likes)}</td><td>{fmt(p.replies)}</td><td>{fmt(p.profile_visits)}</td><td>{fmt(p.bot_entries)}</td></tr>)}
        </tbody></table></div>}
      </div>
    </div>
  </>;
}

function Accounts({accounts,loading,onAdd,onRefresh}){
  const [q,setQ]=useState("");
  const [connecting,setConnecting]=useState(null);
  const [message,setMessage]=useState("");
  const filtered=accounts.filter(a=>[a.name,a.handle,a.sector,a.persona].join(" ").toLowerCase().includes(q.toLowerCase()));

  async function connectThreads(accountId){
    setConnecting(accountId);setMessage("");
    try{
      const r=await api(`/api/threads/connect?state=account_${accountId}`);
      if(!r.url) throw new Error("missing_oauth_url");
      window.location.href=r.url;
    }catch(e){
      setMessage(e.message==="meta_threads_not_configured"?"Meta Threads 환경변수가 아직 Production에 적용되지 않았습니다.":"Threads 연결을 시작하지 못했습니다.");
      setConnecting(null);
    }
  }

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("threads_connected")==="1"){
      setMessage("Threads 계정 연결이 완료되었습니다.");
      window.history.replaceState({}, "", window.location.pathname);
      onRefresh();
    }
  },[]);

  return <>
    <div className="hero-row"><div><h1>Threads 계정 관리</h1><p>운영 계정을 등록하고 Meta OAuth로 실제 Threads 계정을 연결합니다.</p></div><div className="toolbar"><button className="ghost" onClick={onRefresh}><RefreshCw size={15}/> 새로고침</button><button className="primary" onClick={onAdd}><Plus size={16}/> 계정 추가</button></div></div>
    {message&&<div className="save-message">{message}</div>}
    <div className="panel">
      <div className="search-row"><div className="search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="계정 검색"/></div></div>
      {loading?<div className="loading-line"><Loader2 className="spin"/> 불러오는 중</div>:filtered.length===0?
        <EmptyState title={accounts.length?"검색 결과가 없습니다.":"등록된 계정이 없습니다."} desc={accounts.length?"다른 검색어를 입력해보세요.":"계정 추가 버튼으로 첫 Threads 계정을 등록하세요."} action={!accounts.length?<button className="primary" onClick={onAdd}><Plus size={15}/> 계정 추가</button>:null}/>
      :<div className="account-list">{filtered.map(a=><div className="account-list-card" key={a.id}>
        <div className="avatar xl">{String(a.name||"?").slice(0,1)}</div>
        <div className="grow"><div className="line-title"><b>{a.name}</b><span>{a.handle}</span><span className={`badge ${a.is_active?"green":"gray"}`}>{a.is_active?"운영중":"중지"}</span>{a.threads_user_id?<span className="badge green">Threads 연결됨</span>:<span className="badge gray">Threads 미연결</span>}</div>
        <p>{a.persona||"페르소나 미설정"}</p><div className="chips"><span>{a.sector||"섹터 미설정"}</span><span>{a.daily_post_goal?`하루 ${a.daily_post_goal}개`:"게시 목표 미설정"}</span><span>{a.cta_ratio!=null&&Number(a.cta_ratio)>0?`CTA ${a.cta_ratio}%`:"CTA 미설정"}</span>{a.threads_user_id&&<span>ID {a.threads_user_id}</span>}</div></div>
        <div className="account-actions">
          <button className={a.threads_user_id?"ghost":"primary"} onClick={()=>connectThreads(a.id)} disabled={connecting===a.id}>
            {connecting===a.id?<Loader2 className="spin" size={15}/>:<Send size={15}/>}
            {a.threads_user_id?"Threads 다시 연결":"Threads 연결"}
          </button>
        </div>
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
          <div><label>기본 게시물 길이</label><input value={a.min_chars!=null&&a.max_chars!=null?`${a.min_chars}~${a.max_chars}자`:"미설정"} readOnly/></div>
          <div><label>하루 게시 목표</label><input value={a.daily_post_goal ? `${a.daily_post_goal}개` : "미설정"} readOnly/></div>
        </div>
        <label>페르소나</label><textarea rows="6" value={a.persona||""} readOnly/>
      </div>
      <div className="panel">
        <SectionTitle title="품질 기준"/>
        <div className="kv"><span>최소 검토 기준</span><b>{a.quality_threshold!=null?`${a.quality_threshold}점`:"미설정"}</b></div>
        <div className="kv"><span>자동 예약 가능 기준</span><b>{a.auto_publish_threshold!=null?`${a.auto_publish_threshold}점`:"미설정"}</b></div>
        <div className="kv"><span>CTA 비율</span><b>{Number(a.cta_ratio)>0 ? `${a.cta_ratio}%` : "미설정"}</b></div>
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
  const [integrations,setIntegrations]=useState({threads:{configured:false}});

  useEffect(()=>{ if(!account&&accounts[0]) setAccount(String(accounts[0].id)); },[accounts,account]);
  useEffect(()=>{ api("/api/integrations").then(setIntegrations).catch(()=>{}); },[]);

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

  async function autoFetch(){
    if(!account||!sourceHandle.trim()){
      setMessage("참고 Threads 계정 핸들을 입력해주세요.");
      return;
    }
    setLoading(true);setMessage("");
    try{
      const r=await api("/api/style-fetch",{method:"POST",body:JSON.stringify({
        account_id:Number(account),source_handle:sourceHandle.trim(),label:label.trim()
      })});
      setMessage(`자동 수집 완료 · 가져온 게시물 ${r.fetched}개 · 사용 가능 ${r.usable}개 · 신규 학습 ${r.inserted}개 · 신뢰도 ${r.confidence}%`);
      await load(account);
      await onRefresh();
    }catch(e){
      if(e.message==="threads_access_token_missing") setMessage("Threads API 토큰이 아직 연결되지 않았습니다.");
      else if(e.message==="threads_profile_discovery_required") setMessage("Meta 앱에 threads_profile_discovery 권한 승인이 필요합니다.");
      else setMessage("참고 계정 게시물 자동 수집에 실패했습니다.");
    }finally{setLoading(false);}
  }

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
          <div><label>메모</label><input value={label} onChange={e=>setLabel(e.target.value)} placeholder="참고 계정 용도 메모"/></div>
        </div>

        <div className={`integration-strip ${integrations?.threads?.configured?"ready":"waiting"}`}>
          <div><b>Threads 공개 프로필 자동 수집</b><span>{integrations?.threads?.configured?"API 토큰 연결됨":"API 토큰 연결 필요"}</span></div>
          <span className={`badge ${integrations?.threads?.configured?"green":"gray"}`}>{integrations?.threads?.configured?"사용 가능":"미연결"}</span>
        </div>
        <button className="generate secondary-generate" onClick={autoFetch} disabled={loading||!sourceHandle.trim()}>{loading?<Loader2 className="spin" size={17}/>:<RefreshCw size={17}/>} 이 계정 게시물 자동 가져오기 + 학습</button>

        <div className="or-divider"><span>또는 직접 샘플 입력</span></div>

        <label>게시물 샘플</label>
        <textarea rows="12" value={samplesText} onChange={e=>setSamplesText(e.target.value)} placeholder={"게시물 원문을 붙여넣으세요.\n\n여러 게시물을 넣을 때는 게시물 사이에\n===POST===\n를 넣어 구분하세요."}/>
        <div className="learning-note">자동 수집이 아직 연결되지 않았거나, 특정 게시물만 학습시키고 싶을 때 사용하세요. 권장 샘플은 20~50개입니다.</div>
        <button className="generate" onClick={learn} disabled={loading}>{loading?<Loader2 className="spin" size={17}/>:<BrainCircuit size={17}/>} 직접 샘플 분석 및 학습</button>
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
          {(data.sources||[]).length?(data.sources||[]).map(s=><div className="style-source" key={s.id}><div><b>{s.source_handle}</b><span>{s.label||"메모 없음"}{s.last_synced_at?` · 최근 자동수집 ${fmtDate(s.last_synced_at)} · ${s.last_sync_count||0}개`:""}</span>{s.last_error&&<small>{s.last_error}</small>}</div><span className="badge green">활성</span></div>):<EmptyState title="등록된 참고 계정이 없습니다." desc="왼쪽에서 참고 Threads 계정과 게시물 샘플을 넣어 학습을 시작하세요."/>}
        </div>
      </div>
    </div>
  </>;
}

function QualityPanel({quality}){
  const icon=quality.status==="empty"?<FileText/>:quality.status==="ready"?<CheckCircle2/>:quality.status==="review"?<AlertTriangle/>:<XCircle/>;
  return <div className={`quality-card ${quality.status}`}>
    <div className="quality-head"><div>{icon}<div><span>콘텐츠 품질 점수</span><strong>{quality.score}<small>/100</small></strong></div></div><span className="quality-status">{qualityLabel[quality.status]}</span></div>
    {quality.status==="empty"
      ?<div className="quality-empty-guide">본문을 작성하면 모바일 분단 · 가독성 · 정보량 · 반응유도 기준으로 실시간 검사합니다.</div>
      :<><div className="quality-metrics">{Object.entries(quality.metrics).map(([k,v])=><div key={k}><span>{({hook:"훅",readability:"가독성",substance:"정보량",engagement:"반응유도",naturalness:"자연스러움",duplicate:"중복안전",visual:"시각완성도",safety:"표현안전"})[k]}</span><b>{v}</b></div>)}</div>
      {quality.blockers.length>0&&<div className="blockers">{quality.blockers.map((b,i)=><div key={i}>• {b}</div>)}</div>}</>}
  </div>;
}

function Writer({accounts,posts,onSaved}){
  const [account,setAccount]=useState("");
  const [type,setType]=useState("후킹형");
  const [mediaMode,setMediaMode]=useState("text");
  const [text,setText]=useState("");
  const [image,setImage]=useState(null);
  const [saving,setSaving]=useState(false);
  const [publishing,setPublishing]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [aiTopic,setAiTopic]=useState("");
  const [message,setMessage]=useState("");
  const [messageType,setMessageType]=useState("success");
  const [replyText,setReplyText]=useState("제가 지금 보고 있는 종목들은\n단순히 “오를 것 같다”는 느낌으로 고르지는 않습니다.\n\n수급 · 실적 · 모멘텀 · 시장 관심도를 따로 보고\n종목별로 점수를 나눠서 보고 있습니다.\n\n현재 관심 있게 보고 있는 섹터와 종목들도 계속 업데이트하고 있으니\n궁금하신 분들은 프로필에서 무료로 확인해보셔도 됩니다.");

  useEffect(()=>{ if(!account&&accounts[0]) setAccount(String(accounts[0].id)); },[accounts,account]);
  const quality=useMemo(()=>scorePost({
    text,
    mediaMode,
    hasImage:!!image,
    recentTexts:posts.filter(p=>p.status==="published").map(p=>p.body)
  }),[text,mediaMode,image,posts]);
  const selected=accounts.find(a=>String(a.id)===account);
  const connected=!!selected?.threads_user_id;

  async function generateWithAI(){
    if(!account||generating) return;
    setGenerating(true);setMessage("");setMessageType("success");
    try{
      const result=await api("/api/ai/generate",{method:"POST",body:JSON.stringify({
        account_id:Number(account),
        post_type:type,
        topic:aiTopic.trim()
      })});
      setText(result.body||"");
      setReplyText(result.reply||"");
      setMessage(`AI 자동 소재 선정 + 초안 생성 완료${result.selected_topic?` · ${result.selected_topic}`:""}`);
    }catch(e){
      setMessageType("error");
      const map={
        openai_not_configured:"AI 생성 API가 아직 연결되지 않았습니다. Vercel에 OPENAI_API_KEY가 필요합니다.",
        account_not_found:"선택한 계정을 찾지 못했습니다.",
        generation_failed:"AI 생성에 실패했습니다."
      };
      const base=map[e.message]||`AI 생성 실패 · ${e.message||"server_error"}`;
      setMessage(e.details?`${base} · ${e.details}`:base);
    }finally{setGenerating(false);}
  }

  async function saveDraft(){
    if(!account||!text.trim()) return;
    setSaving(true);setMessage("");setMessageType("success");
    try{
      await api("/api/posts",{method:"POST",body:JSON.stringify({
        account_id:Number(account),post_type:type,media_mode:mediaMode,body:text,
        quality_score:quality.score,quality_status:quality.status,quality_details:quality,status:"draft"
      })});
      setMessage("초안이 DB에 저장되었습니다.");
      await onSaved();
    }catch(e){
      setMessageType("error");
      setMessage(`초안 저장 실패 · ${e.message||"server_error"}`);
    }finally{setSaving(false);}
  }

  async function publishNow(){
    if(!account||!text.trim()||publishing) return;
    if(!connected){
      setMessageType("error");
      setMessage("선택한 계정은 Threads 연결이 필요합니다.");
      return;
    }
    if(mediaMode!=="text"){
      setMessageType("error");
      setMessage("이미지 게시를 위해 이미지 저장소 연결이 먼저 필요합니다. 현재는 텍스트 게시만 지원합니다.");
      return;
    }
    if(quality.status==="blocked"){
      setMessageType("error");
      setMessage("품질검사에서 차단된 게시물은 실제 게시할 수 없습니다.");
      return;
    }

    setPublishing(true);setMessage("");setMessageType("success");
    try{
      const result=await api("/api/threads/publish",{method:"POST",body:JSON.stringify({
        account_id:Number(account),
        post_type:type,
        media_mode:mediaMode,
        body:text,
        quality_score:quality.score,
        quality_status:quality.status,
        quality_details:quality,
        reply_text:replyText.trim()
      })});
      if(result.reply_ok){
        setMessage(`Threads 본문 + 1차 댓글 게시 완료 · 댓글 ID ${result.threads_reply_id}`);
      }else if(result.reply_attempted){
        setMessage(`Threads 본문 게시 완료 · 1차 댓글 등록 실패${result.reply_details?` · Meta: ${result.reply_details}`:""}`);
      }else{
        setMessage(`Threads 게시 완료 · 게시물 ID ${result.threads_post_id}`);
      }
      setText("");
      setImage(null);
      await onSaved();
    }catch(e){
      setMessageType("error");
      const map={
        threads_account_not_connected:"Threads 계정 연결 정보가 없습니다.",
        threads_create_failed:"Threads 게시물 생성에 실패했습니다.",
        threads_publish_failed:"Threads 게시 최종 발행에 실패했습니다.",
        text_only_for_now:"현재는 텍스트 게시만 지원합니다."
      };
      const base=map[e.message]||`Threads 게시 실패 · ${e.message||"server_error"}`;
      setMessage(e.details?`${base} · Meta: ${e.details}`:base);
    }finally{setPublishing(false);}
  }

  if(accounts.length===0) return <><div className="hero-row"><div><h1>AI 게시물 생성</h1><p>계정별 콘텐츠 작성 공간입니다.</p></div></div><div className="panel"><EmptyState title="먼저 Threads 계정을 등록하세요." desc="등록 계정이 있어야 계정별 페르소나를 적용한 게시물을 만들 수 있습니다."/></div></>;

  return <>
    <div className="hero-row"><div><h1>AI 게시물 생성</h1><p>초안 저장과 실제 Threads 게시까지 연결되어 있습니다.</p></div></div>
    <div className="writer-grid">
      <div className="panel composer">
        <label>계정 선택</label><select value={account} onChange={e=>setAccount(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.handle})</option>)}</select>
        <div className="account-context"><b>{selected?.name}</b><span>{selected?.persona||"페르소나 미설정"}</span><small>{connected?"Threads 연결됨 · 실제 게시 가능":"Threads 미연결 · 계정 관리에서 먼저 연결 필요"}</small>{selected?.style_sample_count>0&&<small>학습 스타일 {selected.style_confidence}% · 샘플 {selected.style_sample_count}개 · {(selected.learned_style?.style_tags||[]).join(" · ")}</small>}</div>
        <div className="ai-generate-box">
          <div className="ai-generate-head"><div><b>AI 자동 소재 발굴 + 작성</b><span>계정 페르소나와 섹터를 기준으로 오늘 쓸 소재부터 자동으로 찾습니다.</span></div><Sparkles size={18}/></div>
          <button className="ai-generate-btn primary-auto" onClick={generateWithAI} disabled={generating||!account}>
            {generating?<Loader2 className="spin" size={16}/>:<WandSparkles size={16}/>}
            {generating?"최신 시장을 검색하고 작성 중...":"오늘 게시물 자동 생성"}
          </button>
          <details className="ai-topic-override">
            <summary>특정 주제를 직접 지정하고 싶을 때만 입력</summary>
            <textarea rows="3" value={aiTopic} onChange={e=>setAiTopic(e.target.value)} placeholder="선택 입력 · 비워두면 AI가 최신 시장에서 자동으로 소재를 선정합니다."/>
          </details>
          <small>기본값은 완전 자동입니다. 최신 공개 정보를 검색한 뒤 최근 실제 게시물과 겹치지 않는 소재를 골라 본문과 1차 댓글을 함께 작성합니다.</small>
        </div>
        <label>게시물 유형</label><div className="choice-row">{postTypes.map(([n,I])=><button className={type===n?"choice active":"choice"} onClick={()=>setType(n)} key={n}><I size={15}/>{n}</button>)}</div>
        <label>게시 방식</label><div className="choice-row"><button className={mediaMode==="text"?"choice active":"choice"} onClick={()=>setMediaMode("text")}><FileText size={15}/> 텍스트만</button><button className={mediaMode==="image"?"choice active":"choice"} onClick={()=>setMediaMode("image")}><ImageIcon size={15}/> 이미지 + 본문</button></div>
        {mediaMode==="image"&&<label className="upload"><input type="file" accept="image/*" onChange={e=>setImage(e.target.files?.[0]||null)}/><UploadCloud size={24}/><b>{image?image.name:"이미지 선택"}</b><span>이미지 실제 게시를 위해 저장소 연결이 필요합니다.</span></label>}
        <label>게시물 본문</label><textarea rows="15" value={text} onChange={e=>setText(e.target.value)} placeholder="Threads에 게시할 본문을 작성하세요."/>
        <div className="reply-editor">
          <div className="reply-editor-head"><label>게시 후 1차 댓글</label><span>{replyText.trim()?"자동 등록":"댓글 등록 안 함"}</span></div>
          <textarea rows="7" value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="비워두면 1차 댓글을 등록하지 않습니다."/>
          <small>본문 게시가 성공하면 이 내용을 바로 첫 댓글로 등록합니다. 프로필 유입용 문구는 게시 전 수정할 수 있습니다.</small>
        </div>
        <div className="publish-actions">
          <button className="ghost draft-action" onClick={saveDraft} disabled={saving||publishing||generating||!text.trim()||quality.status==="blocked"}>{saving?<Loader2 className="spin" size={17}/>:<Save size={17}/>} 초안 저장</button>
          <button className="generate publish-action" onClick={publishNow} disabled={publishing||saving||generating||!connected||mediaMode!=="text"||!text.trim()||quality.status==="blocked"}>{publishing?<Loader2 className="spin" size={17}/>:<Send size={17}/>} 지금 Threads에 게시</button>
        </div>
        {message&&<div className={messageType==="error"?"form-error":"save-message"}>{message}</div>}
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

function Analytics({data,onRefresh}){
  const t=data?.totals||{};
  const rows=(data?.posts||[]).filter(p=>p.status==="published");
  const [syncing,setSyncing]=useState(false);
  const [syncMessage,setSyncMessage]=useState("");

  async function syncInsights(){
    setSyncing(true);setSyncMessage("");
    try{
      const r=await api("/api/metrics/sync",{method:"POST",body:JSON.stringify({})});
      setSyncMessage("성과 갱신 완료 · 성공 "+(r.synced||0)+"개"+(r.failed?" · 실패 "+r.failed+"개":""));
      await onRefresh();
    }catch(e){
      setSyncMessage("성과 갱신 실패 · "+(e.details||e.message||"server_error"));
    }finally{setSyncing(false);}
  }

  return <><div className="hero-row"><div><h1>성과 분석</h1><p>실제 Threads 게시물 인사이트를 기준으로 집계합니다.</p></div><button className="primary" onClick={syncInsights} disabled={syncing}>{syncing?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} {syncing?"Threads 인사이트 수집 중":"성과 지금 갱신"}</button></div>
    {syncMessage&&<div className="analytics-sync-message">{syncMessage}</div>}
    <div className="stats analytics-stats">
      <Stat icon={Eye} label="전체 조회수" value={fmt(t.views)}/>
      <Stat icon={Heart} label="좋아요" value={fmt(t.likes)}/>
      <Stat icon={MessageCircle} label="답글" value={fmt(t.replies)}/>
      <Stat icon={RefreshCw} label="리포스트" value={fmt(t.reposts)}/>
    </div>
    <div className="stats analytics-stats secondary">
      <Stat icon={Newspaper} label="인용" value={fmt(t.quotes)}/>
      <Stat icon={Send} label="공유" value={fmt(t.shares)}/>
      <Stat icon={MousePointerClick} label="봇 진입" value={fmt(t.bot_entries)}/>
      <Stat icon={ClipboardCheck} label="신청 완료" value={fmt(t.applications)}/>
    </div>
    <div className="panel">
      <SectionTitle title="최근 게시물 성과" action={<span className="tag">실제 게시 완료 기준</span>}/>
      {rows.length===0?<EmptyState title="게시 완료 데이터가 없습니다." desc="Threads에 실제 게시된 글이 생기면 여기에서 조회수와 반응을 비교할 수 있습니다."/>:
      <div className="table-wrap"><table><thead><tr><th>계정</th><th>게시물</th><th>조회</th><th>좋아요</th><th>답글</th><th>리포스트</th><th>인용</th><th>공유</th></tr></thead><tbody>
        {rows.map(p=><tr key={p.id}><td>{p.account_name}</td><td className="analytics-post-body">{String(p.body||"").slice(0,68)}{String(p.body||"").length>68?"…":""}</td><td>{fmt(p.views)}</td><td>{fmt(p.likes)}</td><td>{fmt(p.replies)}</td><td>{fmt(p.reposts)}</td><td>{fmt(p.quotes)}</td><td>{fmt(p.shares)}</td></tr>)}
      </tbody></table></div>}
    </div>
    <div className="analytics-note">프로필 방문은 현재 Threads 게시물 인사이트의 공통 제공 지표가 아니어서 임의 추정하지 않습니다. 봇 진입·신청 전환은 ROADER 자체 유입 추적 데이터로 집계합니다.</div>
  </>;
}

function Leads({leads,onRefresh}){
  return <><div className="hero-row"><div><h1>텔레그램 신청 관리</h1><p>Telegram 신청봇에서 저장된 실제 신청자만 표시합니다.</p></div><button className="ghost" onClick={onRefresh}><RefreshCw size={15}/> 새로고침</button></div>
    <div className="panel">{leads.length===0?<EmptyState title="아직 접수된 신청이 없습니다." desc="Telegram 신청봇에서 접수된 실제 신청자가 여기에 표시됩니다."/>:<div className="table-wrap"><table><thead><tr><th>접수번호</th><th>신청일</th><th>이름</th><th>Telegram</th><th>연령</th><th>관심분야</th><th>경험</th><th>유입코드</th><th>상태</th></tr></thead><tbody>
      {leads.map(l=><tr key={l.id}><td><b>{l.receipt_number||"-"}</b></td><td>{fmtDate(l.created_at)}</td><td>{l.display_name||"-"}</td><td>{l.telegram_username||l.telegram_user_id}</td><td>{l.age_group||"-"}</td><td>{l.interest||"-"}</td><td>{l.experience||"-"}</td><td>{l.source_code||"-"}</td><td><StatusBadge>{l.status}</StatusBadge></td></tr>)}
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
    analytics:<Analytics data={dashboard} onRefresh={loadAll}/>,
    leads:<Leads leads={leads} onRefresh={loadAll}/>,
    settings:<SettingsPage/>
  }[page];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">R</div><div><strong>ROADER</strong><span>Threads Content & Lead Automation</span></div></div>
      <nav>{navItems.map(([Icon,label,key])=><button key={key} className={page===key?"active":""} onClick={()=>setPage(key)}><Icon size={19}/><span>{label}</span></button>)}</nav>
    </aside>
    <main>
      <header><div className="date-pill">{new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",weekday:"short"}).format(new Date())}</div><div className="admin"><div>●</div><span>관리자</span><ChevronDown size={14}/></div></header>
      {error&&<div className="global-error">{error}</div>}
      <div className="content">{pageNode}</div>
    </main>
    <AccountModal open={modal} onClose={()=>setModal(false)} onSaved={loadAll}/>
  </div>;
}
