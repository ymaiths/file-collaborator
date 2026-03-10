import { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];
type AnyLineItem = {
  quantity: number;
  products: Product | null;
  [key: string]: any;
};

export const calculateItemCost = (
  item: AnyLineItem,
  projectSizeVal: number 
) => {
  const product = item.products;
  if (!product) return { costEq: 0, costInst: 0 };

  // 1. คำนวณต้นทุนอุปกรณ์ (costEq)
  let costEq = 0;
  if (product.is_fixed_cost) {
    costEq = (product.cost_fixed || 0) * item.quantity;
  } else {
    costEq = (product.cost_percentage || 0) * projectSizeVal * item.quantity;
  }

  // 2. คำนวณต้นทุนค่าติดตั้ง (costInst)
  let costInst = 0;
  if (product.is_fixed_installation_cost) {
    costInst = (product.fixed_installation_cost || 0) * item.quantity;
  } else {
    costInst = (product.installation_cost_percentage || 0) * costEq;
  }

  return { costEq, costInst };
};

export const calculateDefaultLineItem = (
  product: Product,
  projectSizeWatt: number,
  quantity: number = 1
) => {
  const { costEq, costInst } = calculateItemCost(
    { quantity, products: product },
    projectSizeWatt
  );

  return {
    quantity,
    product_price: costEq,
    installation_price: costInst,
  };
};

/**
 * 2. Helper ตรวจสอบว่าเป็น Included Items หรือไม่?
 * 🌟 Data-Driven 100%: อิงจาก field is_price_included ในตาราง products โดยตรง
 * ไม่ต้อง Hardcode ชื่อหมวดหมู่อีกต่อไป
 */
export const isIncludedItem = (
  product: Product,
  projectSizeWatt: number
): boolean => {
  // ถ้าตั้งค่าไว้ว่าเป็น true หรือ false ให้ยึดตามนั้น 
  // แต่ถ้าไม่มีค่า (null) ให้ถือว่ารวมในราคาขาย (true) เป็นค่าเริ่มต้น
  return product.is_price_included ?? true;
};

/**
 * 3. ฟังก์ชันปัดเศษเป็นจำนวนเต็มร้อย
 */
export const roundToHundred = (num: number): number => {
  return Math.round(num / 100) * 100;
};