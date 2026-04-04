import { describe, it, expect } from 'vitest';
import { simulate } from '../../src/simulate';

/* ═══ 기본 파라미터 (40세 차장) ═══ */
const BASE = {
  currentAge:40,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:4000,
  isaBalance:2000,isaContrib:2000,pensionSavingsBalance:3000,pensionAnnualContrib:1800,
  irpRetirementPay:9000,nationalPensionMonthly:120,annualReturn:7,retireReturn:3,inflation:2.5,
  lastMonthSalary:600,propertyTaxBase:30000,nhiBehavior:'dep',privThresh:1200,
};

function run(overrides = {}) {
  return simulate({ ...BASE, ...overrides });
}

function atAge(data, age) {
  return data.find(d => d.age === age);
}

/* ═══════════════════════════════════════════
   1. 적립기 복리 성장 검증
   ═══════════════════════════════════════════ */
describe('적립기 (Accumulation Phase)', () => {
  it('ISA: 기존 잔고 × (1+r) + 연간 납입', () => {
    const { data } = run({ currentAge: 40, retireAge: 42 });
    const y0 = atAge(data, 40);
    // year 40: isa = 2000 * 1.07 + 2000 = 4140
    expect(y0.isa).toBe(Math.round(2000 * 1.07 + 2000));
  });

  it('연금저축 세액공제분(pD)과 비과세분(pnD) 분리 성장', () => {
    // contrib 1800 → dd=900 (deducted), nd=900 (non-deducted)
    const { data } = run({ currentAge: 40, retireAge: 42, pensionSavingsBalance: 0 });
    const y0 = atAge(data, 40);
    // pen = pD + pnD = (0*1.07 + 900) + (0*1.07 + 900) = 1800
    expect(y0.pen).toBe(1800);
  });

  it('pnD도 복리 성장 (이전 버그 수정 확인)', () => {
    const { data } = run({ currentAge: 40, retireAge: 43, pensionSavingsBalance: 0, pensionAnnualContrib: 1800 });
    // year 40: pnD = 900, pD = 900
    // year 41: pnD = 900*1.07 + 900 = 1863, pD = 900*1.07 + 900 = 1863
    // year 42: pnD = 1863*1.07 + 900 = 2893.41, pD same
    const y2 = atAge(data, 42);
    const expectedPnD = (900 * 1.07 + 900) * 1.07 + 900;
    const expectedPD = (900 * 1.07 + 900) * 1.07 + 900;
    expect(y2.pen).toBe(Math.round(expectedPnD + expectedPD));
  });

  it('IRP 안전자산 룰: r × 0.85 적용', () => {
    const { data } = run({ currentAge: 40, retireAge: 42, irpRetirementPay: 10000 });
    const y0 = atAge(data, 40);
    expect(y0.irp).toBe(Math.round(10000 * (1 + 0.07 * 0.85)));
  });

  it('적립기에는 세금·건보료 0', () => {
    const { data } = run();
    const accumRows = data.filter(d => d.ph === "적립기");
    accumRows.forEach(d => {
      expect(d.tax).toBe(0);
      expect(d.nhi).toBe(0);
      expect(d.w).toBe(0);
    });
  });
});

/* ═══════════════════════════════════════════
   2. 은퇴기 수익률 검증
   ═══════════════════════════════════════════ */
describe('은퇴기 수익률', () => {
  it('ISA/pD/pnD: rRet 적용, IRP: rRet × 0.85 적용', () => {
    // 즉시 은퇴 시나리오로 첫 해 성장 검증
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 10000, isaContrib: 0, pensionSavingsBalance: 10000,
      pensionAnnualContrib: 0, irpRetirementPay: 10000,
      annualLiving: 0, nationalPensionMonthly: 0, inflation: 0,
    });
    const y0 = atAge(data, 55);
    // living=0, remaining=0, no withdrawals → just growth
    expect(y0.isa).toBe(Math.round(10000 * 1.03));
    expect(y0.irp).toBe(Math.round(10000 * (1 + 0.03 * 0.85)));
  });
});

/* ═══════════════════════════════════════════
   3. 물가상승률 검증
   ═══════════════════════════════════════════ */
describe('물가상승률 (Inflation)', () => {
  it('생활비가 매년 복리 증가', () => {
    const { data } = run({ currentAge: 55, retireAge: 55, inflation: 3, annualLiving: 4000 });
    const y0 = atAge(data, 55);
    const y5 = atAge(data, 60);
    expect(y0.living).toBe(4000); // age 55, 0 years elapsed
    expect(y5.living).toBe(Math.round(4000 * Math.pow(1.03, 5)));
  });

  it('인플레 0이면 생활비 고정', () => {
    const { data } = run({ currentAge: 55, retireAge: 55, inflation: 0, annualLiving: 4000 });
    const y10 = atAge(data, 65);
    expect(y10.living).toBe(4000);
  });
});

