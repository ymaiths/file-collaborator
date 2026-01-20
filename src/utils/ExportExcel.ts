import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Helper Function: โหลดรูปภาพจาก URL (แทน fs.readFileSync)
const loadImage = async (url: string): Promise<ArrayBuffer | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load image: ${url}`);
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(error);
    return null;
  }
};

// Helper Function: แปลงตัวเลขเป็นคำอ่านภาษาไทย (จาก Script ของคุณ)
const getBahtText = (num: number): string => {
  if (!num) return "ศูนย์บาทถ้วน";
  num = Number(num);
  const suffix = "บาท";
  const satangSuffix = "สตางค์";
  const fullSuffix = "ถ้วน";
  const textNum = [
    "ศูนย์",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
  ];
  const textScale = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

  const splitNum = String(num.toFixed(2)).split(".");
  let baht = splitNum[0];
  let satang = splitNum[1];

  const convert = (numberStr: string) => {
    let res = "";
    const len = numberStr.length;
    for (let i = 0; i < len; i++) {
      const digit = Number(numberStr[i]);
      if (digit !== 0) {
        const scaleIdx = len - i - 1;
        if (digit === 1 && scaleIdx === 0 && len > 1) {
          res += "เอ็ด";
        } else if (digit === 1 && scaleIdx === 1) {
          res += "";
        } else if (digit === 2 && scaleIdx === 1) {
          res += "ยี่";
        } else {
          res += textNum[digit];
        }
        if (scaleIdx === 1 && digit === 1) res += "สิบ";
        else res += textScale[scaleIdx];
      }
    }
    return res;
  };

  let bahtText = "";
  if (baht.length > 6) {
    const overMillion = baht.substring(0, baht.length - 6);
    const underMillion = baht.substring(baht.length - 6);
    bahtText = convert(overMillion) + "ล้าน" + convert(underMillion);
  } else {
    bahtText = convert(baht);
  }
  bahtText += suffix;
  if (Number(satang) === 0) {
    bahtText += fullSuffix;
  } else {
    bahtText += convert(satang) + satangSuffix;
  }
  return bahtText;
};

// Interface สำหรับข้อมูลที่จะรับเข้ามา (Map ให้ตรงกับ mockData เดิมของคุณ)
export interface ExcelLineItem {
  no: number;
  name: string;
  brand: string;
  qty: number;
  unit: string;
  matUnit: number;
  matTotal: number;
  labUnit: number;
  labTotal: number;
  total: number;
  category: "A" | "B";
}

export interface QuotationData {
  // ข้อมูลบริษัท
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyTaxId: string;
  // ข้อมูลลูกค้าและโปรเจค
  customerName: string;
  customerAddress: string;
  customerID: string; // Tax ID ลูกค้า
  projectName: string;
  maxPower: string;
  inverterBrand: string;
  date: string;
  docNumber: string;
  // รายการสินค้า
  items: ExcelLineItem[];
  // เงื่อนไข
  paymentTerms: string[];
  warrantyTerms: string[];
  remarks: string;
  // ยอดรวม
  discount: number;
  vatRate: number;
}

export const generateQuotationExcel = async (data: QuotationData) => {
  console.log("⏳ กำลังสร้างไฟล์ Excel...");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Quotation", {
    properties: { defaultRowHeight: 24.5 },
  });

  const defaultFont = { name: "Kanit Light", size: 9 };

  // ==========================================
  // 1. LOAD IMAGES (จาก public folder)
  // ==========================================
  const logoBuffer = await loadImage("/logo.png");
  const signBuffer = await loadImage("/signature.png");
  const wmBuffer = await loadImage("/watermark.png");

  let logoId: number | null = null;
  let signatureId: number | null = null;
  let watermarkId: number | null = null;

  if (logoBuffer) {
    logoId = workbook.addImage({ buffer: logoBuffer, extension: "png" });
  }
  if (signBuffer) {
    signatureId = workbook.addImage({ buffer: signBuffer, extension: "png" });
  }
  if (wmBuffer) {
    watermarkId = workbook.addImage({ buffer: wmBuffer, extension: "png" });
  }

  // ==========================================
  // 2. SETUP COLUMNS
  // ==========================================
  worksheet.columns = [
    { key: "no", width: 5, style: { font: defaultFont } },
    { key: "name", width: 50, style: { font: defaultFont } },
    { key: "company", width: 12, style: { font: defaultFont } },
    { key: "brand", width: 12, style: { font: defaultFont } },
    { key: "qty", width: 12, style: { font: defaultFont } },
    { key: "unit", width: 8, style: { font: defaultFont } },
    { key: "matUnit", width: 12, style: { font: defaultFont } },
    { key: "matTotal", width: 12, style: { font: defaultFont } },
    { key: "labUnit", width: 12, style: { font: defaultFont } },
    { key: "labTotal", width: 12, style: { font: defaultFont } },
    { key: "total", width: 14, style: { font: defaultFont } },
  ];

  // ==========================================
  // 3. HEADER SECTION
  // ==========================================
  if (logoId !== null) {
    worksheet.addImage(logoId, {
      tl: { col: 0, row: 0 } as any,
      br: { col: 2, row: 10 } as any,
    });
  }

  if (watermarkId !== null) {
    worksheet.addImage(watermarkId, {
      tl: { col: 10.5, row: 1 } as any,
      br: { col: 11, row: 10 } as any,
    });
  }

  // ใช้ข้อมูลจริงจาก data.company...
  worksheet.mergeCells("C1:H3");
  const companynameCell = worksheet.getCell("C1");
  companynameCell.value = data.companyName;
  companynameCell.alignment = {
    vertical: "bottom",
    horizontal: "center",
    wrapText: true,
  };
  companynameCell.font = { name: "Kanit Light", size: 16, bold: true };

  worksheet.mergeCells("C4:H10");
  const companyinfoCell = worksheet.getCell("C4");
  companyinfoCell.value = `ที่อยู่ ${data.companyAddress}\nTel : ${data.companyPhone}\nเลขประจำตัวผู้เสียภาษี: ${data.companyTaxId}`;
  companyinfoCell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  companyinfoCell.font = { name: "Kanit Light", size: 12 };

  worksheet.mergeCells("I1:K10");
  const titleCell = worksheet.getCell("I1");
  titleCell.value = "ใบเสนอราคา\nQUOTATION";
  titleCell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  titleCell.font = {
    name: "Kanit Light",
    size: 20,
    bold: true,
    color: { argb: "FF002060" },
  };
  titleCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  worksheet.mergeCells("A11:H20");
  const customerCell = worksheet.getCell("A11");
  // ใช้ข้อมูลจริงจาก data.customer...
  customerCell.value = `\n ชื่อลูกค้า/เบอร์โทร : ${
    data.customerName
  }\n\n ที่อยู่ : ${data.customerAddress}\n\n เลขประจำตัวผู้เสียภาษี : ${
    data.customerID || "-"
  }`;
  customerCell.alignment = {
    vertical: "top",
    horizontal: "left",
    wrapText: true,
  };
  customerCell.font = { name: "Kanit Light", size: 10 };
  customerCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  worksheet.mergeCells("I11:K20");
  const projectinfoCell = worksheet.getCell("I11");
  // ใช้ข้อมูลจริงจาก data.project...
  projectinfoCell.value = `โปรเจค : ${data.projectName} \n      ${data.maxPower} \n      INVERTER : ${data.inverterBrand} \n\n วันที่ : ${data.date} \n \n เลขที่เอกสาร : ${data.docNumber}`;
  projectinfoCell.alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true,
  };
  projectinfoCell.font = { name: "Kanit Light", size: 9.5 };
  projectinfoCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  // ==========================================
  // 4. TABLE HEADER (เหมือนเดิม)
  // ==========================================
  worksheet.mergeCells(`A21:K22`);
  const greenBar = worksheet.getCell(`A21`);
  greenBar.value = "";
  greenBar.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF54B985" },
  };
  greenBar.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const hTopStart = 23;
  const hTopEnd = 24;
  const hMiddle = 25;
  const hSubStart = 26;
  const hSubEnd = 27;
  const hMain = hTopStart;

  worksheet.getCell(`A${hMain}`).value = "Main Equipment";
  worksheet.mergeCells(`A${hMain}:C${hSubEnd}`);
  worksheet.getCell(`D${hMain}`).value = "Brand";
  worksheet.mergeCells(`D${hMain}:D${hSubEnd}`);
  worksheet.getCell(`E${hMain}`).value = "Q'ty";
  worksheet.mergeCells(`E${hMain}:E${hSubEnd}`);
  worksheet.getCell(`F${hMain}`).value = "Unit";
  worksheet.mergeCells(`F${hMain}:F${hSubEnd}`);
  worksheet.getCell(`K${hTopStart}`).value = "Total";
  worksheet.mergeCells(`K${hTopStart}:K${hSubEnd}`);

  worksheet.getCell(`G${hTopStart}`).value = "Material";
  worksheet.mergeCells(`G${hTopStart}:H${hTopEnd}`);
  worksheet.getCell(`I${hTopStart}`).value = "Labor";
  worksheet.mergeCells(`I${hTopStart}:J${hTopEnd}`);

  worksheet.getCell(`G${hMiddle}`).value = "Scope of Work";
  worksheet.mergeCells(`G${hMiddle}:H${hMiddle}`);
  worksheet.getCell(`I${hMiddle}`).value = "Scope of Supply";
  worksheet.mergeCells(`I${hMiddle}:J${hMiddle}`);

  worksheet.getCell(`G${hSubStart}`).value = "PONIX";
  worksheet.mergeCells(`G${hSubStart}:G${hSubEnd}`);
  worksheet.getCell(`H${hSubStart}`).value = "Cost";
  worksheet.mergeCells(`H${hSubStart}:H${hSubEnd}`);
  worksheet.getCell(`I${hSubStart}`).value = "PONIX";
  worksheet.mergeCells(`I${hSubStart}:I${hSubEnd}`);
  worksheet.getCell(`J${hSubStart}`).value = "Cost";
  worksheet.mergeCells(`J${hSubStart}:J${hSubEnd}`);

  const headerCenterStyle = {
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    font: { bold: false, name: "Kanit Light", size: 10 },
  };

  const headerCells = [
    `A${hMain}`,
    `D${hMain}`,
    `E${hMain}`,
    `F${hMain}`,
    `G${hTopStart}`,
    `I${hTopStart}`,
    `K${hTopStart}`,
    `G${hMiddle}`,
    `I${hMiddle}`,
    `G${hSubStart}`,
    `H${hSubStart}`,
    `I${hSubStart}`,
    `J${hSubStart}`,
  ];
  headerCells.forEach((ref) => {
    const cell = worksheet.getCell(ref);
    // @ts-ignore
    cell.alignment = headerCenterStyle.alignment;
    // @ts-ignore
    cell.font = headerCenterStyle.font;
  });

  for (let r = hTopStart; r <= hSubEnd; r++) {
    for (let c = 1; c <= 11; c++) {
      const cell = worksheet.getCell(r, c);
      if (!cell.address.startsWith("C")) {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }
  }

  // ==========================================
  // 5. DATA ROWS
  // ==========================================
  let currentRow = 28;
  let itemRunningNumber = 1;

  const createSectionHeader = (
    rowNum: number,
    sectionLetter: string,
    title: string,
    mergeEndCol: string
  ) => {
    const nextRow = rowNum + 1;
    const cellA = worksheet.getCell(`A${rowNum}`);
    worksheet.mergeCells(`A${rowNum}:A${nextRow}`);
    cellA.value = sectionLetter;
    cellA.font = { bold: true, name: "Kanit Light", size: 10 };
    cellA.alignment = { horizontal: "center", vertical: "middle" };
    cellA.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFBFBFBF" },
    };
    cellA.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    worksheet.mergeCells(`B${rowNum}:${mergeEndCol}${nextRow}`);
    const cellB = worksheet.getCell(`B${rowNum}`);
    cellB.value = title;
    cellB.font = { bold: true, name: "Kanit Light", size: 10 };
    cellB.alignment = { horizontal: "left", vertical: "middle" };
    cellB.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    ["D", "E", "F", "G", "H", "I", "J", "K"].forEach((col) => {
      if (col <= mergeEndCol) return;
      worksheet.mergeCells(`${col}${rowNum}:${col}${nextRow}`);
      const cell = worksheet.getCell(`${col}${rowNum}`);
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  };

  const formatZero = (num: number) => (num === 0 ? "" : num);

  // Section A
  const sectionATitle = `ระบบโซลาร์ ${data.maxPower
    .replace("กำลังไฟสูงสุด ( ", "")
    .replace(" )", "")}`;
  createSectionHeader(currentRow, "A", sectionATitle, "C");
  currentRow += 2;

  let sumA = 0;
  data.items
    .filter((i) => i.category === "A")
    .forEach((item) => {
      const nextRow = currentRow + 1;
      const row = worksheet.getRow(currentRow);
      row.values = [
        itemRunningNumber++,
        item.name,
        "",
        item.brand,
        formatZero(item.qty),
        item.unit,
        formatZero(item.matUnit),
        formatZero(item.matTotal),
        formatZero(item.labUnit),
        formatZero(item.labTotal),
        formatZero(item.total),
      ];
      worksheet.mergeCells(`A${currentRow}:A${nextRow}`);
      worksheet.mergeCells(`B${currentRow}:C${nextRow}`);
      worksheet.mergeCells(`D${currentRow}:D${nextRow}`);
      ["E", "F", "G", "H", "I", "J", "K"].forEach((col) => {
        worksheet.mergeCells(`${col}${currentRow}:${col}${nextRow}`);
      });
      [5, 7, 8, 9, 10, 11].forEach((c) => (row.getCell(c).numFmt = "#,##0.00"));
      for (let r = currentRow; r <= nextRow; r++) {
        const rRow = worksheet.getRow(r);
        for (let c = 1; c <= 11; c++) {
          if (c === 3) continue;
          rRow.getCell(c).border = {
            left: { style: "thin" },
            right: { style: "thin" },
            bottom: { style: "thin" },
          };
        }
      }
      [1, 4, 5, 6].forEach((c) => {
        worksheet.getCell(currentRow, c).alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      });
      worksheet.getCell(`B${currentRow}`).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
      sumA += item.total;
      currentRow += 2;
    });

  // SUM A
  const sumANextRow = currentRow + 1;
  worksheet.mergeCells(`A${currentRow}:J${sumANextRow}`);
  const sumACell = worksheet.getCell(`A${currentRow}`);
  sumACell.value = "SUM A";
  sumACell.alignment = { horizontal: "center", vertical: "middle" };
  sumACell.font = { bold: true, name: "Kanit Light", size: 10 };
  sumACell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFBFBFBF" },
  };
  sumACell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  worksheet.mergeCells(`K${currentRow}:K${sumANextRow}`);
  const sumATotalCell = worksheet.getCell(`K${currentRow}`);
  sumATotalCell.value = sumA;
  sumATotalCell.numFmt = "#,##0.00";
  sumATotalCell.alignment = { horizontal: "right", vertical: "middle" };
  sumATotalCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFBFBFBF" },
  };
  sumATotalCell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  currentRow += 2;

  // Section B
  createSectionHeader(currentRow, "B", "Project Management", "D");
  currentRow += 2;

  let sumB = 0;
  data.items
    .filter((i) => i.category === "B")
    .forEach((item) => {
      const nextRow = currentRow + 1;
      const row = worksheet.getRow(currentRow);
      row.values = [
        itemRunningNumber++,
        item.name,
        "",
        "",
        formatZero(item.qty),
        item.unit,
        formatZero(item.matUnit),
        formatZero(item.matTotal),
        formatZero(item.labUnit),
        formatZero(item.labTotal),
        formatZero(item.total),
      ];
      worksheet.mergeCells(`A${currentRow}:A${nextRow}`);
      worksheet.mergeCells(`B${currentRow}:D${nextRow}`);
      ["E", "F", "G", "H", "I", "J", "K"].forEach((col) => {
        worksheet.mergeCells(`${col}${currentRow}:${col}${nextRow}`);
      });
      [5, 7, 8, 9, 10, 11].forEach((c) => (row.getCell(c).numFmt = "#,##0.00"));
      for (let r = currentRow; r <= nextRow; r++) {
        const rRow = worksheet.getRow(r);
        for (let c = 1; c <= 11; c++) {
          if (c === 3 || c === 4) continue;
          rRow.getCell(c).border = {
            left: { style: "thin" },
            right: { style: "thin" },
            bottom: { style: "thin" },
          };
        }
      }
      [1, 5, 6].forEach((c) => {
        worksheet.getCell(currentRow, c).alignment = {
          horizontal: "center",
          vertical: "middle",
        };
      });
      worksheet.getCell(`B${currentRow}`).alignment = {
        horizontal: "left",
        vertical: "middle",
        wrapText: true,
      };
      sumB += item.total;
      currentRow += 2;
    });

  // SUM B
  const sumBNextRow = currentRow + 1;
  worksheet.mergeCells(`A${currentRow}:J${sumBNextRow}`);
  const sumBCell = worksheet.getCell(`A${currentRow}`);
  sumBCell.value = "SUM B";
  sumBCell.alignment = { horizontal: "center", vertical: "middle" };
  sumBCell.font = { bold: true, name: "Kanit Light", size: 10 };
  sumBCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFBFBFBF" },
  };
  sumBCell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  worksheet.mergeCells(`K${currentRow}:K${sumBNextRow}`);
  const sumBTotalCell = worksheet.getCell(`K${currentRow}`);
  sumBTotalCell.value = sumB;
  sumBTotalCell.numFmt = "#,##0.00";
  sumBTotalCell.alignment = { horizontal: "right", vertical: "middle" };
  sumBTotalCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFBFBFBF" },
  };
  sumBTotalCell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  currentRow += 2;

// ==========================================
  // 6. FOOTER
  // ==========================================
  const footerStart = currentRow;
  const footerEndRow = footerStart + 9;

  // -- Left Side Terms -- (เงื่อนไขการชำระเงิน)
  worksheet.mergeCells(`A${footerStart}:B${footerEndRow}`);
  const leftTermCell = worksheet.getCell(`A${footerStart}`);
  
  const leftRichText: any[] = [
    {
      text: "เงื่อนไขการชำระเงิน\n",
      font: { bold: true, name: "Kanit Light", size: 11 },
    },
  ];

  // ✅ เช็คจำนวนข้อ: ถ้ามีมากกว่า 1 ข้อ ให้ใส่เลขลำดับ (1. 2. 3.) ถ้ามีข้อเดียวไม่ต้องใส่
  data.paymentTerms.forEach((term, i) => {
    // กำหนด prefix: ถ้าข้อมูลมีหลายข้อ ให้ใส่ "1. " ถ้ามีข้อเดียวให้ว่างไว้
    const prefix = data.paymentTerms.length > 1 ? `${i + 1}. ` : "";
    
    leftRichText.push({
      text: `${prefix}${term}\n`, // ใส่ prefix หน้าข้อความ
      font: { name: "Kanit Light", size: 11 },
    });
  });

  // เพิ่มหมายเหตุต่อท้าย
  leftRichText.push({
    text: "หมายเหตุ\n",
    font: { bold: true, name: "Kanit Light", size: 11 },
  });
  leftRichText.push({
    text: data.remarks,
    font: { name: "Kanit Light", size: 11 },
  });

  leftTermCell.value = { richText: leftRichText };
  leftTermCell.alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true,
  };
  leftTermCell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  // --- ส่วนเงื่อนไขการรับประกัน (ตรงกลาง) ---
  worksheet.mergeCells(`C${footerStart}:H${footerEndRow}`);
  const midTermCell = worksheet.getCell(`C${footerStart}`);
  const midRichText: any[] = [
    {
      text: "\nเงื่อนไขการรับประกัน\n",
      font: { bold: true, name: "Kanit Light", size: 11 },
    },
  ];

  data.warrantyTerms.forEach((term, i) => {
    const prefix = data.warrantyTerms.length > 1 ? `${i + 1}. ` : "";
    midRichText.push({
      text: `${prefix}${term}\n`,
      font: { name: "Kanit Light", size: 10 },
    });
  });

  midTermCell.value = { richText: midRichText };
  midTermCell.alignment = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true,
  };
  midTermCell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };


  const totalAmount = sumA + sumB;
  const vatAmount = totalAmount * data.vatRate;
  const grandTotal = totalAmount + vatAmount;

  let r = footerStart;
  const totals = [
    { t: "รวม(Total)", v: totalAmount },
    { t: "ส่วนลด(Discount)", v: data.discount || 0 }, // ถ้า 0 จะโชว์ 0 ถ้าอยากได้ขีดให้แก้ตอน Map
    { t: "รวม(Total)", v: totalAmount - data.discount },
    { t: "ภาษีมูลค่าเพิ่ม Vat7%", v: vatAmount },
    { t: "รวมเงินทั้งสิ้น (Grand Total)", v: grandTotal },
  ];

  totals.forEach((item, idx) => {
    // ถ้าเป็นส่วนลด และค่าเป็น 0 ให้แสดง "-"
    const displayVal = idx === 1 && item.v === 0 ? "-" : item.v;

    const nextR = r + 1;
    worksheet.mergeCells(`I${r}:J${nextR}`);
    const label = worksheet.getCell(`I${r}`);
    label.value = item.t;
    label.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFBFBFBF" },
    };
    label.font = { name: "Kanit Light", size: 9, bold: false };
    label.alignment = { vertical: "middle", horizontal: "left" };
    label.border = {
      left: { style: "thin" },
      bottom: { style: "thin" },
      top: { style: "thin" },
      right: { style: "thin" },
    };

    worksheet.mergeCells(`K${r}:K${nextR}`);
    const val = worksheet.getCell(`K${r}`);
    val.value = displayVal;
    if (typeof displayVal === "number") val.numFmt = "#,##0.00";
    val.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFBFBFBF" },
    };
    val.font = { name: "Kanit Light", size: 9, bold: false };
    val.alignment = { vertical: "middle", horizontal: "right" };
    val.border = {
      right: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      top: { style: "thin" },
    };
    r += 2;
  });

  currentRow = footerEndRow + 1;

  // ==========================================
  // 7. BAHT TEXT ROW
  // ==========================================
  const bahtTextNextRow = currentRow + 1;
  worksheet.mergeCells(`A${currentRow}:K${bahtTextNextRow}`);
  const bahtCell = worksheet.getCell(`A${currentRow}`);
  bahtCell.value = getBahtText(grandTotal);
  bahtCell.alignment = { vertical: "middle", horizontal: "center" };
  bahtCell.font = { name: "Kanit Light", size: 11 };
  bahtCell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  currentRow += 2;

  // ==========================================
  // 8. SIGNATURES
  // ==========================================
  if (signatureId !== null) {
    worksheet.addImage(signatureId, {
      tl: { col: 0.2, row: currentRow } as any,
      ext: { width: 230, height: 95 },
    });
  }

  worksheet.mergeCells(`A${currentRow}:E${currentRow + 7}`);
  const sign1 = worksheet.getCell(`A${currentRow}`);
  const spaces = "                       ";
  sign1.value = `${spaces}ลงชื่อผู้ให้บริการ\n\n${spaces}___________________\n${spaces}วันที่ ${data.date}`; // ใช้ data.date
  sign1.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  sign1.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  sign1.font = { name: "Kanit Light", size: 10 };

  worksheet.mergeCells(`F${currentRow}:K${currentRow + 7}`);
  const sign2 = worksheet.getCell(`F${currentRow}`);
  sign2.value = "ลงชื่อลูกค้า\n\n___________________\nวันที่ ___/___/___";
  sign2.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  sign2.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  sign2.font = { name: "Kanit Light", size: 10 };

  // ==========================================
  // FORCE ROW HEIGHT & SAVE
  // ==========================================
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    row.height = 24.5;
    (row as any).customHeight = true;
  });

  // Browser Save (using file-saver)
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `Quotation_${data.docNumber}.xlsx`);

  console.log("✅ สร้างไฟล์ Excel สำเร็จ!");
};
