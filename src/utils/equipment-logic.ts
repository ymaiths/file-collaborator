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

  // กรอง Inverter ที่ไม่ใช่ Accessories (min_kw > 0)
  // และเรียงจากใหญ่ไปเล็ก เพื่อประโยชน์ของ Greedy
  const mainInverters = availableInverters
    .filter((p) => p.min_kw !== null && p.min_kw > 0)
    .sort((a, b) => (b.min_kw || 0) - (a.min_kw || 0));

  // --- กรณีที่ 1: โครงการ < 20kW (20,000 Watt) ---
  if (projectSizeWatt < 20000) {
    // เลือกตัวที่มีขนาดเท่ากัน และ Phase ตรงกัน
    const match = mainInverters.find(
      (p) => p.min_kw === projectSizeWatt && p.electrical_phase === projectPhase
    );

    if (match) {
      results.push({ product: match, quantity: 1 });
    }
    // ถ้าหาไม่เจอ ให้คืนค่าว่าง (หรือจะ Handle fallback ก็ได้)
    return results;
  }

  // --- กรณีที่ 2: โครงการ >= 20kW ---

  // 2.1 เลือก 1 Inverter ที่มีขนาดเท่าขนาดโครงการ
  const exactMatch = mainInverters.find((p) => p.min_kw === projectSizeWatt);
  if (exactMatch) {
    return [{ product: exactMatch, quantity: 1 }];
  }

  // 2.2 เลือกหลาย Inverter ที่ขนาดเท่ากัน (หารลงตัว)
  // เนื่องจากเรียงจากมากไปน้อยแล้ว ตัวแรกที่เจอคือตัวใหญ่ที่สุดที่หารลงตัว
  const divisorMatch = mainInverters.find(
    (p) => projectSizeWatt % (p.min_kw || 1) === 0
  );
  if (divisorMatch) {
    const qty = projectSizeWatt / (divisorMatch.min_kw || 1);
    return [{ product: divisorMatch, quantity: qty }];
  }

  // 2.3 Greedy Algorithm (เลือกขนาดต่างกัน)
  // เลือกตัวใหญ่ที่สุดที่ใส่น้อยกว่าที่เหลือ ใส่ไปเรื่อยๆ จนครบ
  let remainingWatt = projectSizeWatt;
  const greedySelection: Map<string, { product: Product; qty: number }> =
    new Map();

  // วนลูปเลือกของ
  while (remainingWatt > 0) {
    // หา Inverter ตัวที่ใหญ่ที่สุด ที่ยังเล็กกว่าหรือเท่ากับ remainingWatt
    // (mainInverters เรียงจากมากไปน้อยอยู่แล้ว find จะเจอตัวใหญ่สุดที่เข้าเงื่อนไข)
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
      // กรณีเหลือเศษยิบย่อยที่ไม่มี Inverter ตัวไหนลง (เช่นเหลือ 100W แต่ Inverter เล็กสุด 3kW)
      // ต้อง Break เพื่อกัน Infinite Loop (ในทางปฏิบัติ อาจจะต้องปัดขึ้นหรือแจ้งเตือน)
      break;
    }
  }

  // แปลง Map กลับเป็น Array
  greedySelection.forEach((value) => {
    results.push({ product: value.product, quantity: value.qty });
  });

  return results;
};

// ==========================================
// 2. Logic เลือก Accessories (Zero Export / Smart Logger)
// ==========================================
export const selectInverterAccessories = (
  accessoryProducts: Product[], // สินค้าในหมวด inverter หรือ zero_export_smart_logger
  inverterCount: number,
  projectPhase: string
): LineItemResult | null => {
  // Case A: Inverter มากกว่า 1 ตัว -> Smart Logger
  if (inverterCount > 1) {
    // เงื่อนไข: min_kw เท่ากับ 2
    const logger = accessoryProducts.find((p) => p.min_kw === 2);
    if (logger) return { product: logger, quantity: 1 };
  }

  // Case B: Inverter 1 ตัว -> Zero Export
  else {
    if (projectPhase === "single_phase") {
      // เงื่อนไข: 1 Phase, min_kw เป็น 0 หรือ null
      const zero1P = accessoryProducts.find(
        (p) =>
          (p.min_kw === 0 || p.min_kw === null) &&
          p.electrical_phase === "single_phase"
      );
      if (zero1P) return { product: zero1P, quantity: 1 };
    } else {
      // เงื่อนไข: 3 Phase, min_kw เป็น 0 หรือ null
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
