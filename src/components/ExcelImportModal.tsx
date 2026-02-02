import { useState, useRef } from "react";
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
import { Upload, FileSpreadsheet, ArrowRight } from "lucide-react";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
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
  fields: ImportField[]; // ฟิลด์ที่ต้อง Map จาก Excel
  booleanFields?: BooleanField[]; // ฟิลด์ Boolean ที่ให้ติ๊กเลือก
  extraInputs?: ExtraInput[]; // ช่องกรอกข้อมูลเพิ่มเติม (เช่น เงื่อนไข)
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
  const [excelData, setExcelData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, string>>({});
  const [booleanValues, setBooleanValues] = useState<Record<string, boolean>>(
    booleanFields.reduce((acc, field) => ({ ...acc, [field.key]: field.defaultValue }), {})
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      // อ่านข้อมูลเป็น Array of Arrays (แถวแรกคือ Header)
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      if (data.length > 0) {
        setHeaders(data[0] as string[]); // แถวที่ 0 คือ Header
        setExcelData(data.slice(1, 6)); // เอาแค่ 5 แถวแรกมา Preview
        
        // Auto-Guess Mapping (เดาใจ)
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
    // อ่านไฟล์เต็มๆ อีกครั้ง หรือใช้ Logic นี้กับข้อมูลจริง
    // ในที่นี้เราจะส่ง Mapping กลับไปให้ Parent Process ข้อมูลจริง
    // แต่เพื่อความง่าย เราจะส่ง Raw Data + Mapping config กลับไป
    
    // 1. อ่านไฟล์จริงทั้งหมดอีกรอบ (เพื่อให้ได้ทุกแถว ไม่ใช่แค่ Preview)
    if (fileInputRef.current?.files?.[0]) {
        const file = fileInputRef.current.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
            
            // Process Data
            const processedData = jsonData.slice(1).map((row) => {
                const item: any = {};
                // Map Columns
                Object.entries(columnMapping).forEach(([colIndex, fieldKey]) => {
                    item[fieldKey] = row[Number(colIndex)];
                });
                return item;
            }).filter(item => Object.keys(item).length > 0); // กรองแถวว่าง

            onImport(processedData, booleanValues);
            onClose();
        };
        reader.readAsBinaryString(file);
    }
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
                <p className="text-xs text-muted-foreground mt-1">รองรับไฟล์ .xlsx, .xls</p>
            </div>
          </div>

          {headers.length > 0 && (
            <>
              {/* 2. Extra Inputs (เงื่อนไขต่างๆ - เฉพาะ Sales Program) */}
              {extraInputs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                    {extraInputs.map((input) => (
                        <div key={input.key} className="space-y-1">
                            <Label className="text-xs font-semibold text-blue-800">{input.label}</Label>
                            <Input 
                                value={input.value} 
                                onChange={(e) => input.onChange(e.target.value)}
                                className="bg-white h-8 text-sm"
                                placeholder={`ระบุ ${input.label}`}
                            />
                        </div>
                    ))}
                </div>
              )}

              {/* 3. Global Boolean Settings */}
              {booleanFields.length > 0 && (
                <div className="p-4 bg-muted rounded-lg border">
                    <h4 className="text-sm font-semibold mb-3">ตั้งค่าคอลัมน์ (ใช้ค่าเดียวกันทั้งตาราง)</h4>
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
                                <Label htmlFor={field.key} className="cursor-pointer">{field.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
              )}

              {/* 4. Column Mapping Table */}
              <div className="border rounded-md overflow-hidden">
                <div className="bg-muted px-4 py-2 text-sm font-semibold border-b">
                    จับคู่หัวตาราง (Mapping)
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
                                                if(val === "ignore") {
                                                    const newMap = {...columnMapping};
                                                    delete newMap[idx];
                                                    setColumnMapping(newMap);
                                                } else {
                                                    setColumnMapping({...columnMapping, [idx]: val});
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="h-8">
                                                <SelectValue placeholder="เลือกข้อมูล" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="ignore" className="text-muted-foreground">-- ไม่นำเข้า --</SelectItem>
                                                {fields.map(f => (
                                                    <SelectItem key={f.key} value={f.key}>
                                                        {f.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {excelData.map((row, rIdx) => (
                                <tr key={rIdx} className="border-b last:border-0 hover:bg-gray-50">
                                    {headers.map((_, cIdx) => (
                                        <td key={cIdx} className="p-2 truncate max-w-[150px] text-gray-600">
                                            {row[cIdx]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>ยกเลิก</Button>
          <Button onClick={handleConfirm} disabled={headers.length === 0} className="gap-2">
            <Upload className="w-4 h-4" /> นำเข้าข้อมูล
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};