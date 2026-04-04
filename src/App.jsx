import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, ReferenceLine } from "recharts";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";

import { getPensionTaxRate, calcRetTax, calcPensionLimit, calcRegNHI, calcVolNHI } from "./tax-engine";
import { simulate } from "./simulate";

/* ═══════════════════════════════════════════
   TOSS-STYLE DESIGN TOKENS
   ═══════════════════════════════════════════ */
const T = {
  bg: "#F4F5F7",
  white: "#FFFFFF",
  blue: "#3182F6",
  blueBg: "#EBF2FF",
  blueLight: "#D1E3FF",
  text: "#191F28",
  text2: "#333D4B",
  text3: "#6B7684",
  text4: "#8B95A1",
  text5: "#B0B8C1",
  border: "#E5E8EB",
  borderLight: "#F2F3F5",
  red: "#F04452",
  redBg: "#FFF0F0",
  orange: "#F59E0B",
  orangeBg: "#FFF8E6",
  green: "#30C85E",
  greenBg: "#E8F8EE",
  cyan: "#00BCD4",
  purple: "#8B5CF6",
  purpleBg: "#F3EDFF",
  shadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 1px rgba(0,0,0,0.06)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.08)",
  radius: 16,
  radiusSm: 10,
};

const FONT = `'Toss Product Sans', 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif`;

const CC = { isa: "#30C85E", pension: "#8B5CF6", irp: "#F59E0B", national: "#00BCD4", tax: "#F04452", nhi: "#F97316", net: "#3182F6", accent: "#3182F6" };

/* ═══ PERSONAS ═══ */
const PERSONAS = [
  { label: "25세 신입", desc: "파이프라인 시작", params: { currentAge:25,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:3000,isaBalance:0,isaContrib:500,pensionSavingsBalance:0,pensionAnnualContrib:600,irpRetirementPay:0,nationalPensionMonthly:80,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:350,propertyTaxBase:0,nhiBehavior:'dep',privThresh:1200 }},
  { label: "28세 사원", desc: "ISA·연금 본격화", params: { currentAge:28,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:3000,isaBalance:500,isaContrib:1000,pensionSavingsBalance:1000,pensionAnnualContrib:900,irpRetirementPay:1000,nationalPensionMonthly:85,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:400,propertyTaxBase:0,nhiBehavior:'dep',privThresh:1200 }},
  { label: "30세 대리", desc: "결혼·내집마련", params: { currentAge:30,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:3500,isaBalance:1500,isaContrib:1500,pensionSavingsBalance:2000,pensionAnnualContrib:900,irpRetirementPay:2000,nationalPensionMonthly:90,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:450,propertyTaxBase:10000,nhiBehavior:'dep',privThresh:1200 }},
  { label: "33세 대리", desc: "고년차, 적립 가속", params: { currentAge:33,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:3500,isaBalance:3000,isaContrib:1500,pensionSavingsBalance:3500,pensionAnnualContrib:1200,irpRetirementPay:3500,nationalPensionMonthly:95,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:500,propertyTaxBase:15000,nhiBehavior:'dep',privThresh:1200 }},
  { label: "35세 과장", desc: "승진, 적극 투자", params: { currentAge:35,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:4000,isaBalance:5000,isaContrib:2000,pensionSavingsBalance:5000,pensionAnnualContrib:1500,irpRetirementPay:5000,nationalPensionMonthly:100,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:550,propertyTaxBase:20000,nhiBehavior:'dep',privThresh:1200 }},
  { label: "38세 과장", desc: "자녀 교육비 증가", params: { currentAge:38,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:4500,isaBalance:8000,isaContrib:2000,pensionSavingsBalance:7000,pensionAnnualContrib:1800,irpRetirementPay:7000,nationalPensionMonthly:110,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:600,propertyTaxBase:25000,nhiBehavior:'dep',privThresh:1200 }},
  { label: "40세 차장", desc: "자산 본격 축적", params: { currentAge:40,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:4000,isaBalance:2000,isaContrib:2000,pensionSavingsBalance:3000,pensionAnnualContrib:1800,irpRetirementPay:9000,nationalPensionMonthly:120,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:600,propertyTaxBase:30000,nhiBehavior:'dep',privThresh:1200 }},
  { label: "43세 부장", desc: "연봉 피크 접근", params: { currentAge:43,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:5000,isaBalance:15000,isaContrib:2000,pensionSavingsBalance:12000,pensionAnnualContrib:1800,irpRetirementPay:12000,nationalPensionMonthly:130,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:700,propertyTaxBase:40000,nhiBehavior:'dep',privThresh:1200 }},
  { label: "46세 부장", desc: "은퇴 준비 본격화", params: { currentAge:46,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:5000,isaBalance:20000,isaContrib:2000,pensionSavingsBalance:18000,pensionAnnualContrib:1800,irpRetirementPay:16000,nationalPensionMonthly:140,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:750,propertyTaxBase:45000,nhiBehavior:'dep',privThresh:1200 }},
  { label: "50세 임원", desc: "고연봉, 자산 큼", params: { currentAge:50,retireAge:58,pensionStartAge:65,lifeExpectancy:95,annualLiving:6000,isaBalance:30000,isaContrib:2000,pensionSavingsBalance:25000,pensionAnnualContrib:1800,irpRetirementPay:25000,nationalPensionMonthly:160,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:1000,propertyTaxBase:70000,nhiBehavior:'dep',privThresh:1200 }},
  { label: "55세 퇴직임박", desc: "인출 전략 수립", params: { currentAge:55,retireAge:56,pensionStartAge:65,lifeExpectancy:95,annualLiving:5000,isaBalance:40000,isaContrib:0,pensionSavingsBalance:35000,pensionAnnualContrib:0,irpRetirementPay:40000,nationalPensionMonthly:170,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:1200,propertyTaxBase:80000,nhiBehavior:'dep',privThresh:1200 }},
];

