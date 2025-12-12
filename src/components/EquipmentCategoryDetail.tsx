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
  "AC box": "ac_cabinet",
  "DC box": "dc_cabinet",
  Other: "other",
};

// Reverse mapping
const enumToDisplayName: Partial<Record<ProductCategory, string>> &
  Record<string, string> = {
  solar_panel: "Solar Panel",
  inverter: "Inverter",
  ac_cabinet: "AC box",
  dc_cabinet: "DC box",
  other: "Other",
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
  // [1] เพิ่ม field นี้
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
  const [isPriceIncluded, setIsPriceIncluded] = useState(true);
  const [isRequired, setIsRequired] = useState(false);

  // Determine current category enum
  const currentCategoryEnum = (categoryNameToEnum[categoryName] ||
    categoryName) as ProductCategory;
  // [2] เช็คว่าเป็น Inverter หรือไม่
  const isInverter = currentCategoryEnum === "inverter";

  useEffect(() => {
    if (products.length > 0) {
      setIsPriceIncluded(products[0]?.is_price_included ?? true);
      setIsRequired(products[0]?.is_required_product ?? false);
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
      is_fixed_cost: true,
      fixed_installation_cost: null,
      installation_cost_percentage: null,
      is_fixed_installation_cost: true,
      min_kw: null,
      max_kw: null,
      is_exact_kw: true,
      is_price_included: isPriceIncluded,
      is_required_product: isRequired,
      product_category: currentCategoryEnum,
      // [3] กำหนดค่าเริ่มต้นเป็น null
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

  const handlePriceIncludedChange = (checked: boolean) => {
    setIsPriceIncluded(checked);
    setProducts(products.map((p) => ({ ...p, is_price_included: checked })));
  };

  const handleRequiredChange = (checked: boolean) => {
    setIsRequired(checked);
    setProducts(products.map((p) => ({ ...p, is_required_product: checked })));
  };

  const handleSaveAll = async () => {
    try {
      for (const product of products) {
        // Prepare data (exclude temp id)
        // Note: electrical_phase will be included automatically
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
    // ... (Logic เดิม ไม่ต้องแก้)
    if (type === "equipment") {
      if (product.is_fixed_cost) {
        return product.cost_fixed?.toLocaleString() || "-";
      } else {
        const percentage = product.cost_percentage || 0;
        if (product.is_exact_kw) {
          const cost = (product.min_kw || 0) * percentage;
          return cost.toLocaleString();
        } else {
          const minCost = (product.min_kw || 0) * percentage;
          const maxCost = (product.max_kw || 0) * percentage;
          return `${minCost.toLocaleString()} - ${maxCost.toLocaleString()}`;
        }
      }
    } else {
      if (product.is_fixed_installation_cost) {
        return product.fixed_installation_cost?.toLocaleString() || "-";
      } else {
        const percentage = product.installation_cost_percentage || 0;
        const equipmentCost = product.is_fixed_cost
          ? product.cost_fixed || 0
          : (product.min_kw || 0) * (product.cost_percentage || 0);

        if (product.is_exact_kw || product.is_fixed_cost) {
          const cost = equipmentCost * percentage;
          return cost.toLocaleString();
        } else {
          const minEquipmentCost =
            (product.min_kw || 0) * (product.cost_percentage || 0);
          const maxEquipmentCost =
            (product.max_kw || 0) * (product.cost_percentage || 0);
          const minCost = minEquipmentCost * percentage;
          const maxCost = maxEquipmentCost * percentage;
          return `${minCost.toLocaleString()} - ${maxCost.toLocaleString()}`;
        }
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
      {/* Header */}
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
                <label className="text-sm text-foreground">required</label>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* ... Buttons เดิม ... */}
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
              {/* [4] แสดงคอลัมน์ Phase ถ้าเป็น Inverter */}
              {isInverter && (
                <th className="p-3 text-left text-sm font-medium text-foreground">
                  ระบบไฟ (Phase)
                </th>
              )}
              <th className="p-3 text-left text-sm font-medium text-foreground">
                brand
              </th>
              <th className="p-3 text-left text-sm font-medium text-foreground">
                หน่วย
              </th>
              <th className="p-3 text-left text-sm font-medium text-foreground">
                ราคาทุนอุปกรณ์
              </th>
              <th className="p-3 text-left text-sm font-medium text-foreground">
                ราคาทุนติดตั้ง
              </th>
              <th className="p-3 text-left text-sm font-medium text-foreground">
                ขนาดอุปกรณ์ (Watt)
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

                {/* [5] Column Phase (เฉพาะ Inverter) */}
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
                    <div className="flex gap-2">
                      <Select
                        value={product.is_fixed_cost ? "exact" : "percent"}
                        onValueChange={(value) => {
                          const isFixed = value === "exact";
                          setProducts(
                            products.map((p) =>
                              p.id === product.id
                                ? {
                                    ...p,
                                    is_fixed_cost: isFixed,
                                    cost_fixed: isFixed ? p.cost_fixed : null,
                                    cost_percentage: isFixed
                                      ? null
                                      : p.cost_percentage,
                                  }
                                : p
                            )
                          );
                        }}
                      >
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percent</SelectItem>
                          <SelectItem value="exact">Exact</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="any"
                        value={
                          product.is_fixed_cost
                            ? product.cost_fixed || ""
                            : product.cost_percentage || ""
                        }
                        onChange={(e) =>
                          handleUpdateProduct(
                            product.id,
                            product.is_fixed_cost
                              ? "cost_fixed"
                              : "cost_percentage",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="h-8"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-foreground">
                      {formatCost(product, "equipment")}
                    </span>
                  )}
                </td>

                {/* Cost (Installation) */}
                <td className="p-3">
                  {isEditMode ? (
                    <div className="flex gap-2">
                      <Select
                        value={
                          product.is_fixed_installation_cost
                            ? "exact"
                            : "percent"
                        }
                        onValueChange={(value) => {
                          const isFixed = value === "exact";
                          setProducts(
                            products.map((p) =>
                              p.id === product.id
                                ? {
                                    ...p,
                                    is_fixed_installation_cost: isFixed,
                                    fixed_installation_cost: isFixed
                                      ? p.fixed_installation_cost
                                      : null,
                                    installation_cost_percentage: isFixed
                                      ? null
                                      : p.installation_cost_percentage,
                                  }
                                : p
                            )
                          );
                        }}
                      >
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percent</SelectItem>
                          <SelectItem value="exact">Exact</SelectItem>
                        </SelectContent>
                      </Select>
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
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-foreground">
                      {formatCost(product, "installation")}
                    </span>
                  )}
                </td>

                {/* Size (kW) */}
                <td className="p-3">
                  {isEditMode ? (
                    <div className="flex gap-2">
                      <Select
                        value={product.is_exact_kw ? "exact" : "range"}
                        onValueChange={(value) => {
                          handleUpdateProduct(
                            product.id,
                            "is_exact_kw",
                            value === "exact"
                          );
                        }}
                      >
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="range">Range</SelectItem>
                          <SelectItem value="exact">Exact</SelectItem>
                        </SelectContent>
                      </Select>
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
                        placeholder={product.is_exact_kw ? "Exact" : "Min"}
                      />
                      {!product.is_exact_kw && (
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
                          className="h-8"
                          placeholder="Max"
                        />
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
                {/* [6] ปรับ ColSpan ให้ครอบคลุมเมื่อมี Phase column */}
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
