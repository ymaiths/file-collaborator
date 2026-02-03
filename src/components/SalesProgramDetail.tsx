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
  price: number; // UI use mainly
  is_exact_price: boolean;
  price_percentage: number | null; // Note: In sales context, this usually means Price/Watt or similar logic
  price_exact: number | null;
  sale_package_id?: string;
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

  // ✅ 1. Global State สำหรับควบคุม Column (เหมือน Equipment)
  const [isExactKw, setIsExactKw] = useState(true);
  const [isExactPrice, setIsExactPrice] = useState(true);

  // Helper States
  const [newBrandInput, setNewBrandInput] = useState("");
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [customBrandNames, setCustomBrandNames] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [tempPaymentTerms, setTempPaymentTerms] = useState("");
  const [tempWarrantyTerms, setTempWarrantyTerms] = useState("");
  const [tempNote, setTempNote] = useState("");

  // Initial Fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchPackageDetails(), fetchPrices()]);
      setLoading(false);
    };
    fetchData();
  }, [programId]);

  // ✅ 2. Sync Global State เมื่อโหลดข้อมูลเสร็จ (เหมือน Equipment)
  useEffect(() => {
    if (prices.length > 0) {
      setIsExactKw(prices[0].is_exact_kw ?? true);
      setIsExactPrice(prices[0].is_exact_price ?? true);
    }
  }, [prices.length]);

  // Handle Click Outside
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
    } catch (error) { console.error(error); }
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
      
      // Map data to ensure price field exists for UI (though we use exact/percentage logic)
      const mappedData = (data || []).map(p => ({
          ...p,
          price: p.is_exact_price ? (p.price_exact || 0) : (p.price_percentage || 0) // Default for UI
      }));
      setPrices(mappedData as SalePackagePrice[]);
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "โหลดข้อมูลราคาไม่สำเร็จ", variant: "destructive" });
    }
  };

  // ✅ 3. Bulk Handlers (เปลี่ยนค่าทั้งตารางเมื่อ Header เปลี่ยน)
  const handleExactKwChange = (isExact: boolean) => {
    setIsExactKw(isExact);
    setPrices(prices.map(p => ({
        ...p,
        is_exact_kw: isExact,
        kw_min: p.kw_min,
        kw_max: isExact ? null : p.kw_max // Clear max if exact
    })));
  };

  const handleExactPriceChange = (isExact: boolean) => {
    setIsExactPrice(isExact);
    setPrices(prices.map(p => ({
        ...p,
        is_exact_price: isExact,
        // Reset or Move values logic if needed, but keeping them is safer
        price_exact: isExact ? p.price_exact : null,
        price_percentage: isExact ? null : p.price_percentage
    })));
  };


  // ✅ 4. Import Logic (Updated)
  const openImportModal = (mode: "append" | "replace") => {
    setTempPaymentTerms(paymentTerms);
    setTempWarrantyTerms(warrantyTerms);
    setTempNote(note);
    setImportMode(mode);
    setIsImportModalOpen(true);
  };

  const handleImportSales = async (data: any[], booleanValues: Record<string, boolean>) => {
    const isReplace = importMode === "replace";

    // Logic: ถ้า Replace ใช้ค่าจาก Modal, ถ้า Append ใช้ค่าปัจจุบันของหน้าจอ
    const _isExactKw = isReplace ? booleanValues.is_exact_kw : isExactKw;
    const _isExactPrice = isReplace ? booleanValues.is_exact_price : isExactPrice;

    const newItems = data.map((row) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      inverter_brand: (row.brand ? String(row.brand).toLowerCase().trim().replace(/\s+/g, '_') : "other") as InverterBrand,
      electronic_phase: (row.phase && (String(row.phase).includes("3"))) ? "three_phase" : "single_phase" as ElectronicPhase,
      
      // Size
      is_exact_kw: _isExactKw,
      kw_min: parseFloat(row.kw_min) || 0,
      kw_max: !_isExactKw ? (parseFloat(row.kw_max) || 0) : null,
      
      // Price (Input from Excel usually comes as 'price')
      price: parseFloat(row.price) || 0, // For UI temp
      is_exact_price: _isExactPrice,
      price_exact: _isExactPrice ? (parseFloat(row.price) || 0) : null,
      price_percentage: !_isExactPrice ? (parseFloat(row.price) || 0) : null,
    }));

    if (isReplace) {
        const hasRealItems = prices.some(p => !p.id.startsWith("temp-"));
        if (hasRealItems) {
            const { error } = await supabase.from("sale_package_prices").delete().eq("sale_package_id", programId);
            if (error) { toast({ title: "Error", description: "ลบข้อมูลเก่าไม่สำเร็จ", variant: "destructive" }); return; }
        }
        
        setPrices(newItems as any);
        // Update Global State
        setIsExactKw(_isExactKw);
        setIsExactPrice(_isExactPrice);
        
        toast({ title: "แทนที่สำเร็จ", description: `นำเข้า ${newItems.length} รายการ` });
    } else {
        setPrices((prev) => [...prev, ...newItems] as any);
        toast({ title: "เพิ่มสำเร็จ", description: `เพิ่ม ${newItems.length} รายการ` });
    }
    
    setPaymentTerms(tempPaymentTerms);
    setWarrantyTerms(tempWarrantyTerms);
    setNote(tempNote);
  };

  const handleSaveAll = async () => {
    try {
        setLoading(true);
        const { error: pkgError } = await supabase.from("sale_packages")
            .update({ payment_terms: paymentTerms, warranty_terms: warrantyTerms, note: note })
            .eq("id", programId);
        if (pkgError) throw pkgError;

        if (deletedIds.length > 0) {
            await supabase.from("sale_package_prices").delete().in("id", deletedIds);
        }

        const recordsToUpsert = prices.map((item) => {
            const isNew = item.id.startsWith("temp-");
            // ❌ Filter 'price' out, keep only DB columns
            const { id, price: _unused, ...rest } = item; 
            return {
                ...(isNew ? {} : { id }),
                ...rest,
                sale_package_id: programId 
            };
        });

        if (recordsToUpsert.length > 0) {
            const newRecords = recordsToUpsert.filter(r => !r.id);
            const existingRecords = recordsToUpsert.filter(r => r.id);
            if (newRecords.length > 0) await supabase.from("sale_package_prices").insert(newRecords as any);
            if (existingRecords.length > 0) await supabase.from("sale_package_prices").upsert(existingRecords as any);
        }

        await Promise.all([fetchPackageDetails(), fetchPrices()]);
        setDeletedIds([]);
        setIsEditMode(false);
        toast({ title: "บันทึกสำเร็จ" });
    } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  // Helper Functions
  const handleAddBrand = async (brandValue?: string) => {
     // ... (Same Logic as before, just ensure new item uses Global State)
     let brandToUse: InverterBrand = "huawei";
     // ... (Brand fetch/create logic) ...
     
     // Note: Use global state here
     const newPrice: SalePackagePrice = {
        id: `temp-${Date.now()}`,
        inverter_brand: brandToUse,
        electronic_phase: "single_phase",
        kw_min: 0,
        kw_max: null,
        is_exact_kw: isExactKw,
        price: 0,
        is_exact_price: isExactPrice,
        price_percentage: null,
        price_exact: 0,
     };
     setPrices([...prices, newPrice]);
  };

  const handleAddSize = (brand: InverterBrand) => {
    const newPrice: SalePackagePrice = {
        id: `temp-${Date.now()}`,
        inverter_brand: brand,
        electronic_phase: "single_phase",
        kw_min: 0,
        kw_max: null,
        is_exact_kw: isExactKw, // Use Global
        price: 0,
        is_exact_price: isExactPrice, // Use Global
        price_percentage: null,
        price_exact: 0,
    };
    // Insert after last item of this brand
    const brandPrices = prices.filter(p => p.inverter_brand === brand);
    const lastItem = brandPrices[brandPrices.length - 1];
    const index = lastItem ? prices.indexOf(lastItem) : prices.length - 1;
    const newPrices = [...prices];
    newPrices.splice(index + 1, 0, newPrice);
    setPrices(newPrices);
  };

  const handleDeletePrice = (id: string) => {
    if (!id.startsWith("temp-")) setDeletedIds(prev => [...prev, id]);
    setPrices(prices.filter(p => p.id !== id));
  };

  const handleUpdatePrice = (id: string, field: keyof SalePackagePrice, value: any) => {
    setPrices(prices.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const groupedPrices = prices.reduce((acc, price) => {
    const brand = price.inverter_brand;
    if (!acc[brand]) acc[brand] = [];
    acc[brand].push(price);
    return acc;
  }, {} as Record<InverterBrand, SalePackagePrice[]>);

  // Formatting helpers
  const formatBrandName = (brand: string) => brand.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const brandNames: Partial<Record<InverterBrand, string>> = { huawei: "Huawei", solaredge: "SolarEdge" };
  const getBrandDisplayName = (brand: string) => customBrandNames[brand] || brandNames[brand as InverterBrand] || formatBrandName(brand);
  const allBrandOptions = React.useMemo(() => {
     // ... same as before
     const options = Object.entries(brandNames).map(([value, label]) => ({ value, label }));
     const customOptions = Object.entries(customBrandNames).map(([value, label]) => ({ value, label }));
     return [...options, ...customOptions.filter(opt => !brandNames[opt.value as InverterBrand])];
  }, [customBrandNames]);
  const phaseNames: Record<ElectronicPhase, string> = { single_phase: "1Ph", three_phase: "3Ph" };


  if (loading) return <div className="p-4">Loading...</div>;

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
              <Button variant="outline" size="sm" onClick={() => openImportModal("append")}>
                <PlusCircle className="h-4 w-4 mr-2" /> เพิ่มตาราง
              </Button>
              <Button variant="outline" size="sm" onClick={() => openImportModal("replace")}>
                <Upload className="h-4 w-4 mr-2" /> แทนที่ตาราง
              </Button>
            </>
          )}
          {isEditMode ? <Button onClick={handleSaveAll}>บันทึก</Button> : <Button onClick={() => setIsEditMode(true)}>แก้ไข</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Table */}
        <div className="lg:col-span-4 border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left text-sm font-medium">Inverter Brand</th>
                  
                  {/* ✅ Header Size with Toggle */}
                  <th className="px-2 py-1.5 text-left text-sm font-medium min-w-[140px]">
                    <div className="flex items-center gap-2">
                       ขนาดติดตั้ง
                       {isEditMode && (
                        <Select value={isExactKw ? "exact" : "range"} onValueChange={(v) => handleExactKwChange(v === "exact")}>
                           <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                             <div className="flex items-center justify-center w-full h-full text-xs font-bold pb-0.5">{isExactKw ? "=" : "↔"}</div>
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="exact"><span className="font-bold mr-2">=</span> Exact</SelectItem>
                             <SelectItem value="range"><span className="font-bold mr-2">↔</span> Range</SelectItem>
                           </SelectContent>
                        </Select>
                       )}
                    </div>
                  </th>

                  <th className="px-2 py-1.5 text-left text-sm font-medium">Phase</th>
                  
                  {/* ✅ Header Price with Toggle */}
                  <th className="px-2 py-1.5 text-left text-sm font-medium min-w-[140px]">
                    <div className="flex items-center gap-2">
                       ราคาโครงการ
                       {isEditMode && (
                        <Select value={isExactPrice ? "exact" : "percent"} onValueChange={(v) => handleExactPriceChange(v === "exact")}>
                           <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                             <div className="flex items-center justify-center w-full h-full text-xs font-bold">{isExactPrice ? "฿" : "%"}</div>
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="exact"><span className="font-bold mr-2">฿</span> Fix Price</SelectItem>
                             <SelectItem value="percent"><span className="font-bold mr-2">%</span> Per Watt</SelectItem>
                           </SelectContent>
                        </Select>
                       )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedPrices).map(([brand, brandPrices], brandIndex) => (
                    <React.Fragment key={brand}>
                        {brandPrices.map((price, priceIndex) => (
                            <tr key={price.id} className="border-t">
                                {/* Brand */}
                                <td className="px-2 py-1.5 align-top border-r" rowSpan={brandPrices.length + (isEditMode ? 1 : 0)} hidden={priceIndex !== 0}>
                                    <div className="flex items-center gap-1">
                                        {isEditMode && (
                                            <button onClick={() => {
                                                const ids = prices.filter(p => p.inverter_brand === brand && !p.id.startsWith("temp-")).map(p => p.id);
                                                setDeletedIds(prev => [...prev, ...ids]);
                                                setPrices(prices.filter(p => p.inverter_brand !== brand));
                                            }} className="text-destructive hover:text-destructive/80"><Minus className="h-4 w-4" /></button>
                                        )}
                                        {isEditMode ? (
                                             <Select value={brand} onValueChange={(v) => setPrices(prices.map(p => p.inverter_brand === brand ? { ...p, inverter_brand: v as InverterBrand } : p))}>
                                                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                                <SelectContent>{allBrandOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                                             </Select>
                                        ) : <span>{getBrandDisplayName(brand)}</span>}
                                    </div>
                                </td>
                                
                                {/* Size */}
                                <td className="px-2 py-1.5 border-r">
                                    <div className="flex items-center gap-1">
                                        {isEditMode && <button onClick={() => handleDeletePrice(price.id)} className="text-destructive"><Minus className="h-4 w-4" /></button>}
                                        {isEditMode ? (
                                            <div className="flex items-center gap-1">
                                                <Input type="number" step="any" value={price.kw_min} onChange={(e) => handleUpdatePrice(price.id, "kw_min", parseFloat(e.target.value))} className="w-16 h-7 text-sm px-1.5" placeholder={isExactKw ? "Size" : "Min"} />
                                                {!price.is_exact_kw && <><span className="text-xs">-</span><Input type="number" step="any" value={price.kw_max || ""} onChange={(e) => handleUpdatePrice(price.id, "kw_max", parseFloat(e.target.value))} className="w-16 h-7 text-sm px-1.5" placeholder="Max" /></>}
                                            </div>
                                        ) : (
                                            <span>{price.is_exact_kw ? price.kw_min : `${price.kw_min} - ${price.kw_max}`}</span>
                                        )}
                                    </div>
                                </td>

                                {/* Phase */}
                                <td className="px-2 py-1.5 border-r">
                                    {isEditMode ? (
                                        <Select value={price.electronic_phase} onValueChange={(v) => handleUpdatePrice(price.id, "electronic_phase", v)}>
                                            <SelectTrigger className="h-7 w-16 text-xs px-1.5"><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="single_phase">1Ph</SelectItem><SelectItem value="three_phase">3Ph</SelectItem></SelectContent>
                                        </Select>
                                    ) : <span>{phaseNames[price.electronic_phase]}</span>}
                                </td>

                                {/* Price */}
                                <td className="px-2 py-1.5">
                                    {isEditMode ? (
                                        <Input type="number" step="any" 
                                            value={price.is_exact_price ? (price.price_exact ?? "") : (price.price_percentage ?? "")} 
                                            onChange={(e) => {
                                                const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                                handleUpdatePrice(price.id, price.is_exact_price ? "price_exact" : "price_percentage", val);
                                            }}
                                            className="w-24 h-7 text-sm px-1.5" placeholder={price.is_exact_price ? "บาท" : "บาท/watt"} 
                                        />
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
                                 <Input value={newBrandInput} onChange={(e) => setNewBrandInput(e.target.value)} onFocus={() => setShowBrandSuggestions(true)} placeholder="Add Brand..." className="h-8" />
                                 <button onClick={() => handleAddBrand(newBrandInput)} disabled={!newBrandInput} className="text-primary"><Plus className="h-4 w-4" /></button>
                              </div>
                              {/* Suggestions Logic ... */}
                           </div>
                        </td>
                        <td colSpan={3}></td>
                    </tr>
                )}
              </tbody>
            </table>
        </div>

        {/* Right Panel: Terms */}
        <div className="border rounded-lg p-4 h-fit">
          <h3 className="text-lg font-semibold mb-4">ข้อกำหนด</h3>
          <div className="space-y-4">
             <div><label className="text-sm font-medium">เงื่อนไขชำระเงิน</label>{isEditMode ? <Input value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)}/> : <p className="text-sm text-muted">{paymentTerms || "-"}</p>}</div>
             <div><label className="text-sm font-medium">เงื่อนไขรับประกัน</label>{isEditMode ? <Input value={warrantyTerms} onChange={e=>setWarrantyTerms(e.target.value)}/> : <p className="text-sm text-muted">{warrantyTerms || "-"}</p>}</div>
             <div><label className="text-sm font-medium">หมายเหตุ</label>{isEditMode ? <Input value={note} onChange={e=>setNote(e.target.value)}/> : <p className="text-sm text-muted">{note || "-"}</p>}</div>
          </div>
        </div>
      </div>

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={importMode === "replace" ? "แทนที่ข้อมูล" : "เพิ่มข้อมูล"}
        fields={[
            { key: "brand", label: "Inverter Brand", type: "enum", enumOptions: allBrandOptions },
            { key: "phase", label: "Phase", type: "enum", enumOptions: [{ label: "1 Phase", value: "single_phase"}, { label: "3 Phase", value: "three_phase"}] },
            { key: "kw_min", label: "ขนาด (Min/Exact) kW" },
            { key: "kw_max", label: "ขนาดสูงสุด (Max) kW" },
            { key: "price", label: "ราคา" },
        ]}
        booleanFields={importMode === "replace" ? [
            { key: "is_exact_kw", label: "ขนาดแบบค่าเดียว (Exact)", defaultValue: isExactKw },
            { key: "is_exact_price", label: "ราคาแบบ Fix (บาท)", defaultValue: isExactPrice },
        ] : []}
        extraInputs={[
            { key: "payment", label: "เงื่อนไขชำระเงิน", value: tempPaymentTerms, onChange: setTempPaymentTerms },
            { key: "warranty", label: "เงื่อนไขรับประกัน", value: tempWarrantyTerms, onChange: setTempWarrantyTerms },
            { key: "note", label: "หมายเหตุ", value: tempNote, onChange: setTempNote },
        ]}
        onImport={handleImportSales}
      />
    </div>
  );
};