/* ═══ FORMATTERS ═══ */
const fmt=v=>{if(Math.abs(v)>=10000)return`${(v/10000).toFixed(1)}억`;if(Math.abs(v)>=1000)return`${(v/1000).toFixed(1)}천`;return`${Math.round(v)}만`;};
const fmtF=v=>`${Math.round(v).toLocaleString()}만원`;

/* ═══ ANIMATED NUMBER ═══ */
function AnimatedNumber({ value, format = fmt, color = T.text, style = {} }) {
  const spring = useSpring(value, { stiffness: 120, damping: 20 });
  const display = useTransform(spring, (v) => format(v));
  return <motion.span style={{ color, ...style }}>{display}</motion.span>;
}

/* ═══ CUSTOM SLIDER (Framer Motion, WebView-safe) ═══ */
function Sl({label,value,onChange,min,max,step=1,unit="",color=T.blue,info}){
  const pct=((value-min)/(max-min))*100;
  const trackRef = useState(null);

  const handleInteraction = useCallback((clientX) => {
    const track = trackRef[0];
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    const clamped = Math.max(min, Math.min(max, snapped));
    onChange(clamped);
  }, [min, max, step, onChange, trackRef]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    const track = e.currentTarget;
    trackRef[0] = track;
    handleInteraction(e.clientX);

    const onMove = (ev) => {
      ev.preventDefault();
      handleInteraction(ev.clientX);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [handleInteraction, trackRef]);

  return(
    <div style={{marginBottom:18}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6}}>
        <span style={{fontSize:13,color:T.text3,fontWeight:500}}>{label}{info&&<span style={{fontSize:11,color:T.text4,marginLeft:4}}>({info})</span>}</span>
        <span style={{fontSize:14,color:T.text,fontWeight:700}}>{value>=10000?fmt(value):value.toLocaleString()}{unit}</span>
      </div>
      <div
        onPointerDown={handlePointerDown}
        style={{
          position:"relative",width:"100%",height:28,cursor:"pointer",
          touchAction:"none",userSelect:"none",WebkitUserSelect:"none",
          display:"flex",alignItems:"center",
        }}
      >
        <div style={{
          position:"absolute",left:0,right:0,height:4,borderRadius:2,
          background:T.border,
        }}>
          <motion.div
            style={{height:"100%",borderRadius:2,background:color}}
            animate={{width:`${pct}%`}}
            transition={{type:"spring",stiffness:300,damping:30}}
          />
        </div>
        <motion.div
          style={{
            position:"absolute",left:`${pct}%`,
            width:20,height:20,borderRadius:10,
            background:T.white,border:`2px solid ${color}`,
            boxShadow:"0 1px 4px rgba(0,0,0,0.15)",
            marginLeft:-10,zIndex:1,
          }}
          whileTap={{scale:1.2}}
          transition={{type:"spring",stiffness:400,damping:25}}
        />
      </div>
    </div>
  );
}

/* ═══ COMPONENTS ═══ */
function Card({children,style={}}){
  return <div style={{background:T.white,borderRadius:T.radius,boxShadow:T.shadow,padding:20,...style}}>{children}</div>;
}

function Stat({label,value,sub,color=T.text,emoji}){
  return(
    <div style={{background:T.white,borderRadius:T.radiusSm,boxShadow:T.shadow,padding:"14px 16px",flex:"1 1 110px",minWidth:110}}>
      <div style={{fontSize:12,color:T.text4,marginBottom:4}}>{emoji} {label}</div>
      <div style={{fontSize:20,color,fontWeight:800,letterSpacing:-0.5}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:T.text5,marginTop:2}}>{sub}</div>}
    </div>
  );
}

