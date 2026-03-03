import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, ArrowRight, RefreshCw } from "lucide-react";

// Types
export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: "text" | "number" | "enum"; 
  enumOptions?: { label: string; value: string }[]; 
}

export interface BooleanField {
  key: string;
  label: string;
  defaultValue: boolean;
}

export interface ExtraInput {
  key: string;
  label: string;
  value: string;
  onChange: (val: string) => void;
}

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fields: ImportField[];
  booleanFields?: BooleanField[];
  extraInputs?: ExtraInput[];
  onImport: (data: any[], booleanValues: Record<string, boolean>) => void;
}

export const ExcelImportModal = ({
  isOpen,
  onClose,
  title,
  fields,
  booleanFields = [],
  extraInputs = [],
  onImport,
}: ExcelImportModalProps) => {
  const [fullData, setFullData] = useState<any[][]>([]); 
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  
  const [enumValueMapping, setEnumValueMapping] = useState<Record<string, Record<string, string>>>({});
  
  const [booleanValues, setBooleanValues] = useState<Record<string, boolean>>(
    booleanFields.reduce((acc, field) => ({ ...acc, [field.key]: field.defaultValue }), {})
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🌟 1. อัปเกรดฟังก์ชันเดาค่า ให้ฉลาดเรื่องตัวเลข Phase มากขึ้น
  const guessEnumValue = (excelVal: string, options: { label: string; value: string }[]) => {
    if (!excelVal) return "";
    const rawStr = String(excelVal).toLowerCase();
    const normalized = rawStr.replace(/[^a-z0-9]/g, ""); 
    
    const exact = options.find(opt => opt.value.toLowerCase() === normalized || opt.label.toLowerCase() === rawStr);
    if (exact) return exact.value;

    // ✅ ดักตัวเลข 1 กับ 3 โดยเฉพาะ (ถ้า Excel มาเป็นเลข 3 ก็จะเจอ 3 Phase ทันที)
    const numMatch = rawStr.match(/\d+/);
    if (numMatch) {
        const num = numMatch[0];
        const optWithNum = options.find(opt => opt.label.includes(num) || opt.value.includes(num));
        if (optWithNum) return optWithNum.value;
    }

    const partialMatches = options.filter(opt => 
        normalized.includes(opt.value.toLowerCase().replace(/[^a-z0-9]/g, "")) || 
        opt.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(normalized)
    );

    if (partialMatches.length > 0) {
        partialMatches.sort((a, b) => b.value.length - a.value.length);
        return partialMatches[0].value;
    }

    // ✅ คืนค่า option ตัวแรกเสมอแทนที่จะคืนค่า "other" (เพื่อป้องกัน DB Error)
    return options[0]?.value || ""; 
  };

  // 🌟 2. ปรับ useEffect ให้ "รักษาค่าที่ผู้ใช้เลือกไว้" ไม่เขียนทับมั่วๆ ตอน Re-render
  useEffect(() => {
    setEnumValueMapping(prevMapping => {
      // Copy ค่าที่ผู้ใช้เคยจับคู่ไว้มาใช้งานต่อ
      const newMapping: Record<string, Record<string, string>> = { ...prevMapping };
      let hasChanges = false;
      
      Object.entries(columnMapping).forEach(([colIndex, fieldKey]) => {
          const fieldConfig = fields.find(f => f.key === fieldKey);
          
          if (fieldConfig?.type === "enum" && fieldConfig.enumOptions) {
              if (!newMapping[fieldKey]) {
                  newMapping[fieldKey] = {};
                  hasChanges = true;
              }
              
              fullData.slice(1).forEach(row => {
                  const val = row[Number(colIndex)];
                  if (val !== undefined && val !== null && String(val).trim() !== "") {
                      const strVal = String(val).trim();
                      
                      // ✅ ถ้าค่านั้นยังไม่เคยถูก Mapping ถึงจะยอมให้เดาค่าใหม่ (ห้ามทับของที่ผู้ใช้เปลี่ยนเอง)
                      if (!newMapping[fieldKey][strVal]) {
                          newMapping[fieldKey][strVal] = guessEnumValue(strVal, fieldConfig.enumOptions!);
                          hasChanges = true;
                      }
                  }
              });
          }
      });

      // ถ้าไม่มีอะไรเปลี่ยน ให้คืนค่าเดิมเพื่อลดการกระตุกของหน้าจอ
      return hasChanges ? newMapping : prevMapping;
    });

  }, [columnMapping, fullData, fields]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      
      if (ws["!merges"]) {
        ws["!merges"].forEach((merge) => {
          const startRef = XLSX.utils.encode_cell({ c: merge.s.c, r: merge.s.r });
          const sourceCell = ws[startRef];

          if (sourceCell) {
            for (let row = merge.s.r; row <= merge.e.r; row++) {
              for (let col = merge.s.c; col <= merge.e.c; col++) {
                const targetRef = XLSX.utils.encode_cell({ c: col, r: row });
                if (!ws[targetRef]) {
                   ws[targetRef] = { ...sourceCell }; 
                }
              }
            }
          }
        });
      }

      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      if (data.length > 0) {
        setHeaders(data[0] as string[]);
        setFullData(data); 
        
        const initialMapping: Record<number, string> = {};
        data[0].forEach((headerVal: any, index: number) => {
            const h = String(headerVal).toLowerCase();
            const found = fields.find(f => 
                h.includes(f.label.toLowerCase()) || 
                h.includes(f.key.toLowerCase())
            );
            if (found) {
                initialMapping[index] = found.key;
            }
        });
        setColumnMapping(initialMapping);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirm = () => {
    const processedData = fullData.slice(1).map((row) => {
        const item: any = {};
        
        Object.entries(columnMapping).forEach(([colIndex, fieldKey]) => {
            let rawValue = row[Number(colIndex)];
            const fieldConfig = fields.find(f => f.key === fieldKey);

            if (fieldConfig?.type === "enum" && rawValue !== undefined && rawValue !== null) {
                const strVal = String(rawValue).trim();
                const mappedVal = enumValueMapping[fieldKey]?.[strVal];
                
                // 🔴 DEBUG 1: แอบดูว่าตอนจับคู่มันได้ค่าอะไรมา
                console.log(`[ตรวจสอบ Enum] คอลัมน์: ${fieldKey} | ค่าใน Excel: "${strVal}" | ค่าที่จะนำไปใช้: "${mappedVal}"`);
                
                item[fieldKey] = mappedVal || fieldConfig.enumOptions?.[0]?.value || strVal; 
            } else {
                item[fieldKey] = rawValue;
            }
        });
        return item;
    }).filter(item => Object.keys(item).length > 0);

    // 🔴 DEBUG 2: แอบดูข้อมูลก้อนสุดท้ายก่อนส่งออกไปให้หน้าหลัก
    console.log("🔥 ข้อมูลที่ Modal กำลังจะส่งออกไป (Processed Data):", processedData);
    console.log("🔥 เช็คสถานะ Mapping ปัจจุบัน:", enumValueMapping);

    onImport(processedData, booleanValues);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>นำเข้าข้อมูล: {title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 border-2 border-dashed rounded-lg bg-muted/50">
            <div className="p-3 bg-white rounded-full shadow-sm">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
                <Input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".xlsx, .xls" 
                    onChange={handleFileUpload} 
                    className="cursor-pointer"
                />
            </div>
          </div>

          {headers.length > 0 && (
            <>
              {booleanFields.length > 0 && (
                <div className="p-4 bg-muted rounded-lg border">
                    <h4 className="text-sm font-semibold mb-3">ตั้งค่าคอลัมน์</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {booleanFields.map((field) => (
                            <div key={field.key} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={field.key} 
                                    checked={booleanValues[field.key]}
                                    onCheckedChange={(checked) => 
                                        setBooleanValues(prev => ({...prev, [field.key]: !!checked}))
                                    }
                                />
                                <Label htmlFor={field.key}>{field.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              <div className="border rounded-md overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-semibold border-b">
                    1. จับคู่หัวตาราง (Mapping Columns)
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700">
                            <tr>
                                {headers.map((header, idx) => (
                                    <th key={idx} className="p-2 border-b min-w-[150px]">
                                        <div className="mb-2 text-xs text-muted-foreground">{header}</div>
                                        <Select 
                                            value={columnMapping[idx] || "ignore"}
                                            onValueChange={(val) => {
                                                const newMap = {...columnMapping};
                                                if(val === "ignore") delete newMap[idx];
                                                else newMap[idx] = val;
                                                setColumnMapping(newMap);
                                            }}
                                        >
                                            <SelectTrigger className="h-8">
                                                <SelectValue placeholder="เลือกข้อมูล" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ignore">-- ไม่นำเข้า --</SelectItem>
                                                {fields.map(f => (
                                                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {fullData.slice(1, 4).map((row, rIdx) => (
                                <tr key={rIdx} className="border-b last:border-0 hover:bg-gray-50 opacity-60">
                                    {headers.map((_, cIdx) => (
                                        <td key={cIdx} className="p-2 truncate max-w-[150px]">{row[cIdx]}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>

              {Object.keys(enumValueMapping).length > 0 && (
                <div className="border rounded-md overflow-hidden mt-4">
                    <div className="bg-orange-50 px-4 py-2 text-sm font-semibold border-b border-orange-100 text-orange-800 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        2. ตรวจสอบการจับคู่ค่า (Value Mapping)
                    </div>
                    <div className="p-4 space-y-6">
                        {Object.entries(enumValueMapping).map(([fieldKey, mapping]) => {
                            const fieldConfig = fields.find(f => f.key === fieldKey);
                            return (
                                <div key={fieldKey}>
                                    <h5 className="text-sm font-medium mb-2">
                                        สำหรับคอลัมน์: <span className="text-primary">{fieldConfig?.label}</span>
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {Object.entries(mapping).map(([excelVal, systemVal]) => (
                                            <div key={excelVal} className="flex items-center gap-2 p-2 border rounded bg-white text-sm">
                                                <span className="font-mono text-xs bg-gray-100 px-1 rounded truncate max-w-[80px]" title={excelVal}>
                                                    {excelVal}
                                                </span>
                                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                                <Select 
                                                    value={systemVal} 
                                                    onValueChange={(newVal) => {
                                                        setEnumValueMapping(prev => ({
                                                            ...prev,
                                                            [fieldKey]: {
                                                                ...prev[fieldKey],
                                                                [excelVal]: newVal
                                                            }
                                                        }));
                                                    }}
                                                >
                                                    <SelectTrigger className="h-7 min-w-[100px]">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {fieldConfig?.enumOptions?.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value}>
                                                                {opt.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleConfirm} disabled={headers.length === 0} className="gap-2">
            <Upload className="w-4 h-4" /> ยืนยันนำเข้า
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};