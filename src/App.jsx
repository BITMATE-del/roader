import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, SlidersHorizontal, Sparkles, CalendarDays, History,
  BarChart3, Send, Settings, Plus, Eye, UserRound, MousePointerClick, ClipboardCheck,
  MoreHorizontal, CheckCircle2, AlertTriangle, Image as ImageIcon, FileText,
  MessageCircle, Newspaper, Heart, UploadCloud, WandSparkles, ShieldCheck, XCircle,
  Search, ChevronDown, Save, RefreshCw, Database, Loader2, BrainCircuit, Copy, ExternalLink, Trash2
} from "lucide-react";
import { scorePost, qualityLabel } from "./lib/quality";

const navItems = [
  [LayoutDashboard,"대시보드","dashboard"],
  [Users,"Threads 계정 관리","accounts"],
  [SlidersHorizontal,"콘텐츠 설정","content"],
  [BrainCircuit,"스타일 학습","learning"],
  [Sparkles,"AI 게시물 생성","writer"],
  [CalendarDays,"게시 스케줄러","scheduler"],
  [Database,"캐시 로그","cachelogs"],
  [BrainCircuit,"학습 로그","learninglogs"],
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
  const num=Number(String(n??0).replaceAll(",",""));
  return (Number.isFinite(num)?num:0).toLocaleString("ko-KR");
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
  const [copied,setCopied]=useState(null);
  const [editing,setEditing]=useState(null);
  const [editSaving,setEditSaving]=useState(false);
  const [deleting,setDeleting]=useState(null);
  const filtered=accounts.filter(a=>[a.name,a.handle,a.sector,a.persona].join(" ").toLowerCase().includes(q.toLowerCase()));

  async function copyReferral(account){
    const code=account.telegram_source_code;
    if(!code) return;
    const url=`${window.location.origin}/r/${code}`;
    try{
      await navigator.clipboard.writeText(url);
      setCopied(account.id);
      setTimeout(()=>setCopied(null),1600);
    }catch{
      window.prompt("프로필 유입 링크를 복사해주세요.",url);
    }
  }

  async function saveAccountEdit(){
    if(!editing?.id) return;
    setEditSaving(true);setMessage("");
    try{
      await api("/api/accounts",{method:"PATCH",body:JSON.stringify({
        id:editing.id,
        name:editing.name,
        sector:editing.sector,
        target_audience:editing.target_audience,
        tone:editing.tone,
        persona:editing.persona,
        daily_post_goal:Number(editing.daily_post_goal||0),
        cta_ratio:Number(editing.cta_ratio||0),
        is_active:editing.is_active
      })});
      setEditing(null);
      setMessage("계정 설정 수정 완료");
      await onRefresh();
    }catch(e){
      setMessage("계정 수정 실패 · "+(e.message||"server_error"));
    }finally{setEditSaving(false);}
  }

  async function deleteAccount(account){
    if(!account?.id) return;
    const confirmed=window.confirm(
      `${account.name} (${account.handle}) 계정을 ROADER에서 삭제할까요?\n\n이 계정의 예약글, 게시물, 학습 데이터도 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
    );
    if(!confirmed) return;

    setDeleting(account.id);
    setMessage("");
    try{
      await api("/api/accounts",{method:"DELETE",body:JSON.stringify({id:account.id})});
      if(editing?.id===account.id) setEditing(null);
      setMessage(`계정 삭제 완료 · ${account.handle}`);
      await onRefresh();
    }catch(e){
      setMessage("계정 삭제 실패 · "+(e.message||"server_error"));
    }finally{
      setDeleting(null);
    }
  }

  async function connectThreads(accountId){
    setConnecting(accountId);setMessage("");
    try{
      const r=await api("/api/threads/connect?state=account_"+accountId);
      if(!r.url) throw new Error("missing_oauth_url");
      const width=620,height=760;
      const left=Math.max(0,window.screenX+(window.outerWidth-width)/2);
      const top=Math.max(0,window.screenY+(window.outerHeight-height)/2);
      const popup=window.open(r.url,"roader_threads_oauth","popup=yes,width="+width+",height="+height+",left="+left+",top="+top+",resizable=yes,scrollbars=yes");
      if(!popup) throw new Error("popup_blocked");
      popup.focus();
    }catch(e){
      setMessage(e.message==="popup_blocked"?"브라우저에서 팝업이 차단되었습니다. ROADER 팝업을 허용한 뒤 다시 시도해주세요.":e.message==="meta_threads_not_configured"?"Meta Threads 환경변수가 아직 Production에 적용되지 않았습니다.":"Threads 연결을 시작하지 못했습니다.");
      setConnecting(null);
    }
  }
  useEffect(()=>{
    function onOAuthMessage(event){
      if(event.origin!==window.location.origin) return;
      const data=event.data||{};
      if(data.type!=="roader_threads_oauth") return;
      setConnecting(null);
      if(data.status==="connected"){
        setMessage("Threads 연결 완료 · 실제 계정 "+(data.username||""));
        onRefresh();
        return;
      }
      if(data.status==="handle_mismatch"){
        setMessage("연결 차단 · ROADER에는 "+data.expected+" 계정으로 등록되어 있지만 Meta 인증은 "+data.actual+" 계정으로 진행됐습니다. Threads에서 연결할 계정으로 전환한 뒤 다시 시도해주세요.");
        return;
      }
      if(data.status==="already_connected"){
        setMessage("연결 차단 · 이 Threads 계정은 이미 "+(data.connected_name||"다른 ROADER 계정")+(data.connected_handle?" ("+data.connected_handle+")":"")+"에 연결되어 있습니다.");
        return;
      }
      setMessage("Threads 연결 실패 · "+(data.error||"oauth_error"));
    }
    window.addEventListener("message",onOAuthMessage);
    return ()=>window.removeEventListener("message",onOAuthMessage);
  },[onRefresh]);

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
        <p>{a.persona||"페르소나 미설정"}</p><div className="chips"><span>{a.sector||"섹터 미설정"}</span><span>{a.daily_post_goal?`하루 ${a.daily_post_goal}개`:"게시 목표 미설정"}</span><span>{a.cta_ratio!=null&&Number(a.cta_ratio)>0?`CTA ${a.cta_ratio}%`:"CTA 미설정"}</span>{a.performance_sample_count>0&&<span>성과학습 {a.performance_confidence}% · {a.performance_sample_count}건</span>}{a.threads_username&&<span>실제 연결 {a.threads_username}</span>}{a.threads_user_id&&<span>ID {a.threads_user_id}</span>}</div>
        {a.telegram_source_code&&<div className="referral-box">
          <div><b>프로필 유입 링크</b><span>{`${window.location.origin}/r/${a.telegram_source_code}`}</span></div>
          <button className="ghost referral-copy" onClick={()=>copyReferral(a)}><Copy size={14}/>{copied===a.id?"복사됨":"복사"}</button>
          <a className="ghost referral-open" href={`/r/${a.telegram_source_code}`} target="_blank" rel="noreferrer"><ExternalLink size={14}/>열기</a>
        </div>}</div>
        <div className="account-actions">
          <button className="ghost" onClick={()=>setEditing({...a})}><SlidersHorizontal size={15}/> 설정 수정</button>
          <button className="ghost danger-action" onClick={()=>deleteAccount(a)} disabled={deleting===a.id}>
            {deleting===a.id?<Loader2 className="spin" size={15}/>:<Trash2 size={15}/>}
            {deleting===a.id?"삭제 중":"삭제"}
          </button>
          <button className={a.threads_user_id?"ghost":"primary"} onClick={()=>connectThreads(a.id)} disabled={connecting===a.id}>
            {connecting===a.id?<Loader2 className="spin" size={15}/>:<Send size={15}/>}
            {a.threads_user_id?"Threads 다시 연결":"새 로그인으로 연결"}
          </button>
        </div>
      </div>)}</div>}
    </div>
    {editing&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setEditing(null)}>
      <div className="modal-card">
        <div className="modal-heading"><div><h2>계정 설정 수정</h2><p>{editing.handle}</p></div></div>
        <div className="form-grid">
          <div><label>계정명</label><input value={editing.name||""} onChange={e=>setEditing(v=>({...v,name:e.target.value}))}/></div>
          <div><label>섹터</label><input value={editing.sector||""} onChange={e=>setEditing(v=>({...v,sector:e.target.value}))}/></div>
          <div><label>주요 타깃</label><input value={editing.target_audience||""} onChange={e=>setEditing(v=>({...v,target_audience:e.target.value}))}/></div>
          <div><label>기본 톤</label><input value={editing.tone||""} onChange={e=>setEditing(v=>({...v,tone:e.target.value}))}/></div>
          <div><label>하루 게시 목표</label><input type="number" min="0" max="8" value={editing.daily_post_goal??0} onChange={e=>setEditing(v=>({...v,daily_post_goal:e.target.value}))}/></div>
          <div><label>CTA 비율</label><input type="number" min="0" max="100" value={editing.cta_ratio??0} onChange={e=>setEditing(v=>({...v,cta_ratio:e.target.value}))}/></div>
        </div>
        <label>페르소나 / 작성 규칙</label>
        <textarea rows="7" value={editing.persona||""} onChange={e=>setEditing(v=>({...v,persona:e.target.value}))}/>
        <label className="check-row"><input type="checkbox" checked={editing.is_active!==false} onChange={e=>setEditing(v=>({...v,is_active:e.target.checked}))}/> 자동 운영 활성화</label>
        <div className="modal-actions">
          <button className="ghost" onClick={()=>setEditing(null)}>취소</button>
          <button className="primary" onClick={saveAccountEdit} disabled={editSaving}>{editSaving?<Loader2 className="spin" size={16}/>:<Save size={16}/>} 저장</button>
        </div>
      </div>
    </div>}
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
      if(e.message==="threads_account_not_connected") setMessage("선택한 ROADER 계정을 먼저 Threads에 연결해주세요.");
      else if(e.message==="threads_token_expired") setMessage("Threads 연결 토큰이 만료되었습니다. 계정 관리에서 이 계정을 'Threads 다시 연결' 한 번 해주세요.");
      else if(e.message==="threads_profile_discovery_required") setMessage("공개 프로필 수집 권한 오류가 발생했습니다. 권한 진단상 scope는 정상이라 Meta 원문 오류를 확인해주세요."+(e.details?" · "+e.details:""));
      else setMessage("참고 계정 게시물 자동 수집에 실패했습니다."+(e.details?" · "+e.details:""));
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
      setMessage(`최근 스타일 학습 완료 · 신규 샘플 ${r.inserted}개 · 신뢰도 ${r.confidence}%`);
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
    <div className="hero-row"><div><h1>스타일 학습</h1><p>참고 계정의 최근 게시물 5~10개에서 현재 작성 패턴만 추출해 계정별 스타일로 저장합니다.</p></div><button className="ghost" onClick={()=>load()}><RefreshCw size={15}/> 새로고침</button></div>

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

        <div className="learning-note">
          <b>최근 게시물 5~10개만 넣어주세요.</b><br/>
          오래된 게시물까지 섞기보다 최근 작성물을 기준으로 학습하면 현재 말투 · 문장 길이 · 훅 · 줄바꿈 · 마무리 패턴을 더 정확하게 반영합니다.
        </div>

        <label>최근 게시물 샘플 *</label>
        <textarea rows="14" value={samplesText} onChange={e=>setSamplesText(e.target.value)} placeholder={"최근 게시물 원문을 5~10개 붙여넣으세요.\n\n게시물과 게시물 사이에는 아래 구분자를 넣어주세요.\n===POST===\n\n예시)\n첫 번째 게시물 원문\n===POST===\n두 번째 게시물 원문"}/>
        <div className="learning-note">권장: 최근 게시물 5~10개 · 최소 3개 이상. 원문 내용 자체를 복제하지 않고 반복되는 작성 패턴만 추출합니다.</div>
        <button className="generate" onClick={learn} disabled={loading}>{loading?<Loader2 className="spin" size={17}/>:<BrainCircuit size={17}/>} 최근 게시물 스타일 학습</button>

        <details style={{marginTop:14}}>
          <summary style={{cursor:"pointer",fontSize:12,fontWeight:700,color:"#64748b"}}>실험 기능 · Threads 공개 프로필 자동 수집</summary>
          <div style={{marginTop:10}}>
            <div className={`integration-strip ${selected?.threads_user_id?"ready":"waiting"}`}>
              <div><b>Threads 공개 프로필 자동 수집</b><span>{selected?.threads_user_id?`연결 계정 ${selected.threads_username||selected.handle} 토큰 사용`:"선택한 ROADER 계정의 Threads 연결 필요"}</span></div>
              <span className={`badge ${selected?.threads_user_id?"green":"gray"}`}>{selected?.threads_user_id?"연결됨":"미연결"}</span>
            </div>
            <button className="generate secondary-generate" onClick={autoFetch} disabled={loading||!sourceHandle.trim()||!selected?.threads_user_id}>{loading?<Loader2 className="spin" size={17}/>:<RefreshCw size={17}/>} 자동 가져오기 + 학습</button>
          </div>
        </details>
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
  const mediaMode="text";
  const [text,setText]=useState("");
  const image=null;
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
    hasImage:false,
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
        <label>게시 방식</label><div className="choice-row"><button className="choice active" type="button"><FileText size={15}/> 텍스트만</button></div>
        <label>게시물 본문</label><textarea rows="15" value={text} onChange={e=>setText(e.target.value)} placeholder="Threads에 게시할 본문을 작성하세요."/>
        <div className="reply-editor">
          <div className="reply-editor-head"><label>게시 후 1차 댓글</label><span>{replyText.trim()?"자동 등록":"댓글 등록 안 함"}</span></div>
          <textarea rows="7" value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="비워두면 1차 댓글을 등록하지 않습니다."/>
          <small>본문 게시가 성공하면 이 내용을 바로 첫 댓글로 등록합니다. 프로필 유입용 문구는 게시 전 수정할 수 있습니다.</small>
        </div>
        <div className="publish-actions">
          <button className="ghost draft-action" onClick={saveDraft} disabled={saving||publishing||generating||!text.trim()||quality.status==="blocked"}>{saving?<Loader2 className="spin" size={17}/>:<Save size={17}/>} 초안 저장</button>
          <button className="generate publish-action" onClick={publishNow} disabled={publishing||saving||generating||!connected||!text.trim()||quality.status==="blocked"}>{publishing?<Loader2 className="spin" size={17}/>:<Send size={17}/>} 지금 Threads에 게시</button>
        </div>
        {message&&<div className={messageType==="error"?"form-error":"save-message"}>{message}</div>}
      </div>
      <div className="right-stack">
        <div className="panel">
          <SectionTitle title="게시물 미리보기" action={<span className="tag">{type}</span>}/>
          <div className="post-preview-head"><div className="avatar">{String(selected?.name||"?").slice(0,1)}</div><div><b>{selected?.name}</b><span>{selected?.handle}</span></div></div>
          <div className="post-live-preview">{text||<span className="muted">작성한 본문이 여기에 표시됩니다.</span>}</div>

        </div>
        <QualityPanel quality={quality}/>
      </div>
    </div>
  </>;
}

function Scheduler({schedules,onRefresh}){
  const [editing,setEditing]=useState(null);
  const [editText,setEditText]=useState("");
  const [editReply,setEditReply]=useState("");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [preparing,setPreparing]=useState(false);
  const [autoTried,setAutoTried]=useState(false);

  const editQuality=useMemo(()=>scorePost({
    text:editText,
    mediaMode:"text",
    hasImage:false,
    recentTexts:[]
  }),[editText]);

  const now=Date.now();
  const visibleSchedules=useMemo(
    ()=>schedules.filter(s=>{
      const t=new Date(s.scheduled_at).getTime();
      if(!Number.isFinite(t)) return true;
      return t>=now-5*60*1000 || ["scheduled","publishing","publish_failed"].includes(String(s.status));
    }),
    [schedules,now]
  );

  const stats=useMemo(()=>({
    total:visibleSchedules.length,
    ready:visibleSchedules.filter(s=>s.status==="scheduled").length,
    waiting:visibleSchedules.filter(s=>["generation_pending","running"].includes(String(s.status))).length,
    issues:visibleSchedules.filter(s=>["quality_failed","generation_failed","topic_duplicate","publish_failed","connection_required"].includes(String(s.status))).length
  }),[visibleSchedules]);

  const needsPreparation=useMemo(
    ()=>visibleSchedules.some(s=>["generation_pending","quality_failed","generation_failed","topic_duplicate","plan_failed","publish_failed"].includes(String(s.status))),
    [visibleSchedules]
  );

  async function prepareNow(silent=false){
    if(preparing) return;
    setPreparing(true);
    if(!silent) setMessage("");
    try{
      const r=await api("/api/automation/prepare",{method:"POST",body:JSON.stringify({})});
      const planning=(r.planning||[]).flatMap(x=>x.rows||[]);
      const scheduled=planning.filter(x=>x.status==="scheduled").length;
      const retried=planning.filter(x=>["quality_failed","generation_failed","topic_duplicate"].includes(x.status)).length;
      if(!silent) setMessage(`예약 준비 완료 · 예약 ${scheduled}개${retried?` · 재시도 ${retried}개`:""}`);
      await onRefresh();
    }catch(e){
      if(!silent) setMessage("예약 준비 실패 · "+(e.details||e.message||"server_error"));
    }finally{
      setPreparing(false);
    }
  }

  useEffect(()=>{
    if(autoTried||preparing||!needsPreparation) return;
    setAutoTried(true);
    prepareNow(true);
  },[autoTried,preparing,needsPreparation]);

  function openEdit(row){
    if(!row.post_id||!row.body) return;
    setEditing(row);
    setEditText(row.body||"");
    setEditReply(row.reply_text||"");
    setMessage("");
  }

  async function saveEdit(){
    if(!editing?.post_id||!editText.trim()) return;
    if(editQuality.status==="blocked"){
      setMessage("치명적 품질 문제가 있어 저장할 수 없습니다. 표시된 차단 사유만 수정해주세요.");
      return;
    }
    setSaving(true);setMessage("");
    try{
      await api("/api/posts",{method:"PATCH",body:JSON.stringify({
        id:editing.post_id,
        body:editText,
        reply_text:editReply,
        quality_score:editQuality.score,
        quality_status:editQuality.status,
        quality_details:editQuality
      })});
      setMessage("예약 게시물 수정 완료");
      setEditing(null);
      await onRefresh();
    }catch(e){
      setMessage("예약글 수정 실패 · "+(e.message||"server_error"));
    }finally{setSaving(false);}
  }

  function statusLabel(status){
    return {
      generation_pending:"생성 대기",
      connection_required:"Threads 연결 필요",
      running:"생성 중",
      generation_failed:"생성 재시도",
      topic_duplicate:"다른 주제 탐색",
      quality_failed:"내용 보정 필요",
      plan_failed:"생성 재시도",
      scheduled:"게시 예정",
      publishing:"게시 중",
      published:"게시 완료",
      publish_failed:"게시 재시도"
    }[String(status)]||String(status||"-");
  }

  function statusTone(status){
    if(status==="scheduled"||status==="published") return "ready";
    if(["generation_pending","running","topic_duplicate"].includes(String(status))) return "waiting";
    return "issue";
  }

  return <>
    <div className="hero-row scheduler-hero">
      <div><h1>게시 스케줄러</h1><p>앞으로 올라갈 게시물만 한눈에 확인합니다. 품질점수는 개선 기준이고, 치명적 문제가 없으면 자동 게시됩니다.</p></div>
      <button className="primary" onClick={()=>prepareNow(false)} disabled={preparing}>
        {preparing?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>}
        {preparing?"예약글 준비 중":"예약글 지금 준비"}
      </button>
    </div>

    <div className="scheduler-summary">
      <div><span>남은 슬롯</span><b>{stats.total}</b></div>
      <div><span>게시 예정</span><b>{stats.ready}</b></div>
      <div><span>생성 중</span><b>{stats.waiting}</b></div>
      <div><span>확인 필요</span><b>{stats.issues}</b></div>
    </div>

    {message&&<div className="save-message">{message}</div>}

    {visibleSchedules.length===0
      ?<div className="panel"><EmptyState title="남은 게시 슬롯이 없습니다." desc="오늘 예정된 게시가 모두 끝났거나 자동 운영 대상 계정이 없습니다."/></div>
      :<div className="scheduler-grid">
        {visibleSchedules.map(s=><article className={`schedule-card ${statusTone(s.status)}`} key={s.id}>
          <div className="schedule-card-head">
            <div>
              <span className="schedule-time">{new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(s.scheduled_at))}</span>
              <b>{s.account_name}</b>
            </div>
            <StatusBadge>{statusLabel(s.status)}</StatusBadge>
          </div>

          <div className="schedule-topic">{s.generated_topic||(
            s.status==="connection_required"?"계정 연결 필요":
            s.status==="generation_pending"?"주제 선정 대기":
            s.status==="running"?"주제 선정 중":"자동 생성 대기"
          )}</div>

          <div className="schedule-body">
            {s.body
              ?String(s.body).slice(0,210)+(String(s.body).length>210?"…":"")
              :s.status==="connection_required"
                ?"계정관리에서 Threads 연결을 완료하면 자동 생성이 시작됩니다."
                :s.status==="quality_failed"
                  ?(s.last_error||"치명적 차단 사유를 보정한 뒤 다시 예약합니다.")
                  :s.status==="generation_failed"
                    ?(s.last_error||"생성에 실패해 다음 실행에서 자동 재시도합니다.")
                    :s.status==="topic_duplicate"
                      ?"오늘 사용한 주제와 겹쳐 다른 주제를 찾고 있습니다."
                      :"자동 생성기가 게시물을 준비하고 있습니다."
            }
          </div>

          <div className="schedule-card-foot">
            <div className="schedule-quality">
              <span>품질</span>
              <b>{s.quality_score??"-"}</b>
              <small>{s.quality_score!=null?(Number(s.quality_score)>=90?"목표 달성":"개선 중"):"대기"}</small>
            </div>
            {s.status==="scheduled"&&s.post_id
              ?<button className="ghost" onClick={()=>openEdit(s)}>수정</button>
              :null}
          </div>
        </article>)}
      </div>}

    {editing&&<div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setEditing(null)}>
      <div className="modal-card schedule-edit-modal">
        <div className="modal-heading"><div><h2>예약 게시물 수정</h2><p>{editing.account_name} · {fmtDate(editing.scheduled_at)}</p></div></div>
        <label>본문</label>
        <textarea rows="14" value={editText} onChange={e=>setEditText(e.target.value)}/>
        <label>1차 댓글</label>
        <textarea rows="6" value={editReply} onChange={e=>setEditReply(e.target.value)}/>
        <div className={editQuality.status!=="blocked"?"save-message":"form-error"}>
          현재 품질 {editQuality.score}점 / 목표 {editing.auto_publish_threshold||90}점
          {editQuality.status==="blocked"
            ?(editQuality.blockers?.length?" · "+editQuality.blockers.join(" · "):" · 게시 차단 사유가 있습니다.")
            :" · 치명적 문제 없음, 저장 가능"}
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={()=>setEditing(null)}>취소</button>
          <button className="primary" onClick={saveEdit} disabled={saving||editQuality.status==="blocked"}>{saving?<Loader2 className="spin" size={16}/>:<Save size={16}/>} 수정 저장</button>
        </div>
      </div>
    </div>}
  </>;
}


function CacheLogs(){
  const [logs,setLogs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);setMessage("");
    try{
      const r=await api("/api/logs/cache");
      setLogs(r.logs||[]);
    }catch(e){
      setMessage("캐시 로그를 불러오지 못했습니다. · "+(e.details||e.message||"server_error"));
    }finally{setLoading(false);}
  }

  useEffect(()=>{load();},[]);

  const stats=useMemo(()=>({
    total:logs.length,
    success:logs.filter(x=>["scheduled","published"].includes(String(x.status))).length,
    retry:logs.filter(x=>["generation_failed","quality_failed","topic_duplicate","publish_failed","plan_failed"].includes(String(x.status))).length,
    running:logs.filter(x=>x.status==="running").length
  }),[logs]);

  const label={
    running:"처리 중",
    scheduled:"예약 완료",
    published:"게시 완료",
    generation_failed:"생성 실패",
    quality_failed:"품질 보정",
    topic_duplicate:"주제 재선정",
    publish_failed:"게시 재시도",
    plan_failed:"계획 실패"
  };

  return <>
    <div className="hero-row"><div><h1>캐시 로그</h1><p>자동 생성·예약·게시 과정에서 쌓이는 작업 상태를 확인합니다.</p></div><button className="ghost" onClick={load} disabled={loading}>{loading?<Loader2 className="spin" size={15}/>:<RefreshCw size={15}/>} 새로고침</button></div>
    <div className="log-summary">
      <div><span>전체 로그</span><b>{stats.total}</b></div>
      <div><span>정상 처리</span><b>{stats.success}</b></div>
      <div><span>재시도/보정</span><b>{stats.retry}</b></div>
      <div><span>처리 중</span><b>{stats.running}</b></div>
    </div>
    {message&&<div className="form-error">{message}</div>}
    <div className="panel">
      {loading?<div className="loading-line"><Loader2 className="spin"/> 로그 불러오는 중</div>:logs.length===0?<EmptyState title="아직 캐시 로그가 없습니다." desc="자동화가 실행되면 작업 로그가 여기에 쌓입니다."/>:
      <div className="log-list">{logs.map(x=><div className="log-row" key={x.id}>
        <div className="log-time"><b>{fmtDate(x.updated_at)}</b><span>{x.account_name} · {String(x.slot_hour).padStart(2,"0")}:10</span></div>
        <div className="log-main">
          <div className="log-title"><b>{x.generated_topic||x.account_name}</b><StatusBadge>{label[x.status]||x.status}</StatusBadge></div>
          <p>{x.last_error||(
            x.status==="published"?"Threads 게시까지 완료되었습니다.":
            x.status==="scheduled"?"품질검사를 통과해 예약되었습니다.":
            x.status==="running"?"자동화가 현재 이 슬롯을 처리하고 있습니다.":
            "자동화 작업 상태가 갱신되었습니다."
          )}</p>
        </div>
        <div className="log-meta"><span>품질</span><b>{x.quality_score??"-"}</b><small>{x.attempt_count?("시도 "+x.attempt_count+"회"):"-"}</small></div>
      </div>)}</div>}
    </div>
  </>;
}

function LearningLogs(){
  const [data,setData]=useState({runs:[],profiles:[]});
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);setMessage("");
    try{
      const r=await api("/api/logs/learning");
      setData({runs:r.runs||[],profiles:r.profiles||[]});
    }catch(e){
      setMessage("학습 로그를 불러오지 못했습니다. · "+(e.details||e.message||"server_error"));
    }finally{setLoading(false);}
  }

  useEffect(()=>{load();},[]);

  return <>
    <div className="hero-row"><div><h1>학습 로그</h1><p>실제 게시 성과를 바탕으로 ROADER가 계정별 작성 전략을 어떻게 바꾸고 있는지 확인합니다.</p></div><button className="ghost" onClick={load} disabled={loading}>{loading?<Loader2 className="spin" size={15}/>:<RefreshCw size={15}/>} 새로고침</button></div>
    {message&&<div className="form-error">{message}</div>}

    <div className="learning-profile-grid">
      {data.profiles.map(p=>{
        const s=p.strategy||{};
        const winners=Array.isArray(s.winning_patterns)?s.winning_patterns:[];
        const avoids=Array.isArray(s.avoid_patterns)?s.avoid_patterns:[];
        const types=Array.isArray(s.preferred_post_types)?s.preferred_post_types:[];
        const hours=Array.isArray(s.preferred_hours_kst)?s.preferred_hours_kst:[];
        return <div className="learning-profile-card" key={p.account_id}>
          <div className="learning-profile-head"><div><b>{p.account_name}</b><span>{p.handle}</span></div><div className="learning-confidence"><strong>{p.confidence}%</strong><small>신뢰도</small></div></div>
          <div className="learning-profile-stats"><span>학습 표본 <b>{p.sample_count}개</b></span><span>최근 학습 <b>{fmtDate(p.last_learned_at)}</b></span></div>
          <div className="learning-rule-block"><label>잘된 패턴</label>{winners.length?<ul>{winners.slice(0,4).map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>아직 충분한 성과 패턴이 없습니다.</p>}</div>
          <div className="learning-rule-block avoid"><label>피할 패턴</label>{avoids.length?<ul>{avoids.slice(0,4).map((x,i)=><li key={i}>{x}</li>)}</ul>:<p>아직 회피 패턴이 없습니다.</p>}</div>
          <div className="learning-mini-grid">
            <div><span>우선 유형</span><b>{types.length?types.join(" · "):"-"}</b></div>
            <div><span>좋은 시간대</span><b>{hours.length?hours.map(h=>String(h).padStart(2,"0")+":00").join(" · "):"-"}</b></div>
            <div><span>추천 길이</span><b>{s.target_length_min&&s.target_length_max?(s.target_length_min+"~"+s.target_length_max+"자"):"-"}</b></div>
            <div><span>실험 비율</span><b>{s.exploration_ratio!=null?(s.exploration_ratio+"%"):"-"}</b></div>
          </div>
          {s.hook_guidance&&<div className="learning-guidance"><span>다음 훅 방향</span><p>{s.hook_guidance}</p></div>}
          {s.engagement_guidance&&<div className="learning-guidance"><span>반응 유도 방향</span><p>{s.engagement_guidance}</p></div>}
        </div>;
      })}
    </div>

    <div className="panel">
      <SectionTitle title="학습 이력" action={<span className="tag">성과 기반 자동 갱신</span>}/>
      {loading?<div className="loading-line"><Loader2 className="spin"/> 학습 데이터 불러오는 중</div>:data.runs.length===0?<EmptyState title="아직 학습 이력이 없습니다." desc="성과 데이터가 6개 이상 쌓이면 계정별 자동 학습이 시작됩니다."/>:
      <div className="table-wrap"><table><thead><tr><th>학습시간</th><th>계정</th><th>표본</th><th>신뢰도</th><th>상태</th><th>학습 요약</th></tr></thead><tbody>
        {data.runs.map(r=>{
          const s=r.summary?.strategy||r.summary||{};
          return <tr key={r.id}>
            <td>{fmtDate(r.created_at)}</td>
            <td>{r.account_name}</td>
            <td>{r.sample_count}개</td>
            <td>{r.confidence}%</td>
            <td><StatusBadge>{r.status==="completed"?"학습 완료":r.status}</StatusBadge></td>
            <td className="learning-log-summary">{s.rationale||s.hook_guidance||"성과 데이터를 기반으로 전략 프로필을 갱신했습니다."}</td>
          </tr>;
        })}
      </tbody></table></div>}
    </div>
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
  const [accountRows,setAccountRows]=useState([]);
  const [accountLoading,setAccountLoading]=useState(true);
  const [accountError,setAccountError]=useState("");
  const [selected,setSelected]=useState("all");
  const number=v=>{const n=Number(String(v??0).replaceAll(",",""));return Number.isFinite(n)?n:0;};

  async function loadAccounts(){
    setAccountLoading(true);setAccountError("");
    try{
      const r=await api("/api/analytics/accounts");
      setAccountRows(r.accounts||[]);
    }catch(e){setAccountError("계정별 성과 조회 실패 · "+(e.details||e.message));}
    finally{setAccountLoading(false);}
  }
  useEffect(()=>{loadAccounts();},[]);

  async function syncInsights(){
    setSyncing(true);setSyncMessage("");
    try{
      const r=await api("/api/metrics/sync",{method:"POST",body:JSON.stringify({})});
      setSyncMessage("성과 갱신 완료 · 성공 "+(r.synced||0)+"개"+(r.failed?" · 실패 "+r.failed+"개":""));
      await onRefresh();
      await loadAccounts();
    }catch(e){setSyncMessage("성과 갱신 실패 · "+(e.details||e.message||"server_error"));}
    finally{setSyncing(false);}
  }

  const scored=accountRows.map(a=>{
    const views=number(a.views),posts=number(a.published_count),measured=number(a.measured_count);
    const reactions=number(a.likes)+number(a.replies)+number(a.reposts)+number(a.quotes)+number(a.shares);
    const engagement=views>0?reactions/views*100:null;
    const avgViews=measured>0?views/measured:0;
    const engagementScore=engagement===null?0:Math.min(100,engagement*10);
    const reachScore=measured?Math.min(100,Math.log10(avgViews+1)*30):0;
    const consistency=number(a.daily_post_goal)>0?Math.min(100,number(a.posted_7d)/(number(a.daily_post_goal)*7)*100):0;
    const quality=Math.max(0,Math.min(100,number(a.avg_quality)));
    const learning=Math.max(0,Math.min(100,number(a.learning_confidence)));
    const score=measured>=3?Math.round(reachScore*.3+engagementScore*.3+consistency*.15+quality*.15+learning*.1):null;
    return {...a,views,posts,measured,engagement,avgViews,score,quality,consistency,learning};
  });
  const displayed=selected==="all"?scored:scored.filter(a=>String(a.account_id)===selected);

  return <>
    <div className="hero-row"><div><h1>성과 분석</h1><p>Threads 실제 인사이트와 계정별 운영 성과를 확인합니다.</p></div><button className="primary" onClick={syncInsights} disabled={syncing}>{syncing?<Loader2 className="spin" size={16}/>:<RefreshCw size={16}/>} {syncing?"Threads 인사이트 수집 중":"성과 지금 갱신"}</button></div>
    {syncMessage&&<div className="analytics-sync-message">{syncMessage}</div>}
    <div className="stats analytics-stats">
      <Stat icon={Eye} label="전체 조회수" value={t.views}/>
      <Stat icon={Heart} label="좋아요" value={t.likes}/>
      <Stat icon={MessageCircle} label="답글" value={t.replies}/>
      <Stat icon={RefreshCw} label="리포스트" value={t.reposts}/>
    </div>
    <div className="stats analytics-stats secondary">
      <Stat icon={Newspaper} label="인용" value={t.quotes}/>
      <Stat icon={Send} label="공유" value={t.shares}/>
      <Stat icon={MousePointerClick} label="봇 진입" value={t.bot_entries}/>
      <Stat icon={ClipboardCheck} label="신청 완료" value={t.applications}/>
    </div>
    <div className="panel">
      <div className="analytics-section-head"><div><h2>계정별 성과 및 현재점수</h2><p>점수는 ROADER 운영 지표이며 Threads 공식 계정 점수는 아닙니다.</p></div><select value={selected} onChange={e=>setSelected(e.target.value)}><option value="all">전체 계정</option>{accountRows.map(a=><option value={String(a.account_id)} key={a.account_id}>{a.account_name}</option>)}</select></div>
      {accountError&&<div className="form-error">{accountError}</div>}
      {accountLoading?<div className="loading-line"><Loader2 className="spin"/> 계정별 성과 집계 중</div>:
      <div className="account-performance-grid">{displayed.map(a=><div className="account-performance-card" key={a.account_id}>
        <div className="account-performance-head"><div><b>{a.account_name}</b><span>{a.handle} · 게시 {fmt(a.posts)}건 · 측정 {fmt(a.measured)}건</span></div><div className="account-performance-score"><strong>{a.score===null?"평가 대기":a.score+"점"}</strong><small>{a.score===null?"최소 3개 게시물의 성과 측정 필요":"ROADER 현재점수"}</small></div></div>
        <div className="account-performance-metrics">
          <div><span>조회수</span><b>{fmt(a.views)}</b></div>
          <div><span>좋아요</span><b>{fmt(a.likes)}</b></div>
          <div><span>답글</span><b>{fmt(a.replies)}</b></div>
          <div><span>참여율</span><b>{a.engagement===null?"자료 없음":a.engagement.toFixed(2)+"%"}</b></div>
          <div><span>리포스트·인용·공유</span><b>{fmt(number(a.reposts)+number(a.quotes)+number(a.shares))}</b></div>
          <div><span>평균 조회수</span><b>{a.measured?fmt(Math.round(a.avgViews)):"자료 없음"}</b></div>
        </div>
        <div className="account-performance-breakdown">운영 일관성 {Math.round(a.consistency)} · 콘텐츠 품질 {Math.round(a.quality)} · 학습 신뢰도 {Math.round(a.learning)} <span>최근 측정 {fmtDate(a.last_measured_at)}</span></div>
      </div>)}</div>}
    </div>
    <div className="panel">
      <SectionTitle title="최근 게시물 성과" action={<span className="tag">실제 게시 완료 기준</span>}/>
      {rows.length===0?<EmptyState title="게시 완료 데이터가 없습니다." desc="Threads에 실제 게시된 글이 생기면 반응을 확인할 수 있습니다."/>:
      <div className="table-wrap"><table><thead><tr><th>계정</th><th>게시물</th><th>조회</th><th>좋아요</th><th>답글</th><th>리포스트</th><th>인용</th><th>공유</th></tr></thead><tbody>
        {rows.map(p=><tr key={p.id}><td>{p.account_name}</td><td className="analytics-post-body">{String(p.body||"").slice(0,68)}{String(p.body||"").length>68?"…":""}</td><td>{fmt(p.views)}</td><td>{fmt(p.likes)}</td><td>{fmt(p.replies)}</td><td>{fmt(p.reposts)}</td><td>{fmt(p.quotes)}</td><td>{fmt(p.shares)}</td></tr>)}
      </tbody></table></div>}
    </div>
    <div className="analytics-note">현재점수 = 평균조회수 30% + 참여율 30% + 최근 7일 게시 일관성 15% + 콘텐츠 품질 15% + 학습 신뢰도 10%. 데이터가 부족하면 점수를 확정하지 않습니다. 프로필 방문은 추정하지 않습니다.</div>
  </>;
}

function Leads({leads,onRefresh}){
  return <><div className="hero-row"><div><h1>텔레그램 신청 관리</h1><p>Telegram 신청봇에서 저장된 실제 신청자만 표시합니다.</p></div><button className="ghost" onClick={onRefresh}><RefreshCw size={15}/> 새로고침</button></div>
    <div className="panel">{leads.length===0?<EmptyState title="아직 접수된 신청이 없습니다." desc="Telegram 신청봇에서 접수된 실제 신청자가 여기에 표시됩니다."/>:<div className="table-wrap"><table><thead><tr><th>접수번호</th><th>신청일</th><th>이름</th><th>전화번호</th><th>연령</th><th>관심분야</th><th>경험</th><th>유입코드</th><th>상태</th></tr></thead><tbody>
      {leads.map(l=><tr key={l.id}><td><b>{l.receipt_number||"-"}</b></td><td>{fmtDate(l.created_at)}</td><td>{l.display_name||"-"}</td><td>{l.phone_number||"-"}</td><td>{l.age_group||"-"}</td><td>{l.interest||"-"}</td><td>{l.experience||"-"}</td><td>{l.source_code||"-"}</td><td><StatusBadge>{l.status}</StatusBadge></td></tr>)}
    </tbody></table></div>}</div>
  </>;
}

function SettingsPage(){
  const [state,setState]=useState(null);
  const [loading,setLoading]=useState(true);
  const [connecting,setConnecting]=useState(false);
  const [message,setMessage]=useState("");

  async function load(){
    setLoading(true);
    try{
      const r=await api("/api/integrations");
      setState(r);
    }catch(e){
      setMessage("연결 상태를 불러오지 못했습니다.");
    }finally{setLoading(false);}
  }

  async function connectTelegram(){
    setConnecting(true);setMessage("");
    try{
      const r=await api("/api/setup",{method:"POST",body:JSON.stringify({source:"settings"})});
      setMessage(r.ok?"Telegram webhook 연결이 완료되었습니다.":"Telegram 연결에 실패했습니다.");
      await load();
    }catch(e){
      setMessage("Telegram 연결 실패 · "+(e.details||e.message||"server_error"));
    }finally{setConnecting(false);}
  }

  useEffect(()=>{load();},[]);

  const telegramConnected=!!state?.telegram?.connected;
  const aiConnected=!!state?.ai?.configured;
  const threadsConnected=!!state?.threads?.configured;

  return <><div className="hero-row"><div><h1>설정</h1><p>ROADER 운영 연결 상태입니다.</p></div><button className="ghost" onClick={load} disabled={loading}><RefreshCw size={15}/> 새로고침</button></div>
    {message&&<div className="settings-message">{message}</div>}
    <div className="panel settings-list">
      <div><b>Vercel Production</b><span className="badge green">연결됨</span></div>
      <div><b>Neon Postgres</b><span className="badge green">연결됨</span></div>
      <div><b>Threads API</b><span className={"badge "+(threadsConnected?"green":"gray")}>{threadsConnected?"연결됨":"연결 전"}</span></div>
      <div><b>AI 생성 API</b><span className={"badge "+(aiConnected?"green":"gray")}>{aiConnected?"연결됨":"연결 전"}</span></div>
      <div><b>Vercel Blob 이미지 저장</b><span className="badge gray">연결 전</span></div>
      <div className="settings-telegram-row">
        <div className="settings-telegram-copy"><b>Telegram 신청봇</b><span>{telegramConnected?(state?.telegram?.webhook_url||"webhook 연결됨"):"환경변수 등록 후 webhook 연결이 필요합니다."}</span></div>
        <div className="settings-telegram-actions">
          <span className={"badge "+(telegramConnected?"green":"gray")}>{telegramConnected?"연결됨":"연결 전"}</span>
          <button className="primary" onClick={connectTelegram} disabled={connecting||!state?.telegram?.configured}>
            {connecting?<Loader2 className="spin" size={15}/>:<Send size={15}/>}
            {connecting?"연결 중...":telegramConnected?"Webhook 다시 연결":"Telegram 연결"}
          </button>
        </div>
      </div>
      <div><b>Telegram 신청 DB 저장</b><span className="badge green">연결됨</span></div>
    </div>
    <div className="settings-help">Telegram 연결 버튼은 Bot Token과 Webhook Secret을 브라우저로 노출하지 않고 서버에서 직접 webhook을 등록합니다.</div>
  </>;
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
    scheduler:<Scheduler schedules={schedules} onRefresh={loadAll}/>,
    cachelogs:<CacheLogs/>,
    learninglogs:<LearningLogs/>,
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