function Seg({options,value,onChange}){
  return(
    <div style={{display:"flex",gap:4,background:T.bg,borderRadius:10,padding:3,position:"relative"}}>
      {options.map(o=>(
        <button key={o.v} onClick={()=>onChange(o.v)} style={{
          flex:1,padding:"8px 4px",borderRadius:8,border:"none",cursor:"pointer",
          background:value===o.v?T.white:"transparent",
          boxShadow:value===o.v?T.shadow:"none",
          color:value===o.v?T.text:T.text4,
          fontFamily:FONT,fontSize:12,fontWeight:value===o.v?700:400,
          transition:"all 0.2s",position:"relative",zIndex:1,
        }}>{o.l}</button>
      ))}
    </div>
  );
}

function PhBar({data}){
  const ps=[];let c=null;
  data.forEach(d=>{if(!c||c.ph!==d.ph){if(c)c.e=d.age-1;c={ph:d.ph,s:d.age,e:d.age};ps.push(c);}else c.e=d.age;});
  const cl={"적립기":T.text5,"ISA 인출기":CC.isa,"연금저축 비과세 인출기":CC.pension,"IRP 퇴직급여 인출기":CC.irp,"연금 수령기":CC.national,"국민연금 수령":CC.national,"자산 소진":CC.tax};
  const tot=data.length;
  return(
    <div>
      <div style={{fontSize:12,color:T.text4,marginBottom:8,fontWeight:600}}>인출 단계 타임라인</div>
      <div style={{display:"flex",height:28,borderRadius:8,overflow:"hidden",border:`1px solid ${T.border}`}}>
        {ps.map((p,i)=>{const w=((p.e-p.s+1)/tot)*100;return(
          <motion.div key={i} title={`${p.ph} (${p.s}–${p.e}세)`}
            initial={{opacity:0}} animate={{opacity:0.85}}
            transition={{delay:i*0.1,duration:0.3}}
            style={{width:`${w}%`,background:cl[p.ph]||T.text5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:w>10?9:0,color:"#fff",fontWeight:700,borderRight:i<ps.length-1?`1.5px solid ${T.white}`:"none"}}>{w>15?`${p.s}–${p.e}`:""}</motion.div>
        );})}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:"4px 14px",marginTop:8}}>
        {ps.filter(p=>p.ph!=="적립기").map((p,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:4}}>
            <div style={{width:8,height:8,borderRadius:3,background:cl[p.ph]}}/>
            <span style={{fontSize:11,color:T.text3}}>{p.ph} ({p.s}–{p.e}세)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TT({active,payload}){
  if(!active||!payload?.length)return null;
  const d=payload[0]?.payload;if(!d)return null;
  return(
    <div style={{background:T.white,border:`1px solid ${T.border}`,borderRadius:12,padding:14,boxShadow:T.shadowMd,fontFamily:FONT,fontSize:12,color:T.text,minWidth:220}}>
      <div style={{fontWeight:800,fontSize:15,color:T.blue,marginBottom:2}}>{d.age}세</div>
      <div style={{fontSize:11,color:T.text4,marginBottom:8}}>{d.ph} · {d.src}</div>
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"3px 12px"}}>
        {d.isa>0&&<><span style={{color:CC.isa}}>ISA</span><span style={{textAlign:"right"}}>{fmtF(d.isa)}</span></>}
        {d.pen>0&&<><span style={{color:CC.pension}}>연금저축</span><span style={{textAlign:"right"}}>{fmtF(d.pen)}</span></>}
        {d.irp>0&&<><span style={{color:CC.irp}}>IRP</span><span style={{textAlign:"right"}}>{fmtF(d.irp)}</span></>}
        <div style={{gridColumn:"1/3",height:1,background:T.border,margin:"2px 0"}}/>
        <span style={{color:CC.national}}>국민연금</span><span style={{textAlign:"right"}}>{fmtF(d.np)}</span>
        <span style={{color:CC.accent}}>인출</span><span style={{textAlign:"right"}}>{fmtF(d.w)}</span>
        <span style={{color:CC.tax}}>세금</span><span style={{textAlign:"right",color:CC.tax}}>−{fmtF(d.tax)}</span>
        <span style={{color:CC.nhi}}>건보료</span><span style={{textAlign:"right",color:CC.nhi}}>−{fmtF(d.nhi)}</span>
        {d.nn&&<span style={{gridColumn:"1/3",fontSize:10,color:T.text5,textAlign:"right"}}>↳ {d.nn}</span>}
        <div style={{gridColumn:"1/3",height:1,background:T.border,margin:"2px 0"}}/>
        <span style={{fontWeight:800}}>순수령</span><span style={{textAlign:"right",fontWeight:800,color:CC.net,fontSize:14}}>{fmtF(d.net)}</span>
      </div>
    </div>
  );
}