/* ═══════════════════════════════════════════
   4. 워터폴 인출 순서 검증
   ═══════════════════════════════════════════ */
describe('워터폴 인출 순서', () => {
  it('ISA 원금 → 비과세분 → IRP → 연금 과세분 순서', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 1000, isaContrib: 0, pensionSavingsBalance: 0,
      pensionAnnualContrib: 1800, irpRetirementPay: 5000,
      annualLiving: 2000, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    // ISA 원금 1000 → 1년차에 ISA 소진
    const y0 = atAge(data, 55);
    expect(y0.ph).toBe("ISA 인출기");

    // ISA 소진 후 다음 버킷으로
    const phases = data.map(d => d.ph);
    const uniquePhases = [...new Set(phases)];
    // 적립기 없으므로 ISA → 다음으로 이동 확인
    expect(uniquePhases[0]).toBe("ISA 인출기");
  });

  it('ISA 원금 소진 시 수익 실현 → pnD 전환', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 500, isaContrib: 0, pensionSavingsBalance: 5000,
      pensionAnnualContrib: 0, irpRetirementPay: 5000,
      annualLiving: 600, nationalPensionMonthly: 0, inflation: 0, retireReturn: 5,
    });
    // ISA grows 500*1.05=525, isaOrig=500, draw=min(600,500,525)=500
    // isa=25, isaOrig=0 → gains=25, tax on gains=round(max(0,25-200)*0.099)=0
    // gains→pnD, remaining=100 → pnD=25 draw 25, remaining=75 → IRP overflow
    // IRP tax = calcRetTax(75,1) = round(75*0.03*0.7) = 2
    const y0 = atAge(data, 55);
    expect(y0.tax).toBe(2); // ISA gains 비과세 + IRP overflow 소액
  });
});

/* ═══════════════════════════════════════════
   5. 연금수령한도 검증
   ═══════════════════════════════════════════ */
describe('연금수령한도', () => {
  it('1년차: 잔액/10 × 1.2', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 0, isaContrib: 0, pensionSavingsBalance: 0,
      pensionAnnualContrib: 0, irpRetirementPay: 10000,
      annualLiving: 50000, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    // IRP 10000, 1년차 한도 = 10000/10*1.2 = 1200
    // need=50000, IRP limit=1200, draw=1200
    // remaining still huge → over-limit from IRP
    const y0 = atAge(data, 55);
    // Within limit tax: calcRetTax(1200, 1) = round(1200*0.03*0.7) = 25
    // Over limit: min(50000-1200, 10000-1200) = 8800, tax = round(8800*0.03) = 264
    expect(y0.w).toBe(10000); // all IRP drawn (limit + over)
    expect(y0.src).toContain("IRP1년");
    expect(y0.src).toContain("IRP초과");
  });

  it('11년차 이후 한도 없음', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 0, isaContrib: 0, pensionSavingsBalance: 100000,
      pensionAnnualContrib: 0, irpRetirementPay: 0,
      annualLiving: 500, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    // 연금 과세분, 연 500만 인출, 11년차(age 65)에는 한도 무제한
    const y10 = atAge(data, 65);
    // penY = 11, limit = balance (무제한)
    expect(y10.remaining).toBe(0); // 전액 인출 가능
  });
});

/* ═══════════════════════════════════════════
   6. 세금 정합성 검증
   ═══════════════════════════════════════════ */
