import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

// ==========================================
// 0. HELPER FUNCTION: BAHTTEXT
// ==========================================
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

// ==========================================
// 1. MOCK DATA
// ==========================================
const mockData = {
  customerName: "ห้างหุ้นส่วนจำกัด มงคลพาณิชย์การเหล็ก",
  customerAddress:
    "74/8-6 ซอยสุทร ถนน ตรีมิตร ตำบล/แขวง ตลาดน้อย อำเภอ/เขต สัมพันธวงศ์ จังหวัด กรุงเทพมหานคร 10100",
  customerID: "0-1234-56789-00-0",
  projectName: "โซลาร์เซลล์ 10k 1เฟส",
  maxPower: "กำลังไฟสูงสุด ( 10.00kWp )",
  inverterBrand: "HUAWEI",
  date: "13 / 5 / 2568",
  docNumber: "PNMMA25016",
  items: [
    // --- Section A ---
    {
      no: 1,
      name: "แผงโซลาร์เซลล์ Jinko 625W",
      brand: "Jinko",
      qty: 16,
      unit: "Module",
      matUnit: 3000,
      matTotal: 48000,
      labUnit: 100,
      labTotal: 1600,
      total: 49600,
      category: "A",
    },
    {
      no: 2,
      name: "โครงสร้างการติดตั้ง PV Module",
      brand: "Antai",
      qty: 10000,
      unit: "Watt",
      matUnit: 3,
      matTotal: 30000,
      labUnit: 1,
      labTotal: 10000,
      total: 40000,
      category: "A",
    },
    {
      no: 3,
      name: "Inverter Huawei SUN2000-10KTL-M1",
      brand: "Huawei",
      qty: 1,
      unit: "set",
      matUnit: 49045,
      matTotal: 49045,
      labUnit: 12300,
      labTotal: 12300,
      total: 61345,
      category: "A",
    },
    {
      no: 4,
      name: "Zero Export",
      brand: "Huawei",
      qty: 1,
      unit: "set",
      matUnit: 3500,
      matTotal: 3500,
      labUnit: 1000,
      labTotal: 1000,
      total: 4500,
      category: "A",
    },
    {
      no: 5,
      name: "ตู้คอนโทรล AC",
      brand: "Suntree",
      qty: 1,
      unit: "set",
      matUnit: 7500,
      matTotal: 7500,
      labUnit: 2200,
      labTotal: 2200,
      total: 9700,
      category: "A",
    },
    {
      no: 6,
      name: "ตู้คอนโทรล DC",
      brand: "Suntree",
      qty: 1,
      unit: "set",
      matUnit: 4800,
      matTotal: 4800,
      labUnit: 1500,
      labTotal: 1500,
      total: 6300,
      category: "A",
    },
    {
      no: 7,
      name: "สาย PV1-F",
      brand: "Link",
      qty: 200,
      unit: "metre",
      matUnit: 45,
      matTotal: 9000,
      labUnit: 15,
      labTotal: 3000,
      total: 12000,
      category: "A",
    },
    {
      no: 8,
      name: "สายไฟ VCT , THW",
      brand: "Yazaki",
      qty: 20,
      unit: "metre",
      matUnit: 250,
      matTotal: 5000,
      labUnit: 70,
      labTotal: 1400,
      total: 6400,
      category: "A",
    },
    {
      no: 9,
      name: "ชุดรางเดินสายไฟ ภายนอก,ภายใน",
      brand: "KJL",
      qty: 20,
      unit: "metre",
      matUnit: 450,
      matTotal: 9000,
      labUnit: 100,
      labTotal: 2000,
      total: 11000,
      category: "A",
    },
    // --- Section B ---
    {
      no: 10,
      name: "Electrical drawing, Facility system",
      brand: "",
      qty: 1,
      unit: "Job",
      matUnit: 0,
      matTotal: 0,
      labUnit: 0,
      labTotal: 0,
      total: 3000,
      category: "B",
    },
    {
      no: 11,
      name: "Common Temporary Facilities",
      brand: "",
      qty: 1,
      unit: "Job",
      matUnit: 0,
      matTotal: 0,
      labUnit: 0,
      labTotal: 0,
      total: 3000,
      category: "B",
    },
    {
      no: 12,
      name: "Safety Operation",
      brand: "",
      qty: 1,
      unit: "Job",
      matUnit: 0,
      matTotal: 0,
      labUnit: 0,
      labTotal: 0,
      total: 3000,
      category: "B",
    },
    {
      no: 13,
      name: "Comissioning test",
      brand: "",
      qty: 1,
      unit: "Job",
      matUnit: 0,
      matTotal: 0,
      labUnit: 0,
      labTotal: 0,
      total: 3000,
      category: "B",
    },
    {
      no: 14,
      name: "Tempolary Utility Expense",
      brand: "",
      qty: 1,
      unit: "Job",
      matUnit: 0,
      matTotal: 0,
      labUnit: 0,
      labTotal: 0,
      total: 3000,
      category: "B",
    },
    {
      no: 15,
      name: "ดำเนินการยื่นเอกสารขออนุญาต",
      brand: "",
      qty: 1,
      unit: "Job",
      matUnit: 0,
      matTotal: 0,
      labUnit: 0,
      labTotal: 0,
      total: 12192.38,
      category: "B",
    },
  ],
  paymentTerms: ["มัดจำ 30%", "ชำระ 70% ณ วันส่งมอบงาน"],
  warrantyTerms: [
    "รับประกันระบบ 2 ปี",
    "รับประกันอินเวอร์เตอร์ 10 ปี จากผู้ผลิต",
    "รับประกันแผงโซลาร์เซลล์ 30 ปี จากผู้ผลิต",
    "บริการหลังการติดตั้ง 3 ปี ปีละ 1 ครั้ง",
    "Monitoring Service Free Lifetime",
  ],
  remarks: "ยืนยันราคา 30 วันนับแต่วันเสนอราคา",
  discount: 0,
  vatRate: 0.07,
};