/* ═══ MAIN ═══ */
export function App(){
  const[p,setP]=useState({
    currentAge:40,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:4000,
    isaBalance:2000,isaContrib:2000,pensionSavingsBalance:3000,pensionAnnualContrib:1800,
    irpRetirementPay:30000,nationalPensionMonthly:120,annualReturn:7,
    retireReturn:3,inflation:2.5,
    lastMonthSalary:600,propertyTaxBase:30000,nhiBehavior:'dep',privThresh:1200,
  });
  const[tab,setTab]=useState("balance");
  const[panel,setPanel]=useState("core");
  const[showTbl,setShowTbl]=useState(false);
  const set=useCallback((k,v)=>setP(prev=>({...prev,[k]:v})),[]);
  const loadPersona=useCallback((idx)=>setP(PERSONAS[idx].params),[]);
  const{data,isaTx}=useMemo(()=>simulate(p),[p]);
  const rd=useMemo(()=>data.filter(d=>d.age>=p.retireAge),[data,p.retireAge]);

  const tT=rd.reduce((s,d)=>s+d.tax,0);
  const tN=rd.reduce((s,d)=>s+d.nhi,0);
  const tW=rd.reduce((s,d)=>s+d.w,0);
  const pk=Math.max(...data.map(d=>d.tot));
  const ex=data.find(d=>d.age>=p.retireAge&&d.tot<=0)?.age;
  const ef=tW>0?(tT/tW*100):0;
  const leak=tT+tN;
  const gross=tW+rd.reduce((s,d)=>s+d.np,0);
  const lr=gross>0?(leak/gross*100):0;

  return(
    <div style={{background:T.bg,fontFamily:FONT,minHeight:"100vh",padding:"20px 16px",maxWidth:640,margin:"0 auto"}}>
      {/* Header */}
      <motion.div style={{textAlign:"center",marginBottom:24}}
        initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} transition={{duration:0.3}}>
        <div style={{display:"inline-block",background:T.blueBg,color:T.blue,fontSize:12,fontWeight:700,padding:"4px 12px",borderRadius:20,marginBottom:10}}>
          멀티 버킷 인출 전략
        </div>
        <h1 style={{fontSize:24,fontWeight:900,color:T.text,margin:"4px 0 0",letterSpacing:-0.5}}>
          은퇴 자산 인출 시뮬레이터
        </h1>
        <p style={{fontSize:13,color:T.text3,marginTop:6,lineHeight:1.5}}>
          ISA → 연금저축 비과세분 → IRP 퇴직급여 → 연금저축 과세분<br/>
          세금·건보료 최소화 인출 순서 시뮬레이션
        </p>
      </motion.div>

      {/* Persona Selector */}
      <Card style={{marginBottom:12,padding:"14px 16px"}}>
        <div style={{fontSize:12,color:T.text4,fontWeight:600,marginBottom:8}}>페르소나 선택 (대기업 직장인)</div>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4,WebkitOverflowScrolling:"touch"}}>
          {PERSONAS.map((ps,i)=>(
            <motion.button key={i} onClick={()=>loadPersona(i)} whileTap={{scale:0.95}}
              style={{flexShrink:0,padding:"8px 12px",borderRadius:10,border:`1.5px solid ${T.border}`,
                background:T.white,cursor:"pointer",fontFamily:FONT,textAlign:"left",minWidth:90,
                transition:"all 0.15s"}}>
              <div style={{fontSize:12,fontWeight:700,color:T.text,whiteSpace:"nowrap"}}>{ps.label}</div>
              <div style={{fontSize:10,color:T.text4,marginTop:1,whiteSpace:"nowrap"}}>{ps.desc}</div>
            </motion.button>
          ))}
        </div>
      </Card>

      {/* Controls */}
      <Card style={{marginBottom:12}}>
        <Seg options={[{v:"core",l:"기본 설정"},{v:"accounts",l:"계좌 설정"},{v:"nhi",l:"건보료 전략"}]} value={panel} onChange={setPanel}/>
        <AnimatePresence mode="wait">
          <motion.div key={panel} style={{marginTop:18}}
            initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}
            transition={{duration:0.15}}>
            {panel==="core"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <Sl label="현재 나이" value={p.currentAge} onChange={v=>set("currentAge",v)} min={20} max={55} unit="세"/>
                <Sl label="퇴직 나이" value={p.retireAge} onChange={v=>set("retireAge",v)} min={40} max={65} unit="세"/>
                <Sl label="국민연금 개시" value={p.pensionStartAge} onChange={v=>set("pensionStartAge",v)} min={60} max={70} unit="세" color={CC.national}/>
                <Sl label="기대 수명" value={p.lifeExpectancy} onChange={v=>set("lifeExpectancy",v)} min={75} max={120} unit="세"/>
                <Sl label="연간 생활비" value={p.annualLiving} onChange={v=>set("annualLiving",v)} min={2000} max={12000} step={100} unit="만원" color={CC.tax}/>
                <Sl label="적립기 수익률" value={p.annualReturn} onChange={v=>set("annualReturn",v)} min={3} max={15} step={0.5} unit="%" color={CC.isa} info="적립기"/>
                <Sl label="은퇴기 수익률" value={p.retireReturn} onChange={v=>set("retireReturn",v)} min={0} max={8} step={0.5} unit="%" color={CC.irp} info="보수적 운용"/>
                <Sl label="물가상승률" value={p.inflation} onChange={v=>set("inflation",v)} min={0} max={5} step={0.5} unit="%" color={CC.nhi} info="생활비 연증가"/>
              </div>
            )}
            {panel==="accounts"&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                <Sl label="ISA 현재 잔고" value={p.isaBalance} onChange={v=>set("isaBalance",v)} min={0} max={10000} step={100} unit="만원" color={CC.isa}/>
                <Sl label="ISA 연납입" value={p.isaContrib} onChange={v=>set("isaContrib",v)} min={0} max={2000} step={100} unit="만원" color={CC.isa} info="연 2,000만 한도"/>
                <Sl label="연금저축 현재 잔고" value={p.pensionSavingsBalance} onChange={v=>set("pensionSavingsBalance",v)} min={0} max={30000} step={100} unit="만원" color={CC.pension}/>
                <Sl label="연금저축+IRP 연납입" value={p.pensionAnnualContrib} onChange={v=>set("pensionAnnualContrib",v)} min={0} max={1800} step={100} unit="만원" color={CC.pension} info="세액공제 900만 한도"/>
                <Sl label="퇴직급여 예상액" value={p.irpRetirementPay} onChange={v=>set("irpRetirementPay",v)} min={3000} max={100000} step={1000} unit="만원" color={CC.irp}/>
                <Sl label="국민연금 월수령" value={p.nationalPensionMonthly} onChange={v=>set("nationalPensionMonthly",v)} min={30} max={300} step={5} unit="만원" color={CC.national}/>
              </div>
            )}
            {panel==="nhi"&&(
              <>
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:13,color:T.text2,marginBottom:8,fontWeight:600}}>퇴직 후 건보료 전략</div>
                  <div style={{display:"flex",gap:8}}>
                    {[{v:'dep',l:'피부양자',d:'자녀 직장보험 등재',bg:T.greenBg,c:CC.isa},{v:'vol',l:'임의계속→지역',d:'36개월 직장보험 유지',bg:T.orangeBg,c:CC.irp},{v:'reg',l:'지역가입자',d:'소득+재산 기준 부과',bg:T.redBg,c:CC.tax}].map(({v,l,d,bg,c})=>(
                      <motion.button key={v} onClick={()=>set("nhiBehavior",v)}
                        whileTap={{scale:0.97}}
                        style={{
                          flex:1,padding:"10px 8px",borderRadius:10,cursor:"pointer",border:`2px solid ${p.nhiBehavior===v?c:T.border}`,
                          background:p.nhiBehavior===v?bg:T.white,color:p.nhiBehavior===v?T.text:T.text3,
                          fontFamily:FONT,fontSize:12,fontWeight:p.nhiBehavior===v?700:400,textAlign:"center",transition:"all 0.15s",
                        }}>
                        <div style={{fontWeight:700}}>{l}</div>
                        <div style={{fontSize:10,color:T.text4,marginTop:2}}>{d}</div>
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 20px"}}>
                  <Sl label="퇴직 전 월급" value={p.lastMonthSalary} onChange={v=>set("lastMonthSalary",v)} min={200} max={1500} step={10} unit="만원" color={CC.irp} info="임의계속 기준"/>
                  <Sl label="재산세 과세표준" value={p.propertyTaxBase} onChange={v=>set("propertyTaxBase",v)} min={0} max={100000} step={1000} unit="만원" color={CC.nhi} info="토지·건물·주택"/>
                  <Sl label="사적연금 건보 기준" value={p.privThresh} onChange={v=>set("privThresh",v)} min={1200} max={2500} step={100} unit="만원" color={CC.nhi} info="현행 1,200만"/>
                </div>
                <div style={{background:T.blueBg,borderRadius:10,padding:14,marginTop:10,fontSize:12,color:T.text2,lineHeight:1.7}}>
                  <div style={{fontWeight:700,marginBottom:4,color:T.blue}}>핵심 포인트</div>
                  <div style={{display:"grid",gap:3,fontSize:11}}>
                    <div><span style={{color:CC.isa,fontWeight:600}}>ISA 원금 인출</span> → 소득 아님 → 건보료 무관</div>
                    <div><span style={{color:CC.irp,fontWeight:600}}>IRP 퇴직소득세</span> → 분류과세 → 종합과세·건보료 비영향</div>
                    <div><span style={{color:CC.pension,fontWeight:600}}>사적연금</span> → 연 {p.privThresh.toLocaleString()}만원 이하 건보료 무관</div>
                    <div><span style={{color:CC.isa,fontWeight:600}}>피부양자</span> → 연소득 2,000만원·재산세 과표 9억 이하</div>
                    <div><span style={{color:CC.irp,fontWeight:600}}>임의계속</span> → 퇴직 후 36개월간 직장보험료 유지</div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>

      {/* Stats */}
      <motion.div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}
        initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.1,duration:0.3}}>
        <Stat label="최대 자산" value={fmt(pk)} emoji="📈" color={T.blue}/>
        <Stat label="총 세금+건보" value={fmt(leak)} sub={`누출률 ${lr.toFixed(1)}%`} emoji="📉" color={CC.tax}/>
        <Stat label="실효세율" value={`${ef.toFixed(1)}%`} emoji="💰" color={CC.nhi}/>
        <Stat label="자산 소진" value={ex?`${ex}세`:`${p.lifeExpectancy}세+`} emoji={ex&&ex<p.lifeExpectancy?"⚠️":"✅"} color={ex&&ex<p.lifeExpectancy?CC.tax:CC.isa}/>
      </motion.div>

      {/* Insights */}
      <Card style={{marginBottom:12,padding:"16px 18px"}}>
        <div style={{fontSize:13,fontWeight:700,color:T.blue,marginBottom:10}}>왜 이 인출 순서인가?</div>
        <div style={{display:"grid",gap:10,fontSize:12,color:T.text2,lineHeight:1.7}}>
          {(()=>{
            const insights=[];
            const phases=data.filter(d=>d.age>=p.retireAge);
            const isaPhase=phases.filter(d=>d.src&&d.src.includes("ISA"));
            const pnDPhase=phases.filter(d=>d.src&&d.src.includes("비과세"));
            const irpPhase=phases.filter(d=>d.src&&d.src.includes("IRP"));
            const penPhase=phases.filter(d=>d.ph==="연금 수령기");
            const deplete=data.find(d=>d.age>=p.retireAge&&d.tot<=0);
            const shortfall=phases.filter(d=>d.remaining>0);
            const lastData=phases[phases.length-1];
            const livingEnd=lastData?.living||0;

            if(isaPhase.length>0){
              const s=isaPhase[0].age,e=isaPhase[isaPhase.length-1].age;
              insights.push({icon:"1️⃣",color:CC.isa,title:"ISA 원금 인출",body:`${s}~${e}세 (${e-s+1}년간) 세금 0원, 건보료 무관. 원금이므로 소득으로 잡히지 않습니다.`});
            }
            if(pnDPhase.length>0){
              const s=pnDPhase[0].age,e=pnDPhase[pnDPhase.length-1].age;
              insights.push({icon:"2️⃣",color:CC.pension,title:"연금저축 비과세분",body:`${s}~${e}세. 세액공제 안 받은 자기부담금은 비과세 인출. 건보료에도 영향 없습니다.`});
            }
            if(irpPhase.length>0){
              const s=irpPhase[0].age,e=irpPhase[irpPhase.length-1].age;
              insights.push({icon:"3️⃣",color:CC.irp,title:"IRP 퇴직급여",body:`${s}~${e}세. 퇴직소득세 70→60%로 감면. 분류과세라 건보료·종합소득에 영향 없습니다.`});
            }
            if(penPhase.length>0){
              const s=penPhase[0].age,e=penPhase[penPhase.length-1].age;
              const rate=s>=80?"3.3%":s>=70?"4.4%":"5.5%";
              insights.push({icon:"4️⃣",color:CC.national,title:"연금저축 과세분",body:`${s}~${e}세. 연금소득세 ${rate}(나이별 감소). 연 ${p.privThresh.toLocaleString()}만원 초과 시 건보료 부과.`});
            }

            if(p.inflation>0){
              insights.push({icon:"📊",color:CC.nhi,title:"물가상승 반영",body:`${p.inflation}% 물가상승 → ${p.lifeExpectancy}세 생활비 ${fmt(livingEnd)}`+`원 (현재 ${fmt(p.annualLiving)}원의 ${(livingEnd/p.annualLiving).toFixed(1)}배)`});
            }

            if(deplete&&deplete.age<p.lifeExpectancy){
              insights.push({icon:"⚠️",color:CC.tax,title:"자산 소진 경고",body:`${deplete.age}세에 자산 소진. 기대수명(${p.lifeExpectancy}세)까지 ${p.lifeExpectancy-deplete.age}년 부족. 납입 확대 또는 생활비 조정이 필요합니다.`});
            } else {
              insights.push({icon:"✅",color:CC.isa,title:"자산 유지",body:`기대수명(${p.lifeExpectancy}세)까지 자산이 유지됩니다.${lastData?` 잔여 자산 약 ${fmt(lastData.tot)}원.`:""}`});
            }

            if(shortfall.length>0){
              insights.push({icon:"🔒",color:CC.pension,title:"연금수령한도 영향",body:`연금수령한도(잔액÷(11-연차)×120%)로 인해 ${shortfall.length}개 연도에서 생활비 부족분 발생. 한도 초과 인출 시 기타소득세 16.5% 적용됩니다.`});
            }

            return insights.map((ins,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",background:ins.color+"0D",borderRadius:10,borderLeft:`3px solid ${ins.color}`}}>
                <span style={{fontSize:16,flexShrink:0}}>{ins.icon}</span>
                <div>
                  <div style={{fontWeight:700,color:ins.color,marginBottom:2}}>{ins.title}</div>
                  <div style={{color:T.text3,fontSize:11,lineHeight:1.6}}>{ins.body}</div>
                </div>
              </div>
            ));
          })()}
        </div>
      </Card>

      {/* Phase */}
      <Card style={{marginBottom:12}}><PhBar data={data}/></Card>

      {/* Charts */}
      <Card style={{marginBottom:12}}>
        <Seg options={[{v:"balance",l:"계좌 잔고"},{v:"cashflow",l:"순수령액"},{v:"tax",l:"세금·건보료"},{v:"cum",l:"누적 비용"}]} value={tab} onChange={setTab}/>
        <AnimatePresence mode="wait">
          <motion.div key={tab} style={{marginTop:16}}
            initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            transition={{duration:0.2}}>
            <ResponsiveContainer width="100%" height={280}>
              {tab==="balance"?(
                <AreaChart data={data} margin={{top:5,right:5,left:-10,bottom:5}}>
                  <defs>
                    <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CC.isa} stopOpacity={0.4}/><stop offset="100%" stopColor={CC.isa} stopOpacity={0.02}/></linearGradient>
                    <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CC.pension} stopOpacity={0.4}/><stop offset="100%" stopColor={CC.pension} stopOpacity={0.02}/></linearGradient>
                    <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CC.irp} stopOpacity={0.4}/><stop offset="100%" stopColor={CC.irp} stopOpacity={0.02}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                  <XAxis dataKey="age" stroke={T.text5} fontSize={10} fontFamily={FONT}/>
                  <YAxis stroke={T.text5} fontSize={10} fontFamily={FONT} tickFormatter={fmt}/>
                  <Tooltip content={<TT/>}/>
                  <ReferenceLine x={p.retireAge} stroke={CC.tax} strokeDasharray="4 4" strokeWidth={1}/>
                  <ReferenceLine x={p.pensionStartAge} stroke={CC.national} strokeDasharray="4 4" strokeWidth={1}/>
                  <Area type="monotone" dataKey="isa" stackId="1" fill="url(#gI)" stroke={CC.isa} strokeWidth={2} name="ISA"/>
                  <Area type="monotone" dataKey="pen" stackId="1" fill="url(#gP)" stroke={CC.pension} strokeWidth={2} name="연금저축"/>
                  <Area type="monotone" dataKey="irp" stackId="1" fill="url(#gR)" stroke={CC.irp} strokeWidth={2} name="IRP"/>
                  <Legend wrapperStyle={{fontSize:11,fontFamily:FONT}}/>
                </AreaChart>
              ):tab==="cashflow"?(
                <ComposedChart data={rd} margin={{top:5,right:5,left:-10,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                  <XAxis dataKey="age" stroke={T.text5} fontSize={10} fontFamily={FONT}/>
                  <YAxis stroke={T.text5} fontSize={10} fontFamily={FONT} tickFormatter={fmt}/>
                  <Tooltip content={<TT/>}/>
                  <ReferenceLine y={p.annualLiving} stroke={CC.tax} strokeDasharray="3 3" strokeWidth={1}/>
                  <Bar dataKey="np" stackId="i" fill={CC.national} fillOpacity={0.7} name="국민연금" radius={[3,3,0,0]}/>
                  <Bar dataKey="w" stackId="i" fill={T.blue} fillOpacity={0.5} name="계좌 인출" radius={[3,3,0,0]}/>
                  <Line type="monotone" dataKey="net" stroke={CC.net} strokeWidth={2.5} dot={false} name="순수령액"/>
                  <Legend wrapperStyle={{fontSize:11,fontFamily:FONT}}/>
                </ComposedChart>
              ):tab==="tax"?(
                <ComposedChart data={rd} margin={{top:5,right:5,left:-10,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                  <XAxis dataKey="age" stroke={T.text5} fontSize={10} fontFamily={FONT}/>
                  <YAxis stroke={T.text5} fontSize={10} fontFamily={FONT} tickFormatter={fmt}/>
                  <Tooltip content={<TT/>}/>
                  <Bar dataKey="tax" fill={CC.tax} fillOpacity={0.8} name="세금" radius={[3,3,0,0]}/>
                  <Bar dataKey="nhi" fill={CC.nhi} fillOpacity={0.8} name="건보료" radius={[3,3,0,0]}/>
                  <Line type="monotone" dataKey="net" stroke={CC.net} strokeWidth={2.5} dot={false} name="순수령액"/>
                  <Legend wrapperStyle={{fontSize:11,fontFamily:FONT}}/>
                </ComposedChart>
              ):(
                <AreaChart data={rd} margin={{top:5,right:5,left:-10,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.borderLight}/>
                  <XAxis dataKey="age" stroke={T.text5} fontSize={10} fontFamily={FONT}/>
                  <YAxis stroke={T.text5} fontSize={10} fontFamily={FONT} tickFormatter={fmt}/>
                  <Tooltip content={<TT/>}/>
                  <Area type="monotone" dataKey="cumT" fill={CC.tax} stroke={CC.tax} fillOpacity={0.2} strokeWidth={2} name="누적 세금"/>
                  <Area type="monotone" dataKey="cumN" fill={CC.nhi} stroke={CC.nhi} fillOpacity={0.2} strokeWidth={2} name="누적 건보료"/>
                  <Legend wrapperStyle={{fontSize:11,fontFamily:FONT}}/>
                </AreaChart>
              )}
            </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
      </Card>

      {/* Table */}
      <Card>
        <motion.button onClick={()=>setShowTbl(!showTbl)} whileTap={{scale:0.98}}
          style={{width:"100%",padding:"12px 0",borderRadius:10,border:`1px solid ${T.border}`,background:T.white,color:T.blue,fontFamily:FONT,fontSize:13,fontWeight:600,cursor:"pointer"}}>
          {showTbl?"접기 ▲":"연도별 상세 보기 ▼"}
        </motion.button>
        <AnimatePresence>
          {showTbl&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:"auto",opacity:1}} exit={{height:0,opacity:0}}
              transition={{duration:0.2}} style={{overflow:"hidden"}}>
              <div style={{overflowX:"auto",marginTop:14}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:FONT}}>
                  <thead><tr style={{color:T.text4,borderBottom:`2px solid ${T.border}`}}>
                    {["나이","인출원","ISA","연금","IRP","국민","인출","세금","건보","순수령"].map(h=>(
                      <th key={h} style={{padding:"6px 4px",textAlign:"right",fontWeight:600}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>{rd.map(d=>(
                    <tr key={d.age} style={{borderBottom:`1px solid ${T.borderLight}`}}>
                      <td style={{padding:"5px 4px",textAlign:"right",fontWeight:600,color:T.text}}>{d.age}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:T.text4,fontSize:10,maxWidth:60,overflow:"hidden",whiteSpace:"nowrap"}}>{d.src}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:CC.isa}}>{d.isa>0?fmt(d.isa):"–"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:CC.pension}}>{d.pen>0?fmt(d.pen):"–"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:CC.irp}}>{d.irp>0?fmt(d.irp):"–"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:CC.national}}>{d.np>0?fmt(d.np):"–"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:T.blue,fontWeight:600}}>{d.w>0?fmt(d.w):"–"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:d.tax>0?CC.tax:T.text5}}>{d.tax>0?fmt(d.tax):"0"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:d.nhi>0?CC.nhi:T.text5}}>{d.nhi>0?fmt(d.nhi):"0"}</td>
                      <td style={{padding:"5px 4px",textAlign:"right",color:CC.net,fontWeight:700}}>{fmt(d.net)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* References */}
      <Card style={{marginTop:12}}>
        <div style={{fontSize:13,color:T.text2,fontWeight:700,marginBottom:8}}>참고 자료</div>
        <div style={{display:"grid",gap:6}}>
          {[{t:"연금 콘텐츠 모음",u:"https://m.blog.naver.com/sum7788/223120243032"},{t:"절세 및 연금 계좌 활용",u:"https://m.blog.naver.com/sum7788/223494627908"},{t:"건강보험 줄이기",u:"https://m.blog.naver.com/sum7788/223582252899"},{t:"인출 전략 상세",u:"https://m.blog.naver.com/sum7788/223830289353"}].map(({t,u},i)=>(
            <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:8,background:T.bg,textDecoration:"none",color:T.text2,fontSize:12,fontWeight:500,transition:"background 0.15s"}}>
              <span style={{color:T.blue}}>→</span>{t}
            </a>
          ))}
        </div>
      </Card>

      {/* Footer */}
      <div style={{textAlign:"center",marginTop:20,padding:12,fontSize:11,color:T.text4,lineHeight:1.7}}>
        교육 목적 시뮬레이션 · 세율/건보료율 2025년 기준 단순화 적용
        <br/>ISA 비과세 200만원·9.9% 분리과세 | IRP 위험자산 70% 한도
        <br/>퇴직소득세 분류과세 | 피부양자 연소득 2,000만·재산세 과표 9억 이하
        <br/><span style={{color:T.text5}}>수미숨 '멀티 버킷 인출 전략' 기반</span>
      </div>
    </div>
  );
}
