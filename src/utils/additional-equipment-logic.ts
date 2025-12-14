// ไฟล์: src/utils/additional-equipment-logic.ts

// Helper สำหรับตรวจสอบว่า Inverter อยู่ในกลุ่มที่กำหนดหรือไม่
const isOneOf = (val: number, list: number[]) => list.includes(val);

/**
 * ฟังก์ชันเลือกขนาด Optimizer (Watt) ตามเงื่อนไขตาราง
 */
export const determineOptimizerSize = (
  inverterKw: number, // หน่วยเป็น kW (เช่น 3, 5, 10, 50)
  panelWatt: number // หน่วยเป็น Watt (เช่น 450, 550)
): number | null => {
  // กลุ่ม Inverter ขนาดเล็ก: 3, 5, 10 kW
  if (isOneOf(inverterKw, [3, 5, 10])) {
    if (panelWatt < 450) return 450;
    return 600; // ใช้ >= เพื่อครอบคลุม > 450
  }

  // กลุ่ม Inverter ขนาดกลาง: 12, 15, 20, 30, 36, 40 kW
  if (isOneOf(inverterKw, [12, 15, 20, 30, 36, 40])) {
    if (panelWatt < 550) return 600;
    if (panelWatt >= 550 && panelWatt <= 600) return 1100;
    return 1300;
  }

  // กลุ่ม Inverter ขนาดใหญ่: 50 kW
  if (inverterKw === 50) {
    if (panelWatt < 600) return 1100;
    return 1300;
  }

  return null; // ไม่เข้าเงื่อนไขใดเลย
};

/**
 * ฟังก์ชันคำนวณจำนวน Optimizer
 */
export const calculateOptimizerQty = (
  optimizerSize: number, // 450, 600, 1100, 1300
  totalPanels: number
): number => {
  // Optimizer ขนาด 450W หรือ 600W (1 ต่อ 1)
  if (optimizerSize === 450 || optimizerSize === 600) {
    return totalPanels;
  }

  // Optimizer ขนาด 1100W หรือ 1300W (1 ต่อ 2)
  if (optimizerSize === 1100 || optimizerSize === 1300) {
    return Math.ceil(totalPanels / 2); // หาร 2 แล้วปัดขึ้น
  }

  return 0;
};
