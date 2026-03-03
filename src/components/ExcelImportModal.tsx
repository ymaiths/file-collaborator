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
import { Upload, FileSpreadsheet, ArrowRight, RefreshCw, Layers } from "lucide-react";

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
  // 🌟 เพิ่ม States สำหรับจัดการเรื่อง Sheet
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");

  const [fullData, setFullData] = useState<any[][]>([]); 
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [enumValueMapping, setEnumValueMapping] = useState<Record<string, Record<string, string>>>({});
  
  const [booleanValues, setBooleanValues] = useState<Record<string, boolean>>(
    booleanFields.reduce((acc, field) => ({ ...acc, [field.key]: field.defaultValue }), {})
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const guessEnumValue = (excelVal: string, options: { label: string; value: string }[]) => {
    if (!excelVal) return "";
    const rawStr = String(excelVal).toLowerCase();
    const normalized = rawStr.replace(/[^a-z0-9]/g, ""); 
    
    const exact = options.find(opt => opt.value.toLowerCase() === normalized || opt.label.toLowerCase() === rawStr);
    if (exact) return exact.value;

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
    return options[0]?.value || ""; 
  };

  useEffect(() => {
    setEnumValueMapping(prevMapping => {
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
                      if (!newMapping[fieldKey][strVal]) {
                          newMapping[fieldKey][strVal] = guessEnumValue(strVal, fieldConfig.enumOptions!);
                          hasChanges = true;
                      }
                  }
              });
          }
      });
      return hasChanges ? newMapping : prevMapping;
    });
  }, [columnMapping, fullData, fields]);

  // 🌟 ฟังก์ชันแยกสำหรับประมวลผลข้อมูลใน Sheet ที่เลือก
  const processSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    // เคลียร์ค่า Mapping เก่าทิ้งเมื่อเปลี่ยนชีท
    setEnumValueMapping({});

    // จัดการเซลล์ที่ถูก Merge (ถ้ามี)
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
    } else {
      setHeaders([]);
      setFullData([]);
      setColumnMapping({});
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      
      // 🌟 เก็บ Workbook และรายชื่อชีทเอาไว้
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      
      // 🌟 เลือกชีทแรกเป็นค่าเริ่มต้น และดึงข้อมูลมาแสดง
      const initialSheet = wb.SheetNames[0];
      setSelectedSheet(initialSheet);
      processSheetData(wb, initialSheet);
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirm = () => {
    const processedData = fullData.slice(1).map((row) => {
        // 🌟 ดักจับแถวว่าง ถ้าแถวไหนไม่มีข้อมูลเลย ให้ข้ามไป
        const isEmptyRow = row.every(cell => 
            cell === undefined || cell === null || String(cell).trim() === ""
        );
        if (isEmptyRow) return null;

        const item: any = {};
        
        Object.entries(columnMapping).forEach(([colIndex, fieldKey]) => {
            let rawValue = row[Number(colIndex)];
            const fieldConfig = fields.find(f => f.key === fieldKey);

            if (fieldConfig?.type === "enum" && rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "") {
                const strVal = String(rawValue).trim();
                const mappedVal = enumValueMapping[fieldKey]?.[strVal];
                item[fieldKey] = mappedVal || fieldConfig.enumOptions?.[0]?.value || strVal; 
            } else {
                item[fieldKey] = (rawValue === undefined || String(rawValue).trim() === "") ? null : rawValue;
            }
        });
        return item;
    }).filter(item => item !== null && Object.keys(item).length > 0);

    onImport(processedData, booleanValues);
    
    // เคลียร์ค่าเมื่อปิด Modal
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if(!open) {
        setWorkbook(null);
        setSheetNames([]);
        setSelectedSheet("");
      }
      onClose();
    }}>
      {/* 🌟 1. จำกัดความกว้าง Dialog สูงสุดที่ 95vw เพื่อไม่ให้หน้าต่างล้นจอเด็ดขาด */}
      <DialogContent className="max-w-3xl w-[70vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>นำเข้าข้อมูล: {title}</DialogTitle>
        </DialogHeader>

        {/* 🌟 2. ใส่ min-w-0 เพื่อบังคับให้ Flex ไม่ขยายตัวตามเนื้อหาด้านใน */}
        <div className="flex flex-col gap-4 w-full max-w-full min-w-0">
          {/* อัปโหลดไฟล์ */}
          <div className="flex flex-col md:flex-row items-end gap-4 p-5 border-2 border-dashed rounded-xl bg-muted/20 w-full">
            
            {/* ฝั่งซ้าย: เลือกไฟล์ */}
            <div className="flex-1 w-full space-y-2 min-w-0">
              <Label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="p-1.5 bg-green-100 text-green-700 rounded-md shadow-sm shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <span className="truncate">1. อัปโหลดไฟล์ Excel</span>
              </Label>
              <Input 
                ref={fileInputRef}
                type="file" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload} 
                className="cursor-pointer bg-white h-10 w-full"
              />
            </div>

            {/* ฝั่งขวา: เลือกชีท */}
            <div className="flex-1 w-full space-y-2 min-w-0">
              <Label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-md shadow-sm shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <span className="truncate">2. เลือกชีทข้อมูล (Sheet)</span>
              </Label>
              <Select
                value={selectedSheet}
                onValueChange={(newSheet) => {
                  setSelectedSheet(newSheet);
                  if (workbook) processSheetData(workbook, newSheet);
                }}
                disabled={sheetNames.length === 0}
              >
                <SelectTrigger className="w-full bg-white h-10 border-input">
                  <SelectValue placeholder={sheetNames.length > 0 ? "เลือกชีทที่ต้องการ..." : "รอการอัปโหลดไฟล์..."} />
                </SelectTrigger>
                <SelectContent>
                  {sheetNames.map((sheet, index) => (
                    <SelectItem key={index} value={sheet}>
                      {sheet}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
          </div>

          {headers.length > 0 && (
            <div className="flex flex-col gap-4 w-full min-w-0">
              {booleanFields.length > 0 && (
                <div className="p-4 bg-muted rounded-lg border w-full">
                    <h4 className="text-sm font-semibold mb-3">ตั้งค่าคอลัมน์</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {booleanFields.map((field) => (
                            <div key={field.key} className="flex items-center space-x-2">
                                <Checkbox 
                                    id={field.key} 
                                    checked={booleanValues[field.key]}
                                    onCheckedChange={(checked) => 
                                        setBooleanValues(prev => ({...prev, [field.key]: !!checked}))
                                    }
                                />
                                <Label htmlFor={field.key} className="truncate">{field.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              {/* 🌟 3. ตารางถูกจับใส่กรง (overflow-hidden) แล้วให้ Scroll วิ่งเฉพาะด้านใน */}
              <div className="border rounded-md flex flex-col w-full overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-semibold border-b shrink-0">
                    1. จับคู่หัวตาราง (Mapping Columns)
                </div>
                {/* 👇 ใช้ overflow-x-auto เพื่อให้ตารางมี Scroll ซ้าย-ขวา */}
                <div className="w-full overflow-x-auto pb-1">
                    {/* 👇 whitespace-nowrap ห้ามข้อความตกบรรทัด เพื่อบังคับให้ตารางกว้างออกไป และเกิด Scroll bar */}
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-700">
                            <tr>
                                {headers.map((header, idx) => (
                                    <th key={idx} className="p-3 border-b min-w-[80px] max-w-[100px]">
                                        <div className="mb-1 text-xs text-muted-foreground truncate" title={header}>{header}</div>
                                        <Select 
                                            value={columnMapping[idx] || "ignore"}
                                            onValueChange={(val) => {
                                                const newMap = {...columnMapping};
                                                if(val === "ignore") delete newMap[idx];
                                                else newMap[idx] = val;
                                                setColumnMapping(newMap);
                                            }}
                                        >
                                            <SelectTrigger className="h-8 bg-white w-full">
                                                <SelectValue placeholder="เลือกข้อมูล" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ignore" className="text-xs text-muted-foreground">-- ไม่นำเข้า --</SelectItem>
                                                {fields.map(f => (
                                                    <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {fullData.slice(1, 4).map((row, rIdx) => {
                                const isEmpty = row.every(cell => cell === undefined || cell === null || String(cell).trim() === "");
                                if (isEmpty) return null;
                                return (
                                  <tr key={rIdx} className="border-b last:border-0 hover:bg-gray-50 opacity-60">
                                      {headers.map((_, cIdx) => (
                                          <td key={cIdx} className="p-3 truncate max-w-[150px] text-xs" title={row[cIdx]}>{row[cIdx]}</td>
                                      ))}
                                  </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
              </div>

              {/* 🌟 4. Value Mapping ถูกจับใส่กรอบให้เป็นระเบียบ */}
              {Object.keys(enumValueMapping).length > 0 && (
                <div className="border rounded-md flex flex-col w-full overflow-hidden mt-2">
                    <div className="bg-orange-50 px-4 py-2 text-sm font-semibold border-b border-orange-100 text-orange-800 flex items-center gap-2 shrink-0">
                        <RefreshCw className="w-4 h-4 shrink-0" />
                        <span className="truncate">2. ตรวจสอบการจับคู่ค่า (Value Mapping)</span>
                    </div>
                    <div className="p-4 w-full">
                        {Object.entries(enumValueMapping).map(([fieldKey, mapping]) => {
                            const fieldConfig = fields.find(f => f.key === fieldKey);
                            return (
                                <div key={fieldKey} className="mb-4 last:mb-0">
                                    <h5 className="text-sm font-medium mb-3">
                                        สำหรับคอลัมน์: <span className="text-primary">{fieldConfig?.label}</span>
                                    </h5>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                                        {Object.entries(mapping).map(([excelVal, systemVal]) => (
                                            <div key={excelVal} className="flex items-center gap-2 p-1.5 border rounded bg-white text-sm w-full overflow-hidden">
                                                {/* min-w-0 ตรงนี้สำคัญมาก เพื่อให้ข้อความยาวๆ โดนตัดด้วย ... แทนที่จะดันกล่องให้พัง */}
                                                <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded truncate flex-1 min-w-0" title={excelVal}>
                                                    {excelVal}
                                                </span>
                                                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
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
                                                    <SelectTrigger className="h-7 w-[150px] shrink-0 text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {fieldConfig?.enumOptions?.map(opt => (
                                                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
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
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 pt-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleConfirm} disabled={headers.length === 0} className="gap-2">
            <Upload className="w-4 h-4" /> ยืนยันนำเข้า
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );};