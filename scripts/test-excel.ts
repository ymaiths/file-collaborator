import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

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
  // ✅ 1. ตั้งค่าความสูงแถวเริ่มต้น และ Font พื้นฐาน
  const worksheet = workbook.addWorksheet("Quotation", {
    properties: { defaultRowHeight: 24.5 },
  });

  // กำหนด Font มาตรฐาน Kanit Light
  const defaultFont = { name: "Kanit Light", size: 10 };

  // ==========================================
  // 2. SETUP COLUMNS
  // ==========================================
  // เพิ่ม style: { font: defaultFont } ในทุก column
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

  // Company Name
  worksheet.mergeCells("C1:H2");
  const companynameCell = worksheet.getCell("C1");
  companynameCell.value = `บริษัท โพนิซ จำกัด (สำนักงานใหญ่)`;
  companynameCell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  companynameCell.font = { name: "Kanit Light", size: 16, bold: true };

  // Company Info
  worksheet.mergeCells("C3:H7");
  const companyinfoCell = worksheet.getCell("C3");
  companyinfoCell.value = `ที่อยู่ 612 ถนนช้างเผือก ตำบลในเมือง อำเภอเมือง\nจังหวัดนครราชสีมา 30000\nTel : 082-4360444, 063-1411454\nเลขประจำตัวผู้เสียภาษี: 0-3055-60003-13-9`;
  companyinfoCell.alignment = {
    vertical: "top",
    horizontal: "center",
    wrapText: true,
  };
  companyinfoCell.font = { name: "Kanit Light", size: 12 };

  // Right Header Box
  worksheet.mergeCells("I1:K7");
  const titleCell = worksheet.getCell("I1");
  titleCell.value = "ใบเสนอราคา\nQUOTATION";
  titleCell.alignment = {
    vertical: "top",
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

  // Customer Info (Left)
  worksheet.mergeCells("A8:H15");
  const customerCell = worksheet.getCell("A8");
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

  // Project Info (Right)
  worksheet.mergeCells("I8:K15");
  const projectinfoCell = worksheet.getCell("I8");
  projectinfoCell.value = `โปรเจค : ${mockData.projectName} \n      ${mockData.maxPower} \n      INVERTER : ${mockData.inverterBrand} \n\n วันที่ : ${mockData.date} \n \n เลขที่เอกสาร : ${mockData.docNumber}`;
  projectinfoCell.alignment = {
    vertical: "top",
    horizontal: "left",
    wrapText: true,
  };
  projectinfoCell.font = { name: "Kanit Light", size: 8 };
  projectinfoCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };

  // ==========================================
  // 4. TABLE HEADER (Green Area)
  // ==========================================

  // ✅ ประกาศตัวแปรบรรทัดตรงนี้ให้ชัดเจน
  const greenBarRow = 16;
  const hRow1 = 17; // Material / Labor
  const hRow2 = 18; // Main Headers
  const hRow3 = 19; // Sub Headers

  // 4.1 Green Bar
  worksheet.mergeCells(`A${greenBarRow}:K${greenBarRow}`);
  const greenBar = worksheet.getCell(`A${greenBarRow}`);
  greenBar.value = ""; // ต้องมีค่าว่างไม่งั้นบางที merge ไม่ติด
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

  // 4.2 Top Headers (Row 17)
  worksheet.getCell(`G${hRow1}`).value = "Material";
  worksheet.mergeCells(`G${hRow1}:H${hRow1}`);
  worksheet.getCell(`I${hRow1}`).value = "Labor";
  worksheet.mergeCells(`I${hRow1}:J${hRow1}`);
  worksheet.getCell(`K${hRow1}`).value = "Total";
  worksheet.mergeCells(`K${hRow1}:K${hRow3}`);

  // 4.3 Main Headers (Row 18)
  worksheet.getCell(`A${hRow1}`).value = "Main Equipment";
  worksheet.mergeCells(`A${hRow1}:C${hRow3}`);
  worksheet.getCell(`D${hRow1}`).value = "Brand";
  worksheet.mergeCells(`D${hRow1}:D${hRow3}`);
  worksheet.getCell(`E${hRow1}`).value = "Q'ty";
  worksheet.mergeCells(`E${hRow1}:E${hRow3}`);
  worksheet.getCell(`F${hRow1}`).value = "Unit";
  worksheet.mergeCells(`F${hRow1}:F${hRow3}`);
  worksheet.getCell(`G${hRow2}`).value = "Scope of Work";
  worksheet.mergeCells(`G${hRow2}:H${hRow2}`);
  worksheet.getCell(`I${hRow2}`).value = "Scope of Supply";
  worksheet.mergeCells(`I${hRow2}:J${hRow2}`);

  const headerCells2 = [
    // Row 17
    `G${hRow1}`,
    `I${hRow1}`,
    `K${hRow1}`,
    // Row 18
    `B${hRow2}`,
    `D${hRow2}`,
    `E${hRow2}`,
    `F${hRow2}`,
    `G${hRow2}`,
    `I${hRow2}`,
    // Row 19
    `G${hRow3}`,
    `H${hRow3}`,
    `I${hRow3}`,
    `J${hRow3}`,
  ];

  // Style กลาง (Font + Alignment) แต่ไม่รวม Border/Fill
  const baseHeaderStyle = {
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    font: { bold: true, name: "Kanit Light", size: 9 },
  };
  headerCells2.forEach((ref) => {
    const cell = worksheet.getCell(ref);

    // 1. ใส่ Font และ Alignment
    // @ts-ignore
    cell.alignment = baseHeaderStyle.alignment;
    // @ts-ignore
    cell.font = baseHeaderStyle.font;

    // 3. ใส่ Border (มีเงื่อนไข)
    // ถ้าไม่ใช่ Column C ให้ตีเส้นขอบ
    if (!ref.startsWith("C")) {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    } else {
      // ✅ Column C ไม่ต้องมี Border
      cell.border = undefined as any;
    }
  });

  // เพิ่มเติม: ตีเส้นขอบให้ Column A ที่ว่างอยู่ด้วย (Row 17-19) เพื่อให้ตารางดูไม่แหว่งด้านซ้าย
  // (แต่ถ้าต้องการให้โล่งตาม Column C ก็ลบส่วนนี้ทิ้งได้ครับ)
  [`A${hRow1}`, `A${hRow2}`, `A${hRow3}`].forEach((ref) => {
    const cell = worksheet.getCell(ref);
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  // 4.4 Sub Headers (Row 19)
  worksheet.getCell(`G${hRow3}`).value = "cost per unit";
  worksheet.getCell(`H${hRow3}`).value = "total cost";
  worksheet.getCell(`I${hRow3}`).value = "cost per unit";
  worksheet.getCell(`J${hRow3}`).value = "total cost";

  const centerStyle = {
    alignment: { vertical: "middle", horizontal: "center", wrapText: true },
    font: { bold: true, name: "Kanit Light", size: 11 },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  };

  const headerCells = [
    `G${hRow1}`,
    `I${hRow1}`,
    `K${hRow1}`,
    `B${hRow2}`,
    `C${hRow2}`,
    `D${hRow2}`,
    `E${hRow2}`,
    `F${hRow2}`,
    `G${hRow2}`,
    `I${hRow2}`,
    `G${hRow3}`,
    `H${hRow3}`,
    `I${hRow3}`,
    `J${hRow3}`,
  ];

  headerCells.forEach((ref) => {
    const cell = worksheet.getCell(ref);
    // @ts-ignore
    cell.alignment = centerStyle.alignment;
    // @ts-ignore
    cell.font = centerStyle.font;
    // @ts-ignore
    cell.border = centerStyle.border;
  });

  // Style Empty A column
  [`A${hRow1}`, `A${hRow2}`, `A${hRow3}`].forEach((ref) => {
    const cell = worksheet.getCell(ref);
    // @ts-ignore
    cell.border = centerStyle.border;
  });
  // ==========================================
  // 5. DATA ROWS
  // ==========================================
  let currentRow = 20; // เริ่มที่ 20 ต่อจาก Header

  // --- Helper Function: สร้างแถบหัวข้อ Section (Header) ---
  // เพิ่ม mergeEndCol เพื่อระบุจุดสิ้นสุดการ Merge (C หรือ D)
  const createSectionHeader = (
    rowNum: number,
    sectionLetter: string,
    title: string,
    mergeEndCol: string
  ) => {
    // 1. ช่อง A (Letter) -> ถมสีเทา
    const cellA = worksheet.getCell(`A${rowNum}`);
    cellA.value = sectionLetter;
    cellA.font = { bold: true, name: "Kanit Light", size: 10 };
    cellA.alignment = { horizontal: "center" };
    cellA.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFBFBFBF" },
    }; // ✅ สีเทา
    cellA.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    // 2. ช่อง B (Title) -> Merge ถึง col ที่กำหนด และ **ไม่ถมสี (ขาว)**
    worksheet.mergeCells(`B${rowNum}:${mergeEndCol}${rowNum}`);
    const cellB = worksheet.getCell(`B${rowNum}`);
    cellB.value = title;
    cellB.font = { bold: true, name: "Kanit Light", size: 10 };
    cellB.alignment = { horizontal: "left" };
    // ❌ ไม่ใส่ fill (ปล่อยขาว)
    cellB.border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };

    // 3. ช่องอื่นๆ ตีเส้นกรอบให้ครบ (แต่ไม่ถมสี)
    // วนลูปตั้งแต่ D ถึง K
    ["D", "E", "F", "G", "H", "I", "J", "K"].forEach((col) => {
      // ถ้า column นั้นถูก merge ไปแล้ว ให้ข้าม (เช่น ถ้า merge ถึง D, ช่อง D จะถูกจัดการโดยข้อ 2 ไปแล้ว)
      if (col <= mergeEndCol) return;

      const cell = worksheet.getCell(`${col}${rowNum}`);
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    });
  };

  // ---------------------------------------------------------
  // สร้าง Header Section A (Merge B:C)
  // ---------------------------------------------------------
  const sectionATitle = `ระบบโซลาร์ ${mockData.maxPower
    .replace("กำลังไฟสูงสุด ( ", "")
    .replace(" )", "")}`;
  // ส่ง "C" ไปเพื่อบอกว่าให้ Merge B ถึง C
  createSectionHeader(currentRow, "A", sectionATitle, "C");
  currentRow++;

  // --- Data Loop (Section A) ---
  // เงื่อนไข: Merge Column B:C
  let sumA = 0;
  mockData.items
    .filter((i) => i.category === "A")
    .forEach((item) => {
      const row = worksheet.getRow(currentRow);

      row.values = [
        item.no,
        item.name,
        "", // C (ถูก Merge)
        item.brand, // D (มีข้อมูล)
        item.qty,
        item.unit,
        item.matUnit,
        item.matTotal,
        item.labUnit,
        item.labTotal,
        item.total,
      ];

      // ✅ Merge B:C
      worksheet.mergeCells(`B${currentRow}:C${currentRow}`);

      // Format Numbers
      [7, 8, 9, 10, 11].forEach((c) => (row.getCell(c).numFmt = "#,##0.00"));

      // ตีเส้นขอบ (Loop ทุกช่อง)
      for (let c = 1; c <= 11; c++) {
        if (c === 3) continue; // ข้าม C เพราะถูก Merge
        row.getCell(c).border = {
          left: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" },
        };
      }

      // จัดกึ่งกลาง
      [1, 4, 5, 6].forEach(
        (c) => (row.getCell(c).alignment = { horizontal: "center" })
      );

      sumA += item.total;
      currentRow++;
    });

  // SUM A Row
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const sumACell = worksheet.getCell(`A${currentRow}`);
  sumACell.value = "SUM A";
  sumACell.alignment = { horizontal: "center" };
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

  const sumATotalCell = worksheet.getCell(`K${currentRow}`);
  sumATotalCell.value = sumA;
  sumATotalCell.numFmt = "#,##0.00";
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
  currentRow++;

  // ---------------------------------------------------------
  // สร้าง Header Section B (Merge B:D)
  // ---------------------------------------------------------
  // ส่ง "D" ไปเพื่อบอกว่าให้ Merge B ถึง D ✅
  createSectionHeader(currentRow, "B", "Project Management", "D");
  currentRow++;

  // --- Data Loop (Section B) ---
  // เงื่อนไข: Merge Column B:D
  let sumB = 0;
  mockData.items
    .filter((i) => i.category === "B")
    .forEach((item) => {
      const row = worksheet.getRow(currentRow);

      row.values = [
        item.no,
        item.name,
        "", // C (ถูก Merge)
        "", // D (ถูก Merge)
        item.qty,
        item.unit,
        item.matUnit,
        item.matTotal,
        item.labUnit,
        item.labTotal,
        item.total,
      ];

      // ✅ Merge B:D
      worksheet.mergeCells(`B${currentRow}:D${currentRow}`);

      // Format Numbers
      [7, 8, 9, 10, 11].forEach((c) => (row.getCell(c).numFmt = "#,##0.00"));

      // ตีเส้นขอบ
      for (let c = 1; c <= 11; c++) {
        if (c === 3 || c === 4) continue; // ข้าม C และ D เพราะถูก Merge
        row.getCell(c).border = {
          left: { style: "thin" },
          right: { style: "thin" },
          bottom: { style: "thin" },
        };
      }

      // จัดกึ่งกลาง
      [1, 5, 6].forEach(
        (c) => (row.getCell(c).alignment = { horizontal: "center" })
      );

      sumB += item.total;
      currentRow++;
    });

  // SUM B Row
  worksheet.mergeCells(`A${currentRow}:J${currentRow}`);
  const sumBCell = worksheet.getCell(`A${currentRow}`);
  sumBCell.value = "SUM B";
  sumBCell.alignment = { horizontal: "center" };
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

  const sumBTotalCell = worksheet.getCell(`K${currentRow}`);
  sumBTotalCell.value = sumB;
  sumBTotalCell.numFmt = "#,##0.00";
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
  currentRow++;
  // ==========================================
  // 6. FOOTER
  // ==========================================
  const footerStart = currentRow;
  const totalAmount = sumA + sumB;
  const vatAmount = totalAmount * mockData.vatRate;
  const grandTotal = totalAmount + vatAmount;

  // Right Totals
  worksheet.getCell(`I${currentRow}`).value = "รวม(Total)";
  worksheet.getCell(`K${currentRow}`).value = totalAmount;
  currentRow++;
  worksheet.getCell(`I${currentRow}`).value = "ส่วนลด(Discount)";
  worksheet.getCell(`K${currentRow}`).value = mockData.discount || "-";
  currentRow++;
  worksheet.getCell(`I${currentRow}`).value = "รวม(Total)";
  worksheet.getCell(`K${currentRow}`).value = totalAmount - mockData.discount;
  currentRow++;
  worksheet.getCell(`I${currentRow}`).value = "ภาษีมูลค่าเพิ่ม Vat7%";
  worksheet.getCell(`K${currentRow}`).value = vatAmount;
  currentRow++;
  worksheet.getCell(`I${currentRow}`).value = "รวมเงินทั้งสิ้น (Grand Total)";
  worksheet.getCell(`K${currentRow}`).value = grandTotal;

  // Styling Right Totals
  for (let r = footerStart; r < currentRow; r++) {
    worksheet.mergeCells(`I${r}:J${r}`);
    worksheet.getCell(`I${r}`).border = {
      left: { style: "thin" },
      bottom: { style: "thin" },
      top: { style: "thin" },
      right: { style: "thin" },
    };
    worksheet.getCell(`I${r}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFBFBFBF" },
    };
    worksheet.getCell(`I${r}`).font = {
      name: "Kanit Light",
      size: 10,
      bold: true,
    };

    worksheet.getCell(`K${r}`).border = {
      right: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      top: { style: "thin" },
    };
    worksheet.getCell(`K${r}`).numFmt = "#,##0.00";
    worksheet.getCell(`K${r}`).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE2E2E2" },
    };
    worksheet.getCell(`K${r}`).font = { name: "Kanit Light", size: 10 };
  }

  // Left Terms
  worksheet.getCell(`A${footerStart}`).value = "เงื่อนไขการชำระเงิน";
  worksheet.getCell(`A${footerStart}`).font = {
    bold: true,
    name: "Kanit Light",
    size: 10,
  };
  mockData.paymentTerms.forEach((term, i) => {
    worksheet.getCell(`A${footerStart + 1 + i}`).value = `${i + 1}. ${term}`;
  });

  worksheet.getCell(`E${footerStart}`).value = "เงื่อนไขการรับประกัน";
  worksheet.getCell(`E${footerStart}`).font = {
    bold: true,
    name: "Kanit Light",
    size: 10,
  };
  mockData.warrantyTerms.forEach((term, i) => {
    worksheet.getCell(`E${footerStart + 1 + i}`).value = `${i + 1}. ${term}`;
  });

  const remarkRow = footerStart + 5;
  worksheet.getCell(`A${remarkRow}`).value = "หมายเหตุ";
  worksheet.getCell(`A${remarkRow}`).font = {
    bold: true,
    name: "Kanit Light",
    size: 10,
  };
  worksheet.getCell(`A${remarkRow + 1}`).value = mockData.remarks;

  // Signatures
  currentRow += 2;
  // Box 1
  worksheet.mergeCells(`B${currentRow}:D${currentRow + 4}`);
  worksheet.getCell(`B${currentRow}`).value =
    "ลงชื่อผู้ให้บริการ\n\n\n___________________\n\nวันที่ 13 / 5 / 2568";
  worksheet.getCell(`B${currentRow}`).alignment = {
    vertical: "bottom",
    horizontal: "center",
    wrapText: true,
  };
  worksheet.getCell(`B${currentRow}`).border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  worksheet.getCell(`B${currentRow}`).font = { name: "Kanit Light", size: 10 };

  // Box 2
  worksheet.mergeCells(`H${currentRow}:J${currentRow + 4}`);
  worksheet.getCell(`H${currentRow}`).value =
    "ลงชื่อลูกค้า\n\n\n___________________\n\nวันที่ ___/___/___";
  worksheet.getCell(`H${currentRow}`).alignment = {
    vertical: "bottom",
    horizontal: "center",
    wrapText: true,
  };
  worksheet.getCell(`H${currentRow}`).border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  worksheet.getCell(`H${currentRow}`).font = { name: "Kanit Light", size: 10 };

  // ==========================================
  // ✅ FINAL ROW HEIGHT CHECK (บังคับความสูงทุกแถว)
  // ==========================================
  worksheet.eachRow((row) => {
    row.height = 24.5;
  });

  // Save File
  const outputPath = path.join(process.cwd(), "Result_Update_Layout.xlsx");

  try {
    await workbook.xlsx.writeFile(outputPath);
    console.log("---------------------------------------------------");
    console.log("✅ สร้างไฟล์สำเร็จแล้ว!");
    console.log(`📂 ตำแหน่งไฟล์: ${outputPath}`);
    console.log("---------------------------------------------------");
  } catch (error) {
    console.error("❌ เกิดข้อผิดพลาด:", error);
  }
}

run();
