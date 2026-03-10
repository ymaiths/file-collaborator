import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ExcelImportModal } from "./ExcelImportModal";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ProductCategory = string; 

interface Product {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  cost_fixed: number | null;
  cost_percentage: number | null;
  is_fixed_cost: boolean;
  fixed_installation_cost: number | null;
  installation_cost_percentage: number | null;
  is_fixed_installation_cost: boolean;
  min_kw: number | null;
  max_kw: number | null;
  is_exact_kw: boolean;
  is_price_included: boolean;
  product_category: ProductCategory;
  electrical_phase: string | null;
}

interface EquipmentCategoryDetailProps {
  categoryName: string;
  categoryId: string;
  onBack: () => void;
  onRenameSuccess?: (oldId: string, newName: string) => void;
}

export const EquipmentCategoryDetail = ({
  categoryName,
  categoryId,
  onBack,
  onRenameSuccess,
}: EquipmentCategoryDetailProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedName, setEditedName] = useState(categoryName);
  
  // เช็ค System Category จากชื่อที่ขึ้นต้นด้วย STANDARD
  const isSystemCat = categoryId.startsWith("STANDARD ");
  const isRowLevelConfig = categoryId === "STANDARD Included Price Items" || categoryId === "STANDARD Excluded Price Items";
  
  // Global settings (ใช้สำหรับหมวดปกติที่ไม่ใช่ Row-level)
  const [isPriceIncluded, setIsPriceIncluded] = useState(true);
  const [isFixedCost, setIsFixedCost] = useState(true);
  const [isFixedInstallationCost, setIsFixedInstallationCost] = useState(true);
  const [isExactKw, setIsExactKw] = useState(true);

  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importBooleans, setImportBooleans] = useState<Record<string, boolean>>({});

  // Conflict Dialog State
  const [conflictDialog, setConflictDialog] = useState<{
    isOpen: boolean;
    prevItem: Product; 
    currItem: Product; 
    overlapText: string;
  } | null>(null);

  const currentCategory = categoryId; 

  // ดึงสิทธิ์จากเครื่อง (Admin / General แก้ไขได้)
  const userRole = localStorage.getItem("userRole");
  const canEdit = userRole === "admin" || userRole === "general";

  useEffect(() => {
    if (products.length > 0) {
      setIsPriceIncluded(products[0]?.is_price_included ?? true);
      
      if (!isRowLevelConfig) {
        setIsFixedCost(products[0]?.is_fixed_cost ?? true);
        setIsExactKw(products[0]?.is_exact_kw ?? true);
        setIsFixedInstallationCost(products[0]?.is_fixed_installation_cost ?? true);
      }
    }
  }, [products.length, isRowLevelConfig]);

  useEffect(() => {
    fetchProducts();
  }, [currentCategory]);

  const fetchProducts = async (catName = currentCategory) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("product_category", catName); 

      if (error) throw error;
      
      // 🌟 ทริค: แปลงค่า null จาก DB ให้เป็น "no_phase" เพื่อโชว์ในเว็บ
      const formattedData = (data || []).map(p => ({
          ...p,
          electrical_phase: p.electrical_phase || "no_phase"
      }));
      setProducts(formattedData as unknown as Product[]);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const openImportModal = (mode: "append" | "replace") => {
    setImportMode(mode);
    setImportBooleans({
      is_dynamic_cost: !isFixedCost,
      is_dynamic_install: !isFixedInstallationCost,
      is_range_kw: !isExactKw,
      is_price_included: isPriceIncluded,
    });
    setIsImportModalOpen(true);
  };

  const handleImportEquipment = async (data: any[], booleanValues: Record<string, boolean>) => {
    if (!canEdit) return; 

    const isReplace = importMode === "replace";

    const _isFixedCost = isReplace ? !booleanValues.is_dynamic_cost : isFixedCost;
    const _isFixedInst = isReplace ? !booleanValues.is_dynamic_install : isFixedInstallationCost;
    const _isExactKw = isReplace ? !booleanValues.is_range_kw : isExactKw;
    const _isPriceIncluded = isReplace ? booleanValues.is_price_included : isPriceIncluded;

    const newItems = data.map((row) => {
      const hasInstallCost = row.install_cost !== undefined && row.install_cost !== null && String(row.install_cost).trim() !== "";
      const finalIsFixedInst = hasInstallCost ? _isFixedInst : false;
      const finalFixedInstVal = hasInstallCost && _isFixedInst ? (parseFloat(row.install_cost) || 0) : null;
      const finalPercentInstVal = !hasInstallCost ? 0.2 : (!finalIsFixedInst ? (parseFloat(row.install_cost) || 0) : null);

      // แปลง Phase จาก Excel
      const rawPhase = String(row.phase || "").toLowerCase();
      let finalPhase = "no_phase";
      if (rawPhase.includes("1") || rawPhase.includes("single")) finalPhase = "single_phase";
      if (rawPhase.includes("3") || rawPhase.includes("three")) finalPhase = "three_phase";

      return {
        id: `temp-${Date.now()}-${Math.random()}`,
        product_category: currentCategory,
        name: row.name || "",
        brand: row.brand || "",
        unit: row.unit || "set",
        is_fixed_cost: _isFixedCost,
        cost_fixed: _isFixedCost ? (parseFloat(row.cost) || 0) : null,
        cost_percentage: !_isFixedCost ? (parseFloat(row.cost) || 0) : null,
        is_fixed_installation_cost: finalIsFixedInst,
        fixed_installation_cost: finalFixedInstVal,
        installation_cost_percentage: finalPercentInstVal,
        is_exact_kw: _isExactKw,
        min_kw: parseFloat(row.kw_min) || 0,
        max_kw: !_isExactKw ? (parseFloat(row.kw_max) || 0) : null,
        is_price_included: _isPriceIncluded,
        electrical_phase: finalPhase, // 🌟 ใช้ Phase ที่จัดรูปแบบแล้ว
      };
    });

    if (isReplace) {
      const hasRealItems = products.some(p => !p.id.startsWith("temp-"));
      if (hasRealItems) {
         const { error } = await supabase.from("products").delete().eq("product_category", currentCategory);
         if (error) {
             toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบข้อมูลเก่าได้", variant: "destructive" });
             return;
         }
      }
      setProducts(newItems);
      setIsPriceIncluded(_isPriceIncluded);
  
      if (!isRowLevelConfig) {
        setIsFixedCost(_isFixedCost);
        setIsFixedInstallationCost(_isFixedInst);
        setIsExactKw(_isExactKw);
      }
      toast({ title: "แทนที่ตารางสำเร็จ", description: `นำเข้าข้อมูลใหม่ ${newItems.length} รายการ` });
    } else {
      setProducts((prev) => [...prev, ...newItems]);
      toast({ title: "เพิ่มตารางสำเร็จ", description: `เพิ่มข้อมูล ${newItems.length} รายการ` });
    }
  };

  const handleAddItem = () => {
    if (!canEdit) return; 
    const newProduct: Product = {
      id: `temp-${Date.now()}`,
      name: "",
      brand: "",
      unit: "set",
      cost_fixed: null,
      cost_percentage: null,
      is_fixed_cost: isRowLevelConfig ? true : isFixedCost,
      fixed_installation_cost: null,
      installation_cost_percentage: null,
      is_fixed_installation_cost: isRowLevelConfig ? true : isFixedInstallationCost,
      min_kw: null,
      max_kw: null,
      is_exact_kw: isRowLevelConfig ? true : isExactKw,
      is_price_included: isPriceIncluded,
      product_category: currentCategory, 
      electrical_phase: "no_phase", // 🌟 ตั้งค่าเริ่มต้นเป็น No Phase
    };
    setProducts([...products, newProduct]);
  };

  const handleDeleteItem = async (id: string) => {
    if (!canEdit) return; 
    if (id.startsWith("temp-")) {
      setProducts(products.filter((p) => p.id !== id));
      return;
    }
    try {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      setProducts(products.filter((p) => p.id !== id));
      toast({ title: "ลบสำเร็จ" });
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  const handleUpdateProduct = (id: string, field: keyof Product, value: any) => {
    setProducts(products.map((p) => {
      if (p.id !== id) return p;
      const updatedItem = { ...p, [field]: value };
      
      if (field === "is_fixed_cost") {
        updatedItem.cost_fixed = value ? updatedItem.cost_fixed : null;
        updatedItem.cost_percentage = value ? null : updatedItem.cost_percentage;
      }
      if (field === "is_fixed_installation_cost") {
        updatedItem.fixed_installation_cost = value ? updatedItem.fixed_installation_cost : null;
        updatedItem.installation_cost_percentage = value ? null : updatedItem.installation_cost_percentage;
      }
      if (field === "is_exact_kw") {
        updatedItem.max_kw = value ? null : updatedItem.max_kw;
      }
      return updatedItem;
    }));
  };

  const handlePriceIncludedChange = (checked: boolean) => {
    setIsPriceIncluded(checked);
    setProducts(products.map((p) => ({ ...p, is_price_included: checked }))); // 🌟 อัปเดตทุกแถวเสมอ
  };
  const handleFixedCostChange = (isFixed: boolean) => {
    setIsFixedCost(isFixed);
    if (!isRowLevelConfig) setProducts(products.map((p) => ({ ...p, is_fixed_cost: isFixed, cost_fixed: isFixed ? p.cost_fixed : null, cost_percentage: isFixed ? null : p.cost_percentage })));
  };
  const handleFixedInstallationCostChange = (isFixed: boolean) => {
    setIsFixedInstallationCost(isFixed);
    if (!isRowLevelConfig) setProducts(products.map((p) => ({ ...p, is_fixed_installation_cost: isFixed, fixed_installation_cost: isFixed ? p.fixed_installation_cost : null, installation_cost_percentage: isFixed ? null : p.installation_cost_percentage })));
  };
  const handleExactKwChange = (isExact: boolean) => {
    setIsExactKw(isExact);
    if (!isRowLevelConfig) setProducts(products.map((p) => ({ ...p, is_exact_kw: isExact, max_kw: isExact ? null : p.max_kw })));
  };

  // 🌟 ระบบดักจับการทับซ้อน (อัปเดตเงื่อนไขใหม่ตามที่ตกลง)
  const checkAndResolveOverlaps = () => {
    const grouped = products.reduce((acc, p) => {
        let key = "ALL";
        
        if (currentCategory === "STANDARD Inverter / Zero Export / Smart Logger") {
            // กลุ่ม 1: เช็คแค่ ยี่ห้อ + เฟส (ไม่สนชื่อ)
            key = `${p.brand}|${p.electrical_phase}`; 
        } else if (
            currentCategory === "STANDARD Operation" || 
            currentCategory === "STANDARD PV Mounting Structure" || 
            currentCategory === "STANDARD Cable" || 
            isRowLevelConfig
        ) {
            // กลุ่ม 2: เช็คแค่ ชื่อ อย่างเดียว
            key = `${p.name}`;
        }
        
        if (!acc[key]) acc[key] = [];
        acc[key].push(p);
        return acc;
    }, {} as Record<string, Product[]>);

    for (const key in grouped) {
        const validItems = grouped[key].filter(p => p.min_kw !== null);
        
        const sorted = [...validItems].sort((a, b) => {
            const aMin = Number(a.min_kw) || 0;
            const bMin = Number(b.min_kw) || 0;
            if (aMin !== bMin) return aMin - bMin;
            const aMax = a.is_exact_kw ? aMin : (Number(a.max_kw) || Infinity);
            const bMax = b.is_exact_kw ? bMin : (Number(b.max_kw) || Infinity);
            return bMax - aMax; 
        });
        
        for (let i = 0; i < sorted.length - 1; i++) {
            const prev = sorted[i]; 
            const curr = sorted[i+1]; 
            const prevStart = Number(prev.min_kw) || 0;
            const prevMax   = prev.is_exact_kw ? prevStart : (Number(prev.max_kw) || Infinity);
            const currStart = Number(curr.min_kw) || 0;
            const currMax   = curr.is_exact_kw ? currStart : (Number(curr.max_kw) || Infinity);

            if (currStart <= prevMax) {
                const overlapStart = Math.max(prevStart, currStart);
                const overlapEnd   = Math.min(prevMax, currMax);

                setConflictDialog({
                    isOpen: true,
                    prevItem: prev,
                    currItem: curr,
                    overlapText: (prev.is_exact_kw && curr.is_exact_kw) 
                                 ? `${overlapStart}` 
                                 : `${overlapStart} - ${overlapEnd === Infinity ? '∞' : overlapEnd}` 
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
      let newProducts = [...products];

      const pMin = Number(prevItem.min_kw) || 0;
      const pMax = prevItem.is_exact_kw ? pMin : (Number(prevItem.max_kw) || Infinity);
      const cMin = Number(currItem.min_kw) || 0;
      const cMax = currItem.is_exact_kw ? cMin : (Number(currItem.max_kw) || Infinity);
      const isExactMatchOverlap = prevItem.is_exact_kw && currItem.is_exact_kw && pMin === cMin;
      const gapSize = currentCategory === "STANDARD Solar Panel" ? 1 : 1000;
      const GAP = isExactMatchOverlap ? 0 : gapSize;
      const isMiddleSplit = (cMin > pMin) && (cMax < pMax);
      if (choice === 'PRIORITIZE_CURR') {
          if (isMiddleSplit) {
              const newPrevMax = cMin - GAP; 
              newProducts = newProducts.map(p => p.id === prevItem.id ? { ...p, max_kw: newPrevMax } : p);
              const splitItem: Product = {
                  ...prevItem,
                  id: `temp-split-${Date.now()}`,
                  min_kw: cMax + GAP,
                  max_kw: prevItem.max_kw
              };
              newProducts.push(splitItem);
          } else {
              if (pMin < cMin) {
                  const newMax = cMin - GAP;
                  newProducts = newProducts.map(p => p.id === prevItem.id ? { ...p, max_kw: newMax } : p);
              } else {
                  const newMin = (cMax === Infinity ? pMax : cMax) + GAP; 
                  if (newMin >= pMax) { 
                      newProducts = newProducts.filter(p => p.id !== prevItem.id);
                  } else {
                      newProducts = newProducts.map(p => p.id === prevItem.id ? { ...p, min_kw: newMin } : p);
                  }
              }
          }
      } else {
          if (isMiddleSplit) {
              newProducts = newProducts.filter(p => p.id !== currItem.id);
          } else {
              if (cMin < pMin) {
                  const newMax = pMin - GAP;
                  newProducts = newProducts.map(p => p.id === currItem.id ? { ...p, max_kw: newMax } : p);
              } else {
                  const newMin = (pMax === Infinity ? cMax : pMax) + GAP;
                  if (newMin >= cMax) { 
                      newProducts = newProducts.filter(p => p.id !== currItem.id);
                  } else {
                      newProducts = newProducts.map(p => p.id === currItem.id ? { ...p, min_kw: newMin } : p);
                  }
              }
          }
      }
      
      setProducts(newProducts);
      setConflictDialog(null);
  };

  const handleSaveAll = async () => {
    if (!canEdit) return; 

    try {
      if (checkAndResolveOverlaps()) {
          return; 
      }

      if (editedName !== categoryName) {
        if (isSystemCat) {
           toast({ title: "ไม่อนุญาตให้เปลี่ยนชื่อ", description: `"${categoryName}" เป็นหมวดหมู่มาตรฐานของระบบ`, variant: "destructive" });
           setEditedName(categoryName); 
           return; 
        }
        if (!editedName.trim()) {
           toast({ title: "เกิดข้อผิดพลาด", description: "ชื่อหมวดหมู่ห้ามว่างเปล่า", variant: "destructive" });
           return;
        }
        const { error: renameError } = await supabase.from("products").update({ product_category: editedName.trim() }).eq("product_category", currentCategory);
        if (renameError) throw renameError;
        if (onRenameSuccess) onRenameSuccess(categoryId, editedName.trim());
      }

      const categoryToSave = (!isSystemCat) ? editedName.trim() : currentCategory; 
      for (const product of products) {
        // 🌟 ทริคพิเศษ: แปลง "no_phase" กลับไปเป็น null ก่อนเซฟลง Database เพื่อป้องกัน Enum Error
        const dbPhase = product.electrical_phase === "no_phase" ? null : product.electrical_phase;

        if (product.id.startsWith("temp-")) {
          const { id, electrical_phase, ...productData } = product;
          const { error } = await supabase.from("products").insert([{ ...productData, product_category: categoryToSave, electrical_phase: dbPhase }]);
          if (error) throw error;
        } else {
          const { id, electrical_phase, ...updateData } = product;
          const { error } = await supabase.from("products").update({ ...updateData, product_category: categoryToSave, electrical_phase: dbPhase }).eq("id", id);
          if (error) throw error;
        }
      }
      
      await fetchProducts(categoryToSave);
      setIsEditMode(false);
      toast({ title: "บันทึกสำเร็จ", description: "บันทึกข้อมูลเรียบร้อยแล้ว" });
    } catch (error) {
      console.error("Error saving products:", error);
      toast({ title: "เกิดข้อผิดพลาดในการบันทึก", variant: "destructive" });
    }
  };

  // ตัวป้องกัน Product เป็น undefined
  const formatCost = (product: Product | undefined, type: "equipment" | "installation") => {
    if (!product) return "-";
    if (type === "equipment") {
      if (product.is_fixed_cost) return product.cost_fixed?.toLocaleString() || "-";
      return `${product.cost_percentage?.toLocaleString() || 0}%`;
    } else {
      if (product.is_fixed_installation_cost) return product.fixed_installation_cost?.toLocaleString() || "-";
      return `${product.installation_cost_percentage?.toLocaleString() || 0}%`;
    }
  };

  const formatSize = (product: Product | undefined) => {
    if (!product) return "-";
    if (product.is_exact_kw) return product.min_kw?.toLocaleString() || "-";
    return `${product.min_kw?.toLocaleString() || 0} - ${product.max_kw?.toLocaleString() || "∞"}`;
  };

  if (loading) return <div className="p-4">กำลังโหลด...</div>;

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row items-center justify-between p-4 bg-card border border-border rounded-md gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button variant="ghost" onClick={onBack}>←</Button> 
          {isEditMode && !isSystemCat ? (
             <Input 
                value={editedName} 
                onChange={(e) => setEditedName(e.target.value)}
                className="font-semibold text-lg h-9 w-64"
             />
          ) : (
            <h2 className="text-lg font-semibold text-foreground truncate max-w-[250px] md:max-w-[400px]">
              {editedName}
            </h2>
          )}
          
          {isEditMode && (
            <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-md">
              <Checkbox checked={isPriceIncluded} onCheckedChange={(c) => handlePriceIncludedChange(!!c)} />
              <label className="text-sm font-medium">รวมในราคาขาย</label>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          {isEditMode && (
            <>
              <Button variant="outline" size="sm" onClick={() => openImportModal("append")}>
                <PlusCircle className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">เพิ่มตาราง</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => openImportModal("replace")}>
                <Upload className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">แทนที่ตาราง</span>
              </Button>
            </>
          )}
          {canEdit && (
            <Button size="sm" onClick={() => { if (isEditMode) handleSaveAll(); else setIsEditMode(true); }}>
              {isEditMode ? "บันทึก" : "แก้ไข"}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr className="whitespace-nowrap">
              {isEditMode && <th className="p-3 w-10"></th>}
              <th className="p-3 text-left font-medium">ชื่ออุปกรณ์ / บริการ</th>
              <th className="p-3 text-left font-medium">ระบบไฟ (Phase)</th>
              <th className="p-3 text-left font-medium">Brand</th>
              <th className="p-3 text-left font-medium">หน่วย</th>
              <th className="p-3 text-left font-medium min-w-[150px]">
                <div className="flex items-center gap-2">
                  ราคาทุนอุปกรณ์
                  {isEditMode && !isRowLevelConfig && (
                    <Select value={isFixedCost ? "exact" : "percent"} onValueChange={(v) => handleFixedCostChange(v === "exact")}>
                      <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 [&>svg]:hidden">
                        <div className="flex items-center justify-center w-full h-full text-xs font-bold">{isFixedCost ? "฿" : "%"}</div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact"><span className="font-bold mr-2">฿</span> Fixed Price</SelectItem>
                        <SelectItem value="percent"><span className="font-bold mr-2">%</span> Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </th>

              <th className="p-3 text-left font-medium min-w-[150px]">
                <div className="flex items-center gap-2">
                  ราคาทุนติดตั้ง
                  {isEditMode && !isRowLevelConfig && (
                    <Select value={isFixedInstallationCost ? "exact" : "percent"} onValueChange={(v) => handleFixedInstallationCostChange(v === "exact")}>
                      <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 [&>svg]:hidden">
                        <div className="flex items-center justify-center w-full h-full text-xs font-bold">{isFixedInstallationCost ? "฿" : "%"}</div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact"><span className="font-bold mr-2">฿</span> Fixed Price</SelectItem>
                        <SelectItem value="percent"><span className="font-bold mr-2">%</span> Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </th>

              <th className="p-3 text-left font-medium min-w-[180px]">
                <div className="flex items-center gap-2">
                  ขนาด (Watt)
                  {isEditMode && !isRowLevelConfig && (
                    <Select value={isExactKw ? "exact" : "range"} onValueChange={(v) => handleExactKwChange(v === "exact")}>
                      <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 [&>svg]:hidden">
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
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-border hover:bg-accent/10 transition-colors">
                {isEditMode && (
                  <td className="p-3">
                    <button onClick={() => handleDeleteItem(product.id)} className="text-destructive hover:text-destructive/80 transition-colors">
                      <Minus className="h-4 w-4" />
                    </button>
                  </td>
                )}
                
                {/* 1. Name */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input value={product.name} onChange={(e) => handleUpdateProduct(product.id, "name", e.target.value)} className="h-8 w-40" placeholder="ชื่อ / รุ่น" />
                  ) : (<span>{product.name}</span>)}
                </td>

                {/* 2. Phase (แสดงในทุก Category แล้ว) */}
                <td className="p-3">
                  {isEditMode ? (
                    <Select value={product.electrical_phase || "no_phase"} onValueChange={(v) => handleUpdateProduct(product.id, "electrical_phase", v)}>
                      <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Phase" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_phase">No Phase</SelectItem>
                        <SelectItem value="single_phase">1 Phase</SelectItem>
                        <SelectItem value="three_phase">3 Phase</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (<span>{product.electrical_phase === "single_phase" ? "1 Phase" : product.electrical_phase === "three_phase" ? "3 Phase" : "No Phase"}</span>)}
                </td>

                {/* 3. Brand */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input value={product.brand || ""} onChange={(e) => handleUpdateProduct(product.id, "brand", e.target.value)} className="h-8 w-24" placeholder="ยี่ห้อ" />
                  ) : (<span>{product.brand || "-"}</span>)}
                </td>

                {/* 4. Unit */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input value={product.unit || ""} onChange={(e) => handleUpdateProduct(product.id, "unit", e.target.value)} className="h-8 w-20" placeholder="หน่วย" />
                  ) : (<span>{product.unit || "-"}</span>)}
                </td>


                {/* 6. Equipment Cost */}
                <td className="p-3">
                  {isEditMode ? (
                    <div className="flex items-center gap-1">
                      {isRowLevelConfig && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                            onClick={() => handleUpdateProduct(product.id, "is_fixed_cost", !product.is_fixed_cost)}
                        >
                            <span className="font-bold text-xs">{product.is_fixed_cost ? "฿" : "%"}</span>
                        </Button>
                      )}
                      <Input type="number" step="any"
                        value={product.is_fixed_cost ? product.cost_fixed ?? "" : product.cost_percentage ?? ""}
                        onChange={(e) => handleUpdateProduct(product.id, product.is_fixed_cost ? "cost_fixed" : "cost_percentage", parseFloat(e.target.value) || 0)}
                        className="h-8 w-24" placeholder={product.is_fixed_cost ? "บาท" : "%"}
                      />
                    </div>
                  ) : (<span>{formatCost(product, "equipment")}</span>)}
                </td>

                {/* 7. Installation Cost */}
                <td className="p-3">
                  {isEditMode ? (
                    <div className="flex items-center gap-1">
                      {isRowLevelConfig && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                            onClick={() => handleUpdateProduct(product.id, "is_fixed_installation_cost", !product.is_fixed_installation_cost)}
                        >
                            <span className="font-bold text-xs">{product.is_fixed_installation_cost ? "฿" : "%"}</span>
                        </Button>
                      )}
                      <Input type="number" step="any"
                        value={product.is_fixed_installation_cost ? product.fixed_installation_cost ?? "" : product.installation_cost_percentage ?? ""}
                        onChange={(e) => handleUpdateProduct(product.id, product.is_fixed_installation_cost ? "fixed_installation_cost" : "installation_cost_percentage", parseFloat(e.target.value) || 0)}
                        className="h-8 w-24" placeholder={product.is_fixed_installation_cost ? "บาท" : "%"}
                      />
                    </div>
                  ) : (<span>{formatCost(product, "installation")}</span>)}
                </td>

                {/* 8. Size Config */}
                <td className="p-3">
                  {isEditMode ? (
                    <div className="flex gap-1 items-center">
                      {isRowLevelConfig && (
                         <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                             onClick={() => handleUpdateProduct(product.id, "is_exact_kw", !product.is_exact_kw)}
                         >
                             <span className="font-bold text-xs">{product.is_exact_kw ? "=" : "↔"}</span>
                         </Button>
                      )}
                      {product.is_exact_kw ? (
                        <Input type="number" step="any" value={product.min_kw ?? ""} onChange={(e) => handleUpdateProduct(product.id, "min_kw", parseFloat(e.target.value) || 0)} className="h-8 w-20" placeholder="Size" />
                      ) : (
                        <>
                          <Input type="number" step="any" value={product.min_kw ?? ""} onChange={(e) => handleUpdateProduct(product.id, "min_kw", parseFloat(e.target.value) || 0)} className="h-8 w-16" placeholder="Min" />
                          <span className="text-muted-foreground">-</span>
                          <Input type="number" step="any" value={product.max_kw ?? ""} onChange={(e) => handleUpdateProduct(product.id, "max_kw", parseFloat(e.target.value) || 0)} className="h-8 w-16" placeholder="Max" />
                        </>
                      )}
                    </div>
                  ) : (<span>{formatSize(product)}</span>)}
                </td>
              </tr>
            ))}
            {isEditMode && (
              <tr className="border-t border-border">
                <td colSpan={isRowLevelConfig ? 9 : 8} className="p-3">
                  <button onClick={handleAddItem} className="flex items-center gap-2 text-sm text-primary font-medium hover:text-primary/80 transition-colors">
                    <Plus className="h-4 w-4" /> Add Item
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={importMode === "replace" ? `แทนที่ข้อมูล ${categoryName}` : `เพิ่มข้อมูล ${categoryName}`}
        onBooleanChange={setImportBooleans}
        fields={[
            { key: "name", label: "ชื่ออุปกรณ์ / บริการ" },
            { key: "brand", label: "ยี่ห้อ (Brand)" },
            { key: "unit", label: "หน่วย" },
            { key: "cost", label: "ราคาทุนอุปกรณ์" },
            { key: "install_cost", label: "ค่าติดตั้ง" },
            ...( (importMode === "replace" ? importBooleans.is_range_kw : !isExactKw) 
              ? [
                  { key: "kw_min", label: "ขนาด MIN (Watt)" }, 
                  { key: "kw_max", label: "ขนาด MAX (Watt)" }
                ] 
              : [
                  { key: "kw_min", label: "ขนาด (Watt)" }
                ]
            ),
            // 🌟 นำเงื่อนไข isInverter ออก เพื่อให้หมวดหมู่อื่นนำเข้า Phase ได้
            { 
                key: "phase", 
                label: "Phase (ระบบไฟ)", 
                type: "enum" as const, 
                enumOptions: [
                    { label: "No Phase", value: "no_phase" },
                    { label: "1 Phase", value: "single_phase" }, 
                    { label: "3 Phase", value: "three_phase" }
                ] 
            }
          ]}
        booleanFields={
            importMode === "replace" 
            ? [
                { key: "is_dynamic_cost", label: "ราคาทุนอุปกรณ์คิดเป็น (%)", defaultValue: !isFixedCost },
                { key: "is_dynamic_install", label: "ค่าติดตั้งคิดเป็น (%)", defaultValue: !isFixedInstallationCost },
                { key: "is_range_kw", label: "ขนาดเป็นช่วง (Range)", defaultValue: !isExactKw },
                { key: "is_price_included", label: "รวมในราคาขาย", defaultValue: isPriceIncluded },
            ]
            : []
        }
        onImport={handleImportEquipment}
      />

      {/* Overlap Conflict Dialog */}
      <AlertDialog open={!!conflictDialog} onOpenChange={(open) => !open && setConflictDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
                ⚠️ พบช่วงข้อมูลซ้ำซ้อนกัน
            </AlertDialogTitle>
            <AlertDialogDescription>
              ระบบพบว่าคุณกรอกข้อมูล <b>{conflictDialog?.currItem?.name || conflictDialog?.currItem?.brand || "อุปกรณ์"}</b> ทับซ้อนกัน:
              <br/><br/>
              ช่วงขนาด <b>{conflictDialog?.overlapText} Watt</b> ทับซ้อนกันระหว่าง:
              <ul className="list-disc pl-5 mt-2 space-y-2 text-sm bg-muted/50 p-3 rounded">
                 <li>
                    <b>รายการบน:</b> {conflictDialog?.prevItem?.min_kw} - {conflictDialog?.prevItem?.is_exact_kw ? conflictDialog?.prevItem?.min_kw : (conflictDialog?.prevItem?.max_kw ?? "∞")} 
                    <span className="text-muted-foreground ml-2">({formatCost(conflictDialog?.prevItem, "equipment")} ต้นทุน)</span>
                 </li>
                 <li>
                    <b>รายการล่าง:</b> {conflictDialog?.currItem?.min_kw} - {conflictDialog?.currItem?.is_exact_kw ? conflictDialog?.currItem?.min_kw : (conflictDialog?.currItem?.max_kw ?? "∞")} 
                    <span className="text-muted-foreground ml-2">({formatCost(conflictDialog?.currItem, "equipment")} ต้นทุน)</span>
                 </li>
              </ul>
              <br/>
              คุณต้องการให้อุปกรณ์ในช่วงขนาดนี้ ยึดราคาของแถวไหน?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row justify-center gap-4 sm:justify-center sm:space-x-0 w-full mt-2">
            
            <Button 
                variant="outline" 
                onClick={() => handleResolveConflict('KEEP_PREV')} 
                className="flex-1 h-auto py-3 border-2 hover:bg-muted hover:border-primary/50"
            >
              <div className="flex flex-col items-center">
                 <span className="text-xs text-muted-foreground mb-1">เก็บแถวบนไว้</span>
                 <span className="text-lg font-bold text-foreground">{formatCost(conflictDialog?.prevItem, "equipment")}</span>
              </div>
            </Button>

            <Button 
                onClick={() => handleResolveConflict('PRIORITIZE_CURR')} 
                className="flex-1 h-auto py-3 bg-blue-600 hover:bg-blue-700"
            >
              <div className="flex flex-col items-center">
                 <span className="text-xs text-white/80 mb-1">แทนที่ด้วยแถวล่าง</span>
                 <span className="text-lg font-bold text-white">{formatCost(conflictDialog?.currItem, "equipment")}</span>
              </div>
            </Button>

          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};