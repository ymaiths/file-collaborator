import { Database } from "@/integrations/supabase/types";

// ใช้ Type แบบกว้างๆ หรือ import มาจาก types ก็ได้
type Product = Database["public"]["Tables"]["products"]["Row"];
type AnyLineItem = {
  quantity: number;
  products: Product | null;
  [key: string]: any;
};

export const calculateItemCost = (
  item: AnyLineItem,
  projectSizeVal: number // รับค่า quotations.kw_size (จะเป็น Watt หรือ kW ขึ้นอยู่กับข้อมูลใน DB คุณ)
) => {
  const product = item.products;
  if (!product) return { costEq: 0, costInst: 0 };

  // 1. คำนวณต้นทุนอุปกรณ์ (costEq)
  let costEq = 0;
  if (product.is_fixed_cost) {
    // แบบ Fixed: ราคาต่อหน่วย * จำนวน
    costEq = (product.cost_fixed || 0) * item.quantity;
  } else {
    // แบบ %: (Cost% * ขนาดโครงการ) * จำนวน
    // หมายเหตุ: เช็คหน่วย projectSizeVal ให้ดีว่าเป็น Watt หรือ kW ตามที่ cost_percentage อ้างอิง
    costEq = (product.cost_percentage || 0) * projectSizeVal * item.quantity;
  }

  // 2. คำนวณต้นทุนค่าติดตั้ง (costInst)
  let costInst = 0;
  if (product.is_fixed_installation_cost) {
    // แบบ Fixed: ราคาต่อหน่วย * จำนวน
    costInst = (product.fixed_installation_cost || 0) * item.quantity;
  } else {
    // ✅ แก้ไขตามสูตรใหม่:
    // "ราคาทุนค่าติดตั้ง = products.installation_cost_percentage * ราคาทุนของอุปกรณ์"
    // เราใช้ costEq ที่เพิ่งคำนวณเสร็จข้างบน มาคูณได้เลย
    costInst = (product.installation_cost_percentage || 0) * costEq;
  }

  return { costEq, costInst };
};
/**
 * 2. Helper ตรวจสอบว่าเป็น Included Items หรือไม่?
 */
export const isIncludedItem = (
  product: Product,
  projectSizeWatt: number
): boolean => {
  // 2.1 Required Product (อุปกรณ์หลัก)
  if (product.is_required_product) return true;

  // 2.2 Optimizer
  // เช็คทั้ง category และชื่อเผื่อไว้
  if (
    (product.product_category as any) === "optimizer" ||
    product.name.toLowerCase().includes("optimizer")
  ) {
    return true;
  }

  // 2.3 Walkway & Water Service (เฉพาะโครงการ >= 100kW)
  if (
    (product.product_category as any) === "service" &&
    projectSizeWatt >= 100000
  ) {
    return true;
  }

  return false;
};

/**
 * 3. ฟังก์ชันปัดเศษเป็นจำนวนเต็มร้อย (Round to nearest 100)
 */
export const roundToHundred = (num: number): number => {
  return Math.round(num / 100) * 100;
};
