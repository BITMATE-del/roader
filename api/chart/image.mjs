import { Resvg } from "@resvg/resvg-js";

const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[m]));
const num=v=>Number(v||0);
const won=v=>num(v).toLocaleString("ko-KR")+"원";

async function candles(symbol){
  const market="KRW-"+String(symbol||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const r=await fetch("https://api.upbit.com/v1/candles/minutes/60?market="+encodeURIComponent(market)+"&count=48",{headers:{accept:"application/json"}});
  if(!r.ok) throw new Error("upbit_candles_failed");
  const rows=await r.json();
  return [...rows].reverse();
}

function buildSvg({coinName,symbol,current,change,support,resistance,rsi,rows}){
  const W=1080,H=1350;
  const chart={x:38,y:320,w:1004,h:570};
  const plot={x:55,y:350,w:760,h:430};
  const vals=rows.flatMap(c=>[num(c.high_price),num(c.low_price)]).filter(Boolean);
  vals.push(current,support,resistance);
  let min=Math.min(...vals), max=Math.max(...vals);
  const pad=(max-min)*0.12||Math.max(current*0.03,1);
  min-=pad;max+=pad;
  const y=p=>plot.y+plot.h-((p-min)/(max-min))*plot.h;
  const step=plot.w/Math.max(rows.length,1);
  const candleW=Math.max(4,step*0.5);

  const candleSvg=rows.map((c,i)=>{
    const o=num(c.opening_price),cl=num(c.trade_price),hi=num(c.high_price),lo=num(c.low_price);
    const x=plot.x+i*step+step/2, up=cl>=o, color=up?"#14cbb8":"#ff5264";
    const top=Math.min(y(o),y(cl)), h=Math.max(2,Math.abs(y(o)-y(cl)));
    return `<line x1="${x}" y1="${y(hi)}" x2="${x}" y2="${y(lo)}" stroke="${color}" stroke-width="2"/>
      <rect x="${x-candleW/2}" y="${top}" width="${candleW}" height="${h}" rx="1" fill="${color}"/>`;
  }).join("");

  const vols=rows.map(c=>num(c.candle_acc_trade_volume));
  const vmax=Math.max(...vols,1);
  const volSvg=rows.map((c,i)=>{
    const v=num(c.candle_acc_trade_volume), o=num(c.opening_price),cl=num(c.trade_price);
    const x=plot.x+i*step+step/2, h=(v/vmax)*80;
    return `<rect x="${x-candleW/2}" y="${860-h}" width="${candleW}" height="${h}" fill="${cl>=o?"#14cbb8":"#ff5264"}" opacity=".7"/>`;
  }).join("");

  const pct=(change*100).toFixed(2);
  const changeText=(change>=0?"+":"")+pct+"%";
  const upColor=change>=0?"#13d0be":"#ff5264";
  const title=esc(coinName||symbol);
  const sym=esc(symbol);
  const resistanceY=y(resistance), supportY=y(support), currentY=y(current);
  const rsiVal=Number.isFinite(rsi)?rsi.toFixed(1):"-";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#06182a"/><stop offset="1" stop-color="#03111f"/></linearGradient>
    <linearGradient id="cyan" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#50d6ff"/><stop offset="1" stop-color="#69f0e1"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <rect x="20" y="20" width="1040" height="1310" rx="28" fill="none" stroke="#163b5c" stroke-width="2"/>

  <text x="45" y="104" fill="url(#cyan)" font-family="Arial,sans-serif" font-size="66" font-weight="800">${title} (${sym})</text>
  <text x="48" y="146" fill="#91a9c1" font-family="Arial,sans-serif" font-size="24">KRW · UPBIT · 1시간봉</text>

  <rect x="42" y="180" width="660" height="112" rx="20" fill="#08233a" stroke="#1e7da8"/>
  <text x="68" y="225" fill="#c8d9e8" font-family="Arial,sans-serif" font-size="25" font-weight="700">현재가</text>
  <text x="185" y="257" fill="#65e7ef" font-family="Arial,sans-serif" font-size="58" font-weight="900">${won(current)}</text>
  <text x="495" y="253" fill="${upColor}" font-family="Arial,sans-serif" font-size="28" font-weight="800">${changeText}</text>

  <rect x="722" y="180" width="315" height="112" rx="20" fill="#071b2d" stroke="#163b5c"/>
  <text x="750" y="224" fill="#c8d9e8" font-family="Arial,sans-serif" font-size="22">1차 저항</text>
  <text x="1010" y="224" text-anchor="end" fill="#ff5264" font-family="Arial,sans-serif" font-size="24" font-weight="800">${won(resistance)}</text>
  <text x="750" y="266" fill="#c8d9e8" font-family="Arial,sans-serif" font-size="22">1차 지지</text>
  <text x="1010" y="266" text-anchor="end" fill="#3184ff" font-family="Arial,sans-serif" font-size="24" font-weight="800">${won(support)}</text>

  <rect x="${chart.x}" y="${chart.y}" width="${chart.w}" height="${chart.h}" rx="18" fill="#061726" stroke="#174263"/>
  ${[0,1,2,3,4,5].map(i=>`<line x1="${plot.x}" y1="${plot.y+i*plot.h/5}" x2="${plot.x+plot.w}" y2="${plot.y+i*plot.h/5}" stroke="#173149"/>`).join("")}
  ${[0,1,2,3,4,5,6,7].map(i=>`<line x1="${plot.x+i*plot.w/7}" y1="${plot.y}" x2="${plot.x+i*plot.w/7}" y2="${plot.y+plot.h}" stroke="#102c43"/>`).join("")}
  ${candleSvg}
  <line x1="${plot.x}" y1="${resistanceY}" x2="${plot.x+plot.w}" y2="${resistanceY}" stroke="#ff3655" stroke-width="3" stroke-dasharray="10 8"/>
  <line x1="${plot.x}" y1="${supportY}" x2="${plot.x+plot.w}" y2="${supportY}" stroke="#2385ff" stroke-width="3" stroke-dasharray="10 8"/>
  <line x1="${plot.x}" y1="${currentY}" x2="${plot.x+plot.w}" y2="${currentY}" stroke="#18c9b6" stroke-width="2" stroke-dasharray="4 5"/>

  <rect x="825" y="${resistanceY-18}" width="185" height="38" rx="8" fill="#e72e48"/><text x="917" y="${resistanceY+9}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="800">저항 ${won(resistance)}</text>
  <rect x="825" y="${currentY-18}" width="185" height="38" rx="8" fill="#0f9f90"/><text x="917" y="${currentY+9}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="800">현재 ${won(current)}</text>
  <rect x="825" y="${supportY-18}" width="185" height="38" rx="8" fill="#176de8"/><text x="917" y="${supportY+9}" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="800">지지 ${won(support)}</text>

  <text x="55" y="820" fill="#cbd7e4" font-family="Arial,sans-serif" font-size="21">거래량</text>
  ${volSvg}
  <line x1="55" y1="866" x2="1010" y2="866" stroke="#173149"/>

  <rect x="38" y="920" width="500" height="360" rx="20" fill="#071b2d" stroke="#174263"/>
  <text x="65" y="970" fill="#eef7ff" font-family="Arial,sans-serif" font-size="30" font-weight="800">핵심 가격대</text>
  <text x="68" y="1030" fill="#a8bdd0" font-family="Arial,sans-serif" font-size="22">현재가</text><text x="500" y="1030" text-anchor="end" fill="#65e7ef" font-family="Arial,sans-serif" font-size="31" font-weight="900">${won(current)}</text>
  <text x="68" y="1085" fill="#a8bdd0" font-family="Arial,sans-serif" font-size="22">1차 저항</text><text x="500" y="1085" text-anchor="end" fill="#ff5264" font-family="Arial,sans-serif" font-size="28" font-weight="900">${won(resistance)}</text>
  <text x="68" y="1140" fill="#a8bdd0" font-family="Arial,sans-serif" font-size="22">1차 지지</text><text x="500" y="1140" text-anchor="end" fill="#3184ff" font-family="Arial,sans-serif" font-size="28" font-weight="900">${won(support)}</text>
  <rect x="64" y="1180" width="210" height="70" rx="14" fill="#0a2942"/><text x="84" y="1212" fill="#a8bdd0" font-family="Arial,sans-serif" font-size="18">RSI (14)</text><text x="84" y="1241" fill="#c875ff" font-family="Arial,sans-serif" font-size="28" font-weight="900">${rsiVal}</text>
  <rect x="290" y="1180" width="220" height="70" rx="14" fill="#0a2942"/><text x="310" y="1212" fill="#a8bdd0" font-family="Arial,sans-serif" font-size="18">기준</text><text x="310" y="1241" fill="#60e3d6" font-family="Arial,sans-serif" font-size="22" font-weight="800">UPBIT 실시간</text>

  <rect x="556" y="920" width="486" height="360" rx="20" fill="#071b2d" stroke="#174263"/>
  <text x="585" y="970" fill="#eef7ff" font-family="Arial,sans-serif" font-size="30" font-weight="800">관전 포인트</text>
  <circle cx="605" cy="1030" r="23" fill="#176de8"/><text x="605" y="1038" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="900">1</text>
  <text x="648" y="1025" fill="#f4f8fb" font-family="Arial,sans-serif" font-size="23" font-weight="800">${won(support)} 지지 여부</text><text x="648" y="1058" fill="#8fa7bc" font-family="Arial,sans-serif" font-size="18">이탈 시 단기 조정 가능성</text>
  <circle cx="605" cy="1110" r="23" fill="#ef3e56"/><text x="605" y="1118" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="900">2</text>
  <text x="648" y="1105" fill="#f4f8fb" font-family="Arial,sans-serif" font-size="23" font-weight="800">${won(resistance)} 돌파 확인</text><text x="648" y="1138" fill="#8fa7bc" font-family="Arial,sans-serif" font-size="18">돌파 시 상승 흐름 강화 가능</text>
  <circle cx="605" cy="1190" r="23" fill="#176de8"/><text x="605" y="1198" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="20" font-weight="900">3</text>
  <text x="648" y="1185" fill="#f4f8fb" font-family="Arial,sans-serif" font-size="23" font-weight="800">거래량 · RSI 흐름 체크</text><text x="648" y="1218" fill="#8fa7bc" font-family="Arial,sans-serif" font-size="18">가격 움직임과 동반되는지 확인</text>

  <text x="540" y="1310" text-anchor="middle" fill="#607f99" font-family="Arial,sans-serif" font-size="16">실시간 시장 데이터 기반 참고용 분석 이미지</text>
  </svg>`;
}

export default async function handler(req,res){
  try{
    if(req.method!=="GET") return res.status(405).end();
    const symbol=String(req.query?.symbol||"").toUpperCase();
    if(!symbol) return res.status(400).json({ok:false,error:"symbol_required"});
    const rows=await candles(symbol);
    const svg=buildSvg({
      coinName:String(req.query?.name||symbol),
      symbol,
      current:num(req.query?.current)||num(rows.at(-1)?.trade_price),
      change:num(req.query?.change),
      support:num(req.query?.support),
      resistance:num(req.query?.resistance),
      rsi:Number(req.query?.rsi),
      rows
    });
    const png=new Resvg(svg,{fitTo:{mode:"width",value:1080},font:{loadSystemFonts:true,defaultFontFamily:"Arial"}}).render().asPng();
    res.setHeader("content-type","image/png");
    res.setHeader("cache-control","public, max-age=60, s-maxage=60");
    return res.status(200).send(Buffer.from(png));
  }catch(error){
    console.error("chart-image",error);
    return res.status(500).json({ok:false,error:"chart_render_failed"});
  }
}
