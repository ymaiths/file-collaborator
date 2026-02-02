import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CompanyInformationForm } from "@/components/CompanyInformationForm";
import { ListManagementView } from "@/components/ListManagementView";
import { EquipmentCategoryDetail } from "@/components/EquipmentCategoryDetail";
import { SalesProgramDetail } from "@/components/SalesProgramDetail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type DatabaseSubTab = "company" | "sales" | "equipment";

// Mapping between enum values and display names
const enumToDisplayName: Record<string, string> = {
  solar_panel: "Solar Panel",
  inverter: "Inverter",
  ac_box: "AC Box",
  dc_box: "DC Box",
  support_inverter: "Support Inverter",
  pv_mounting_structure: "PV Mounting Structure",
  cable: "Cable & Connector",
  operation: "Operation & Maintenance",
  service: "Service",
  optimizer: "Optimizer",
  electrical_management: "Electrical Management",
  others: "Others"
};

export const DatabaseTabContent = () => {
  // --- State Definitions ---
  const [activeSubTab, setActiveSubTab] = useState<DatabaseSubTab>("company");
  const [selectedCategory, setSelectedCategory] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedSalesProgram, setSelectedSalesProgram] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [equipmentCategories, setEquipmentCategories] = useState<
    { id: string; name: string }[]
  >([]);
  const [salesPrograms, setSalesPrograms] = useState<
    { id: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  // --- Effects ---
  useEffect(() => {
    if (activeSubTab === "equipment") {
      fetchEquipmentCategories();
    } else if (activeSubTab === "sales") {
      fetchSalesPrograms();
    }
  }, [activeSubTab]);

  // --- Data Fetching ---
  const fetchEquipmentCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("product_category")
        .order("product_category");

      if (error) throw error;

      const uniqueCategories = Array.from(
        new Set(data?.map((p) => p.product_category) || [])
      ).map((category) => ({
        id: category as string,
        name: enumToDisplayName[category as string] || (category as string),
      }));

      setEquipmentCategories(uniqueCategories);
    } catch (error) {
      console.error("Error fetching equipment categories:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดรายการหมวดหมู่ได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPrograms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("sale_packages")
        .select("id, sale_name")
        .order("sale_name");

      if (error) throw error;

      const seenNames = new Set<string>();
      const uniquePrograms: { id: string; name: string }[] = [];

      for (const p of data || []) {
        if (!seenNames.has(p.sale_name)) {
          seenNames.add(p.sale_name);
          uniquePrograms.push({
            id: p.id,
            name: p.sale_name,
          });
        }
      }

      setSalesPrograms(uniquePrograms);
    } catch (error) {
      console.error("Error fetching sales programs:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถโหลดรายการโปรแกรมการขายได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  const handleCategoryClick = (id: string, name: string) => {
    setSelectedCategory({ id, name });
  };

  const handleSalesProgramClick = (id: string, name: string) => {
    setSelectedSalesProgram({ id, name });
  };

  const handleBackToList = () => {
    setSelectedCategory(null);
    setSelectedSalesProgram(null);
    // Refresh data to show updates if returning from detail view
    if (activeSubTab === "sales") fetchSalesPrograms();
    if (activeSubTab === "equipment") fetchEquipmentCategories();
  };

  // [NEW] Delete Handler for Sales Program
  const handleDeleteSalesProgram = async (id: string) => {
    try {
      const { error } = await supabase.from("sale_packages").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "ลบสำเร็จ",
        description: "ลบโปรแกรมการขายเรียบร้อยแล้ว",
      });
      fetchSalesPrograms(); // Refresh the list
    } catch (error) {
      console.error("Error deleting sales program:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบรายการได้",
        variant: "destructive",
      });
    }
  };

  // [NEW] Delete Handler for Equipment Category
  const handleDeleteCategory = async (id: string) => {
    try {
      // Warning: This deletes ALL products in this category because the category list 
      // is derived from existing products.
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("product_category", id as Database["public"]["Enums"]["product_category"]);
      if (error) throw error;

      toast({
        title: "ลบสำเร็จ",
        description: "ลบหมวดหมู่และอุปกรณ์ภายในทั้งหมดแล้ว",
      });
      fetchEquipmentCategories(); // Refresh the list
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบหมวดหมู่ได้",
        variant: "destructive",
      });
    }
  };

  const handleCreateEquipmentCategory = async (
    name: string,
    includeInPrice: boolean,
    isRequired: boolean
  ) => {
    try {
      const { data: enumData, error: enumError } =
        await supabase.functions.invoke("add-product-category", {
          body: { categoryName: name },
        });

      if (enumError) throw enumError;

      if (!enumData.success) {
        throw new Error(enumData.error || "Failed to add category");
      }

      const enumValue =
        enumData.enumValue as Database["public"]["Enums"]["product_category"];

      const { data: productData, error: productError } = await supabase
        .from("products")
        .insert([
          {
            name: "",
            product_category: enumValue,
            is_price_included: includeInPrice,
            is_required_product: isRequired,
            is_fixed_cost: true,
            is_fixed_installation_cost: true,
            is_exact_kw: true,
          },
        ])
        .select()
        .single();

      if (productError) throw productError;
      await fetchEquipmentCategories();

      toast({
        title: "สร้างหมวดหมู่สำเร็จ",
        description: `${name} ถูกเพิ่มเข้าระบบแล้ว`,
      });
    } catch (error) {
      console.error("Error creating equipment category:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description:
          error instanceof Error ? error.message : "ไม่สามารถสร้างหมวดหมู่ได้",
        variant: "destructive",
      });
    }
  };

  const handleCreateSalesProgram = async (name: string) => {
    try {
      const { data: packageData, error: packageError } = await supabase
        .from("sale_packages")
        .insert([
          {
            sale_name: name as any,
          },
        ])
        .select()
        .single();

      if (packageError) throw packageError;

      await fetchSalesPrograms();

      toast({
        title: "สร้างโปรแกรมสำเร็จ",
        description: `${name} ถูกเพิ่มเข้าระบบแล้ว`,
      });
    } catch (error) {
      console.error("Error creating sales program:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description:
          error instanceof Error ? error.message : "ไม่สามารถสร้างโปรแกรมได้",
        variant: "destructive",
      });
    }
  };

  // --- UI Render ---
  return (
    <div>
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeSubTab === "company" ? "secondary" : "outline"}
          onClick={() => setActiveSubTab("company")}
          className="px-6 py-5 text-base font-medium"
        >
          ข้อมูลบริษัท
        </Button>
        <Button
          variant={activeSubTab === "sales" ? "secondary" : "outline"}
          onClick={() => setActiveSubTab("sales")}
          className="px-6 py-5 text-base font-medium"
        >
          โปรแกรมการขาย
        </Button>
        <Button
          variant={activeSubTab === "equipment" ? "secondary" : "outline"}
          onClick={() => setActiveSubTab("equipment")}
          className="px-6 py-5 text-base font-medium"
        >
          อุปกรณ์และการดำเนินงาน
        </Button>
      </div>

      {activeSubTab === "company" && <CompanyInformationForm />}
      {activeSubTab === "sales" && (
        <>
          {selectedSalesProgram ? (
            <SalesProgramDetail
              programName={selectedSalesProgram.name}
              programId={selectedSalesProgram.id}
              onBack={handleBackToList}
            />
          ) : loading ? (
            <div className="p-4 text-center text-muted-foreground">
              กำลังโหลดรายการโปรแกรมการขาย...
            </div>
          ) : (
            <ListManagementView
              title="Sales Programme"
              items={salesPrograms}
              createNewLabel="Create New SalesProgramme"
              newItemPlaceholder="Name Sales Program"
              onItemClick={handleSalesProgramClick}
              onCreateNew={handleCreateSalesProgram}
              onDeleteItem={handleDeleteSalesProgram} //  [NEW] Connected delete handler
            />
          )}
        </>
      )}
      {activeSubTab === "equipment" && (
        <>
          {selectedCategory ? (
            <EquipmentCategoryDetail
              categoryName={selectedCategory.name}
              categoryId={selectedCategory.id}
              onBack={handleBackToList}
            />
          ) : loading ? (
            <div className="p-4 text-center text-muted-foreground">
              กำลังโหลดรายการหมวดหมู่...
            </div>
          ) : (
            <ListManagementView
              title="Equipment & Operation"
              items={equipmentCategories}
              createNewLabel="Create New Equipment & Operation"
              showCheckboxes={true}
              newItemPlaceholder="Name Category"
              onItemClick={handleCategoryClick}
              onCreateNew={handleCreateEquipmentCategory}
              onDeleteItem={handleDeleteCategory} // [NEW] Connected delete handler
            />
          )}
        </>
      )}
    </div>
  );
};