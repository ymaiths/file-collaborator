import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Minus, Plus, Copy, Upload, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { ExcelImportModal } from "./ExcelImportModal";

type InverterBrand = Database["public"]["Enums"]["inverter_brand"];
type ElectronicPhase = Database["public"]["Enums"]["electronic_phase"];

interface SalePackagePrice {
  id: string;
  inverter_brand: InverterBrand;
  electronic_phase: ElectronicPhase;
  kw_min: number;
  kw_max: number | null;
  is_exact_kw: boolean;
  price: number;
  is_exact_price: boolean;
  price_percentage: number | null;
  price_exact: number | null;
}

interface SalesProgramDetailProps {
  programName: string;
  programId: string;
  onBack: () => void;
}

export const SalesProgramDetail = ({
  programName,
  programId,
  onBack,
}: SalesProgramDetailProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [prices, setPrices] = useState<SalePackagePrice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Terms State
  const [paymentTerms, setPaymentTerms] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [note, setNote] = useState("");

  const [newBrandInput, setNewBrandInput] = useState("");
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [customBrandNames, setCustomBrandNames] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  
  // Modal Temp State
  const [tempPaymentTerms, setTempPaymentTerms] = useState("");
  const [tempWarrantyTerms, setTempWarrantyTerms] = useState("");
  const [tempNote, setTempNote] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchPackageDetails(), fetchPrices()]);
      setLoading(false);
    };
    fetchData();
  }, [programId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowBrandSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPackageDetails = async () => {
    try {
      const { data, error } = await supabase
        .from("sale_packages")
        .select("payment_terms, warranty_terms, note")
        .eq("id", programId)
        .single();

      if (error) throw error;
      if (data) {
        setPaymentTerms(data.payment_terms || "");
        setWarrantyTerms(data.warranty_terms || "");
        setNote(data.note || "");
      }
    } catch (error) {
      console.error("Error fetching package details:", error);
    }
  };

  const fetchPrices = async () => {
    try {
      const { data, error } = await supabase
        .from("sale_package_prices")
        .select("*")
        .eq("sale_package_id", programId)
        .order("inverter_brand")
        .order("kw_min");

      if (error) throw error;
      setPrices(data || []);
    } catch (error) {
      console.error("Error fetching prices:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลราคาได้",
        variant: "destructive",
      });
    }
  };

  const openImportModal = (mode: "append" | "replace") => {
    setTempPaymentTerms(paymentTerms);
    setTempWarrantyTerms(warrantyTerms);
    setTempNote(note);
    setImportMode(mode);
    setIsImportModalOpen(true);
  };

  const handleImportSales = async (data: any[], booleanValues: Record<string, boolean>) => {
    // 🔥 Logic เลือกค่า Boolean:
    // ถ้า Replace: ใช้ค่าจาก Checkbox ใน Modal (booleanValues)
    // ถ้า Append: ใช้ค่าจากข้อมูลที่มีอยู่แล้ว (prices[0]) เพื่อให้ Pattern เหมือนกัน
    const currentIsExactKw = importMode === "replace" 
        ? booleanValues.is_exact_kw 
        : (prices.length > 0 ? prices[0].is_exact_kw : true); // Default true ถ้ายังไม่มีข้อมูล

    const newItems = data.map((row) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      inverter_brand: (row.brand ? String(row.brand).toLowerCase().trim().replace(/\s+/g, '_') : "other") as InverterBrand,
      electronic_phase: (row.phase && (String(row.phase).includes("3"))) ? "three_phase" : "single_phase" as ElectronicPhase,
      
      // ใช้ค่า Boolean ที่เลือก logic มาแล้วด้านบน
      is_exact_kw: currentIsExactKw,
      kw_min: parseFloat(row.kw_min) || 0,
      kw_max: !currentIsExactKw ? (parseFloat(row.kw_max) || 0) : null,
      
      price: parseFloat(row.price) || 0,
      is_exact_price: true,
      price_exact: parseFloat(row.price) || 0,
      price_percentage: null
    }));

    if (importMode === "replace") {
        const hasRealItems = prices.some(p => !p.id.startsWith("temp-"));
        if (hasRealItems) {
            const { error } = await supabase
                .from("sale_package_prices")
                .delete()
                .eq("sale_package_id", programId);
            
            if (error) {
                toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบข้อมูลเก่าได้", variant: "destructive" });
                return;
            }
        }
        setPrices(newItems as any);
        toast({ title: "แทนที่ตารางสำเร็จ", description: `นำเข้าข้อมูลใหม่ ${newItems.length} รายการ` });
    } else {
        setPrices((prev) => [...prev, ...newItems] as any);
        toast({ title: "เพิ่มตารางสำเร็จ", description: `เพิ่มข้อมูล ${newItems.length} รายการ` });
    }
    
    setPaymentTerms(tempPaymentTerms);
    setWarrantyTerms(tempWarrantyTerms);
    setNote(tempNote);
  };

  const handleSaveAll = async () => {
    try {
        setLoading(true);
        const { error: pkgError } = await supabase
            .from("sale_packages")
            .update({
                payment_terms: paymentTerms,
                warranty_terms: warrantyTerms,
                note: note,
            })
            .eq("id", programId);
        
        if (pkgError) throw pkgError;

        if (deletedIds.length > 0) {
            const { error: deleteError } = await supabase.from("sale_package_prices").delete().in("id", deletedIds);
            if (deleteError) throw deleteError;
        }

        const recordsToUpsert = prices.map((price) => {
            const isNew = price.id.startsWith("temp-");
            const { id, ...rest } = price;
            return { ...(isNew ? {} : { id }), ...rest, sale_package_id: programId };
        });

        if (recordsToUpsert.length > 0) {
            const newRecords = recordsToUpsert.filter(r => !r.id);
            const existingRecords = recordsToUpsert.filter(r => r.id);

            if (newRecords.length > 0) {
                const { error: insertError } = await supabase.from("sale_package_prices").insert(newRecords as any);
                if (insertError) throw insertError;
            }
            if (existingRecords.length > 0) {
                const { error: updateError } = await supabase.from("sale_package_prices").upsert(existingRecords as any);
                if (updateError) throw updateError;
            }
        }

        await Promise.all([fetchPackageDetails(), fetchPrices()]);
        setDeletedIds([]);
        setIsEditMode(false);
        toast({ title: "บันทึกสำเร็จ", description: "ข้อมูลถูกบันทึกเรียบร้อยแล้ว" });

    } catch (error) {
        console.error("Save Error:", error);
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกข้อมูลได้", variant: "destructive" });
    } finally {
        setLoading(false);
    }
  };

  const handleAddBrand = async (brandValue?: string) => {
    let brandToUse: InverterBrand = "huawei";
    if (brandValue) {
      const normalizedInput = brandValue.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const existingBrand = allBrandOptions.find(opt => opt.value === brandValue || opt.value === normalizedInput || opt.label.toLowerCase() === brandValue.toLowerCase());

      if (existingBrand) {
        brandToUse = existingBrand.value as InverterBrand;
      } else {
        try {
          const { error } = await supabase.functions.invoke("add-inverter-brand", { body: { brandName: brandValue } });
          if (error) throw error;
          brandToUse = normalizedInput as InverterBrand;
          setCustomBrandNames(prev => ({ ...prev, [normalizedInput]: brandValue }));
          toast({ title: "เพิ่ม brand สำเร็จ", description: `เพิ่ม ${brandValue} เรียบร้อยแล้ว` });
        } catch (error) {
          toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
          return;
        }
      }
    }

    const newPrice: SalePackagePrice = {
      id: `temp-${Date.now()}`,
      inverter_brand: brandToUse,
      electronic_phase: "single_phase",
      kw_min: 0,
      kw_max: null,
      is_exact_kw: true,
      price: 0,
      is_exact_price: true,
      price_percentage: null,
      price_exact: 0,
    };
    setPrices([...prices, newPrice]);
    setNewBrandInput("");
    setShowBrandSuggestions(false);
  };

  const handleAddSize = (brand: InverterBrand) => {
    const brandPrices = prices.filter((p) => p.inverter_brand === brand);
    const lastPrice = brandPrices[brandPrices.length - 1];
    const newPrice: SalePackagePrice = {
      id: `temp-${Date.now()}`,
      inverter_brand: brand,
      electronic_phase: "single_phase",
      kw_min: 0,
      kw_max: null,
      is_exact_kw: true,
      price: 0,
      is_exact_price: true,
      price_percentage: null,
      price_exact: 0,
    };
    const lastIndex = prices.lastIndexOf(lastPrice);
    const newPrices = [...prices];
    newPrices.splice(lastIndex + 1, 0, newPrice);
    setPrices(newPrices);
  };

  const handleDeletePrice = (id: string) => {
    if (!id.startsWith("temp-")) setDeletedIds((prev) => [...prev, id]);
    setPrices(prices.filter((p) => p.id !== id));
  };

  const handleUpdatePrice = (id: string, field: keyof SalePackagePrice, value: any) => {
    setPrices(prices.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const groupedPrices = prices.reduce((acc, price) => {
    const brand = price.inverter_brand;
    if (!acc[brand]) acc[brand] = [];
    acc[brand].push(price);
    return acc;
  }, {} as Record<InverterBrand, SalePackagePrice[]>);

  const formatBrandName = (brand: string): string => brand.split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const brandNames: Partial<Record<InverterBrand, string>> = { huawei: "Huawei", huawei_optimizer: "Huawei Optimizer", solaredge: "SolarEdge", hoymiles: "Hoymiles" };
  const getBrandDisplayName = (brand: string): string => customBrandNames[brand] || brandNames[brand as InverterBrand] || formatBrandName(brand);

  const allBrandOptions = React.useMemo(() => {
    const options = Object.entries(brandNames).map(([value, label]) => ({ value, label }));
    const customOptions = Object.entries(customBrandNames).map(([value, label]) => ({ value, label }));
    return [...options, ...customOptions.filter((opt) => !brandNames[opt.value as InverterBrand])];
  }, [customBrandNames]);

  const phaseNames: Record<ElectronicPhase, string> = { single_phase: "1Ph", three_phase: "3Ph" };

  if (loading) return <div className="p-4">กำลังโหลด...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 p-4 border rounded-lg bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>←</Button>
          <h2 className="text-xl font-semibold">{programName}</h2>
        </div>
        <div className="flex gap-2">
          {isEditMode && (
            <>
              {/* ✅ ปุ่มเพิ่มตาราง (Append) */}
              <Button variant="outline" size="sm" onClick={() => openImportModal("append")}>
                <PlusCircle className="h-4 w-4 mr-2" />
                เพิ่มตาราง
              </Button>

              {/* ✅ ปุ่มแทนที่ตาราง (Replace) */}
              <Button variant="outline" size="sm" onClick={() => openImportModal("replace")}>
                <Upload className="h-4 w-4 mr-2" />
                แทนที่ตาราง
              </Button>

              <Button variant="outline" size="sm"><Copy className="h-4 w-4 mr-2" />คัดลอกตาราง</Button>
            </>
          )}
          {isEditMode ? <Button onClick={handleSaveAll}>บันทึก</Button> : <Button onClick={() => setIsEditMode(true)}>แก้ไข</Button>}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left - Table */}
        <div className="lg:col-span-4">
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-sm">Inverter Brand</th>
                  <th className="px-2 py-1.5 text-left font-medium text-sm">ขนาดการติดตั้ง</th>
                  <th className="px-2 py-1.5 text-left font-medium text-sm">ประเภทไฟบ้าน</th>
                  <th className="px-2 py-1.5 text-left font-medium text-sm">ราคาโครงการ</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedPrices).map(([brand, brandPrices], brandIndex) => (
                    <React.Fragment key={brand}>
                        {brandPrices.map((price, priceIndex) => (
                            <tr key={price.id} className="border-t">
                                <td className="px-2 py-1.5 align-top border-r" rowSpan={brandPrices.length + (isEditMode ? 1 : 0)} hidden={priceIndex !== 0}>
                                    <div className="flex items-center gap-1">
                                        {isEditMode && (
                                            <button onClick={() => {
                                                const idsToDelete = prices.filter(p => p.inverter_brand === brand && !p.id.startsWith("temp-")).map(p => p.id);
                                                setDeletedIds(prev => [...prev, ...idsToDelete]);
                                                setPrices(prices.filter(p => p.inverter_brand !== brand));
                                            }} className="text-destructive hover:text-destructive/80"><Minus className="h-4 w-4" /></button>
                                        )}
                                        {isEditMode ? (
                                                <Select value={brand} onValueChange={(value) => {
                                                    setPrices(prices.map(p => p.inverter_brand === brand ? { ...p, inverter_brand: value as InverterBrand } : p));
                                                }}>
                                                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                                    <SelectContent>{allBrandOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                                                </Select>
                                        ) : <span>{getBrandDisplayName(brand)}</span>}
                                    </div>
                                </td>
                                
                                <td className="px-2 py-1.5 border-r">
                                    <div className="flex items-center gap-1">
                                        {isEditMode && <button onClick={() => handleDeletePrice(price.id)} className="text-destructive"><Minus className="h-4 w-4" /></button>}
                                        {isEditMode ? (
                                            <div className="flex items-center gap-1">
                                                <Input type="number" step="any" value={price.kw_min} onChange={(e) => handleUpdatePrice(price.id, "kw_min", parseFloat(e.target.value))} className="w-16 h-7 text-sm px-1.5" />
                                                {!price.is_exact_kw && <><span className="text-xs">-</span><Input type="number" step="any" value={price.kw_max || ""} onChange={(e) => handleUpdatePrice(price.id, "kw_max", parseFloat(e.target.value))} className="w-16 h-7 text-sm px-1.5" /></>}
                                                <Select value={price.is_exact_kw ? "exact" : "range"} onValueChange={(value) => handleUpdatePrice(price.id, "is_exact_kw", value === "exact")}>
                                                    <SelectTrigger className="h-7 w-20 text-xs px-1.5"><SelectValue /></SelectTrigger>
                                                    <SelectContent><SelectItem value="exact">Exact</SelectItem><SelectItem value="range">Range</SelectItem></SelectContent>
                                                </Select>
                                            </div>
                                        ) : (
                                            <span>{price.is_exact_kw ? price.kw_min : `${price.kw_min} - ${price.kw_max}`}</span>
                                        )}
                                    </div>
                                </td>

                                <td className="px-2 py-1.5 border-r">
                                    {isEditMode ? (
                                        <Select value={price.electronic_phase} onValueChange={(value) => handleUpdatePrice(price.id, "electronic_phase", value)}>
                                            <SelectTrigger className="h-7 w-16 text-xs px-1.5"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="single_phase">1Ph</SelectItem><SelectItem value="three_phase">3Ph</SelectItem></SelectContent>
                                        </Select>
                                    ) : <span>{phaseNames[price.electronic_phase]}</span>}
                                </td>

                                <td className="px-2 py-1.5">
                                    {isEditMode ? (
                                        <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-1">
                                                    <Input type="number" step="any" 
                                                    value={price.is_exact_price ? (price.price_exact ?? "") : (price.price_percentage ?? "")} 
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                                        handleUpdatePrice(price.id, price.is_exact_price ? "price_exact" : "price_percentage", val);
                                                    }}
                                                    className="w-20 h-7 text-sm px-1.5" placeholder={price.is_exact_price ? "บาท" : "c"} />
                                                    <Select value={price.is_exact_price ? "exact" : "percent"} onValueChange={(v) => handleUpdatePrice(price.id, "is_exact_price", v === "exact")}>
                                                        <SelectTrigger className="h-7 w-16 text-xs px-1.5 bg-muted/50"><SelectValue /></SelectTrigger>
                                                        <SelectContent><SelectItem value="exact">bath</SelectItem><SelectItem value="percent">bath/watt</SelectItem></SelectContent>
                                                    </Select>
                                                </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {(price.is_exact_price ? (price.price_exact || 0) : (price.price_percentage || 0) * price.kw_min * 1000).toLocaleString()}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">{price.is_exact_price ? "" : `(x${price.price_percentage || 0})`}</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {isEditMode && (
                            <tr className="border-t">
                                <td className="px-2 py-1" colSpan={3}>
                                    <button onClick={() => handleAddSize(brand as InverterBrand)} className="flex items-center gap-2 text-primary hover:text-primary/80"><Plus className="h-4 w-4" /><span>Add Item</span></button>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}
                {isEditMode && (
                  <tr className="border-t">
                    <td className="px-2 py-1.5">
                      <div className="relative" ref={containerRef}>
                        <div className="flex items-center gap-2">
                          <Input value={newBrandInput} onChange={(e) => setNewBrandInput(e.target.value)} onFocus={() => setShowBrandSuggestions(true)} placeholder="เลือกหรือกรอก brand ใหม่" className="h-8" />
                          <button onClick={() => handleAddBrand(newBrandInput)} className="text-primary hover:text-primary/80" disabled={!newBrandInput}><Plus className="h-4 w-4" /></button>
                        </div>
                        {showBrandSuggestions && (
                          <div className="absolute z-[100] w-full top-full mb-1 bg-background border rounded-md shadow-lg">
                            <div className="p-2 space-y-1">
                              {allBrandOptions.map((opt) => (
                                <button key={opt.value} type="button" onClick={() => { setShowBrandSuggestions(false); handleAddBrand(opt.value); }} className="w-full text-left px-3 py-2 hover:bg-muted rounded-sm text-sm">{opt.label}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-3" colSpan={3}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right - Terms */}
        <div className="border rounded-lg p-4 h-fit">
          <h3 className="text-lg font-semibold mb-4">ข้อกำหนด</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">เงื่อนไขการชำระเงิน</label>
              {isEditMode ? <Input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="กรอกเงื่อนไขการชำระเงิน" /> : <p className="text-sm text-muted-foreground">{paymentTerms || "-"}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">เงื่อนไขการรับประกัน</label>
              {isEditMode ? <Input value={warrantyTerms} onChange={(e) => setWarrantyTerms(e.target.value)} placeholder="กรอกเงื่อนไขการรับประกัน" /> : <p className="text-sm text-muted-foreground">{warrantyTerms || "-"}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">หมายเหตุ</label>
              {isEditMode ? <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="กรอกหมายเหตุ" /> : <p className="text-sm text-muted-foreground">{note || "-"}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={importMode === "replace" ? `แทนที่ข้อมูล ${programName}` : `เพิ่มข้อมูล ${programName}`}
        
        fields={[
            { key: "brand", label: "Inverter Brand (Huawei, Sungrow...)" },
            { key: "phase", label: "Phase (1 หรือ 3)" },
            { key: "kw_min", label: "ขนาด (Min/Exact) kW" },
            { key: "kw_max", label: "ขนาดสูงสุด (Max) kW" },
            { key: "price", label: "ราคาโครงการ (บาท)" },
        ]}
        
        // ✅ Logic Boolean: แสดง Checkbox เฉพาะ Mode Replace
        booleanFields={
            importMode === "replace"
            ? [{ key: "is_exact_kw", label: "ขนาดติดตั้งแบบค่าเดียว (Exact)", defaultValue: true }]
            : []
        }
        
        extraInputs={[
            { key: "payment", label: "เงื่อนไขการชำระเงิน", value: tempPaymentTerms, onChange: setTempPaymentTerms },
            { key: "warranty", label: "เงื่อนไขการรับประกัน", value: tempWarrantyTerms, onChange: setTempWarrantyTerms },
            { key: "note", label: "หมายเหตุ", value: tempNote, onChange: setTempNote },
        ]}
        
        onImport={handleImportSales}
      />
    </div>
  );
};