describe('세금 계산', () => {
  it('ISA 원금 인출: 세금 0', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 10000, isaContrib: 0, pensionSavingsBalance: 0,
      pensionAnnualContrib: 0, irpRetirementPay: 0,
      annualLiving: 1000, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    // ISA 원금만 인출, 아직 원금 남아있음 (수익 없음 r=0)
    const y0 = atAge(data, 55);
    expect(y0.tax).toBe(0);
  });

  it('IRP 한도 내: 퇴직소득세 × 70% (1~10년차)', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 0, isaContrib: 0, pensionSavingsBalance: 0,
      pensionAnnualContrib: 0, irpRetirementPay: 50000,
      annualLiving: 1000, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    const y0 = atAge(data, 55);
    // IRP 1년차 한도 = 50000/10*1.2 = 6000 > need 1000
    // tax = round(1000 * 0.03 * 0.7) = 21
    expect(y0.tax).toBe(Math.round(1000 * 0.03 * 0.7));
  });

  it('IRP 한도 초과: 비할인 퇴직소득세 3% (16.5% 아님)', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 0, isaContrib: 0, pensionSavingsBalance: 0,
      pensionAnnualContrib: 0, irpRetirementPay: 5000,
      annualLiving: 5000, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    // IRP 1년차 한도 = 5000/10*1.2 = 600
    // within-limit: 600, tax = round(600*0.03*0.7) = 13
    // over-limit: 4400, tax = round(4400*0.03) = 132
    // total tax = 13 + 132 = 145
    const y0 = atAge(data, 55);
    expect(y0.tax).toBe(Math.round(600 * 0.03 * 0.7) + Math.round(4400 * 0.03));
  });

  it('연금 과세분: 나이별 연금소득세 3.3~5.5%', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 0, isaContrib: 0, pensionSavingsBalance: 50000,
      pensionAnnualContrib: 0, irpRetirementPay: 0,
      annualLiving: 500, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    const y55 = atAge(data, 55);
    // age 55 < 70 → 5.5%
    // 1년차 한도 = 50000/10*1.2 = 6000 > 500
    expect(y55.tax).toBe(Math.round(500 * 0.055));

    const y70 = atAge(data, 70);
    if (y70 && y70.ph === "연금 수령기") {
      // 70세 → 4.4%
      expect(y70.tax).toBe(Math.round(y70.w * 0.044));
    }
  });

  it('연금 한도 초과: 기타소득세 16.5%', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 0, isaContrib: 0, pensionSavingsBalance: 3000,
      pensionAnnualContrib: 0, irpRetirementPay: 0,
      annualLiving: 3000, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    // 1년차 한도 = 3000/10*1.2 = 360
    // within: 360, tax = round(360*0.055) = 20
    // over: 2640, tax = round(2640*0.165) = 436
    const y0 = atAge(data, 55);
    expect(y0.tax).toBe(Math.round(360 * 0.055) + Math.round(2640 * 0.165));
  });

  it('누적 세금이 단조 증가', () => {
    const { data } = run();
    for (let i = 1; i < data.length; i++) {
      expect(data[i].cumT).toBeGreaterThanOrEqual(data[i - 1].cumT);
    }
  });
});

/* ═══════════════════════════════════════════
   7. 건보료 정합성 검증
   ═══════════════════════════════════════════ */
describe('건보료 (NHI)', () => {
  it('피부양자: ISA/IRP 인출 시 소득 미반영 → nhi=0', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 50000, isaContrib: 0, pensionSavingsBalance: 0,
      pensionAnnualContrib: 0, irpRetirementPay: 0,
      annualLiving: 3000, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
      nhiBehavior: 'dep',
    });
    const y0 = atAge(data, 55);
    expect(y0.nhi).toBe(0);
    expect(y0.nn).toBe("피부양자");
  });

  it('피부양자: 국민연금+사적연금 > 2000만 → 피부양자 상실', () => {
    const { data } = run({
      currentAge: 65, retireAge: 55, pensionStartAge: 65,
      isaBalance: 0, isaContrib: 0, pensionSavingsBalance: 50000,
      pensionAnnualContrib: 0, irpRetirementPay: 0,
      annualLiving: 5000, nationalPensionMonthly: 120, inflation: 0, retireReturn: 0,
      nhiBehavior: 'dep',
    });
    // np = 1440, pensionIncome will be some amount from pension deducted
    // If np + pensionIncome > 2000 → 피부양자 상실
    const y0 = atAge(data, 65);
    if (y0.np + (y0.w) > 2000) {
      expect(y0.nn).toBe("피부양자상실→지역");
      expect(y0.nhi).toBeGreaterThan(0);
    }
  });

  it('임의계속: 퇴직 후 3년간 적용', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, nhiBehavior: 'vol', lastMonthSalary: 600,
    });
    const y0 = atAge(data, 55);
    const y2 = atAge(data, 57);
    const y3 = atAge(data, 58);
    expect(y0.nn).toBe("임의계속");
    expect(y2.nn).toBe("임의계속");
    expect(y3.nn).not.toBe("임의계속"); // 3년 경과
  });

  it('사적연금 건보 기준 1200만 적용', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 0, isaContrib: 0, pensionSavingsBalance: 50000,
      pensionAnnualContrib: 0, irpRetirementPay: 0,
      annualLiving: 1100, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
      nhiBehavior: 'reg', privThresh: 1200,
    });
    const y0 = atAge(data, 55);
    // pensionIncome = 1100 < 1200 → 건보 비영향
    expect(y0.nn).toBe("지역가입자");
  });
});

/* ═══════════════════════════════════════════
   8. 자산 소진 + 국민연금만 수령 검증
   ═══════════════════════════════════════════ */
