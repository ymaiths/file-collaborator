import React from "react";
import { EditableCell } from "./EditableCell";
import { ProductSelector, SelectedProduct } from "./ProductSelector";

// Helper จัดรูปแบบเงิน
const formatCurrency = (num: number | undefined | null) => {
  if (num === undefined || num === null || isNaN(num)) return ""; // เอา num === 0 ออกเพื่อให้แสดง 0.00 ได้ถ้าต้องการ หรือใส่กลับถ้าต้องการซ่อน
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Helper เช็คข้อความ
const formatText = (text: string | undefined | null) => {
  if (!text || text === "-") return "";
  return text;
};

// Interface ของข้อมูล
export interface PreviewData {
  customerName: string;
  projectName: string;
  docNumber: string;
  date: string;
  quotationId: string;
  items: any[];
  paymentTerms: string[];
  warrantyTerms: string[];
  remarks: string;
  vatRate: number;
  discount?: number;
}

interface QuotationPreviewProps {
  data: PreviewData | null;
  isEditMode: boolean;
  onUpdateItem: (itemId: string, field: string, value: any) => void;
  onUpdateTerms: (field: string, value: string) => void;
  onUpdateTotalOverride?: (type: 'net' | 'grand', value: number) => void;
  onAddItem?: (section: "A" | "B", item: SelectedProduct) => void;
}

export const QuotationPreview = ({ data, isEditMode, onUpdateItem, onUpdateTerms, onUpdateTotalOverride,onAddItem }: QuotationPreviewProps) => {
  if (!data) return <div className="text-center p-10 text-xs">กำลังโหลดตัวอย่าง...</div>;

  const itemsA = data.items.filter((i) => i.category === "A");
  const itemsB = data.items.filter((i) => i.category === "B");

  // การคำนวณราคา
  const totalAmount = data.items.reduce((sum, i) => sum + i.total, 0); // นี่คือ Net Total (ยอดรวมสินค้า)
  const discount = data.discount || 0;
  const totalAfterDiscount = totalAmount - discount;
  const vatAmount = totalAfterDiscount * data.vatRate;
  const grandTotal = totalAfterDiscount + vatAmount;

  // Style Classes
  const borderClass = "border border-gray-400 p-1 text-xs align-middle";
  const headerClass = "bg-gray-200 font-bold text-center " + borderClass;
  
  // คำนวณราคาต่อหน่วยเพื่อแสดงผล
  const calcUnit = (total: number, qty: number) => {
      if (!qty || qty === 0) return 0;
      return total / qty;
  };
  
  // Helper เลือกค่า Original หรือ Edited
  const getVal = (item: any, field: string) => {
      return item[`edited_${field}`] !== null && item[`edited_${field}`] !== undefined && item[`edited_${field}`] !== "" 
             ? item[`edited_${field}`] 
             : item[field];
  };
  
  return (
    <div className="bg-white p-[10mm] shadow-lg text-gray-800 border border-gray-200 w-full mx-auto font-sans box-border">
      
      {/* Header Label */}
      <div className="mb-2 text-right">
         <h2 className="text-sm font-bold text-gray-500">PREVIEW (ตัวอย่างเอกสาร)</h2>
      </div>

      {/* Table Section */}
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr>
            <th className={`${headerClass} w-8`}>No.</th>
            <th className={`${headerClass} w-[30%]`}>รายการ (Description)</th>
            <th className={`${headerClass} w-16`}>ยี่ห้อ</th>
            <th className={`${headerClass} w-10`}>จำนวน</th>
            <th className={`${headerClass} w-10`}>หน่วย</th>
            
            <th className={`${headerClass} w-20`}>ราคาอุปกรณ์<br/>/หน่วย</th>
            <th className={`${headerClass} w-24 bg-gray-100`}>ค่าอุปกรณ์รวม</th>
            
            <th className={`${headerClass} w-20`}>ค่าแรง<br/>/หน่วย</th>
            <th className={`${headerClass} w-24 bg-gray-100`}>ค่าแรงรวม</th>
            
            <th className={`${headerClass} w-24`}>รวมเงิน</th>
          </tr>
        </thead>
        <tbody>
          {/* --- Section A --- */}
          {itemsA.length > 0 && (
            <tr className="bg-blue-50">
              <td colSpan={10} className={`${borderClass} font-bold text-blue-800`}>
                A. Main Equipment
              </td>
            </tr>
          )}
          {itemsA.map((item, idx) => (
            <tr key={`a-${item.id || idx}`}>
              <td className={`${borderClass} text-center`}>{idx + 1}</td>
              
              {/* 1. รายการ */}
              <td className={`${borderClass}`}>
                <EditableCell 
                  isEditMode={isEditMode}
                  value={getVal(item, "name")}
                  onSave={(val) => onUpdateItem(item.id, "edited_name", val)}
                />
              </td>

              {/* 2. ยี่ห้อ */}
              <td className={`${borderClass}`}>
                <EditableCell 
                  isEditMode={isEditMode}
                  align="center"
                  value={getVal(item, "brand")}
                  onSave={(val) => onUpdateItem(item.id, "edited_brand", val)}
                />
              </td>

              {/* 3. จำนวน */}
              <td className={`${borderClass}`}>
                <EditableCell 
                  isEditMode={isEditMode}
                  type="number"
                  align="center"
                  value={item.qty}
                  onSave={(val) => onUpdateItem(item.id, "quantity", parseFloat(val))}
                />
              </td>

              {/* 4. หน่วย */}
              <td className={`${borderClass}`}>
                <EditableCell 
                  isEditMode={isEditMode}
                  align="center"
                  value={getVal(item, "unit")}
                  onSave={(val) => onUpdateItem(item.id, "edited_unit", val)}
                />
              </td>
              
              {/* 5. ราคาอุปกรณ์/หน่วย */}
              <td className={`${borderClass}`}>
                 <EditableCell 
                  isEditMode={isEditMode}
                  type="text"
                  align="right"
                  value={formatCurrency(calcUnit(item.matUnit, item.qty))}
                  onSave={(val) => {
                    const cleanVal = val.replace(/,/g, '');
                    const unitPrice = parseFloat(cleanVal);
                    const totalPrice = unitPrice * (item.qty || 1);
                    onUpdateItem(item.id, "product_price", totalPrice);
                  }}
                />
              </td>
              <td className={`${borderClass} text-right bg-gray-50`}>
                 {formatCurrency(item.matUnit)}
              </td>
              
              {/* 6. ค่าแรง/หน่วย */}
              <td className={`${borderClass}`}>
                 <EditableCell 
                  isEditMode={isEditMode}
                  type="text"
                  align="right"
                  value={formatCurrency(calcUnit(item.labUnit, item.qty))}
                  onSave={(val) => {
                      const cleanVal = val.replace(/,/g, '');
                      const unitPrice = parseFloat(cleanVal);
                      const totalPrice = unitPrice * (item.qty || 1);
                      onUpdateItem(item.id, "installation_price", totalPrice);
                  }}
                />
              </td>
              <td className={`${borderClass} text-right bg-gray-50`}>
                 {formatCurrency(item.labUnit)}
              </td>
              
              <td className={`${borderClass} text-right font-semibold`}>
                 {formatCurrency(item.total)}
              </td>
            </tr>
          ))}
          {isEditMode && (
            <tr>
                <td colSpan={10} className="p-2 border-l border-r border-b border-gray-400 bg-white">    
                  <div className="flex justify-start">
                    <div className="w-[420px]">
                      <ProductSelector section="A" onSelect={(item) => onAddItem?.("A", item)} />
                    </div>
                  </div>
                </td>
            </tr>
          )}

          {/* --- Section B --- */}
          {itemsB.length > 0 && (
            <tr className="bg-blue-50">
              <td colSpan={10} className={`${borderClass} font-bold text-blue-800`}>
                B. Project Management & Operation
              </td>
            </tr>
          )}
          {itemsB.map((item, idx) => (
            <tr key={`b-${item.id || idx}`}>
              <td className={`${borderClass} text-center`}>{itemsA.length + idx + 1}</td>
              
              <td className={`${borderClass}`}>
                <EditableCell 
                  isEditMode={isEditMode}
                  value={getVal(item, "name")}
                  onSave={(val) => onUpdateItem(item.id, "edited_name", val)}
                />
              </td>

              <td className={`${borderClass} text-center`}></td> 
              
              <td className={`${borderClass}`}>
                 <EditableCell 
                  isEditMode={isEditMode}
                  type="number"
                  align="center"
                  value={item.qty}
                  onSave={(val) => onUpdateItem(item.id, "quantity", parseFloat(val))}
                />
              </td>
              
              <td className={`${borderClass}`}>
                 <EditableCell 
                  isEditMode={isEditMode}
                  align="center"
                  value={getVal(item, "unit")}
                  onSave={(val) => onUpdateItem(item.id, "edited_unit", val)}
                />
              </td>

              <td className={`${borderClass} text-right`}></td>
              <td className={`${borderClass} text-right bg-gray-50`}></td>
              <td className={`${borderClass} text-right`}></td>
              <td className={`${borderClass} text-right bg-gray-50`}></td>
              
              <td className={`${borderClass} text-right font-semibold`}>
                <EditableCell 
                  isEditMode={isEditMode}
                  type="text"
                  align="right"
                  value={formatCurrency(item.total)}
                  onSave={(val) => {
                    const cleanVal = val.replace(/,/g, '');
                    const newTotal = parseFloat(cleanVal);
                    if (isNaN(newTotal)) return;
                    const qty = item.qty || 1;
                    const newUnitPrice = newTotal / qty;
                    onUpdateItem(item.id, "product_price", newUnitPrice);
                  }}
                />
              </td>
            </tr>
          ))}
          {isEditMode && (
            <tr className="bg-gray-50">
                <td colSpan={10} className="p-2 border-l border-r border-b border-gray-400 bg-white">    
                  <div className="flex justify-start">
                    <div className="w-[420px]">
                        <ProductSelector section="B" onSelect={(item) => onAddItem?.("B", item)} />
                    </div>
                  </div>
                </td>
            </tr>
          )}
        </tbody>
        
        {/* --- FOOTER STRUCTURE --- */}
        <tfoot>
          <tr>
            <td colSpan={7} className="border border-gray-400 p-0 align-top h-full">
                <div className="flex h-full min-h-[160px]">
                    <div className="w-1/2 flex flex-col border-r border-gray-400">
                        {/* เงื่อนไขการชำระเงิน */}
                        <div className="flex-1 p-2 border-b border-gray-400">
                             <h4 className="font-bold text-gray-800 underline mb-1 text-xs">เงื่อนไขการชำระเงิน</h4>
                             <EditableCell
                                isEditMode={isEditMode}
                                type="textarea"
                                value={data.paymentTerms.join("\n")}
                                onSave={(val) => onUpdateTerms("edited_payment_terms", val)}
                                className="text-[10px] text-gray-600"
                             />
                        </div>
                        {/* หมายเหตุ */}
                        <div className="flex-1 p-2 bg-gray-50">
                             <h4 className="font-bold text-gray-800 underline mb-1 text-xs">หมายเหตุ</h4>
                             <EditableCell
                                isEditMode={isEditMode}
                                type="textarea"
                                value={data.remarks}
                                onSave={(val) => onUpdateTerms("edited_note", val)}
                                className="text-[10px] text-gray-600"
                             />
                        </div>
                    </div>

                    <div className="w-1/2 p-2">
                        {/* เงื่อนไขการรับประกัน */}
                        <h4 className="font-bold text-gray-800 underline mb-1 text-xs">เงื่อนไขการรับประกัน</h4>
                        <EditableCell
                            isEditMode={isEditMode}
                            type="textarea"
                            value={data.warrantyTerms.join("\n")}
                            onSave={(val) => onUpdateTerms("edited_warranty_terms", val)}
                            className="text-[10px] text-gray-600"
                        />
                    </div>
                </div>
            </td>

            {/* 2. RIGHT BLOCK (Totals) */}
            <td colSpan={3} className="border border-gray-400 p-0 align-top">
                <div className="flex flex-col h-full text-xs">
                    
                    {/* ✅ 1. รวม (Net Total) - แก้ไขให้เป็น EditableCell */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right font-bold bg-gray-100 border-r border-gray-400 flex items-center justify-end">รวม (Total)</div>
                        <div className="w-1/2 p-1 text-right flex items-center justify-end font-medium">
                            <EditableCell 
                                isEditMode={isEditMode}
                                type="text"
                                align="right"
                                value={formatCurrency(totalAmount)}
                                onSave={(val) => {
                                    const cleanVal = parseFloat(val.replace(/,/g, ''));
                                    if (!isNaN(cleanVal) && onUpdateTotalOverride) {
                                        onUpdateTotalOverride('net', cleanVal);
                                    }
                                }}
                            />
                        </div>
                    </div>
                    
                    {/* ส่วนลด */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right font-bold bg-gray-100 border-r border-gray-400 flex items-center justify-end">ส่วนลด (Discount)</div>
                        <div className="w-1/2 p-1 text-right flex items-center justify-end">
                            {discount > 0 ? `-${formatCurrency(discount)}` : ""}
                        </div>
                    </div>
                    
                    {/* หลังหักส่วนลด (Read Only) */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right font-bold bg-gray-100 border-r border-gray-400 flex items-center justify-end">รวม (Total)</div>
                        <div className="w-1/2 p-1 text-right flex items-center justify-end font-medium">{formatCurrency(totalAfterDiscount)}</div>
                    </div>
                    
                    {/* VAT (Read Only) */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right text-gray-600 bg-gray-100 border-r border-gray-400 flex items-center justify-end">ภาษีมูลค่าเพิ่ม (VAT 7%)</div>
                        <div className="w-1/2 p-1 text-right text-gray-600 flex items-center justify-end">{formatCurrency(vatAmount)}</div>
                    </div>
                    
                    {/* ✅ 2. รวมเงินทั้งสิ้น (Grand Total) - แก้ไขให้เป็น EditableCell */}
                    <div className="flex flex-1">
                        <div className="w-1/2 p-1 text-right font-bold text-primary bg-blue-50 border-r border-gray-400 flex items-center justify-end">รวมเงินทั้งสิ้น<br/>(Grand Total)</div>
                        <div className="w-1/2 p-1 text-right font-bold text-primary text-sm flex items-center justify-end">
                             <EditableCell 
                                isEditMode={isEditMode}
                                type="text"
                                align="right"
                                value={formatCurrency(grandTotal)}
                                onSave={(val) => {
                                    const cleanVal = parseFloat(val.replace(/,/g, ''));
                                    if (!isNaN(cleanVal) && onUpdateTotalOverride) {
                                        onUpdateTotalOverride('grand', cleanVal);
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </td>
          </tr>
        </tfoot>
      </table>

    </div>
  );
};