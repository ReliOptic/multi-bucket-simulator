import { getPensionTaxRate, calcRetTax, calcPensionLimit, calcRegNHI, calcVolNHI } from "./tax-engine";

export function simulate(p) {
  const r = p.annualReturn / 100;
  const rRet = p.retireReturn / 100;
  const inf = p.inflation / 100;
  const data = [];

  let isa = p.isaBalance, isaOrig = p.isaBalance;
  let pnD = 0, pD = p.pensionSavingsBalance;
  let irp = p.irpRetirementPay;
  let irpStarted = false, irpY = 0;
  let penStarted = false, penY = 0;
  let isaTx = 0, cumT = 0, cumN = 0;

  for (let age = p.currentAge; age <= p.lifeExpectancy; age++) {
    let w = 0, tax = 0, nhi = 0, np = 0;
    const sources = [];

    /* ─── 적립기 ─── */
    if (age < p.retireAge) {
      isa = isa * (1 + r) + p.isaContrib; isaOrig += p.isaContrib;
      const dd = Math.min(p.pensionAnnualContrib, 900);
      const nd = Math.max(0, p.pensionAnnualContrib - 900);
      pD = pD * (1 + r) + dd;
      pnD = pnD * (1 + r) + nd;
      irp = irp * (1 + r * 0.85);
      data.push({ age, ph: "적립기", src: "적립", isa: Math.round(isa), pen: Math.round(pD + pnD), irp: Math.round(irp), w: 0, tax: 0, nhi: 0, net: 0, np: 0, tot: Math.round(isa + pD + pnD + irp), cumT: Math.round(cumT), cumN: Math.round(cumN), nn: "", living: 0, remaining: 0 });
      continue;
    }

    /* ─── 은퇴기 수익률 + 국민연금 ─── */
    if (age >= p.pensionStartAge) np = p.nationalPensionMonthly * 12;
    if (isa > 0) isa *= (1 + rRet);
    if (pD > 0) pD *= (1 + rRet);
    if (pnD > 0) pnD *= (1 + rRet);
    if (irp > 0) irp *= (1 + rRet * 0.85);

    if (irpStarted) irpY++;
    if (penStarted) penY++;

    const living = Math.round(p.annualLiving * Math.pow(1 + inf, age - p.currentAge));
    let remaining = Math.max(0, living - np);
    const yar = age - p.retireAge;
    let pensionIncome = 0;

    /* ── 1. ISA 원금 (비과세, 한도 없음) ── */
    if (remaining > 0 && isaOrig > 0 && isa > 0) {
      const draw = Math.min(remaining, isaOrig, isa);
      isa -= draw; isaOrig -= draw; w += draw; remaining -= draw;
      sources.push("ISA원금");
      if (isaOrig <= 0 || isa <= 50) {
        if (isa > 0) {
          const gains = isa;
          tax += Math.round(Math.max(0, gains - 200) * 0.099);
          isaTx = Math.min(Math.round(Math.min(gains, 3000) * 0.1), 300);
          pnD += gains; isa = 0;
        }
        isaOrig = 0;
      }
    }

    /* ── 2. 연금저축 비과세분 (자기부담금, 한도 없음) ── */
    if (remaining > 0 && pnD > 0) {
      const draw = Math.min(remaining, pnD);
      pnD -= draw; w += draw; remaining -= draw;
      sources.push("연금비과세");
    }

    /* ── 3. IRP 퇴직급여 (연금수령한도 적용) ── */
    if (remaining > 0 && irp > 0) {
      if (!irpStarted) { irpStarted = true; irpY = 1; }
      const limit = calcPensionLimit(irp, irpY);
      const draw = Math.min(remaining, limit, irp);
      irp -= draw; w += draw; remaining -= draw;
      tax += calcRetTax(draw, irpY);
      sources.push(`IRP${irpY}년`);
    }

    /* ── 4. 연금저축 과세분 (연금수령한도 적용) ── */
    if (remaining > 0 && pD > 0) {
      if (!penStarted) { penStarted = true; penY = 1; }
      const limit = calcPensionLimit(pD, penY);
      const draw = Math.min(remaining, limit, pD);
      pD -= draw; w += draw; remaining -= draw;
      tax += Math.round(draw * getPensionTaxRate(age));
      pensionIncome += draw;
      sources.push(`연금${penY}년`);
    }

    /* ── 5. 한도 초과 인출 ── */
    if (remaining > 0 && pD > 0) {
      const draw = Math.min(remaining, pD);
      pD -= draw; w += draw; remaining -= draw;
      tax += Math.round(draw * 0.165);
      pensionIncome += draw;
      sources.push("연금초과(16.5%)");
    }
    if (remaining > 0 && irp > 0) {
      const draw = Math.min(remaining, irp);
      irp -= draw; w += draw; remaining -= draw;
      tax += Math.round(draw * 0.03);
      sources.push("IRP초과(퇴직소득세)");
    }

    /* ── 단계 이름 ── */
    let ph, src;
    if (sources.length === 0) {
      ph = np > 0 ? "국민연금 수령" : "자산 소진"; src = "—";
    } else {
      const pr = sources[0];
      if (pr.includes("ISA")) ph = "ISA 인출기";
      else if (pr.includes("비과세")) ph = "연금저축 비과세 인출기";
      else if (pr.includes("IRP")) ph = "IRP 퇴직급여 인출기";
      else ph = "연금 수령기";
      src = sources.join(" + ");
    }

    /* ── 건보료 ── */
    let nn = "";
    const totalInc = np + pensionIncome;
    if (p.nhiBehavior === 'dep') {
      if (totalInc <= 2000) { nhi = 0; nn = "피부양자"; }
      else { nhi = calcRegNHI(totalInc, p.propertyTaxBase); nn = "피부양자상실→지역"; }
    } else if (p.nhiBehavior === 'vol' && yar < 3) {
      nhi = calcVolNHI(p.lastMonthSalary); nn = "임의계속";
    } else {
      if (pensionIncome > p.privThresh) {
        nhi = calcRegNHI(np + pensionIncome, p.propertyTaxBase); nn = "사적연금건보";
      } else {
        nhi = calcRegNHI(np, p.propertyTaxBase); nn = "지역가입자";
      }
    }

    cumT += tax; cumN += nhi;
    data.push({ age, ph, src, isa: Math.round(Math.max(0, isa)), pen: Math.round(Math.max(0, pD + pnD)), irp: Math.round(Math.max(0, irp)), w: Math.round(w), tax: Math.round(tax), nhi: Math.round(nhi), net: Math.round(np + w - tax - nhi), np: Math.round(np), tot: Math.round(Math.max(0, isa) + Math.max(0, pD + pnD) + Math.max(0, irp)), cumT: Math.round(cumT), cumN: Math.round(cumN), nn, living: Math.round(living), remaining: Math.round(remaining) });
  }
  return { data, isaTx };
}
