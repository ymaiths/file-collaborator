import React from "react";
import { EditableCell } from "./EditableCell";
import { ProductSelector, SelectedProduct } from "./ProductSelector";

// Helper จัดรูปแบบเงิน
const formatCurrency = (num: number | undefined | null) => {
  if (num === undefined || num === null || isNaN(num)) return ""; 
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
  const totalAmount = data.items.reduce((sum, i) => sum + i.total, 0); 
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
            {/* ✅ เทคนิค: ใส่ h-[1px] ที่ td เพื่อบังคับให้ cell ยึดความสูงตามเพื่อนร่วมแถว 
                และยอมให้ลูก (div) ใช้ h-full ได้อย่างถูกต้อง 
            */}
            
            {/* --- LEFT BLOCK (Terms) --- */}
            <td colSpan={7} className="border border-gray-400 p-0 align-top h-[1px]">
                <div className="flex flex-col h-full min-h-[160px] p-3 border-r border-gray-400"> {/* ใช้ h-full */}
                    
                    {/* 1. Payment Terms */}
                    <div className="mb-3">
                      <h4 className="font-bold mb-1 underline decoration-gray-400 underline-offset-2 text-xs">เงื่อนไขการชำระเงิน</h4>
                      {data.paymentTerms && data.paymentTerms.length > 0 ? (
                        data.paymentTerms.length === 1 ? (
                          <p className="text-xs text-gray-700">{data.paymentTerms[0]}</p>
                        ) : (
                          <ol className="list-decimal list-inside text-xs space-y-0.5">
                            {data.paymentTerms.map((term, index) => (
                              <li key={index} className="text-gray-700">{term}</li>
                            ))}
                          </ol>
                        )
                      ) : (
                        <p className="text-xs text-gray-500">-</p>
                      )}
                    </div>

                    {/* 2. Warranty Terms */}
                    <div className="mb-3">
                      <h4 className="font-bold mb-1 underline decoration-gray-400 underline-offset-2 text-xs">เงื่อนไขการรับประกัน</h4>
                      {data.warrantyTerms && data.warrantyTerms.length > 0 ? (
                        data.warrantyTerms.length === 1 ? (
                          <p className="text-xs text-gray-700">{data.warrantyTerms[0]}</p>
                        ) : (
                          <ol className="list-decimal list-inside text-xs space-y-0.5">
                            {data.warrantyTerms.map((term, index) => (
                              <li key={index} className="text-gray-700">{term}</li>
                            ))}
                          </ol>
                        )
                      ) : (
                        <p className="text-xs text-gray-500">-</p>
                      )}
                    </div>

                    {/* 3. Remarks (ใช้ flex-1 เพื่อดันให้เต็มพื้นที่ถ้าจำเป็น หรือปล่อยตามธรรมชาติ) */}
                    <div className="mb-2 flex-1">
                      <h4 className="font-bold mb-1 underline decoration-gray-400 underline-offset-2 text-xs">หมายเหตุ</h4>
                      {(() => {
                        const remarkLines = data.remarks ? data.remarks.split('\n').filter(line => line.trim() !== '') : [];
                        if (remarkLines.length === 0) return <p className="text-xs text-gray-500">-</p>;
                        if (remarkLines.length === 1) return <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{remarkLines[0]}</p>;
                        return (
                          <ol className="list-decimal list-inside text-xs space-y-0.5">
                            {remarkLines.map((line, index) => (
                              <li key={index} className="text-gray-700 whitespace-pre-line">{line}</li>
                            ))}
                          </ol>
                        );
                      })()}
                    </div>

                </div>
            </td>

            {/* --- RIGHT BLOCK (Totals) --- */}
            <td colSpan={3} className="border border-gray-400 p-0 align-top h-[1px]">
                {/* ใช้ h-full เพื่อยืดเต็มความสูง td */}
                <div className="flex flex-col h-full text-xs">
                    
                    {/* รวม (Net Total) */}
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
                                    if (!isNaN(cleanVal) && onUpdateTotalOverride) onUpdateTotalOverride('net', cleanVal);
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
                    
                    {/* หลังหักส่วนลด */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right font-bold bg-gray-100 border-r border-gray-400 flex items-center justify-end">รวม (Total)</div>
                        <div className="w-1/2 p-1 text-right flex items-center justify-end font-medium">{formatCurrency(totalAfterDiscount)}</div>
                    </div>
                    
                    {/* VAT */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right text-gray-600 bg-gray-100 border-r border-gray-400 flex items-center justify-end">ภาษีมูลค่าเพิ่ม (VAT 7%)</div>
                        <div className="w-1/2 p-1 text-right text-gray-600 flex items-center justify-end">{formatCurrency(vatAmount)}</div>
                    </div>
                    
                    {/* ✅ Grand Total: ใช้ flex-1 เพื่อดันให้ยืดเต็มพื้นที่ที่เหลือจนสุดขอบล่าง */}
                    <div className="flex flex-1">
                        <div className="w-1/2 p-1 text-right font-bold text-primary bg-blue-50 border-r border-gray-400 flex items-center justify-end">
                            รวมเงินทั้งสิ้น<br/>(Grand Total)
                        </div>
                        <div className="w-1/2 p-1 text-right font-bold text-primary text-sm flex items-center justify-end bg-white">
                             <EditableCell 
                                isEditMode={isEditMode}
                                type="text"
                                align="right"
                                value={formatCurrency(grandTotal)}
                                onSave={(val) => {
                                    const cleanVal = parseFloat(val.replace(/,/g, ''));
                                    if (!isNaN(cleanVal) && onUpdateTotalOverride) onUpdateTotalOverride('grand', cleanVal);
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