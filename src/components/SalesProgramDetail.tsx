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
  // Removed terms from here as they are now in the parent package
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

  // Initial Fetch
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchPackageDetails(), fetchPrices()]);
      setLoading(false);
    };
    fetchData();
  }, [programId]);

  // Handle click outside for brand suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowBrandSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ 1. Fetch Package Details (Terms)
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

  // ✅ 2. Fetch Prices (Children)
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

  // ✅ 3. Corrected Handle Save
  const handleSave = async () => {
    try {
      setLoading(true);

      // --- A. Save Terms to Parent (sale_packages) ---
      const { error: packageError } = await supabase
        .from("sale_packages")
        .update({
          payment_terms: paymentTerms,
          warranty_terms: warrantyTerms,
          note: note,
        })
        .eq("id", programId);

      if (packageError) throw packageError;

      // --- B. Handle Prices (sale_package_prices) ---
      
      // 1. Delete removed items
      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("sale_package_prices")
          .delete()
          .in("id", deletedIds);
        if (deleteError) throw deleteError;
      }

      // 2. Prepare Data for Upsert
      // Combine new (temp-) and existing records
      const recordsToUpsert = prices.map((price) => {
        // Remove temp ID if present
        const isNew = price.id.startsWith("temp-");
        const { id, ...rest } = price;
        
        return {
          ...(isNew ? {} : { id }), // Include ID only if it's not new
          ...rest,
          sale_package_id: programId,
          // ❌ Don't include terms here anymore
        };
      });

      if (recordsToUpsert.length > 0) {
        // Using upsert for both insert and update is cleaner if ID handling is correct,
        // but since we stripped IDs for new items, we might need separate calls 
        // OR let Supabase handle UUID generation.
        // Simplest way: Split like you did before.

        const newRecords = recordsToUpsert.filter(r => !r.id);
        const existingRecords = recordsToUpsert.filter(r => r.id);

        if (newRecords.length > 0) {
            const { error: insertError } = await supabase
                .from("sale_package_prices")
                .insert(newRecords as any);
            if (insertError) throw insertError;
        }

        if (existingRecords.length > 0) {
            const { error: updateError } = await supabase
                .from("sale_package_prices")
                .upsert(existingRecords as any);
            if (updateError) throw updateError;
        }
      }

      toast({ title: "บันทึกสำเร็จ", description: "ข้อมูลถูกบันทึกเรียบร้อยแล้ว" });

      // Reset & Reload
      setDeletedIds([]);
      setIsEditMode(false);
      await Promise.all([fetchPackageDetails(), fetchPrices()]);

    } catch (error) {
      console.error("Save Error:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกข้อมูลได้", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ... (Keep the rest of your helper functions: handleAddBrand, handleAddSize, etc. as they are) ...
  // ... (Keep your formatting logic and UI render code as is) ...

  const handleAddBrand = async (brandValue?: string) => {
     // ... (Your existing logic) ...
     // just copy-paste the rest of your handlers here
     // Ensure when creating `newPrice` object, you DON'T include payment_terms etc.
     
     /* Example of corrected newPrice object in handlers:
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
        // payment_terms: paymentTerms, // <--- REMOVE THIS
        // warranty_terms: warrantyTerms, // <--- REMOVE THIS
        // note: note, // <--- REMOVE THIS
     };
     */
     
     // I will provide the full handlers below for clarity to ensure no fields are missed.
     
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
  
  const brandNames: Partial<Record<InverterBrand, string>> = { huawei: "Huawei", huawei_optimizer: "Huawei Optimizer", solaredge: "SolarEdge" };
  
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
              <Button variant="outline" size="sm"><Copy className="h-4 w-4 mr-2" />คัดลอกตาราง</Button>
              <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-2" />แทนที่ตาราง</Button>
              <Button variant="outline" size="sm"><PlusCircle className="h-4 w-4 mr-2" />เพิ่มตาราง</Button>
            </>
          )}
          {isEditMode ? <Button onClick={handleSave}>บันทึก</Button> : <Button onClick={() => setIsEditMode(true)}>แก้ไข</Button>}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left - Table */}
        <div className="lg:col-span-4">
          <div className="border rounded-lg">
            <table className="w-full">
               {/* ... (Keep your table Header and Body logic exactly as is) ... */}
               {/* Just ensure to copy the table render part from your original code */}
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
                                {/* ... (Your existing Row Rendering Logic) ... */}
                                {/* Copy the <td> cells for Brand, Size, Phase, Price from your code */}
                                {/* They are purely UI and don't change logic */}
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
                                
                                {/* ... The rest of your columns (Size, Phase, Price) ... */}
                                <td className="px-2 py-1.5 border-r">
                                    <div className="flex items-center gap-1">
                                        {isEditMode && <button onClick={() => handleDeletePrice(price.id)} className="text-destructive"><Minus className="h-4 w-4" /></button>}
                                        {/* ... Size Inputs ... */}
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
                                    {/* ... Price Inputs (Same logic as yours) ... */}
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
                                                  {/* logic for displaying range price if needed */}
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
                 {/* Add Brand Input Row (Keep your existing) */}
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

        {/* Right - Terms (Updated to use State) */}
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
    </div>
  );
};