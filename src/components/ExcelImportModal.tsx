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
  type?: "text" | "number" | "enum"; // เพิ่ม type enum
  enumOptions?: { label: string; value: string }[]; // ตัวเลือกสำหรับ enum
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
  const [fullData, setFullData] = useState<any[][]>([]); // เก็บข้อมูลทั้งหมด
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  
  // State สำหรับเก็บการจับคู่ค่า Enum: { fieldKey: { excelValue: systemValue } }
  const [enumValueMapping, setEnumValueMapping] = useState<Record<string, Record<string, string>>>({});
  
  const [booleanValues, setBooleanValues] = useState<Record<string, boolean>>(
    booleanFields.reduce((acc, field) => ({ ...acc, [field.key]: field.defaultValue }), {})
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ฟังก์ชันเดาค่า Enum (Fuzzy Match อย่างง่าย)
  const guessEnumValue = (excelVal: string, options: { label: string; value: string }[]) => {
    if (!excelVal) return "";
    const normalized = String(excelVal).toLowerCase().replace(/[^a-z0-9]/g, ""); // ตัดอักขระพิเศษ
    
    // 1. หาที่ตรงกันเป๊ะๆ (Exact Match)
    const exact = options.find(opt => opt.value.toLowerCase() === normalized || opt.label.toLowerCase() === excelVal.toLowerCase());
    if (exact) return exact.value;

    // ✅ 2. หาที่มีคำคล้ายกัน (Contains) แต่เลือกตัวที่ "ยาวที่สุด" (Longest Match)
    // เพื่อป้องกันกรณีเลือก 'huawei' แทนที่จะเป็น 'huawei_optimizer'
    const partialMatches = options.filter(opt => 
        normalized.includes(opt.value.toLowerCase()) || 
        opt.label.toLowerCase().includes(normalized) ||
        normalized.includes(opt.label.toLowerCase().replace(/[^a-z0-9]/g, "")) // เช็ค Label แบบตัดอักขระด้วย
    );

    if (partialMatches.length > 0) {
        // เรียงลำดับตามความยาวของ value (จากยาวไปสั้น) แล้วเอาตัวแรก
        // เช่น ['huawei', 'huawei_optimizer'] -> เรียงเป็น ['huawei_optimizer', 'huawei'] -> เลือกตัวแรก
        partialMatches.sort((a, b) => b.value.length - a.value.length);
        return partialMatches[0].value;
    }

    return "other"; // Default fallback
  };

  // เมื่อ columnMapping เปลี่ยน ให้คำนวณ Unique Values ของ Enum columns
  useEffect(() => {
    const newMapping: Record<string, Record<string, string>> = {};
    
    // หาว่า Column ไหนบ้างที่ Map เข้ากับ Field ที่เป็น Enum
    Object.entries(columnMapping).forEach(([colIndex, fieldKey]) => {
        const fieldConfig = fields.find(f => f.key === fieldKey);
        
        if (fieldConfig?.type === "enum" && fieldConfig.enumOptions) {
            const uniqueValues = new Set<string>();
            // สแกนหาค่าที่ไม่ซ้ำใน Column นั้นจากข้อมูลทั้งหมด
            fullData.slice(1).forEach(row => {
                const val = row[Number(colIndex)];
                if (val !== undefined && val !== null && String(val).trim() !== "") {
                    uniqueValues.add(String(val).trim());
                }
            });

            // สร้าง Auto Map สำหรับแต่ละค่า
            const valueMap: Record<string, string> = {};
            uniqueValues.forEach(val => {
                valueMap[val] = guessEnumValue(val, fieldConfig.enumOptions!);
            });
            newMapping[fieldKey] = valueMap;
        }
    });
    setEnumValueMapping(newMapping);

  }, [columnMapping, fullData, fields]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      
      // ✅ 1. เพิ่ม Logic จัดการ Merge Cells ตรงนี้ครับ
      if (ws["!merges"]) {
        ws["!merges"].forEach((merge) => {
          // 1.1 หาพิกัดเซลล์แม่ (ซ้ายบน)
          const startRef = XLSX.utils.encode_cell({ c: merge.s.c, r: merge.s.r });
          const sourceCell = ws[startRef];

          // ถ้าเซลล์แม่มีค่า (และไม่ใช่ undefined)
          if (sourceCell) {
            // 1.2 วนลูปทุกเซลล์ที่อยู่ใน Range การ Merge
            for (let row = merge.s.r; row <= merge.e.r; row++) {
              for (let col = merge.s.c; col <= merge.e.c; col++) {
                const targetRef = XLSX.utils.encode_cell({ c: col, r: row });
                
                // ถ้าเซลล์เป้าหมายไม่มีค่า (เป็นช่องว่างจากการ Merge) ให้ก๊อปปี้ค่าจากเซลล์แม่ใส่เข้าไป
                if (!ws[targetRef]) {
                   // Clone object เพื่อไม่ให้กระทบ reference เดิม
                   ws[targetRef] = { ...sourceCell }; 
                }
              }
            }
          }
        });
      }

      // ✅ 2. แปลงเป็น JSON หลังจากเติมค่าเสร็จแล้ว
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      if (data.length > 0) {
        setHeaders(data[0] as string[]);
        setFullData(data); 
        
        // ... (Logic เดิมของคุณ) ...
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
    // Process Data
    const processedData = fullData.slice(1).map((row) => {
        const item: any = {};
        
        Object.entries(columnMapping).forEach(([colIndex, fieldKey]) => {
            let rawValue = row[Number(colIndex)];
            const fieldConfig = fields.find(f => f.key === fieldKey);

            // ถ้าเป็น Enum ให้แปลงค่าตาม Mapping ที่ผู้ใช้เลือก
            if (fieldConfig?.type === "enum" && rawValue) {
                const strVal = String(rawValue).trim();
                const mappedVal = enumValueMapping[fieldKey]?.[strVal];
                // ถ้า Map ได้ให้ใช้ค่า Map, ถ้าไม่ได้ให้ลองเดาครั้งสุดท้ายหรือส่ง raw (ซึ่งอาจจะ error ที่ db ถ้าไม่ตรง)
                item[fieldKey] = mappedVal || "other"; 
            } else {
                item[fieldKey] = rawValue;
            }
        });
        return item;
    }).filter(item => Object.keys(item).length > 0);

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
          {/* 1. File Upload */}
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
              {/* Extra Inputs & Global Booleans (เหมือนเดิม) */}
              {/* ... (Copy Code ส่วน Extra Inputs & BooleanFields เดิมมาใส่ตรงนี้ได้เลย) ... */}
              {extraInputs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    {extraInputs.map((input) => (
                        <div key={input.key} className="space-y-1">
                            <Label className="text-xs font-semibold text-blue-800">{input.label}</Label>
                            <Input 
                                value={input.value} 
                                onChange={(e) => input.onChange(e.target.value)}
                                className="bg-white h-8 text-sm"
                            />
                        </div>
                    ))}
                </div>
              )}
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

              {/* 2. Column Mapping */}
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
                        {/* Preview 3 Rows */}
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

              {/* 3. Enum Value Mapping (ส่วนใหม่!) */}
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