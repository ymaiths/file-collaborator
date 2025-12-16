import { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

interface LineItemResult {
  product: Product;
  quantity: number;
}

// ==========================================
// 1. Logic สำหรับเลือก Inverter (Complex Algorithm)
// ==========================================
export const selectInverters = (
  availableInverters: Product[], // รายการ Inverter ยี่ห้อที่เลือกทั้งหมด
  projectSizeWatt: number,
  projectPhase: string // 'single_phase' | 'three_phase'
): LineItemResult[] => {
  const results: LineItemResult[] = [];

  // ✅✅✅ แก้ไขจุดที่ผิดพลาดตรงนี้ ✅✅✅
  // กรอง Inverter จริงๆ เท่านั้น:
  // 1. ต้องไม่ใช่ Accessories (เราสมมติว่า Inverter จริงๆ ต้องมีขนาด > 100 Watt ขึ้นไป)
  // 2. ชื่อต้องไม่มีคำว่า Smart Logger หรือ Zero Export
  const mainInverters = availableInverters
    .filter((p) => p.min_kw !== null && p.min_kw > 100) // แก้จาก > 0 เป็น > 100 (กัน Smart Logger ที่ค่าเป็น 2 หลุดเข้ามา)
    .filter((p) => {
      const name = p.name.toLowerCase();
      return !name.includes("smart logger") && !name.includes("zero export");
    })
    .sort((a, b) => (b.min_kw || 0) - (a.min_kw || 0));

  console.log(
    "Main Inverters Found:",
    mainInverters.map((p) => `${p.name} (${p.min_kw}W)`)
  );

  // --- กรณีที่ 1: โครงการ < 20kW (20,000 Watt) ---
  if (projectSizeWatt < 20000) {
    const match = mainInverters.find(
      (p) => p.min_kw === projectSizeWatt && p.electrical_phase === projectPhase
    );

    if (match) {
      results.push({ product: match, quantity: 1 });
    }
    return results;
  }

  // --- กรณีที่ 2: โครงการ >= 20kW ---

  // 2.1 เลือก 1 Inverter ที่มีขนาดเท่าขนาดโครงการ
  const exactMatch = mainInverters.find((p) => p.min_kw === projectSizeWatt);
  if (exactMatch) {
    return [{ product: exactMatch, quantity: 1 }];
  }

  // 2.2 เลือกหลาย Inverter ที่ขนาดเท่ากัน (หารลงตัว)
  const divisorMatch = mainInverters.find(
    (p) => projectSizeWatt % (p.min_kw || 1) === 0
  );
  if (divisorMatch) {
    const qty = projectSizeWatt / (divisorMatch.min_kw || 1);
    return [{ product: divisorMatch, quantity: qty }];
  }

  // 2.3 Greedy Algorithm
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
      // ถ้าไม่ลงตัว (เศษเหลือ) ให้แจ้งเตือน หรือหยุด loop
      // ในเคส 199kW ถ้าไม่มี Inverter ที่รวมกันได้ 199kW เป๊ะๆ อาจจะเหลือเศษ
      // แนะนำ: ถ้าเหลือเศษเล็กน้อย ให้หยุด (Break)
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
