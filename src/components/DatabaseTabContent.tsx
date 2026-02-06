import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CompanyInformationForm } from "@/components/CompanyInformationForm";
import { ListManagementView } from "@/components/ListManagementView";
import { EquipmentCategoryDetail } from "@/components/EquipmentCategoryDetail";
import { SalesProgramDetail } from "@/components/SalesProgramDetail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

// ✅ 1. Import isSystemCategory เพื่อใช้ตรวจสอบ
import { isSystemCategory } from "@/constants"; 

type DatabaseSubTab = "company" | "sales" | "equipment";

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
  const [activeSubTab, setActiveSubTab] = useState<DatabaseSubTab>("company");
  const [selectedCategory, setSelectedCategory] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [selectedSalesProgram, setSelectedSalesProgram] = useState<{
    id: string;
    name: string;
  } | null>(null);
  
  // ✅ 2. อัปเดต Type ให้รองรับ isSystem flag
  const [equipmentCategories, setEquipmentCategories] = useState<
    { id: string; name: string; isSystem: boolean }[]
  >([]);
  
  const [salesPrograms, setSalesPrograms] = useState<
    { id: string; name: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeSubTab === "equipment") {
      fetchEquipmentCategories();
    } else if (activeSubTab === "sales") {
      fetchSalesPrograms();
    }
  }, [activeSubTab]);

  const fetchEquipmentCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("products")
        .select("product_category")
        .order("product_category");

      if (error) throw error;

      // ✅ 3. Map ข้อมูลพร้อมเช็ค isSystemCategory
      const uniqueCategories = Array.from(
        new Set(data?.map((p) => p.product_category) || [])
      ).map((category) => {
        const catString = category as string;
        // แปลงชื่อถ้ามีใน mapping หรือใช้ชื่อเดิมถ้าไม่มี
        const displayName = enumToDisplayName[catString] || catString;
        
        return {
            id: catString,
            name: displayName,
            // ตรวจสอบว่าเป็น System Category หรือไม่ (เช็คทั้ง key และ display name เพื่อความชัวร์)
            isSystem: isSystemCategory(catString) || isSystemCategory(displayName)
        };
      });

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

  const handleCategoryClick = (id: string, name: string) => {
    setSelectedCategory({ id, name });
  };

  const handleSalesProgramClick = (id: string, name: string) => {
    setSelectedSalesProgram({ id, name });
  };

  const handleBackToList = () => {
    setSelectedCategory(null);
    setSelectedSalesProgram(null);
    if (activeSubTab === "sales") fetchSalesPrograms();
    if (activeSubTab === "equipment") fetchEquipmentCategories();
  };

  const handleDeleteSalesProgram = async (id: string) => {
    try {
      const { error } = await supabase.from("sale_packages").delete().eq("id", id);
      if (error) throw error;

      toast({
        title: "ลบสำเร็จ",
        description: "ลบโปรแกรมการขายเรียบร้อยแล้ว",
      });
      fetchSalesPrograms();
    } catch (error) {
      console.error("Error deleting sales program:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบรายการได้",
        variant: "destructive",
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    // ✅ 4. เพิ่ม Guard Clause: ห้ามลบ System Category
    if (isSystemCategory(id) || isSystemCategory(enumToDisplayName[id] || id)) {
        toast({
            title: "การดำเนินการถูกปฏิเสธ",
            description: "ไม่สามารถลบหมวดหมู่มาตรฐานของระบบได้",
            variant: "destructive"
        });
        return;
    }

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("product_category", id);
      if (error) throw error;

      toast({
        title: "ลบสำเร็จ",
        description: "ลบหมวดหมู่และอุปกรณ์ภายในทั้งหมดแล้ว",
      });
      fetchEquipmentCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบหมวดหมู่ได้",
        variant: "destructive",
      });
    }
  };

  // ... (ฟังก์ชัน Duplicate / Create ยังคงเดิม ไม่ต้องแก้) ...
  const handleDuplicateSalesProgram = async (id: string) => { /* Code เดิม */ };
  const handleDuplicateCategory = async (id: string) => { /* Code เดิม */ };
  const handleCreateEquipmentCategory = async (name: string, includeInPrice: boolean, isRequired: boolean) => { /* Code เดิม */ };
  const handleCreateSalesProgram = async (name: string) => { /* Code เดิม */ };

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
              onDeleteItem={handleDeleteSalesProgram}
              onDuplicateItem={handleDuplicateSalesProgram}
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
              // ✅ 5. ส่ง items ที่มี flag isSystem ไปให้ ListManagementView
              items={equipmentCategories}
              createNewLabel="Create New Equipment & Operation"
              showCheckboxes={true}
              newItemPlaceholder="Name Category"
              onItemClick={handleCategoryClick}
              onCreateNew={handleCreateEquipmentCategory}
              onDeleteItem={handleDeleteCategory}
              onDuplicateItem={handleDuplicateCategory}
            />
          )}
        </>
      )}
    </div>
  );
};