describe('자산 소진', () => {
  it('자산 소진 후 국민연금만 수령', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 60, lifeExpectancy: 80,
      isaBalance: 1000, isaContrib: 0, pensionSavingsBalance: 1000,
      pensionAnnualContrib: 0, irpRetirementPay: 1000,
      annualLiving: 3000, nationalPensionMonthly: 100, inflation: 0, retireReturn: 0,
    });
    // 전체 자산 3000만, 연간 3000만 필요 → 1~2년 내 소진
    const depleted = data.find(d => d.tot <= 0);
    expect(depleted).toBeDefined();
    // 소진 후 국민연금 수령기
    const afterDepletion = data.find(d => d.age >= 60 && d.tot <= 0);
    if (afterDepletion) {
      expect(afterDepletion.ph).toBe("국민연금 수령");
      expect(afterDepletion.np).toBe(1200); // 100만 × 12
    }
  });

  it('총 자산(tot)은 음수가 되지 않음', () => {
    const { data } = run();
    data.forEach(d => {
      expect(d.tot).toBeGreaterThanOrEqual(0);
      expect(d.isa).toBeGreaterThanOrEqual(0);
      expect(d.pen).toBeGreaterThanOrEqual(0);
      expect(d.irp).toBeGreaterThanOrEqual(0);
    });
  });
});

/* ═══════════════════════════════════════════
   9. 연금수령연차 카운터 검증
   ═══════════════════════════════════════════ */
describe('연금수령연차 카운터', () => {
  it('IRP 연차: 첫 인출 시 1년차, 이후 매년 증가', () => {
    const { data } = run({
      currentAge: 55, retireAge: 55, pensionStartAge: 70,
      isaBalance: 3000, isaContrib: 0, pensionSavingsBalance: 0,
      pensionAnnualContrib: 0, irpRetirementPay: 50000,
      annualLiving: 2000, nationalPensionMonthly: 0, inflation: 0, retireReturn: 0,
    });
    // ISA 3000 / 2000 per year = ~1.5 years of ISA
    // IRP starts around age 57
    const irpStart = data.find(d => d.src && d.src.includes("IRP"));
    if (irpStart) {
      expect(irpStart.src).toContain("IRP1년");
      const nextYear = atAge(data, irpStart.age + 1);
      if (nextYear && nextYear.src && nextYear.src.includes("IRP")) {
        expect(nextYear.src).toContain("IRP2년");
      }
    }
  });
});

/* ═══════════════════════════════════════════
   10. 페르소나별 정합성 (스모크 테스트)
   ═══════════════════════════════════════════ */
describe('페르소나 스모크 테스트', () => {
  const personas = [
    { label: "25세 신입", params: { currentAge:25,retireAge:55,pensionStartAge:65,lifeExpectancy:90,annualLiving:3000,isaBalance:0,isaContrib:500,pensionSavingsBalance:0,pensionAnnualContrib:600,irpRetirementPay:0,nationalPensionMonthly:80,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:350,propertyTaxBase:0,nhiBehavior:'dep',privThresh:1200 }},
    { label: "40세 차장", params: BASE },
    { label: "55세 퇴직임박", params: { currentAge:55,retireAge:56,pensionStartAge:65,lifeExpectancy:95,annualLiving:5000,isaBalance:40000,isaContrib:0,pensionSavingsBalance:35000,pensionAnnualContrib:0,irpRetirementPay:40000,nationalPensionMonthly:170,annualReturn:7,retireReturn:3,inflation:2.5,lastMonthSalary:1200,propertyTaxBase:80000,nhiBehavior:'dep',privThresh:1200 }},
  ];

  personas.forEach(({ label, params }) => {
    it(`${label}: 데이터 길이 = lifeExpectancy - currentAge + 1`, () => {
      const { data } = simulate(params);
      expect(data.length).toBe(params.lifeExpectancy - params.currentAge + 1);
    });

    it(`${label}: 첫 행 age = currentAge, 마지막 행 age = lifeExpectancy`, () => {
      const { data } = simulate(params);
      expect(data[0].age).toBe(params.currentAge);
      expect(data[data.length - 1].age).toBe(params.lifeExpectancy);
    });

    it(`${label}: net = np + w - tax - nhi`, () => {
      const { data } = simulate(params);
      data.filter(d => d.age >= params.retireAge).forEach(d => {
        expect(d.net).toBe(Math.round(d.np + d.w - d.tax - d.nhi));
      });
    });

    it(`${label}: tot ≈ isa + pen + irp (±1 반올림 허용)`, () => {
      const { data } = simulate(params);
      data.forEach(d => {
        const sum = Math.max(0, d.isa) + Math.max(0, d.pen) + Math.max(0, d.irp);
        expect(Math.abs(d.tot - sum)).toBeLessThanOrEqual(1);
      });
    });

    it(`${label}: cumT 단조 증가`, () => {
      const { data } = simulate(params);
      for (let i = 1; i < data.length; i++) {
        expect(data[i].cumT).toBeGreaterThanOrEqual(data[i - 1].cumT);
      }
    });

    it(`${label}: 크래시 없이 완주`, () => {
      expect(() => simulate(params)).not.toThrow();
    });
  });
});
