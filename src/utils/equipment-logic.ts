import { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface LineItemResult {
  product: Product;
  quantity: number;
}

// ==========================================
// 1. Logic สำหรับเลือก Inverter (Unified Algorithm)
// ==========================================
export const selectInverters = (
  availableInverters: Product[], // รายการ Inverter ยี่ห้อที่เลือกทั้งหมด
  projectSizeWatt: number,
  projectPhase: string // 'single_phase' | 'three_phase'
): LineItemResult[] => {
  const results: LineItemResult[] = [];

  // ✅ กรอง Inverter จริงๆ เท่านั้น:
  // (เปลี่ยนจาก const เป็น let เพื่อให้สามารถ filter เฟสไฟทับได้ในขั้นตอนถัดไป)
  let mainInverters = availableInverters
    .filter((p) => p.min_kw !== null && p.min_kw > 100) // กัน Smart Logger ที่ค่าเป็น 2 หลุดเข้ามา
    .filter((p) => {
      const name = p.name.toLowerCase();
      return !name.includes("smart logger") && !name.includes("zero export");
    })
    .sort((a, b) => (b.min_kw || 0) - (a.min_kw || 0));

  console.log(
    "Main Inverters Found:",
    mainInverters.map((p) => `${p.name} (${p.min_kw}W)`)
  );

  // 🌟 เพิ่มเงื่อนไขใหม่: ถ้าโครงการ < 20kW บังคับให้เฟสไฟต้องตรงกันเท่านั้น
  // (ถ้า >= 20kW โค้ดส่วนนี้จะไม่ทำงาน และยอมให้ใช้ Inverter ที่หาได้ทั้งหมดไปคำนวณ)
  if (projectSizeWatt < 20000) {
    mainInverters = mainInverters.filter(
      (p) => p.electrical_phase === projectPhase
    );
  }

  // --- เริ่มการค้นหา (ใช้ Logic เดียวครอบคลุมทุกขนาดโครงการ) ---

  // 1. เลือก 1 Inverter ที่มีขนาดเท่าขนาดโครงการ (Exact Match)
  const exactMatch = mainInverters.find((p) => p.min_kw === projectSizeWatt);
  if (exactMatch) {
    return [{ product: exactMatch, quantity: 1 }];
  }

  // 2. เลือกหลาย Inverter ที่ขนาดเท่ากัน (หารลงตัว - Divisor Match)
  const divisorMatch = mainInverters.find(
    (p) => projectSizeWatt % (p.min_kw || 1) === 0
  );
  if (divisorMatch) {
    const qty = projectSizeWatt / (divisorMatch.min_kw || 1);
    return [{ product: divisorMatch, quantity: qty }];
  }

  // 3. Greedy Algorithm (ถ้าไม่ลงตัว เอาตัวใหญ่สุดยัดไปก่อน แล้วเติมเศษ)
  let remainingWatt = projectSizeWatt;
  const greedySelection: Map<string, { product: Product; qty: number }> =
    new Map();

  while (remainingWatt > 0) {
    // หาตัวใหญ่สุดที่ใส่ได้
    const bestFit = mainInverters.find((p) => (p.min_kw || 0) <= remainingWatt);

    if (bestFit) {
      const current = greedySelection.get(bestFit.id) || {
        product: bestFit,
        qty: 0,
      };
      greedySelection.set(bestFit.id, {
        product: bestFit,
        qty: current.qty + 1,
      });
      remainingWatt -= bestFit.min_kw || 0;
    } else {
      // ถ้าไม่มี Inverter ตัวไหนเล็กพอจะใส่เศษที่เหลือได้แล้ว ให้หยุด loop
      break;
    }
  }

  greedySelection.forEach((value) => {
    results.push({ product: value.product, quantity: value.qty });
  });

  return results;
};

// ==========================================
// 2. Logic เลือก Accessories (Zero Export / Smart Logger)
// ==========================================
export const selectInverterAccessories = (
  accessoryProducts: Product[],
  inverterCount: number,
  projectPhase: string
): LineItemResult | null => {
  // Case A: Inverter มากกว่า 1 ตัว -> Smart Logger 1 ตัว
  if (inverterCount > 1) {
    // เงื่อนไข: min_kw เท่ากับ 2 (ซึ่งคือ Smart Logger ตาม Database คุณ)
    const logger = accessoryProducts.find((p) => p.min_kw === 2);
    if (logger) {
      return { product: logger, quantity: 1 }; // ✅ บังคับเป็น 1 ตัวเสมอ
    }
  }

  // Case B: Inverter 1 ตัว -> Zero Export 1 ตัว
  else {
    if (projectPhase === "single_phase") {
      const zero1P = accessoryProducts.find(
        (p) =>
          (p.min_kw === 0 || p.min_kw === null) &&
          p.electrical_phase === "single_phase"
      );
      if (zero1P) return { product: zero1P, quantity: 1 };
    } else {
      const zero3P = accessoryProducts.find(
        (p) =>
          (p.min_kw === 0 || p.min_kw === null) &&
          p.electrical_phase === "three_phase"
      );
      if (zero3P) return { product: zero3P, quantity: 1 };
    }
  }
  return null;
};