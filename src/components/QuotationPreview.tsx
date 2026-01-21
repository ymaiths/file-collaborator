import React from "react";

// Helper จัดรูปแบบเงิน
// ✅ แก้ไข: ถ้าเป็น 0 หรือ null/undefined ให้ส่งคืนค่าว่าง "" แทนเครื่องหมาย -
const formatCurrency = (num: number | undefined | null) => {
  if (num === undefined || num === null || isNaN(num) || num === 0) return "";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

// Helper เช็คข้อความ ถ้าเป็น "-" ให้ส่งคืนค่าว่าง
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
  items: any[];
  paymentTerms: string[];
  warrantyTerms: string[];
  remarks: string;
  vatRate: number;
  discount?: number;
}

export const QuotationPreview = ({ data }: { data: PreviewData | null }) => {
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
  
  const calcUnit = (total: number, qty: number) => {
      if (!qty || qty === 0) return 0;
      return total / qty;
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
            <tr key={`a-${idx}`}>
              <td className={`${borderClass} text-center`}>{idx + 1}</td>
              <td className={`${borderClass}`}>{item.name}</td>
              {/* ✅ ใช้ formatText เพื่อเว้นว่างถ้าไม่มีข้อมูล */}
              <td className={`${borderClass} text-center`}>{formatText(item.brand)}</td>
              <td className={`${borderClass} text-center`}>{item.qty}</td>
              <td className={`${borderClass} text-center`}>{item.unit}</td>
              
              {/* ✅ ใช้ formatCurrency แบบใหม่ (0 เป็นค่าว่าง) */}
              <td className={`${borderClass} text-right`}>{formatCurrency(calcUnit(item.matUnit, item.qty))}</td>
              <td className={`${borderClass} text-right bg-gray-50`}>{formatCurrency(item.matUnit)}</td>
              <td className={`${borderClass} text-right`}>{formatCurrency(calcUnit(item.labUnit, item.qty))}</td>
              <td className={`${borderClass} text-right bg-gray-50`}>{formatCurrency(item.labUnit)}</td>
              <td className={`${borderClass} text-right font-semibold`}>{formatCurrency(item.total)}</td>
            </tr>
          ))}

          {/* --- Section B --- */}
          {itemsB.length > 0 && (
            <tr className="bg-blue-50">
              <td colSpan={10} className={`${borderClass} font-bold text-blue-800`}>
                B. Project Management & Operation
              </td>
            </tr>
          )}
          {itemsB.map((item, idx) => (
            <tr key={`b-${idx}`}>
              <td className={`${borderClass} text-center`}>{itemsA.length + idx + 1}</td>
              <td className={`${borderClass}`}>{item.name}</td>
              {/* ✅ เอาขีด - ออก ปล่อยว่าง */}
              <td className={`${borderClass} text-center`}></td> 
              <td className={`${borderClass} text-center`}>{item.qty}</td>
              <td className={`${borderClass} text-center`}>{item.unit}</td>
              {/* ✅ เอาขีด - ออก ปล่อยว่าง */}
              <td className={`${borderClass} text-right`}></td>
              <td className={`${borderClass} text-right bg-gray-50`}></td>
              <td className={`${borderClass} text-right`}></td>
              <td className={`${borderClass} text-right bg-gray-50`}></td>
              <td className={`${borderClass} text-right font-semibold`}>{formatCurrency(item.total)}</td>
            </tr>
          ))}
        </tbody>
        
        {/* --- FOOTER STRUCTURE --- */}
        <tfoot>
          <tr>
            {/* 1. LEFT BLOCK (Terms & Remarks) */}
            <td colSpan={7} className="border border-gray-400 p-0 align-top h-full">
                <div className="flex h-full min-h-[160px]">
                    <div className="w-1/2 flex flex-col border-r border-gray-400">
                        <div className="flex-1 p-2 border-b border-gray-400">
                             <h4 className="font-bold text-gray-800 underline mb-1 text-xs">เงื่อนไขการชำระเงิน</h4>
                             <ul className="list-none space-y-0.5 pl-0 text-[10px] text-gray-600">
                                {data.paymentTerms.map((t, i) => {
                                  // กรองค่าที่เป็น - หรือว่างออก
                                  const text = formatText(t);
                                  if (!text) return null;
                                  return <li key={i}>{data.paymentTerms.length > 1 && `${i+1}. `}{text}</li>
                                })}
                             </ul>
                        </div>
                        <div className="flex-1 p-2 bg-gray-50">
                             <h4 className="font-bold text-gray-800 underline mb-1 text-xs">หมายเหตุ</h4>
                             <p className="text-[10px] text-gray-600 whitespace-pre-wrap">
                                {formatText(data.remarks)}
                             </p>
                        </div>
                    </div>

                    <div className="w-1/2 p-2">
                        <h4 className="font-bold text-gray-800 underline mb-1 text-xs">เงื่อนไขการรับประกัน</h4>
                        <ul className="list-none space-y-0.5 pl-0 text-[10px] text-gray-600">
                             {data.warrantyTerms.map((t, i) => {
                               const text = formatText(t);
                               if (!text) return null;
                               return <li key={i}>{data.warrantyTerms.length > 1 && `${i+1}. `}{text}</li>
                             })}
                        </ul>
                    </div>
                </div>
            </td>

            {/* 2. RIGHT BLOCK (Totals) */}
            <td colSpan={3} className="border border-gray-400 p-0 align-top">
                <div className="flex flex-col h-full text-xs">
                    {/* Row 1: Total */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right font-bold bg-gray-100 border-r border-gray-400 flex items-center justify-end">รวม (Total)</div>
                        <div className="w-1/2 p-1 text-right flex items-center justify-end font-medium">{formatCurrency(totalAmount)}</div>
                    </div>
                    
                    {/* Row 2: Discount */}
                    {/* ✅ แก้ไข: ลบ text-red-600 ออก และแสดงค่าว่างถ้า discount เป็น 0 */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right font-bold bg-gray-100 border-r border-gray-400 flex items-center justify-end">ส่วนลด (Discount)</div>
                        <div className="w-1/2 p-1 text-right flex items-center justify-end">
                            {discount > 0 ? `-${formatCurrency(discount)}` : ""}
                        </div>
                    </div>
                    
                    {/* Row 3: Total after discount */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right font-bold bg-gray-100 border-r border-gray-400 flex items-center justify-end">รวม (Total)</div>
                        <div className="w-1/2 p-1 text-right flex items-center justify-end font-medium">{formatCurrency(totalAfterDiscount)}</div>
                    </div>
                    
                    {/* Row 4: VAT */}
                    <div className="flex border-b border-gray-400">
                        <div className="w-1/2 p-1 text-right text-gray-600 bg-gray-100 border-r border-gray-400 flex items-center justify-end">ภาษีมูลค่าเพิ่ม (VAT 7%)</div>
                        <div className="w-1/2 p-1 text-right text-gray-600 flex items-center justify-end">{formatCurrency(vatAmount)}</div>
                    </div>
                    
                    {/* Row 5: Grand Total */}
                    <div className="flex flex-1">
                        <div className="w-1/2 p-1 text-right font-bold text-primary bg-blue-50 border-r border-gray-400 flex items-center justify-end">รวมเงินทั้งสิ้น<br/>(Grand Total)</div>
                        <div className="w-1/2 p-1 text-right font-bold text-primary text-sm flex items-center justify-end">{formatCurrency(grandTotal)}</div>
                    </div>
                </div>
            </td>
          </tr>
        </tfoot>
      </table>

    </div>
  );
};