async function run() {
  console.log("⏳ กำลังสร้างไฟล์ Excel...");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Quotation", {
    properties: { defaultRowHeight: 24.5 },
  });

  const defaultFont = { name: "Kanit Light", size: 9 };

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
  worksheet.mergeCells("C1:H3");
  const companynameCell = worksheet.getCell("C1");
  companynameCell.value = `บริษัท โพนิซ จำกัด (สำนักงานใหญ่)`;
  companynameCell.alignment = {
    vertical: "bottom",
    horizontal: "center",
    wrapText: true,
  };
  companynameCell.font = { name: "Kanit Light", size: 16, bold: true };

  worksheet.mergeCells("C4:H10");
  const companyinfoCell = worksheet.getCell("C4");
  companyinfoCell.value = `ที่อยู่ 612 ถนนช้างเผือก ตำบลในเมือง อำเภอเมือง\nจังหวัดนครราชสีมา 30000\nTel : 082-4360444, 063-1411454\nเลขประจำตัวผู้เสียภาษี: 0-3055-60003-13-9`;
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
  customerCell.value = `\n ชื่อลูกค้า/เบอร์โทร : ${mockData.customerName}\n\n ที่อยู่ : ${mockData.customerAddress}\n\n เลขประจำตัวผู้เสียภาษี : ${mockData.customerID}`;
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
  projectinfoCell.value = `โปรเจค : ${mockData.projectName} \n          ${mockData.maxPower} \n          INVERTER : ${mockData.inverterBrand} \n\n วันที่ : ${mockData.date} \n \n เลขที่เอกสาร : ${mockData.docNumber}`;
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
  // 4. TABLE HEADER
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
    font: { name: "Kanit Light", size: 10 },
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

  // ✅ Helper Check Zero (ถ้า 0 ให้เป็นค่าว่าง)
  const formatZero = (num: number) => (num === 0 ? "" : num);

  const sectionATitle = `ระบบโซลาร์ ${mockData.maxPower
    .replace("กำลังไฟสูงสุด ( ", "")
    .replace(" )", "")}`;
  createSectionHeader(currentRow, "A", sectionATitle, "C");
  currentRow += 2;

  let sumA = 0;
  mockData.items
    .filter((i) => i.category === "A")
    .forEach((item) => {
      const nextRow = currentRow + 1;
      const row = worksheet.getRow(currentRow);

      // ✅ Apply formatZero to Qty and Amounts
      row.values = [
        item.no,
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

      // ✅ เพิ่ม column 5 (Qty) เข้าไปใน List การ Format
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

  createSectionHeader(currentRow, "B", "Project Management", "D");
  currentRow += 2;

  let sumB = 0;
  mockData.items
    .filter((i) => i.category === "B")
    .forEach((item) => {
      const nextRow = currentRow + 1;
      const row = worksheet.getRow(currentRow);

      // ✅ Apply formatZero here as well
      row.values = [
        item.no,
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

      // ✅ เพิ่ม column 5 (Qty)
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

  worksheet.mergeCells(`A${footerStart}:B${footerEndRow}`);
  const leftTermCell = worksheet.getCell(`A${footerStart}`);
  const leftRichText: { text: string; font: Partial<ExcelJS.Font> }[] = [
    {
      text: "เงื่อนไขการชำระเงิน\n",
      font: { bold: true, name: "Kanit Light", size: 11 },
    },
  ];
  mockData.paymentTerms.forEach((term, i) => {
    leftRichText.push({
      text: `${i + 1}. ${term}\n`,
      font: { name: "Kanit Light", size: 11 },
    });
  });
  leftRichText.push({
    text: "หมายเหตุ\n",
    font: { bold: true, name: "Kanit Light", size: 11 },
  });
  leftRichText.push({
    text: mockData.remarks,
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

  worksheet.mergeCells(`C${footerStart}:H${footerEndRow}`);
  const midTermCell = worksheet.getCell(`C${footerStart}`);
  const midRichText: { text: string; font: Partial<ExcelJS.Font> }[] = [
    {
      text: "\nเงื่อนไขการรับประกัน\n",
      font: { bold: true, name: "Kanit Light", size: 11 },
    },
  ];
  mockData.warrantyTerms.forEach((term, i) => {
    midRichText.push({
      text: `${i + 1}. ${term}\n`,
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
  const vatAmount = totalAmount * mockData.vatRate;
  const grandTotal = totalAmount + vatAmount;

  let r = footerStart;
  const totals = [
    { t: "รวม(Total)", v: totalAmount },
    { t: "ส่วนลด(Discount)", v: mockData.discount || "-" },
    { t: "รวม(Total)", v: totalAmount - mockData.discount },
    { t: "ภาษีมูลค่าเพิ่ม Vat7%", v: vatAmount },
    { t: "รวมเงินทั้งสิ้น (Grand Total)", v: grandTotal },
  ];

  totals.forEach((item) => {
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
    val.value = item.v;
    val.numFmt = "#,##0.00";
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
  // ✅ 7. BAHT TEXT ROW
  // ==========================================
  const bahtTextNextRow = currentRow + 1;
  worksheet.mergeCells(`A${currentRow}:K${bahtTextNextRow}`);

  const bahtCell = worksheet.getCell(`A${currentRow}`);
  const thaiBahtText = getBahtText(grandTotal);

  // ✅ เอาวงเล็บ ( ) ออก ตามที่ขอ
  bahtCell.value = `${thaiBahtText}`;

  bahtCell.alignment = { vertical: "middle", horizontal: "center" };
  bahtCell.font = { name: "Kanit Light", size: 11 };

  bahtCell.border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  currentRow += 2; // เพิ่ม 2 แถวของ BahtText

  // ==========================================
  // 8. SIGNATURES (No gap added, just move to next line)
  // ==========================================

  // ✅ แก้ไข: เพิ่ม +3 rows (รวมเป็น 8 แถว: +7)
  worksheet.mergeCells(`A${currentRow}:E${currentRow + 7}`);
  const sign1 = worksheet.getCell(`A${currentRow}`);
  sign1.value =
    "ลงชื่อผู้ให้บริการ\n\n___________________\nวันที่ 13 / 5 / 2568";
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
  // FORCE ROW HEIGHT
  // ==========================================
  worksheet.eachRow({ includeEmpty: true }, (row) => {
    row.height = 24.5;
    (row as any).customHeight = true;
  });

  const outputPath = path.join(process.cwd(), "Result_Update_Layout.xlsx");
  try {
    await workbook.xlsx.writeFile(outputPath);
    console.log("✅ สร้างไฟล์สำเร็จแล้ว!");
    console.log(`📂 ตำแหน่งไฟล์: ${outputPath}`);
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
  }
}

run();
