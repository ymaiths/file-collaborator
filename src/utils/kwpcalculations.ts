// ไฟล์: src/utils/kwpcalculations.ts

export const calculateSystemSpecs = (
  projectSizeWatt: number, // รับค่าเป็น Watt (จาก quotations.kw_size)
  panelSizeWatt: number // รับค่าเป็น Watt (จาก quotations.kw_panel)
) => {
  // ป้องกันการหารด้วย 0 หรือค่าว่าง
  if (!projectSizeWatt || !panelSizeWatt || panelSizeWatt === 0) {
    return {
      kwPeak: 0,
      numberOfPanels: 0,
    };
  }

  // 1. คำนวณจำนวนแผง = ขนาดโครงการ (Watt) / ขนาดแผง (Watt)
  // (ไม่ต้องคูณ 1000 แล้ว เพราะ input เป็น Watt แล้ว)
  const rawPanels = projectSizeWatt / panelSizeWatt;

  // 2. ปัดเศษขึ้น (Round Up) ให้เป็นจำนวนเต็ม
  let numberOfPanels = Math.ceil(rawPanels);

  // 3. เช็คว่าเป็นเลขคี่หรือไม่? ถ้าเป็นเลขคี่ ให้บวกเพิ่มอีก 1 (เพื่อให้เป็นเลขคู่)
  if (numberOfPanels % 2 !== 0) {
    numberOfPanels += 1;
  }

  // 4. คำนวณกำลังไฟสูงสุด (Watt) = จำนวนแผง x ขนาดแผง
  const kwPeak = numberOfPanels * panelSizeWatt;

  return {
    kwPeak, // กำลังไฟสูงสุด (หน่วย Watt)
    numberOfPanels, // จำนวนแผง
  };
};
