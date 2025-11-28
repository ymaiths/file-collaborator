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
import { Minus, Plus, Copy, Upload, PlusCircle, Check } from "lucide-react";
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
  payment_terms: string | null;
  warranty_terms: string | null;
  note: string | null;
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
  const [paymentTerms, setPaymentTerms] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [note, setNote] = useState("");
  const [newBrandInput, setNewBrandInput] = useState("");
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [customBrandNames, setCustomBrandNames] = useState<
    Record<string, string>
  >({});
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPrices();
  }, [programId]);

  useEffect(() => {
    // Get terms from first price entry
    if (prices.length > 0) {
      setPaymentTerms(prices[0]?.payment_terms || "");
      setWarrantyTerms(prices[0]?.warranty_terms || "");
      setNote(prices[0]?.note || "");
    }
  }, [prices]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // เช็คว่าคลิกเกิดขึ้น "นอกกล่อง Container" หรือไม่
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowBrandSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPrices = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    console.log("Program ID:", programId);
    try {
      setLoading(true); // เพิ่ม loading state เพื่อกัน User กดซ้ำ

      // 1. ลบรายการที่ถูกลบออกจาก DB
      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from("sale_package_prices")
          .delete()
          .in("id", deletedIds);

        if (deleteError) {
          console.error("Delete Error:", deleteError);
          throw deleteError;
        }
      }

      // 2. แยกรายการ "ใหม่" (Insert)
      const newRecords = prices
        .filter((price) => price.id.startsWith("temp-"))
        .map((price) => {
          // ตัด ID ชั่วคราว (temp-...) ทิ้งไป เพื่อให้ DB สร้าง ID จริงให้
          const { id, ...rest } = price;
          return {
            ...rest,
            sale_package_id: programId, // <--- [สำคัญ] ระบุว่าราคานี้เป็นของโปรแกรมนี้
            payment_terms: paymentTerms,
            warranty_terms: warrantyTerms,
            note: note,
          };
        });

      // 3. แยกรายการ "เก่า" (Update/Upsert)
      const existingRecords = prices
        .filter((price) => !price.id.startsWith("temp-"))
        .map((price) => ({
          ...price,
          sale_package_id: programId, // <--- [สำคัญ] ย้ำ ID แม่อีกครั้งกันพลาด
          payment_terms: paymentTerms,
          warranty_terms: warrantyTerms,
          note: note,
        }));

      // 4. สั่งบันทึก
      if (newRecords.length > 0) {
        // ใช้ as any เพื่อเลี่ยงปัญหา Type ที่ยังไม่อัปเดต
        const { error: insertError } = await supabase
          .from("sale_package_prices")
          .insert(newRecords as any);

        if (insertError) {
          console.error("Insert Error:", insertError);
          throw insertError;
        }
      }

      if (existingRecords.length > 0) {
        const { error: updateError } = await supabase
          .from("sale_package_prices")
          .upsert(existingRecords as any);

        if (updateError) {
          console.error("Update Error:", updateError);
          throw updateError;
        }
      }

      toast({
        title: "บันทึกสำเร็จ",
        description: "ข้อมูลถูกบันทึกเรียบร้อยแล้ว",
      });

      // Reset ค่าต่างๆ
      setDeletedIds([]);
      setIsEditMode(false);
      await fetchPrices(); // โหลดข้อมูลใหม่
    } catch (error) {
      console.error("Final Save Error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description:
          error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBrand = async (brandValue?: string) => {
    let brandToUse: InverterBrand = "huawei";

    if (brandValue) {
      // Convert input to snake_case for comparison
      const normalizedInput = brandValue
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");

      // Check if the brand already exists in the enum (by enum value or display name)
      const existingBrand = allBrandOptions.find(
        (opt) =>
          opt.value === brandValue ||
          opt.value === normalizedInput ||
          opt.label.toLowerCase() === brandValue.toLowerCase()
      );

      if (existingBrand) {
        // Use existing brand
        brandToUse = existingBrand.value as InverterBrand;
      } else {
        // Add new brand to enum
        try {
          const { error } = await supabase.functions.invoke(
            "add-inverter-brand",
            {
              body: { brandName: brandValue },
            }
          );

          if (error) {
            console.error("Error adding brand:", error);
            toast({
              title: "เกิดข้อผิดพลาด",
              description: "ไม่สามารถเพิ่ม brand ใหม่ได้",
              variant: "destructive",
            });
            return;
          }

          brandToUse = normalizedInput as InverterBrand;

          // Store the original brand name for display
          setCustomBrandNames((prev) => ({
            ...prev,
            [normalizedInput]: brandValue,
          }));

          toast({
            title: "เพิ่ม brand สำเร็จ",
            description: `เพิ่ม ${brandValue} เรียบร้อยแล้ว`,
          });
        } catch (error) {
          console.error("Error:", error);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถเพิ่ม brand ใหม่ได้",
            variant: "destructive",
          });
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
      payment_terms: paymentTerms,
      warranty_terms: warrantyTerms,
      note: note,
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
      payment_terms: paymentTerms,
      warranty_terms: warrantyTerms,
      note: note,
    };

    // Insert after the last price of this brand
    const lastIndex = prices.lastIndexOf(lastPrice);
    const newPrices = [...prices];
    newPrices.splice(lastIndex + 1, 0, newPrice);
    setPrices(newPrices);
  };

  const handleDeletePrice = (id: string) => {
    // ถ้าเป็นข้อมูลเก่า (ไม่มีคำว่า temp-) ให้เก็บ ID ไว้ลบออกจาก DB ทีหลัง
    if (!id.startsWith("temp-")) {
      setDeletedIds((prev) => [...prev, id]);
    }
    setPrices(prices.filter((p) => p.id !== id));
  };

  const handleUpdatePrice = (
    id: string,
    field: keyof SalePackagePrice,
    value: any
  ) => {
    setPrices(prices.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  // Group prices by inverter brand
  const groupedPrices = prices.reduce((acc, price) => {
    const brand = price.inverter_brand;
    if (!acc[brand]) {
      acc[brand] = [];
    }
    acc[brand].push(price);
    return acc;
  }, {} as Record<InverterBrand, SalePackagePrice[]>);

  const formatBrandName = (brand: string): string => {
    return brand
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getBrandDisplayName = (brand: string): string => {
    return (
      customBrandNames[brand] ||
      brandNames[brand as InverterBrand] ||
      formatBrandName(brand)
    );
  };

  const brandNames: Partial<Record<InverterBrand, string>> = {
    huawei: "Huawei",
    huawei__optimizer: "Huawei Optimizer",
    solaredge: "SolarEdge",
  };

  const allBrandOptions = React.useMemo(() => {
    const options = Object.entries(brandNames).map(([value, label]) => ({
      value,
      label,
    }));
    const customOptions = Object.entries(customBrandNames).map(
      ([value, label]) => ({ value, label })
    );
    return [
      ...options,
      ...customOptions.filter((opt) => !brandNames[opt.value as InverterBrand]),
    ];
  }, [customBrandNames]);

  const phaseNames: Record<ElectronicPhase, string> = {
    single_phase: "1Ph",
    three_phase: "3Ph",
  };

  if (loading) {
    return <div className="p-4">กำลังโหลด...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 p-4 border rounded-lg bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>
            ←
          </Button>
          <h2 className="text-xl font-semibold">{programName}</h2>
        </div>
        <div className="flex gap-2">
          {isEditMode && (
            <>
              <Button variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-2" />
                คัดลอกตาราง
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                แทนที่ตาราง
              </Button>
              <Button variant="outline" size="sm">
                <PlusCircle className="h-4 w-4 mr-2" />
                เพิ่มตาราง
              </Button>
            </>
          )}
          {isEditMode ? (
            <Button onClick={handleSave}>บันทึก</Button>
          ) : (
            <Button onClick={() => setIsEditMode(true)}>แก้ไข</Button>
          )}
        </div>
      </div>

      {/* Content - Two sections */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left - Table */}
        <div className="lg:col-span-4">
          <div className="border rounded-lg">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-sm">
                    Inverter Brand
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-sm">
                    ขนาดการติดตั้ง
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-sm">
                    ประเภทไฟบ้าน
                  </th>
                  <th className="px-2 py-1.5 text-left font-medium text-sm">
                    ราคาโครงการ
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(groupedPrices).map(
                  ([brand, brandPrices], brandIndex) => (
                    <React.Fragment key={brand}>
                      {brandPrices.map((price, priceIndex) => (
                        <tr key={price.id} className="border-t">
                          {/* Inverter Brand - merged cell */}
                          {priceIndex === 0 && (
                            <td
                              className="px-2 py-1.5 align-top border-r"
                              rowSpan={
                                brandPrices.length + (isEditMode ? 1 : 0)
                              }
                            >
                              <div className="flex items-center gap-1">
                                {isEditMode && (
                                  <button
                                    onClick={() => {
                                      // 1. หา ID ของรายการที่จะถูกลบ (เฉพาะรายการที่มีอยู่ใน DB แล้ว)
                                      const idsToDelete = prices
                                        .filter(
                                          (p) =>
                                            p.inverter_brand === brand &&
                                            !p.id.startsWith("temp-")
                                        )
                                        .map((p) => p.id);

                                      // 2. เก็บ ID พวกนี้ลงถังขยะ (deletedIds) เพื่อรอสั่งลบตอนกด Save
                                      setDeletedIds((prev) => [
                                        ...prev,
                                        ...idsToDelete,
                                      ]);

                                      // 3. ลบออกจากหน้าจอ (UI) ตามปกติ
                                      setPrices(
                                        prices.filter(
                                          (p) => p.inverter_brand !== brand
                                        )
                                      );
                                    }}
                                    className="text-destructive hover:text-destructive/80"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                )}
                                {isEditMode ? (
                                  <Select
                                    value={brand}
                                    onValueChange={(value) => {
                                      // Update all prices of this brand to new brand
                                      setPrices(
                                        prices.map((p) =>
                                          p.inverter_brand === brand
                                            ? {
                                                ...p,
                                                inverter_brand:
                                                  value as InverterBrand,
                                              }
                                            : p
                                        )
                                      );
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {allBrandOptions.map((opt) => (
                                        <SelectItem
                                          key={opt.value}
                                          value={opt.value}
                                        >
                                          {opt.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <span>{getBrandDisplayName(brand)}</span>
                                )}
                              </div>
                            </td>
                          )}
                          {/* Size */}
                          <td className="px-2 py-1.5 border-r">
                            <div className="flex items-center gap-1">
                              {isEditMode && (
                                <button
                                  onClick={() => handleDeletePrice(price.id)}
                                  className="text-destructive hover:text-destructive/80"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                              )}
                              {isEditMode ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    step="any"
                                    value={price.kw_min}
                                    onChange={(e) =>
                                      handleUpdatePrice(
                                        price.id,
                                        "kw_min",
                                        parseFloat(e.target.value)
                                      )
                                    }
                                    className="w-16 h-7 text-sm px-1.5"
                                  />
                                  {!price.is_exact_kw && (
                                    <>
                                      <span className="text-xs">-</span>
                                      <Input
                                        type="number"
                                        step="any"
                                        value={price.kw_max || ""}
                                        onChange={(e) =>
                                          handleUpdatePrice(
                                            price.id,
                                            "kw_max",
                                            parseFloat(e.target.value)
                                          )
                                        }
                                        className="w-16 h-7 text-sm px-1.5"
                                      />
                                    </>
                                  )}
                                  <Select
                                    value={
                                      price.is_exact_kw ? "exact" : "range"
                                    }
                                    onValueChange={(value) =>
                                      handleUpdatePrice(
                                        price.id,
                                        "is_exact_kw",
                                        value === "exact"
                                      )
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-20 text-xs px-1.5">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="exact">
                                        Exact
                                      </SelectItem>
                                      <SelectItem value="range">
                                        Range
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              ) : (
                                <span>
                                  {price.is_exact_kw
                                    ? price.kw_min
                                    : `${price.kw_min} - ${price.kw_max}`}
                                </span>
                              )}
                            </div>
                          </td>
                          {/* Phase */}
                          <td className="px-2 py-1.5 border-r">
                            {isEditMode ? (
                              <Select
                                value={price.electronic_phase}
                                onValueChange={(value) =>
                                  handleUpdatePrice(
                                    price.id,
                                    "electronic_phase",
                                    value
                                  )
                                }
                              >
                                <SelectTrigger className="h-7 w-16 text-xs px-1.5">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="single_phase">
                                    1Ph
                                  </SelectItem>
                                  <SelectItem value="three_phase">
                                    3Ph
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span>{phaseNames[price.electronic_phase]}</span>
                            )}
                          </td>
                          {/* Price */}
                          <td className="px-2 py-1.5">
                            {(() => {
                              const isExact = price.is_exact_price;
                              const valExact = price.price_exact;
                              const valPercent = price.price_percentage;
                              const kwMin = price.kw_min || 0;
                              const kwMax = price.kw_max || kwMin;
                              const isRange =
                                price.kw_max && price.kw_max !== price.kw_min;

                              // calulate for display
                              const displayMin = isExact
                                ? valExact || 0
                                : (valPercent || 0) * kwMin * 1000;

                              const displayMax = isExact
                                ? valExact || 0
                                : (valPercent || 0) * kwMax * 1000;

                              return isEditMode ? (
                                // --- (Edit Mode) ---
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-1">
                                    {/* input price */}
                                    <Input
                                      type="number"
                                      step="any"
                                      value={
                                        isExact
                                          ? valExact ?? ""
                                          : valPercent ?? ""
                                      }
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const value =
                                          raw === "" ? null : parseFloat(raw);

                                        if (isExact) {
                                          handleUpdatePrice(
                                            price.id,
                                            "price_exact",
                                            value
                                          );
                                        } else {
                                          handleUpdatePrice(
                                            price.id,
                                            "price_percentage",
                                            value
                                          );
                                        }
                                      }}
                                      className="w-20 h-7 text-sm px-1.5"
                                      placeholder={isExact ? "บาท" : "c"}
                                    />

                                    {/* exact or percent */}
                                    <Select
                                      value={isExact ? "exact" : "percent"}
                                      onValueChange={(value) => {
                                        handleUpdatePrice(
                                          price.id,
                                          "is_exact_price",
                                          value === "exact"
                                        );
                                      }}
                                    >
                                      <SelectTrigger className="h-7 w-16 text-xs px-1.5 bg-muted/50">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="exact">
                                          bath
                                        </SelectItem>
                                        <SelectItem value="percent">
                                          bath/watt
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Preview */}
                                  {!isExact && (
                                    <div className="text-xs text-muted-foreground whitespace-nowrap px-1">
                                      = {displayMin.toLocaleString()}
                                      {isRange &&
                                        ` - ${displayMax.toLocaleString()}`}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // --- (View Mode) ---
                                <div className="flex flex-col">
                                  {/* display price */}
                                  <span className="font-medium">
                                    {displayMin.toLocaleString()}
                                    {/* show - max */}
                                    {!isExact &&
                                      isRange &&
                                      ` - ${displayMax.toLocaleString()}`}
                                  </span>

                                  {/* indicate type */}
                                  <span className="text-[10px] text-muted-foreground">
                                    {isExact ? "" : `(x${valPercent || 0})`}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                      {/* Add Item row for this brand group */}
                      {isEditMode && (
                        <tr className="border-t">
                          <td className="px-2 py-1" colSpan={3}>
                            <button
                              onClick={() =>
                                handleAddSize(brand as InverterBrand)
                              }
                              className="flex items-center gap-2 text-primary hover:text-primary/80"
                            >
                              <Plus className="h-4 w-4" />
                              <span>Add Item</span>
                            </button>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                )}
                {isEditMode && (
                  <tr className="border-t">
                    <td className="px-2 py-1.5">
                      <div className="relative" ref={containerRef}>
                        <div className="flex items-center gap-2">
                          <Input
                            value={newBrandInput}
                            onChange={(e) => setNewBrandInput(e.target.value)}
                            onFocus={() => setShowBrandSuggestions(true)}
                            placeholder="เลือกหรือกรอก brand ใหม่"
                            className="h-8"
                          />
                          <button
                            onClick={() => handleAddBrand(newBrandInput)}
                            className="text-primary hover:text-primary/80"
                            disabled={!newBrandInput}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        {showBrandSuggestions && (
                          <div className="absolute z-[100] w-full top-full mb-1 bg-background border rounded-md shadow-lg">
                            <div className="p-2 space-y-1">
                              {allBrandOptions.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setShowBrandSuggestions(false);
                                    handleAddBrand(opt.value);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-muted rounded-sm text-sm"
                                >
                                  {opt.label}
                                </button>
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
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">ข้อกำหนด</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                เงื่อนไขการชำระเงิน
              </label>
              {isEditMode ? (
                <Input
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="กรอกเงื่อนไขการชำระเงิน"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {paymentTerms || "-"}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                เงื่อนไขการรับประกัน
              </label>
              {isEditMode ? (
                <Input
                  value={warrantyTerms}
                  onChange={(e) => setWarrantyTerms(e.target.value)}
                  placeholder="กรอกเงื่อนไขการรับประกัน"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {warrantyTerms || "-"}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">หมายเหตุ</label>
              {isEditMode ? (
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="กรอกหมายเหตุ"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{note || "-"}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
