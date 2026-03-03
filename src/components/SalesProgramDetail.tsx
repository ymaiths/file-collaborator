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
import { Minus, Plus, Upload, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { ExcelImportModal } from "./ExcelImportModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [dbBrandOptions, setDbBrandOptions] = useState<{ value: string; label: string }[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [prices, setPrices] = useState<SalePackagePrice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Terms State
  const [paymentTerms, setPaymentTerms] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [note, setNote] = useState("");

  // Global State Control
  const [isExactKw, setIsExactKw] = useState(true);
  const [isExactPrice, setIsExactPrice] = useState(true);

  // Helper States
  const [newBrandInput, setNewBrandInput] = useState("");
  const [isManualAdd, setIsManualAdd] = useState(false); 
  const [customBrandNames, setCustomBrandNames] = useState<Record<string, string>>({}); 
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  
  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [tempPaymentTerms, setTempPaymentTerms] = useState("");
  const [tempWarrantyTerms, setTempWarrantyTerms] = useState("");
  const [tempNote, setTempNote] = useState("");

  // 🌟 1. ดึงสิทธิ์จากเครื่อง (Admin / General แก้ไขได้)
  const userRole = localStorage.getItem("userRole");
  const canEdit = userRole === "admin" || userRole === "general";

  useEffect(() => {
    fetchBrandEnums();
  }, []);

  const fetchBrandEnums = async () => {
    try {
      const { data, error } = await supabase.rpc("get_enum_values" as any, {
        enum_name: "inverter_brand",
      });

      if (error) throw error;

      if (data) {
        const typedData = data as { enum_value: string }[];
        const options = typedData.map((item) => {
          const val = item.enum_value;
          const label = val
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
          
          return { value: val, label: label };
        });
        setDbBrandOptions(options);
      }
    } catch (error) {
      console.error("Error fetching brand enums:", error);
    }
  };

  const [conflictDialog, setConflictDialog] = useState<{
    isOpen: boolean;
    prevItem: SalePackagePrice; 
    currItem: SalePackagePrice; 
    overlapText: string;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchPackageDetails(), fetchPrices()]);
      setLoading(false);
    };
    fetchData();
  }, [programId]);

  useEffect(() => {
    if (prices.length > 0) {
      setIsExactKw(prices[0].is_exact_kw ?? true);
      setIsExactPrice(prices[0].is_exact_price ?? true);
    }
  }, [prices.length]);

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
      
      const mappedData = (data || []).map(p => ({
          ...p,
          price: p.is_exact_price ? (p.price_exact || 0) : (p.price_percentage || 0)
      }));
      setPrices(mappedData as SalePackagePrice[]);
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "โหลดข้อมูลราคาไม่สำเร็จ", variant: "destructive" });
    }
  };

  const handleExactKwChange = (isExact: boolean) => {
    setIsExactKw(isExact);
    setPrices(prices.map(p => ({
        ...p,
        is_exact_kw: isExact,
        kw_min: p.kw_min,
        kw_max: isExact ? null : p.kw_max
    })));
  };

  const handleExactPriceChange = (isExact: boolean) => {
    setIsExactPrice(isExact);
    setPrices(prices.map(p => {
        const currentValue = p.is_exact_price ? p.price_exact : p.price_percentage;
        return {
            ...p,
            is_exact_price: isExact,
            price_exact: isExact ? (currentValue || 0) : null,
            price_percentage: !isExact ? (currentValue || 0) : null,
            price: currentValue || 0
        };
    }));
  };

  const openImportModal = (mode: "append" | "replace") => {
    setTempPaymentTerms(paymentTerms);
    setTempWarrantyTerms(warrantyTerms);
    setTempNote(note);
    setImportMode(mode);
    setIsImportModalOpen(true);
  };

  const handleImportSales = async (data: any[], booleanValues: Record<string, boolean>) => {
    if (!canEdit) return; // 🌟 ป้องกัน Viewer

    const isTableEmpty = prices.length === 0;
    const isConfigMode = importMode === "replace" || isTableEmpty;

    const _isExactKw = isConfigMode ? booleanValues.is_exact_kw : isExactKw;
    const _isExactPrice = isConfigMode ? booleanValues.is_exact_price : isExactPrice;

    const newItems = data.map((row) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      inverter_brand: row.brand as InverterBrand,
      electronic_phase: (row.phase === "three_phase" || String(row.phase).includes("3")) ? "three_phase" : "single_phase" as ElectronicPhase,
      is_exact_kw: _isExactKw,
      kw_min: parseFloat(row.kw_min) || 0,
      kw_max: !_isExactKw ? (parseFloat(row.kw_max) || 0) : null,
      price: parseFloat(row.price) || 0,
      is_exact_price: _isExactPrice,
      price_exact: _isExactPrice ? (parseFloat(row.price) || 0) : null,
      price_percentage: !_isExactPrice ? (parseFloat(row.price) || 0) : null,
    }));

    if (isConfigMode) {
        if (importMode === "replace") {
            const hasRealItems = prices.some(p => !p.id.startsWith("temp-"));
            if (hasRealItems) {
                const { error } = await supabase.from("sale_package_prices").delete().eq("sale_package_id", programId);
                if (error) { toast({ title: "Error", description: "ลบข้อมูลเก่าไม่สำเร็จ", variant: "destructive" }); return; }
            }
        }
        setPrices(newItems as any);
        setIsExactKw(_isExactKw);
        setIsExactPrice(_isExactPrice);
        toast({ title: "นำเข้าสำเร็จ", description: `นำเข้า ${newItems.length} รายการ` });
    } else {
        setPrices((prev) => [...prev, ...newItems] as any);
        toast({ title: "เพิ่มสำเร็จ", description: `เพิ่ม ${newItems.length} รายการ` });
    }
    
    setPaymentTerms(tempPaymentTerms);
    setWarrantyTerms(tempWarrantyTerms);
    setNote(tempNote);
  };

  const handleAddBrand = async (brandValue?: string) => {
     if (!canEdit) return; // 🌟 ป้องกัน Viewer
     let brandToUse: InverterBrand = (brandValue as InverterBrand) || "others"; 
     
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
    if (!canEdit) return; // 🌟 ป้องกัน Viewer
    const newPrice: SalePackagePrice = {
        id: `temp-${Date.now()}`,
        inverter_brand: brand,
        electronic_phase: "single_phase",
        kw_min: 0,
        kw_max: null,
        is_exact_kw: isExactKw,
        price: 0,
        is_exact_price: isExactPrice,
        price_percentage: null,
        price_exact: 0,
    };
    const brandPrices = prices.filter(p => p.inverter_brand === brand);
    const lastItem = brandPrices[brandPrices.length - 1];
    const index = lastItem ? prices.indexOf(lastItem) : prices.length - 1;
    const newPrices = [...prices];
    newPrices.splice(index + 1, 0, newPrice);
    setPrices(newPrices);
  };

  const handleDeletePrice = (id: string) => {
    if (!canEdit) return; // 🌟 ป้องกัน Viewer
    if (!id.startsWith("temp-")) setDeletedIds(prev => [...prev, id]);
    setPrices(prices.filter(p => p.id !== id));
  };

  const handleUpdatePrice = (id: string, field: keyof SalePackagePrice, value: any) => {
    if (!canEdit) return; // 🌟 ป้องกัน Viewer
    setPrices(prices.map(p => {
        if (p.id !== id) return p;
        const updatedItem = { ...p, [field]: value };
        if (field === "price_exact" || field === "price_percentage" || field === "is_exact_price") {
            updatedItem.price = updatedItem.is_exact_price 
                ? (updatedItem.price_exact || 0) 
                : (updatedItem.price_percentage || 0);
        }
        return updatedItem;
    }));
  };

  const groupedPrices = prices.reduce((acc, price) => {
    const brand = price.inverter_brand;
    if (!acc[brand]) acc[brand] = [];
    acc[brand].push(price);
    return acc;
  }, {} as Record<InverterBrand, SalePackagePrice[]>);

  const formatBrandName = (brand: string) => brand.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const getBrandDisplayName = (brand: string) => customBrandNames[brand] || formatBrandName(brand);

  const allBrandOptions = React.useMemo(() => {
    const options = dbBrandOptions.map(opt => ({
        value: opt.value,
        label: opt.label 
    }));

    const customOptions = Object.entries(customBrandNames).map(([value, label]) => ({
       value, 
       label 
    }));
    
    const combined = [...options, ...customOptions];
    const uniqueOptions = Array.from(new Map(combined.map(item => [item.value, item])).values());
    
    const otherOption = uniqueOptions.find(o => o.value.toLowerCase() === 'others');
    const restOptions = uniqueOptions.filter(o => o.value.toLowerCase() !== 'others');

    if (otherOption) {
        return [...restOptions, otherOption];
    }
    return restOptions;
  }, [dbBrandOptions, customBrandNames]);

  const phaseNames: Record<ElectronicPhase, string> = { single_phase: "1Ph", three_phase: "3Ph" };

  const checkAndResolveOverlaps = () => {
    if (isExactKw) return false;
    const grouped = prices.reduce((acc, p) => {
        const key = `${p.inverter_brand}|${p.electronic_phase}`;
        if(!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
    }, {} as Record<string, SalePackagePrice[]>);

    for (const key in grouped) {
        const sorted = [...grouped[key]].sort((a, b) => {
            if (a.kw_min !== b.kw_min) return a.kw_min - b.kw_min;
            return (b.kw_max || 0) - (a.kw_max || 0); 
        });
        
        for (let i = 0; i < sorted.length - 1; i++) {
            const prev = sorted[i]; 
            const curr = sorted[i+1]; 
            const prevStart = Number(prev.kw_min);
            const prevMax   = Number(prev.kw_max ?? prev.kw_min);
            const currStart = Number(curr.kw_min);
            const currMax   = Number(curr.kw_max || Infinity);

            if (currStart <= prevMax) {
                const overlapStart = Math.max(prevStart, currStart);
                const overlapEnd   = Math.min(prevMax, currMax);

                setConflictDialog({
                    isOpen: true,
                    prevItem: prev,
                    currItem: curr,
                    overlapText: `${overlapStart} - ${overlapEnd === Infinity ? '∞' : overlapEnd}` 
                });
                return true; 
            }
        }
    }
    return false; 
  };

  const handleResolveConflict = (choice: 'KEEP_PREV' | 'PRIORITIZE_CURR') => {
      if (!conflictDialog) return;
      const { prevItem, currItem } = conflictDialog;
      let newPrices = [...prices];

      const pMin = prevItem.kw_min;
      const pMax = prevItem.kw_max ?? Infinity;
      const cMin = currItem.kw_min;
      const cMax = currItem.kw_max ?? Infinity;
      
      const GAP = 1000; 
      const isMiddleSplit = (cMin > pMin) && (cMax < pMax);

      if (choice === 'PRIORITIZE_CURR') {
          if (isMiddleSplit) {
              const newPrevMax = cMin - GAP; 
              newPrices = newPrices.map(p => p.id === prevItem.id ? { ...p, kw_max: newPrevMax } : p);
              const splitItem: SalePackagePrice = {
                  ...prevItem,
                  id: `temp-split-${Date.now()}`,
                  kw_min: cMax + GAP,
                  kw_max: prevItem.kw_max
              };
              newPrices.push(splitItem);
          } else {
              if (pMin < cMin) {
                  const newMax = cMin - GAP;
                  newPrices = newPrices.map(p => p.id === prevItem.id ? { ...p, kw_max: newMax } : p);
              } else {
                  const newMin = (cMax === Infinity ? pMax : cMax) + GAP; 
                  if (newMin > pMax) {
                      newPrices = newPrices.filter(p => p.id !== prevItem.id);
                  } else {
                      newPrices = newPrices.map(p => p.id === prevItem.id ? { ...p, kw_min: newMin } : p);
                  }
              }
          }
      } else {
          if (isMiddleSplit) {
              newPrices = newPrices.filter(p => p.id !== currItem.id);
          } else {
              if (cMin < pMin) {
                  const newMax = pMin - GAP;
                  newPrices = newPrices.map(p => p.id === currItem.id ? { ...p, kw_max: newMax } : p);
              } else {
                  const newMin = (pMax === Infinity ? cMax : pMax) + GAP;
                  if (newMin > cMax) {
                       newPrices = newPrices.filter(p => p.id !== currItem.id);
                  } else {
                       newPrices = newPrices.map(p => p.id === currItem.id ? { ...p, kw_min: newMin } : p);
                  }
              }
          }
      }
      
      setPrices(newPrices);
      setConflictDialog(null);
  };

  const handleSaveAll = async () => {
    if (!canEdit) return; // 🌟 ป้องกัน Viewer

    try {
        if (checkAndResolveOverlaps()) {
            return; 
        }

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

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 p-4 border rounded-lg bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>←</Button>
          <h2 className="text-xl font-semibold">{programName}</h2>
        </div>
        <div className="flex gap-3">
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
          {/* 🌟 2. ซ่อนปุ่มแก้ไข/บันทึก หากเป็นแค่ Viewer */}
          {canEdit && (
            isEditMode ? <Button onClick={handleSaveAll}>บันทึก</Button> : <Button onClick={() => setIsEditMode(true)}>แก้ไข</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Table */}
        <div className="lg:col-span-4 border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left text-sm font-medium">Inverter Brand</th>
                  <th className="px-2 py-1.5 text-left text-sm font-medium min-w-[140px]">
                    <div className="flex items-center gap-2">
                       ขนาดติดตั้ง (kW)
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
                  <th className="px-2 py-1.5 text-left text-sm font-medium min-w-[140px]">
                    <div className="flex items-center gap-2">
                       ราคาโครงการ (บาท)
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
                {Object.entries(groupedPrices).map(([brand, brandPrices]) => (
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
                                
                                {/* Size Column */}
                                <td className="px-2 py-1.5 border-r">
                                    <div className="flex items-center gap-1">
                                        {isEditMode && <button onClick={() => handleDeletePrice(price.id)} className="text-destructive"><Minus className="h-4 w-4" /></button>}
                                        
                                        {isEditMode ? (
                                            <div className="flex items-center gap-1">
                                                <Input 
                                                    type="number" 
                                                    step="any" 
                                                    value={price.kw_min ? price.kw_min / 1000 : ""} 
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                                        handleUpdatePrice(price.id, "kw_min", val * 1000);
                                                    }} 
                                                    className="w-16 h-7 text-sm px-1.5" 
                                                    placeholder={isExactKw ? "Size" : "Min"} 
                                                />

                                                {!price.is_exact_kw && (
                                                    <>
                                                        <span className="text-xs">-</span>
                                                        <Input 
                                                            type="number" 
                                                            step="any" 
                                                            value={price.kw_max ? price.kw_max / 1000 : ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                                                handleUpdatePrice(price.id, "kw_max", val * 1000);
                                                            }} 
                                                            className="w-16 h-7 text-sm px-1.5" 
                                                            placeholder="Max" 
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        ) : (
                                            <span>
                                                {price.is_exact_kw 
                                                    ? (price.kw_min / 1000).toLocaleString() 
                                                    : `${(price.kw_min / 1000).toLocaleString()} - ${(price.kw_max ? price.kw_max / 1000 : "∞").toLocaleString()}`
                                                }
                                            </span>
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
                                      <Input 
                                          type="number" 
                                          step="any" 
                                          value={price.is_exact_price ? (price.price_exact ?? "") : (price.price_percentage ?? "")} 
                                          onChange={(e) => {
                                              const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                              handleUpdatePrice(price.id, price.is_exact_price ? "price_exact" : "price_percentage", val);
                                          }}
                                          className="w-24 h-7 text-sm px-1.5" 
                                          placeholder={price.is_exact_price ? "บาท" : "บาท/watt"} 
                                      />
                                  ) : (
                                      <div className="flex flex-col">
                                          <span className="font-medium">
                                              {(() => {
                                                  if (price.is_exact_price) {
                                                      return (price.price_exact || 0).toLocaleString();
                                                  }
                                                  const rate = price.price_percentage || 0;
                                                  const minTotal = rate * price.kw_min; 
                                                  if (!price.is_exact_kw && price.kw_max) {
                                                      const maxTotal = rate * price.kw_max;
                                                      return `${minTotal.toLocaleString()} - ${maxTotal.toLocaleString()}`;
                                                  }
                                                  return minTotal.toLocaleString();
                                              })()}
                                          </span>
                                          <span className="text-[10px] text-muted-foreground">
                                              {price.is_exact_price ? "" : `(x${price.price_percentage || 0})`}
                                          </span>
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
                
                {/* New Brand Row */}
                {isEditMode && (
                    <tr className="border-t bg-muted/20">
                        <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                                {isManualAdd ? (
                                    <div className="flex items-center gap-2 w-full">
                                        <Input
                                            value={newBrandInput}
                                            onChange={(e) => setNewBrandInput(e.target.value)}
                                            placeholder="ระบุชื่อยี่ห้อใหม่..."
                                            className="h-8 bg-background"
                                            autoFocus
                                        />
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setIsManualAdd(false);
                                                setNewBrandInput("");
                                            }}
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                            title="ยกเลิก"
                                        >
                                            <span className="text-lg">×</span>
                                        </Button>
                                    </div>
                                ) : (
                                    <Select
                                        value={newBrandInput}
                                        onValueChange={(val) => {
                                            if (val === "__NEW_BRAND__") {
                                                setIsManualAdd(true);
                                                setNewBrandInput("");
                                            } else {
                                                setNewBrandInput(val);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-8 w-full bg-background border-dashed">
                                            <SelectValue placeholder="+ เพิ่มยี่ห้อ..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {allBrandOptions
                                                .filter(opt => !Object.keys(groupedPrices).includes(opt.value))
                                                .map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                            ))}
                                            <div className="h-px bg-muted my-1" />
                                            <SelectItem value="__NEW_BRAND__" className="text-primary font-medium focus:bg-primary/10">
                                                <div className="flex items-center gap-2">
                                                    <PlusCircle className="h-4 w-4" />
                                                    <span>เพิ่มยี่ห้ออื่นๆ</span>
                                                </div>
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                )}

                                <Button
                                    size="sm"
                                    onClick={() => {
                                        if (newBrandInput) {
                                            handleAddBrand(newBrandInput);
                                            setNewBrandInput("");
                                            setIsManualAdd(false);
                                        }
                                    }}
                                    disabled={!newBrandInput}
                                    className="h-8 px-3 whitespace-nowrap"
                                >
                                    <Plus className="h-4 w-4 mr-1" /> เพิ่ม
                                </Button>
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
             <div><label className="text-sm font-semibold">เงื่อนไขชำระเงิน</label>{isEditMode ? <Input value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)}/> : <p className="text-sm">{paymentTerms || "-"}</p>}</div>
             <div><label className="text-sm font-semibold">เงื่อนไขรับประกัน</label>{isEditMode ? <Input value={warrantyTerms} onChange={e=>setWarrantyTerms(e.target.value)}/> : <p className="text-sm">{warrantyTerms || "-"}</p>}</div>
             <div><label className="text-sm font-semibold">หมายเหตุ</label>{isEditMode ? <Input value={note} onChange={e=>setNote(e.target.value)}/> : <p className="text-sm">{note || "-"}</p>}</div>
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
            { key: "kw_min", label: "Project Size/ Min Project size (Watt)" },
            { key: "kw_max", label: "Max Project Size (Watt)" },
            { key: "price", label: "Cost (Baht)" },
        ]}
        booleanFields={(importMode === "replace" || prices.length === 0) ? [
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

      <AlertDialog open={!!conflictDialog} onOpenChange={(open) => !open && setConflictDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
               ⚠️ พบช่วงข้อมูลซ้ำซ้อน
            </AlertDialogTitle>
            <AlertDialogDescription>
              ที่ยี่ห้อ <span className="font-bold text-foreground">{conflictDialog?.currItem.inverter_brand}</span>
              <br/><br/>
              ช่วง <b>{conflictDialog?.overlapText}</b> มีการทับซ้อนกันระหว่าง:
              <ul className="list-disc pl-5 mt-2 space-y-1 text-sm bg-muted/50 p-2 rounded">
                 <li>
                    <b>รายการก่อนหน้า:</b> {conflictDialog?.prevItem.kw_min} - {conflictDialog?.prevItem.kw_max ?? "∞"} 
                    <span className="text-muted-foreground ml-2">({conflictDialog?.prevItem.price.toLocaleString()} บาท)</span>
                 </li>
                 <li>
                    <b>รายการปัจจุบัน:</b> {conflictDialog?.currItem.kw_min} - {conflictDialog?.currItem.kw_max ?? "∞"} 
                    <span className="text-muted-foreground ml-2">({conflictDialog?.currItem.price.toLocaleString()} บาท)</span>
                 </li>
              </ul>
              <br/>
              คุณต้องการให้ช่วงที่ทับซ้อนกันมีราคาเท่ากับ
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row justify-center gap-4 sm:justify-center sm:space-x-0 w-full mt-2">
            
            <Button 
                variant="outline" 
                onClick={() => handleResolveConflict('KEEP_PREV')} 
                className="flex-1 h-auto py-3 border-2 hover:bg-muted hover:border-primary/50"
            >
              <div className="flex flex-col items-center">
                 <span className="text-xl font-bold text-foreground">{conflictDialog?.prevItem.price.toLocaleString()}</span>
                 <span className="text-xs text-muted-foreground">บาท</span>
              </div>
            </Button>

            <Button 
                onClick={() => handleResolveConflict('PRIORITIZE_CURR')} 
                className="flex-1 h-auto py-3 bg-blue-600 hover:bg-blue-700"
            >
              <div className="flex flex-col items-center">
                 <span className="text-xl font-bold text-white">{conflictDialog?.currItem.price.toLocaleString()}</span>
                 <span className="text-xs text-white/80">บาท</span>
              </div>
            </Button>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};