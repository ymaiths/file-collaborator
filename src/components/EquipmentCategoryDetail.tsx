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
import { Minus, Plus, Upload, PlusCircle } from "lucide-react"; // เอา Copy ออกถ้าไม่ได้ใช้
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";
import { ExcelImportModal } from "./ExcelImportModal";

// ✅ 1. เปลี่ยน Type จาก Enum เป็น string
type ProductCategory = string; 

// Mapping สำหรับแสดงผล (รองรับ Legacy Key)
const enumToDisplayName: Record<string, string> = {
  solar_panel: "Solar Panel",
  inverter: "Inverter",
  ac_box: "AC Box",
  dc_box: "DC Box",
  pv_mounting_structure: "PV Mounting Structure",
  zero_export_smart_logger: "Zero Export & Smart Logger",
  cable: "Cable & Connector",
  operation: "Operation & Maintenance",
  service: "Service",
  optimizer: "Optimizer",
  support_inverter: "Support Inverter",
  electrical_management: "Electrical Management",
  others: "Others",
};

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
  is_required_product: boolean;
  product_category: ProductCategory;
  electrical_phase: string | null;
}

interface EquipmentCategoryDetailProps {
  categoryName: string;
  categoryId: string;
  onBack: () => void;
}

export const EquipmentCategoryDetail = ({
  categoryName,
  categoryId,
  onBack,
}: EquipmentCategoryDetailProps) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Global settings
  const [isPriceIncluded, setIsPriceIncluded] = useState(true);
  const [isRequired, setIsRequired] = useState(false);
  const [isFixedCost, setIsFixedCost] = useState(true);
  const [isFixedInstallationCost, setIsFixedInstallationCost] = useState(true);
  const [isExactKw, setIsExactKw] = useState(true);

  // Import States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");

  // ✅ 2. ใช้ string โดยตรง (ไม่ต้อง cast เป็น Enum)
  const currentCategory = categoryId; 
  
  // ✅ 3. เช็คเผื่อทั้ง key เก่าและชื่อใหม่ (Case Insensitive check)
  const isInverter = currentCategory.toLowerCase() === "inverter"; 

  useEffect(() => {
    if (products.length > 0) {
      setIsPriceIncluded(products[0]?.is_price_included ?? true);
      setIsRequired(products[0]?.is_required_product ?? false);
      setIsFixedCost(products[0]?.is_fixed_cost ?? true);
      setIsExactKw(products[0]?.is_exact_kw ?? true);
      setIsFixedInstallationCost(products[0]?.is_fixed_installation_cost ?? true);
    }
  }, [products.length]);

  useEffect(() => {
    fetchProducts();
  }, [currentCategory]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("product_category", currentCategory); // ใช้ string

      if (error) throw error;
      setProducts((data as unknown as Product[]) || []);
    } catch (error) {
      console.error("Error fetching products:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดข้อมูลอุปกรณ์ได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openImportModal = (mode: "append" | "replace") => {
    setImportMode(mode);
    setIsImportModalOpen(true);
  };

  const handleImportEquipment = async (data: any[], booleanValues: Record<string, boolean>) => {
    const isReplace = importMode === "replace";

    const _isFixedCost = isReplace ? booleanValues.is_fixed_cost : isFixedCost;
    const _isFixedInst = isReplace ? booleanValues.is_fixed_installation_cost : isFixedInstallationCost;
    const _isExactKw = isReplace ? booleanValues.is_exact_kw : isExactKw;
    const _isPriceIncluded = isReplace ? booleanValues.is_price_included : isPriceIncluded;
    const _isRequired = isReplace ? booleanValues.is_required_product : isRequired;

    const newItems = data.map((row) => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      product_category: currentCategory, // ใช้ตัวแปรใหม่
      
      name: row.name || "",
      brand: row.brand || "",
      unit: row.unit || "",
      
      is_fixed_cost: _isFixedCost,
      cost_fixed: _isFixedCost ? (parseFloat(row.cost) || 0) : null,
      cost_percentage: !_isFixedCost ? (parseFloat(row.cost) || 0) : null,

      is_fixed_installation_cost: _isFixedInst,
      fixed_installation_cost: _isFixedInst ? (parseFloat(row.install_cost) || 0) : null,
      installation_cost_percentage: !_isFixedInst ? (parseFloat(row.install_cost) || 0) : null,

      is_exact_kw: _isExactKw,
      min_kw: parseFloat(row.min_kw) || 0,
      max_kw: !_isExactKw ? (parseFloat(row.max_kw) || 0) : null,

      is_price_included: _isPriceIncluded,
      is_required_product: _isRequired,
      electrical_phase: isInverter ? (row.phase === "3" || row.phase === "3Ph" ? "three_phase" : "single_phase") : null,
    }));

    if (isReplace) {
      const hasRealItems = products.some(p => !p.id.startsWith("temp-"));
      if (hasRealItems) {
         const { error } = await supabase
            .from("products")
            .delete()
            .eq("product_category", currentCategory);
         
         if (error) {
             toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบข้อมูลเก่าได้", variant: "destructive" });
             return;
         }
      }

      setProducts(newItems);
      setIsFixedCost(_isFixedCost);
      setIsFixedInstallationCost(_isFixedInst);
      setIsExactKw(_isExactKw);
      setIsPriceIncluded(_isPriceIncluded);
      setIsRequired(_isRequired);

      toast({ title: "แทนที่ตารางสำเร็จ", description: `นำเข้าข้อมูลใหม่ ${newItems.length} รายการ` });
    } else {
      setProducts((prev) => [...prev, ...newItems]);
      toast({ title: "เพิ่มตารางสำเร็จ", description: `เพิ่มข้อมูล ${newItems.length} รายการ` });
    }
  };

  const handleAddItem = () => {
    const newProduct: Product = {
      id: `temp-${Date.now()}`,
      name: "",
      brand: "",
      unit: "",
      cost_fixed: null,
      cost_percentage: null,
      is_fixed_cost: isFixedCost,
      fixed_installation_cost: null,
      installation_cost_percentage: null,
      is_fixed_installation_cost: isFixedInstallationCost,
      min_kw: null,
      max_kw: null,
      is_exact_kw: isExactKw,
      is_price_included: isPriceIncluded,
      is_required_product: isRequired,
      product_category: currentCategory, // ใช้ตัวแปรใหม่
      electrical_phase: null,
    };
    setProducts([...products, newProduct]);
  };

  const handleDeleteItem = async (id: string) => {
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

  const handleUpdateProduct = (id: string, field: string, value: any) => {
    setProducts(products.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  // Bulk Handlers (เหมือนเดิม)
  const handlePriceIncludedChange = (checked: boolean) => {
    setIsPriceIncluded(checked);
    setProducts(products.map((p) => ({ ...p, is_price_included: checked })));
  };
  const handleRequiredChange = (checked: boolean) => {
    setIsRequired(checked);
    setProducts(products.map((p) => ({ ...p, is_required_product: checked })));
  };
  const handleFixedCostChange = (isFixed: boolean) => {
    setIsFixedCost(isFixed);
    setProducts(products.map((p) => ({
        ...p, is_fixed_cost: isFixed, cost_fixed: isFixed ? p.cost_fixed : null, cost_percentage: isFixed ? null : p.cost_percentage,
    })));
  };
  const handleFixedInstallationCostChange = (isFixed: boolean) => {
    setIsFixedInstallationCost(isFixed);
    setProducts(products.map((p) => ({
        ...p, is_fixed_installation_cost: isFixed, fixed_installation_cost: isFixed ? p.fixed_installation_cost : null, installation_cost_percentage: isFixed ? null : p.installation_cost_percentage,
    })));
  };
  const handleExactKwChange = (isExact: boolean) => {
    setIsExactKw(isExact);
    setProducts(products.map((p) => ({
        ...p, is_exact_kw: isExact, min_kw: p.min_kw, max_kw: isExact ? null : p.max_kw,
    })));
  };

  const handleSaveAll = async () => {
    try {
      for (const product of products) {
        if (product.id.startsWith("temp-")) {
          const { id, ...productData } = product;
          const { error } = await supabase.from("products").insert([productData]);
          if (error) throw error;
        } else {
          const { id, ...updateData } = product;
          const { error } = await supabase.from("products").update(updateData).eq("id", id);
          if (error) throw error;
        }
      }
      await fetchProducts();
      setIsEditMode(false);
      toast({ title: "บันทึกสำเร็จ", description: "บันทึกข้อมูลอุปกรณ์เรียบร้อยแล้ว" });
    } catch (error) {
      console.error("Error saving products:", error);
      toast({ title: "เกิดข้อผิดพลาด", variant: "destructive" });
    }
  };

  const formatCost = (product: Product, type: "equipment" | "installation") => {
    if (type === "equipment") {
      if (product.is_fixed_cost) return product.cost_fixed?.toLocaleString() || "-";
      return `${product.cost_percentage?.toLocaleString() || 0}%`;
    } else {
      if (product.is_fixed_installation_cost) return product.fixed_installation_cost?.toLocaleString() || "-";
      return `${product.installation_cost_percentage?.toLocaleString() || 0}%`;
    }
  };

  const formatSize = (product: Product) => {
    if (product.is_exact_kw) return product.min_kw?.toLocaleString() || "-";
    return `${product.min_kw?.toLocaleString() || 0} - ${product.max_kw?.toLocaleString() || 0}`;
  };

  if (loading) return <div className="p-4">กำลังโหลด...</div>;

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-md">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack}>←</Button> 
          <h2 className="text-lg font-semibold text-foreground">
            {/* แสดงชื่อหมวดหมู่ ถ้ามีใน Legacy Map ก็ใช้ ถ้าไม่มีก็ใช้ชื่อที่ส่งมาตรงๆ */}
            {enumToDisplayName[currentCategory] || categoryName}
          </h2>
          {isEditMode && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox checked={isPriceIncluded} onCheckedChange={(c) => handlePriceIncludedChange(!!c)} />
                <label className="text-sm text-foreground">รวมในราคาขาย</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={isRequired} onCheckedChange={(c) => handleRequiredChange(!!c)} />
                <label className="text-sm text-foreground">Required</label>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <Button variant="outline" size="sm" onClick={() => { if (isEditMode) handleSaveAll(); else setIsEditMode(true); }}>
            {isEditMode ? "เสร็จสิ้น" : "แก้ไข"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              {isEditMode && <th className="p-3 w-10"></th>}
              <th className="p-3 text-left text-sm font-medium">ชื่ออุปกรณ์</th>
              {isInverter && <th className="p-3 text-left text-sm font-medium">ระบบไฟ (Phase)</th>}
              <th className="p-3 text-left text-sm font-medium">Brand</th>
              <th className="p-3 text-left text-sm font-medium">หน่วย</th>

              {/* Header: ราคาทุนอุปกรณ์ */}
              <th className="p-3 text-left text-sm font-medium min-w-[150px]">
                <div className="flex items-center gap-2">
                  ราคาทุนอุปกรณ์
                  {isEditMode && (
                    <Select value={isFixedCost ? "exact" : "percent"} onValueChange={(v) => handleFixedCostChange(v === "exact")}>
                      <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
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

              {/* Header: ราคาทุนติดตั้ง */}
              <th className="p-3 text-left text-sm font-medium min-w-[150px]">
                <div className="flex items-center gap-2">
                  ราคาทุนติดตั้ง
                  {isEditMode && (
                    <Select value={isFixedInstallationCost ? "exact" : "percent"} onValueChange={(v) => handleFixedInstallationCostChange(v === "exact")}>
                      <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
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

              {/* Header: ขนาด */}
              <th className="p-3 text-left text-sm font-medium min-w-[150px]">
                <div className="flex items-center gap-2">
                  ขนาด (Watt)
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
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-border hover:bg-accent/50">
                {isEditMode && (
                  <td className="p-3">
                    <button onClick={() => handleDeleteItem(product.id)} className="text-destructive hover:text-destructive/80">
                      <Minus className="h-4 w-4" />
                    </button>
                  </td>
                )}
                <td className="p-3">
                  {isEditMode ? (
                    <Input value={product.name} onChange={(e) => handleUpdateProduct(product.id, "name", e.target.value)} className="h-8" />
                  ) : (<span className="text-sm">{product.name}</span>)}
                </td>

                {isInverter && (
                  <td className="p-3">
                    {isEditMode ? (
                      <Select value={product.electrical_phase || ""} onValueChange={(v) => handleUpdateProduct(product.id, "electrical_phase", v)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue placeholder="เลือก Phase" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_phase">1 Phase</SelectItem>
                          <SelectItem value="three_phase">3 Phase</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (<span className="text-sm">{product.electrical_phase === "single_phase" ? "1 Phase" : product.electrical_phase === "three_phase" ? "3 Phase" : "-"}</span>)}
                  </td>
                )}

                <td className="p-3">
                  {isEditMode ? (
                    <Input value={product.brand || ""} onChange={(e) => handleUpdateProduct(product.id, "brand", e.target.value)} className="h-8" />
                  ) : (<span className="text-sm">{product.brand || "-"}</span>)}
                </td>

                <td className="p-3">
                  {isEditMode ? (
                    <Input value={product.unit || ""} onChange={(e) => handleUpdateProduct(product.id, "unit", e.target.value)} className="h-8" />
                  ) : (<span className="text-sm">{product.unit || "-"}</span>)}
                </td>

                {/* Cost Eq */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input type="number" step="any"
                      value={product.is_fixed_cost ? product.cost_fixed || "" : product.cost_percentage || ""}
                      onChange={(e) => handleUpdateProduct(product.id, product.is_fixed_cost ? "cost_fixed" : "cost_percentage", parseFloat(e.target.value) || 0)}
                      className="h-8" placeholder={product.is_fixed_cost ? "บาท" : "%"}
                    />
                  ) : (<span className="text-sm">{formatCost(product, "equipment")}</span>)}
                </td>

                {/* Cost Inst */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input type="number" step="any"
                      value={product.is_fixed_installation_cost ? product.fixed_installation_cost || "" : product.installation_cost_percentage || ""}
                      onChange={(e) => handleUpdateProduct(product.id, product.is_fixed_installation_cost ? "fixed_installation_cost" : "installation_cost_percentage", parseFloat(e.target.value) || 0)}
                      className="h-8" placeholder={product.is_fixed_installation_cost ? "บาท" : "%"}
                    />
                  ) : (<span className="text-sm">{formatCost(product, "installation")}</span>)}
                </td>

                {/* Size */}
                <td className="p-3">
                  {isEditMode ? (
                    <div className="flex gap-2 items-center">
                      {product.is_exact_kw ? (
                        <Input type="number" step="any" value={product.min_kw || ""} onChange={(e) => handleUpdateProduct(product.id, "min_kw", parseFloat(e.target.value) || 0)} className="h-8" placeholder="Watt" />
                      ) : (
                        <>
                          <Input type="number" step="any" value={product.min_kw || ""} onChange={(e) => handleUpdateProduct(product.id, "min_kw", parseFloat(e.target.value) || 0)} className="h-8 min-w-[70px]" placeholder="Min" />
                          <span className="text-muted-foreground">-</span>
                          <Input type="number" step="any" value={product.max_kw || ""} onChange={(e) => handleUpdateProduct(product.id, "max_kw", parseFloat(e.target.value) || 0)} className="h-8 min-w-[70px]" placeholder="Max" />
                        </>
                      )}
                    </div>
                  ) : (<span className="text-sm">{formatSize(product)}</span>)}
                </td>
              </tr>
            ))}
            {isEditMode && (
              <tr className="border-t border-border">
                <td colSpan={isInverter ? 8 : 7} className="p-3">
                  <button onClick={handleAddItem} className="flex items-center gap-2 text-sm text-primary hover:text-primary/80">
                    <Plus className="h-4 w-4" /> Add Items
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Import */}
      <ExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={importMode === "replace" ? `แทนที่ข้อมูล ${categoryName}` : `เพิ่มข้อมูล ${categoryName}`}
        fields={[
            { key: "name", label: "ชื่ออุปกรณ์" },
            { key: "brand", label: "ยี่ห้อ (Brand)" },
            { key: "unit", label: "หน่วย" },
            { key: "cost", label: "ราคา/ต้นทุน (ใส่ตัวเลข)" },
            { key: "install_cost", label: "ค่าติดตั้ง (ใส่ตัวเลข)" },
            { key: "min_kw", label: "ขนาด (Min/Exact) Watt" },
            { key: "max_kw", label: "ขนาดสูงสุด (Max) Watt" },
            ...(isInverter ? [{ key: "phase", label: "Phase (ใส่ 1 หรือ 3)" }] : [])
        ]}
        booleanFields={
            importMode === "replace" 
            ? [
                { key: "is_fixed_cost", label: "ราคาทุนแบบคงที่ (Fixed)", defaultValue: isFixedCost },
                { key: "is_fixed_installation_cost", label: "ค่าติดตั้งแบบคงที่ (Fixed)", defaultValue: isFixedInstallationCost },
                { key: "is_exact_kw", label: "ขนาดแบบค่าเดียว (Exact)", defaultValue: isExactKw },
                { key: "is_price_included", label: "รวมในราคาขาย", defaultValue: isPriceIncluded },
                { key: "is_required_product", label: "Required Item", defaultValue: isRequired },
            ]
            : []
        }
        onImport={handleImportEquipment}
      />
    </div>
  );
};