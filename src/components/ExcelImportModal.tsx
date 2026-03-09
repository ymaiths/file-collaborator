import { useState, useRef, useEffect, useMemo } from "react";
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
  onBooleanChange?: (values: Record<string, boolean>) => void; 
}

export const ExcelImportModal = ({
  isOpen,
  onClose,
  title,
  fields,
  booleanFields = [],
  extraInputs = [],
  onImport,
  onBooleanChange,
}: ExcelImportModalProps) => {
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

  useEffect(() => {
    if (onBooleanChange) {
      onBooleanChange(booleanValues);
    }
  }, [booleanValues]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayFields = useMemo(() => {
    let expanded: ImportField[] = [];
    fields.forEach(f => {
      if (f.key === 'kw_min') {
        expanded.push({ ...f, key: 'kw_min_watt', label: `${f.label} (Watt)` });
        expanded.push({ ...f, key: 'kw_min_kw', label: `${f.label} (kW)` });
      } else if (f.key === 'kw_max') {
        expanded.push({ ...f, key: 'kw_max_watt', label: `${f.label} (Watt)` });
        expanded.push({ ...f, key: 'kw_max_kw', label: `${f.label} (kW)` });
      } else {
        expanded.push(f);
      }
    });
    return expanded;
  }, [fields]);

  useEffect(() => {
    setColumnMapping(prev => {
      const newMap = { ...prev };
      let hasChanges = false;
      const validKeys = displayFields.map(f => f.key);
      
      Object.entries(newMap).forEach(([idx, key]) => {
        if (!validKeys.includes(key)) {
          delete newMap[Number(idx)];
          hasChanges = true;
        }
      });
      return hasChanges ? newMap : prev;
    });
  }, [displayFields]);

  const getAvailableFields = (currentColIdx: number) => {
    const otherSelectedKeys = Object.entries(columnMapping)
      .filter(([idx]) => Number(idx) !== currentColIdx)
      .map(([_, key]) => key);

    return displayFields.filter(opt => {
      if (otherSelectedKeys.includes(opt.key)) return false;
      if (opt.key.startsWith('kw_min_') && otherSelectedKeys.some(k => k.startsWith('kw_min_'))) return false;
      if (opt.key.startsWith('kw_max_') && otherSelectedKeys.some(k => k.startsWith('kw_max_'))) return false;
      return true;
    });
  };

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
      
      Object.entries(columnMapping).forEach(([colIndex, mappedKey]) => {
          let fieldKey = mappedKey;
          if (mappedKey.startsWith('kw_min_')) fieldKey = 'kw_min';
          if (mappedKey.startsWith('kw_max_')) fieldKey = 'kw_max';

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

  const processSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    setEnumValueMapping({});

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
          const found = displayFields.find(f => 
              h.includes(f.label.toLowerCase()) || 
              h.includes(f.key.toLowerCase()) ||
              f.label.toLowerCase().includes(h)
          );
          if (found) {
              const alreadySelected = Object.values(initialMapping);
              if (!alreadySelected.includes(found.key)) {
                  const isMinConflict = found.key.startsWith('kw_min_') && alreadySelected.some(k => k.startsWith('kw_min_'));
                  const isMaxConflict = found.key.startsWith('kw_max_') && alreadySelected.some(k => k.startsWith('kw_max_'));
                  if (!isMinConflict && !isMaxConflict) {
                      initialMapping[index] = found.key;
                  }
              }
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
      
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      
      const initialSheet = wb.SheetNames[0];
      setSelectedSheet(initialSheet);
      processSheetData(wb, initialSheet);
    };
    reader.readAsBinaryString(file);
  };

  const handleConfirm = () => {
    const processedData = fullData.slice(1).map((row) => {
        const isEmptyRow = row.every(cell => cell === undefined || cell === null || String(cell).trim() === "");
        if (isEmptyRow) return null;

        const item: any = {};
        
        Object.entries(columnMapping).forEach(([colIndex, mappedKey]) => {
            let rawValue = row[Number(colIndex)];
            
            let fieldKey = mappedKey;
            let multiplier = 1;

            if (mappedKey === 'kw_min_kw') { fieldKey = 'kw_min'; multiplier = 1000; }
            if (mappedKey === 'kw_min_watt') { fieldKey = 'kw_min'; multiplier = 1; }
            if (mappedKey === 'kw_max_kw') { fieldKey = 'kw_max'; multiplier = 1000; }
            if (mappedKey === 'kw_max_watt') { fieldKey = 'kw_max'; multiplier = 1; }

            const fieldConfig = fields.find(f => f.key === fieldKey);

            if (fieldConfig?.type === "enum" && rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "") {
                const strVal = String(rawValue).trim();
                const mappedVal = enumValueMapping[fieldKey]?.[strVal];
                item[fieldKey] = mappedVal || fieldConfig.enumOptions?.[0]?.value || strVal; 
            } else {
                let finalVal = (rawValue === undefined || String(rawValue).trim() === "") ? null : rawValue;
                if (finalVal !== null && multiplier !== 1) {
                    const num = parseFloat(finalVal);
                    if (!isNaN(num)) finalVal = num * multiplier;
                }
                item[fieldKey] = finalVal;
            }
        });

        // 🌟 กฎพิเศษ: ถ้าขนาด >= 20,000 Watt ให้เป็น 3 Phase อัตโนมัติ 🌟
        const minW = Number(item['kw_min']) || 0;
        const maxW = Number(item['kw_max']) || 0;
        
        if (minW >= 20000 || maxW >= 20000) {
            item['phase'] = 'three_phase'; // บังคับเป็น 3 Phase ทันที
        }

        return item;
    }).filter(item => item !== null && Object.keys(item).length > 0);

    onImport(processedData, booleanValues);
    
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
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>นำเข้าข้อมูล: {title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 w-full max-w-full min-w-0">
          <div className="flex flex-col md:flex-row items-end gap-4 p-5 border-2 border-dashed rounded-xl bg-muted/20 w-full">
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

              <div className="border rounded-md flex flex-col w-full overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-semibold border-b shrink-0">
                    1. จับคู่หัวตาราง (Mapping Columns)
                </div>
                <div className="w-full overflow-x-auto pb-1">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                        <thead className="bg-gray-50 text-gray-700">
                            <tr>
                                {headers.map((header, idx) => (
                                    <th key={idx} className="p-3 border-b min-w-[160px] max-w-[250px]">
                                        <div className="mb-2 text-xs text-muted-foreground truncate" title={header}>{header}</div>
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
                                                {getAvailableFields(idx).map(f => (
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
                                          <td key={cIdx} className="p-3 truncate max-w-[250px] text-xs" title={row[cIdx]}>{row[cIdx]}</td>
                                      ))}
                                  </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
              </div>

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
                                                    <SelectTrigger className="h-7 w-[120px] shrink-0 text-xs">
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
  );
};