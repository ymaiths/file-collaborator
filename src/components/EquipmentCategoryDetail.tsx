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
import { Minus, Plus, Copy, Upload, PlusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type ProductCategory = Database["public"]["Enums"]["product_category"];

// Mapping between display names and database enum values
const categoryNameToEnum: Record<string, ProductCategory> = {
  "Solar Panel": "solar_panel",
  Inverter: "inverter",
  "AC Box": "ac_box",
  "DC Box": "dc_box",
  "PV Mounting Structure": "pv_mounting_structure",
  "Cable & Connector": "cable",
  "Operation & Maintenance": "operation",
  "Service": "service",
  "Optimizer": "optimizer",
  "Support Inverter": "support_inverter",
  "Electrical Management": "electrical_management",
  "Others": "others",
};

// Reverse mapping
const enumToDisplayName: Partial<Record<ProductCategory, string>> &
  Record<string, string> = {
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
  
  // Global settings for the category
  const [isPriceIncluded, setIsPriceIncluded] = useState(true);
  const [isRequired, setIsRequired] = useState(false);
  const [isFixedCost, setIsFixedCost] = useState(true);
  const [isFixedInstallationCost, setIsFixedInstallationCost] = useState(true);
  const [isExactKw, setIsExactKw] = useState(true);

  // Determine current category enum
  const currentCategoryEnum = (categoryNameToEnum[categoryName] ||
    categoryName) as ProductCategory;
  const isInverter = currentCategoryEnum === "inverter";

  useEffect(() => {
    if (products.length > 0) {
      // Set initial state based on the first product in the list
      setIsPriceIncluded(products[0]?.is_price_included ?? true);
      setIsRequired(products[0]?.is_required_product ?? false);
      setIsFixedCost(products[0]?.is_fixed_cost ?? true);
      setIsExactKw(products[0]?.is_exact_kw ?? true);
      setIsFixedInstallationCost(products[0]?.is_fixed_installation_cost ?? true);
    }
  }, [products.length]);

  useEffect(() => {
    fetchProducts();
  }, [categoryId]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("product_category", currentCategoryEnum);

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

  const handleAddItem = () => {
    const newProduct: Product = {
      id: `temp-${Date.now()}`,
      name: "",
      brand: "",
      unit: "",
      cost_fixed: null,
      cost_percentage: null,
      is_fixed_cost: isFixedCost, // Use category setting
      fixed_installation_cost: null,
      installation_cost_percentage: null,
      is_fixed_installation_cost: isFixedInstallationCost, // Use category setting
      min_kw: null,
      max_kw: null,
      is_exact_kw: isExactKw,
      is_price_included: isPriceIncluded,
      is_required_product: isRequired,
      product_category: currentCategoryEnum,
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
      toast({
        title: "ลบสำเร็จ",
        description: "ลบรายการอุปกรณ์เรียบร้อยแล้ว",
      });
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบรายการได้",
        variant: "destructive",
      });
    }
  };

  const handleUpdateProduct = (id: string, field: string, value: any) => {
    setProducts(
      products.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // --- Bulk Update Handlers ---

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
    setProducts(
      products.map((p) => ({
        ...p,
        is_fixed_cost: isFixed,
        // Optional: clear the irrelevant field to avoid confusion
        cost_fixed: isFixed ? p.cost_fixed : null,
        cost_percentage: isFixed ? null : p.cost_percentage,
      }))
    );
  };

  const handleFixedInstallationCostChange = (isFixed: boolean) => {
    setIsFixedInstallationCost(isFixed);
    setProducts(
      products.map((p) => ({
        ...p,
        is_fixed_installation_cost: isFixed,
        fixed_installation_cost: isFixed ? p.fixed_installation_cost : null,
        installation_cost_percentage: isFixed ? null : p.installation_cost_percentage,
      }))
    );
  };

  const handleExactKwChange = (isExact: boolean) => {
    setIsExactKw(isExact);
    setProducts(
      products.map((p) => ({
        ...p,
        is_exact_kw: isExact,
        min_kw: p.min_kw,
        // ถ้าเปลี่ยนเป็น Exact ให้ clear max_kw เพื่อไม่ให้สับสน (หรือจะเก็บไว้ก็ได้)
        max_kw: isExact ? null : p.max_kw, 
      }))
    );
  };

  // ---------------------------

  const handleSaveAll = async () => {
    try {
      for (const product of products) {
        if (product.id.startsWith("temp-")) {
          const { id, ...productData } = product;
          const { error } = await supabase
            .from("products")
            .insert([productData]);
          if (error) throw error;
        } else {
          const { id, ...updateData } = product;
          const { error } = await supabase
            .from("products")
            .update(updateData)
            .eq("id", id);
          if (error) throw error;
        }
      }

      await fetchProducts();
      setIsEditMode(false);
      toast({
        title: "บันทึกสำเร็จ",
        description: "บันทึกข้อมูลอุปกรณ์เรียบร้อยแล้ว",
      });
    } catch (error) {
      console.error("Error saving products:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกข้อมูลได้",
        variant: "destructive",
      });
    }
  };

  const formatCost = (product: Product, type: "equipment" | "installation") => {
    if (type === "equipment") {
      if (product.is_fixed_cost) {
        return product.cost_fixed?.toLocaleString() || "-";
      } else {
        const percentage = product.cost_percentage || 0;
        return `${percentage.toLocaleString()}%`;
      }
    } else {
      if (product.is_fixed_installation_cost) {
        return product.fixed_installation_cost?.toLocaleString() || "-";
      } else {
        const percentage = product.installation_cost_percentage || 0;
        return `${percentage.toLocaleString()}%`;
      }
    }
  };

  const formatSize = (product: Product) => {
    if (product.is_exact_kw) {
      return product.min_kw?.toLocaleString() || "-";
    } else {
      return `${product.min_kw?.toLocaleString() || 0} - ${
        product.max_kw?.toLocaleString() || 0
      }`;
    }
  };

  if (loading) {
    return <div className="p-4">กำลังโหลด...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-md">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            {enumToDisplayName[currentCategoryEnum] || categoryName}
          </h2>
          {isEditMode && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isPriceIncluded}
                  onCheckedChange={(checked) =>
                    handlePriceIncludedChange(!!checked)
                  }
                />
                <label className="text-sm text-foreground">รวมในราคาขาย</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isRequired}
                  onCheckedChange={(checked) => handleRequiredChange(!!checked)}
                />
                <label className="text-sm text-foreground">Required</label>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (isEditMode) {
                handleSaveAll();
              } else {
                setIsEditMode(true);
              }
            }}
          >
            {isEditMode ? "เสร็จสิ้น" : "แก้ไข"}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-md overflow-hidden">
  <table className="w-full">
    <thead className="bg-muted">
      <tr>
        {isEditMode && (
          <th className="p-3 text-left text-sm font-medium text-foreground w-10"></th>
        )}
        <th className="p-3 text-left text-sm font-medium text-foreground">
          ชื่ออุปกรณ์
        </th>
        {isInverter && (
          <th className="p-3 text-left text-sm font-medium text-foreground">
            ระบบไฟ (Phase)
          </th>
        )}
        <th className="p-3 text-left text-sm font-medium text-foreground">
          Brand
        </th>
        <th className="p-3 text-left text-sm font-medium text-foreground">
          หน่วย
        </th>

        {/* ✅ [1] แก้ไข Header: ราคาทุนอุปกรณ์ */}
        <th className="p-3 text-left text-sm font-medium text-foreground min-w-[150px]">
          <div className="flex items-center gap-2">
            ราคาทุนอุปกรณ์
            {isEditMode && (
              <Select
                value={isFixedCost ? "exact" : "percent"}
                onValueChange={(value) => handleFixedCostChange(value === "exact")}
              >
                {/* ทำปุ่มเป็นวงกลม และแสดง icon ตรงกลาง */}
                <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                  <div className="flex items-center justify-center w-full h-full text-xs font-bold">
                    {isFixedCost ? "฿" : "%"}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">
                    <span className="font-bold mr-2">฿</span> Fixed Price
                  </SelectItem>
                  <SelectItem value="percent">
                    <span className="font-bold mr-2">%</span> Percentage
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </th>

        {/* ✅ [2] แก้ไข Header: ราคาทุนติดตั้ง */}
        <th className="p-3 text-left text-sm font-medium text-foreground min-w-[150px]">
          <div className="flex items-center gap-2">
            ราคาทุนติดตั้ง
            {isEditMode && (
              <Select
                value={isFixedInstallationCost ? "exact" : "percent"}
                onValueChange={(value) =>
                  handleFixedInstallationCostChange(value === "exact")
                }
              >
                {/* ทำปุ่มเป็นวงกลม และแสดง icon ตรงกลาง */}
                <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                  <div className="flex items-center justify-center w-full h-full text-xs font-bold">
                    {isFixedInstallationCost ? "฿" : "%"}
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">
                    <span className="font-bold mr-2">฿</span> Fixed Price
                  </SelectItem>
                  <SelectItem value="percent">
                    <span className="font-bold mr-2">%</span> Percentage
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </th>

        <th className="p-3 text-left text-sm font-medium text-foreground min-w-[150px]">
                <div className="flex items-center gap-2">
                  ขนาด (Watt)
                  {isEditMode && (
                    <Select
                      value={isExactKw ? "exact" : "range"}
                      onValueChange={(value) => handleExactKwChange(value === "exact")}
                    >
                      <SelectTrigger className="w-7 h-7 rounded-full p-0 border-none bg-primary/10 text-primary hover:bg-primary/20 focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                        <div className="flex items-center justify-center w-full h-full text-xs font-bold pb-0.5">
                          {/* ปรับสัญลักษณ์ให้ดูดี */}
                          {isExactKw ? "=" : "↔"}
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exact">
                          <span className="font-bold mr-2">=</span> Exact
                        </SelectItem>
                        <SelectItem value="range">
                          <span className="font-bold mr-2">↔</span> Range
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </th>
            </tr>
          </thead>
    <tbody>
            {products.map((product) => (
              <tr
                key={product.id}
                className="border-t border-border hover:bg-accent/50"
              >
                {isEditMode && (
                  <td className="p-3">
                    <button
                      onClick={() => handleDeleteItem(product.id)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </td>
                )}
                {/* Product Name */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input
                      value={product.name}
                      onChange={(e) =>
                        handleUpdateProduct(product.id, "name", e.target.value)
                      }
                      className="h-8"
                    />
                  ) : (
                    <span className="text-sm text-foreground">
                      {product.name}
                    </span>
                  )}
                </td>

                {/* Phase (Inverter only) */}
                {isInverter && (
                  <td className="p-3">
                    {isEditMode ? (
                      <Select
                        value={product.electrical_phase || ""}
                        onValueChange={(val) =>
                          handleUpdateProduct(
                            product.id,
                            "electrical_phase",
                            val
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-28">
                          <SelectValue placeholder="เลือก Phase" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single_phase">1 Phase</SelectItem>
                          <SelectItem value="three_phase">3 Phase</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-sm text-foreground">
                        {product.electrical_phase === "single_phase"
                          ? "1 Phase"
                          : product.electrical_phase === "three_phase"
                          ? "3 Phase"
                          : "-"}
                      </span>
                    )}
                  </td>
                )}

                {/* Brand */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input
                      value={product.brand || ""}
                      onChange={(e) =>
                        handleUpdateProduct(product.id, "brand", e.target.value)
                      }
                      className="h-8"
                    />
                  ) : (
                    <span className="text-sm text-foreground">
                      {product.brand || "-"}
                    </span>
                  )}
                </td>

                {/* Unit */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input
                      value={product.unit || ""}
                      onChange={(e) =>
                        handleUpdateProduct(product.id, "unit", e.target.value)
                      }
                      className="h-8"
                    />
                  ) : (
                    <span className="text-sm text-foreground">
                      {product.unit || "-"}
                    </span>
                  )}
                </td>

                {/* Cost (Equipment) */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input
                      type="number"
                      step="any"
                      // Use the product's internal field that matches the global setting
                      value={
                        product.is_fixed_cost
                          ? product.cost_fixed || ""
                          : product.cost_percentage || ""
                      }
                      onChange={(e) =>
                        handleUpdateProduct(
                          product.id,
                          product.is_fixed_cost ? "cost_fixed" : "cost_percentage",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-8"
                      placeholder={product.is_fixed_cost ? "ระบุราคา (บาท)" : "ระบุ %"}
                    />
                  ) : (
                    <span className="text-sm text-foreground">
                      {formatCost(product, "equipment")}
                    </span>
                  )}
                </td>

                {/* Cost (Installation) */}
                <td className="p-3">
                  {isEditMode ? (
                    <Input
                      type="number"
                      step="any"
                      value={
                        product.is_fixed_installation_cost
                          ? product.fixed_installation_cost || ""
                          : product.installation_cost_percentage || ""
                      }
                      onChange={(e) =>
                        handleUpdateProduct(
                          product.id,
                          product.is_fixed_installation_cost
                            ? "fixed_installation_cost"
                            : "installation_cost_percentage",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-8"
                      placeholder={product.is_fixed_installation_cost ? "ระบุราคา (บาท)" : "ระบุ %"}
                    />
                  ) : (
                    <span className="text-sm text-foreground">
                      {formatCost(product, "installation")}
                    </span>
                  )}
                </td>

                {/* Size (kW) */}
                <td className="p-3">
                  {isEditMode ? (
                    <div className="flex gap-2 items-center">
                      {/* กรณี Exact: แสดงช่องเดียว */}
                      {product.is_exact_kw ? (
                        <Input
                          type="number"
                          step="any"
                          value={product.min_kw || ""}
                          onChange={(e) =>
                            handleUpdateProduct(
                              product.id,
                              "min_kw",
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="h-8"
                          placeholder="Watt"
                        />
                      ) : (
                        /* กรณี Range: แสดง 2 ช่อง (Min - Max) */
                        <>
                          <Input
                            type="number"
                            step="any"
                            value={product.min_kw || ""}
                            onChange={(e) =>
                              handleUpdateProduct(
                                product.id,
                                "min_kw",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 min-w-[70px]"
                            placeholder="Min"
                          />
                          <span className="text-muted-foreground">-</span>
                          <Input
                            type="number"
                            step="any"
                            value={product.max_kw || ""}
                            onChange={(e) =>
                              handleUpdateProduct(
                                product.id,
                                "max_kw",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="h-8 min-w-[70px]"
                            placeholder="Max"
                          />
                        </>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-foreground">
                      {formatSize(product)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {isEditMode && (
              <tr className="border-t border-border">
                <td colSpan={isInverter ? 8 : 7} className="p-3">
                  <button
                    onClick={handleAddItem}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80"
                  >
                    <Plus className="h-4 w-4" />
                    Add Items
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Button variant="outline" onClick={onBack}>
        กลับ
      </Button>
    </div>
  );
};