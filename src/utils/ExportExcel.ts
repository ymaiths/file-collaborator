import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

// Type สำหรับข้อมูลที่จะรับเข้ามา (ปรับตาม Interface จริงของคุณ)
interface LineItem {
  id: string;
  no: number;
  name: string;
  brand: string;
  qty: number;
  unit: string;
  // Material (ของ)
  matUnitPrice: number;
  matTotal: number;
  // Labor (แรงงาน/ติดตั้ง)
  labUnitPrice: number;
  labTotal: number;
  // Total
  totalPrice: number;
  category: "A" | "B"; // A = Main Equipment, B = Project Management
}

interface QuotationData {
  customerName: string;
  customerAddress: string;
  customerTaxId?: string;
  projectName: string;
  maxPower: string; // e.g. "250.19 kWp"
  inverterBrand: string;
  date: string;
  docNumber: string;
  items: LineItem[];
  // Terms
  paymentTerms: string[];
  warrantyTerms: string[];
  remarks: string;
  // Totals
  discount: number;
  vatRate: number; // 0.07
}

export const generateQuotationExcel = async (data: QuotationData) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Quotation");

  // 1. ตั้งค่า Column Width ให้ใกล้เคียงกับรูป
  worksheet.columns = [
    { key: "no", width: 5 }, // A: No
    { key: "name", width: 40 }, // B: Description
    { key: "brand", width: 10 }, // C: Brand
    { key: "qty", width: 8 }, // D: Qty
    { key: "unit", width: 8 }, // E: Unit
    { key: "matUnit", width: 12 }, // F: Material Unit
    { key: "matTotal", width: 15 }, // G: Material Total
    { key: "labUnit", width: 12 }, // H: Labor Unit
    { key: "labTotal", width: 15 }, // I: Labor Total
    { key: "total", width: 18 }, // J: Grand Total
  ];

  // ==========================================
  // 2. HEADER SECTION (Logo & Company Info)
  // ==========================================

  // *หมายเหตุ: คุณต้องเตรียม Logo เป็น Base64 string*
  // const logoId = workbook.addImage({
  //   base64: 'data:image/png;base64,...',
  //   extension: 'png',
  // });
  // worksheet.addImage(logoId, {
  //   tl: { col: 0, row: 0 },
  //   ext: { width: 150, height: 50 },
  // });

  // Company Info (Centered)
  worksheet.mergeCells("A1:F5"); // Area for Logo & Address
  const companyInfoCell = worksheet.getCell("A1");
  companyInfoCell.value = `บริษัท โพนิซ จำกัด (สำนักงานใหญ่)\nที่อยู่ 612 ถนนช้างเผือก ตำบลในเมือง อำเภอเมือง\nจังหวัดนครราชสีมา 30000\nTel : 082-4360444, 063-1411454\nเลขประจำตัวผู้เสียภาษี: 0-3055-60003-13-9`;
  companyInfoCell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  companyInfoCell.font = { name: "Sarabun", size: 10, bold: true };

  // Quotation Title Box (Right Side)
  worksheet.mergeCells("G1:J2");
  const titleCell = worksheet.getCell("G1");
  titleCell.value = "ใบเสนอราคา\nQUOTATION";
  titleCell.alignment = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
  };
  titleCell.font = {
    name: "Sarabun",
    size: 16,
    bold: true,
    color: { argb: "FF002060" },
  }; // Dark Blue
  // (Optional: Add borders/background image for the graphic element)

  // ==========================================
  // 3. CUSTOMER & DOC INFO
  // ==========================================

  // Left: Customer Info
  worksheet.mergeCells("A6:F8");
  const customerCell = worksheet.getCell("A6");
  customerCell.value = `ชื่อลูกค้า : ${data.customerName}\nที่อยู่ : ${
    data.customerAddress
  }\nเลขประจำตัวผู้เสียภาษี : ${data.customerTaxId || "-"}`;
  customerCell.alignment = {
    vertical: "top",
    horizontal: "left",
    wrapText: true,
  };
  customerCell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
    bottom: { style: "thin" },
  };

  // Right: Doc Info
  const startRowRight = 6;
  // Row 6
  worksheet.mergeCells(`G${startRowRight}:J${startRowRight}`);
  worksheet.getCell(`G${startRowRight}`).value = `โปรเจค : ${data.projectName}`;
  // Row 7
  worksheet.mergeCells(`G${startRowRight + 1}:J${startRowRight + 1}`);
  worksheet.getCell(
    `G${startRowRight + 1}`
  ).value = `กำลังไฟสูงสุด (${data.maxPower})`;
  worksheet.getCell(`G${startRowRight + 1}`).alignment = {
    horizontal: "right",
  }; // Align text inside if needed
  // Row 8
  worksheet.mergeCells(`G${startRowRight + 2}:J${startRowRight + 2}`);
  worksheet.getCell(
    `G${startRowRight + 2}`
  ).value = `INVERTER : ${data.inverterBrand}`;
  // Row 9
  worksheet.mergeCells(`G${startRowRight + 3}:J${startRowRight + 3}`);
  worksheet.getCell(`G${startRowRight + 3}`).value = `วันที่ : ${data.date}`;
  // Row 10
  worksheet.mergeCells(`G${startRowRight + 4}:J${startRowRight + 4}`);
  worksheet.getCell(
    `G${startRowRight + 4}`
  ).value = `เลขที่เอกสาร : ${data.docNumber}`;

  // Style Right Box
  for (let r = 6; r <= 10; r++) {
    worksheet.getCell(`G${r}`).border = { right: { style: "thin" } };
    worksheet.getCell(`G${r}`).font = { size: 9 };
  }
  worksheet.getCell("G6").border = {
    top: { style: "thin" },
    right: { style: "thin" },
  };

  // ==========================================
  // 4. TABLE HEADER (Green Area)
  // ==========================================
  const headerRowStart = 12;

  // --- ROW 12: Top Headers (Material / Labor) ---
  worksheet.getCell(`F${headerRowStart}`).value = "Material";
  worksheet.mergeCells(`F${headerRowStart}:G${headerRowStart}`);

  worksheet.getCell(`H${headerRowStart}`).value = "Labor";
  worksheet.mergeCells(`H${headerRowStart}:I${headerRowStart}`);

  worksheet.getCell(`J${headerRowStart}`).value = "Total";
  // Merge Total ลงมา 3 แถว (12, 13, 14) ให้ดูสวยงาม
  worksheet.mergeCells(`J${headerRowStart}:J${headerRowStart + 2}`);

  // --- ROW 13: Main Columns ---
  const r13 = headerRowStart + 1;

  // A: No (Merge ลงมาถึง Row 14)
  worksheet.getCell(`A${r13}`).value = "No";
  worksheet.mergeCells(`A${r13}:A${r13 + 1}`);

  // B: Main Equipment / Description (Merge ลงมาถึง Row 14)
  worksheet.getCell(`B${r13}`).value = "Main Equipment";
  worksheet.mergeCells(`B${r13}:B${r13 + 1}`);

  // C: Brand (Merge ลงมาถึง Row 14)
  worksheet.getCell(`C${r13}`).value = "Brand";
  worksheet.mergeCells(`C${r13}:C${r13 + 1}`);

  // D: Q'Ty (Merge ลงมาถึง Row 14)
  worksheet.getCell(`D${r13}`).value = "Q'Ty";
  worksheet.mergeCells(`D${r13}:D${r13 + 1}`);

  // E: Unit (Merge ลงมาถึง Row 14)
  worksheet.getCell(`E${r13}`).value = "Unit";
  worksheet.mergeCells(`E${r13}:E${r13 + 1}`);

  // F-G: Scope of Work
  worksheet.getCell(`F${r13}`).value = "Scope of Work";
  worksheet.mergeCells(`F${r13}:G${r13}`);

  // H-I: Scope of Supply
  worksheet.getCell(`H${r13}`).value = "Scope of Supply";
  worksheet.mergeCells(`H${r13}:I${r13}`);

  // --- ROW 14: Sub Headers ---
  const r14 = headerRowStart + 2;
  worksheet.getCell(`F${r14}`).value = "PONIX";
  worksheet.getCell(`G${r14}`).value = "Cost";
  worksheet.getCell(`H${r14}`).value = "PONIX";
  worksheet.getCell(`I${r14}`).value = "Cost";

  // Styling Headers
  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF92D050" }, // Light Green
  };

  // Apply styles to all header cells
  // (A13-E14, F12-G14, H12-I14, J12-J14)
  const headerCells = [
    `A${r13}`,
    `B${r13}`,
    `C${r13}`,
    `D${r13}`,
    `E${r13}`, // Main Cols
    `F${headerRowStart}`,
    `G${headerRowStart}`,
    `H${headerRowStart}`,
    `I${headerRowStart}`, // Top Row
    `F${r13}`,
    `H${r13}`, // Middle Merged
    `F${r14}`,
    `G${r14}`,
    `H${r14}`,
    `I${r14}`, // Sub headers
    `J${headerRowStart}`, // Total
  ];

  headerCells.forEach((ref) => {
    const cell = worksheet.getCell(ref);
    cell.fill = headerFill;
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
      wrapText: true,
    };
    cell.font = { bold: true };
  });

  // Apply borders to the whole header block
  for (let r = headerRowStart; r <= r14; r++) {
    for (let c = 1; c <= 10; c++) {
      worksheet.getCell(r, c).border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    }
  }

  // ==========================================
  // 5. DATA ROWS (Section A)
  // ==========================================
  let currentRow = 15;

  // Section A Header
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "A | ระบบโซลาร์ ... kWp สองระบบ"; // ใส่ชื่อระบบจริง
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  worksheet.getRow(currentRow).height = 20;
  // Apply borders to the full row A-J
  for (let c = 1; c <= 10; c++)
    worksheet.getCell(currentRow, c).border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  currentRow++;

  let sumA = 0;
  const itemsA = data.items.filter((i) => i.category === "A");

  itemsA.forEach((item, index) => {
    const r = worksheet.getRow(currentRow);
    r.getCell("no").value = index + 1;
    r.getCell("name").value = item.name;
    r.getCell("brand").value = item.brand;
    r.getCell("qty").value = item.qty;
    r.getCell("unit").value = item.unit;

    r.getCell("matUnit").value = item.matUnitPrice;
    r.getCell("matTotal").value = item.matTotal;

    r.getCell("labUnit").value = item.labUnitPrice;
    r.getCell("labTotal").value = item.labTotal;

    r.getCell("total").value = item.totalPrice;

    sumA += item.totalPrice;
    currentRow++;
  });

  // Style Data Rows
  for (let r = 16; r < currentRow; r++) {
    const row = worksheet.getRow(r);
    // Number Formats
    ["matUnit", "matTotal", "labUnit", "labTotal", "total"].forEach((key) => {
      row.getCell(key).numFmt = "#,##0.00";
    });
    // Borders
    for (let c = 1; c <= 10; c++)
      row.getCell(c).border = {
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "dotted" },
      };
  }

  // SUM A Row
  worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "SUM A";
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  }; // Gray

  worksheet.getCell(`J${currentRow}`).value = sumA;
  worksheet.getCell(`J${currentRow}`).numFmt = "#,##0.00";
  worksheet.getCell(`J${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  };
  worksheet.getRow(currentRow).border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
  };

  currentRow++;

  // ==========================================
  // 6. DATA ROWS (Section B)
  // ==========================================

  // Section B Header
  worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "B | Project Management";
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  // Borders
  for (let c = 1; c <= 10; c++)
    worksheet.getCell(currentRow, c).border = {
      top: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
      right: { style: "thin" },
    };
  currentRow++;

  let sumB = 0;
  const itemsB = data.items.filter((i) => i.category === "B");
  const startRowB = currentRow;

  itemsB.forEach((item, index) => {
    const r = worksheet.getRow(currentRow);
    r.getCell("no").value = itemsA.length + index + 1; // ต่อเลขลำดับ
    r.getCell("name").value = item.name;
    r.getCell("qty").value = item.qty;
    r.getCell("unit").value = item.unit;
    // B usually only has Total in the example, but adapt as needed
    r.getCell("total").value = item.totalPrice;

    sumB += item.totalPrice;
    currentRow++;
  });

  // Style Data Rows B
  for (let r = startRowB; r < currentRow; r++) {
    const row = worksheet.getRow(r);
    row.getCell("total").numFmt = "#,##0.00";
    for (let c = 1; c <= 10; c++)
      row.getCell(c).border = {
        left: { style: "thin" },
        right: { style: "thin" },
        bottom: { style: "dotted" },
      };
  }

  // SUM B Row
  worksheet.mergeCells(`A${currentRow}:I${currentRow}`);
  worksheet.getCell(`A${currentRow}`).value = "SUM B";
  worksheet.getCell(`A${currentRow}`).alignment = { horizontal: "center" };
  worksheet.getCell(`A${currentRow}`).font = { bold: true };
  worksheet.getCell(`A${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  };

  worksheet.getCell(`J${currentRow}`).value = sumB;
  worksheet.getCell(`J${currentRow}`).numFmt = "#,##0.00";
  worksheet.getCell(`J${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  };

  currentRow++;

  // ==========================================
  // 7. FOOTER (Totals & Terms)
  // ==========================================

  // Total Calculation
  const total = sumA + sumB;
  const discount = data.discount || 0;
  const afterDiscount = total - discount;
  const vat = afterDiscount * data.vatRate;
  const grandTotal = afterDiscount + vat;

  const startFooterRow = currentRow;

  // -- Right Side Totals --
  // Total
  worksheet.getCell(`I${currentRow}`).value = "รวม (Total)";
  worksheet.getCell(`J${currentRow}`).value = total;
  currentRow++;
  // Discount
  worksheet.getCell(`I${currentRow}`).value = "ส่วนลด (Discount)";
  worksheet.getCell(`J${currentRow}`).value = discount;
  currentRow++;
  // Total after Discount (Optional row based on image logic, skipping to match exact image flow)
  worksheet.getCell(`I${currentRow}`).value = "รวม (Total)";
  worksheet.getCell(`J${currentRow}`).value = afterDiscount;
  currentRow++;
  // VAT
  worksheet.getCell(`I${currentRow}`).value = "ภาษีมูลค่าเพิ่ม Vat 7%";
  worksheet.getCell(`J${currentRow}`).value = vat;
  currentRow++;
  // Grand Total
  worksheet.getCell(`I${currentRow}`).value = "รวมเงินทั้งสิ้น (Grand Total)";
  worksheet.getCell(`J${currentRow}`).value = grandTotal;

  // Formatting Totals
  for (let r = startFooterRow; r <= currentRow; r++) {
    worksheet.getCell(`I${r}`).border = {
      left: { style: "thin" },
      bottom: { style: "thin" },
    };
    worksheet.getCell(`J${r}`).border = {
      right: { style: "thin" },
      bottom: { style: "thin" },
      left: { style: "thin" },
    };
    worksheet.getCell(`J${r}`).numFmt = "#,##0.00";
  }
  // Color the Grand Total
  worksheet.getCell(`J${currentRow}`).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD9D9D9" },
  };

  // -- Left Side Terms --
  // Payment Terms
  worksheet.getCell(`A${startFooterRow}`).value = "เงื่อนไขการชำระเงิน";
  worksheet.getCell(`A${startFooterRow}`).font = { bold: true };
  data.paymentTerms.forEach((term, idx) => {
    worksheet.getCell(`A${startFooterRow + 1 + idx}`).value = `${
      idx + 1
    }. ${term}`;
  });

  // Remarks
  const remarkRow = startFooterRow + 1 + data.paymentTerms.length;
  worksheet.getCell(`A${remarkRow}`).value = "หมายเหตุ";
  worksheet.getCell(`A${remarkRow}`).font = { bold: true };
  worksheet.getCell(`A${remarkRow + 1}`).value = data.remarks;

  // Warranty (Right side of left block) - or below based on space.
  // In image it's column E-F roughly.
  worksheet.getCell(`E${startFooterRow}`).value = "เงื่อนไขการรับประกัน";
  worksheet.getCell(`E${startFooterRow}`).font = { bold: true };
  data.warrantyTerms.forEach((term, idx) => {
    worksheet.getCell(`E${startFooterRow + 1 + idx}`).value = `${
      idx + 1
    }. ${term}`;
  });

  // Text Baht (Below Grand Total)
  // Assuming currentRow is at Grand Total line
  currentRow++;
  worksheet.mergeCells(`D${currentRow}:J${currentRow}`);
  worksheet.getCell(`D${currentRow}`).value = `( ตัวอักษรจำนวนเงินบาทไทย )`; // คุณต้องใช้ library `bahttext` แปลงค่า grandTotal มาใส่ตรงนี้
  worksheet.getCell(`D${currentRow}`).alignment = { horizontal: "center" };

  // ==========================================
  // 8. SIGNATURES
  // ==========================================
  currentRow += 2;

  // Ponix
  worksheet.mergeCells(`B${currentRow}:D${currentRow + 3}`);
  worksheet.getCell(`B${currentRow}`).value =
    "ลงชื่อผู้ให้บริการ\n\n\n___________________\nธนพร สดาการ\nวันที่ 18 / 7 / 2568";
  worksheet.getCell(`B${currentRow}`).alignment = {
    horizontal: "center",
    vertical: "bottom",
    wrapText: true,
  };
  worksheet.getCell(`B${currentRow}`).border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  // Customer
  worksheet.mergeCells(`G${currentRow}:I${currentRow + 3}`);
  worksheet.getCell(`G${currentRow}`).value =
    "ลงชื่อลูกค้า\n\n\n___________________\n\nวันที่ ___/___/___";
  worksheet.getCell(`G${currentRow}`).alignment = {
    horizontal: "center",
    vertical: "bottom",
    wrapText: true,
  };
  // worksheet.getCell(`G${currentRow}`).border = ... (If needed)

  // ==========================================
  // 9. OUTPUT
  // ==========================================
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  saveAs(blob, `Quotation_${data.docNumber}.xlsx`);
};
