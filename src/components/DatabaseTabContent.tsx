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

  // ------------------------------------------------------------------
  // 1. ฟังก์ชันสร้างโปรแกรมการขายใหม่
  // ------------------------------------------------------------------
  const handleCreateSalesProgram = async (name: string) => {
    try {
      const { error } = await supabase
        .from("sale_packages")
        .insert({ sale_name: name });

      if (error) throw error;

      toast({
        title: "สร้างสำเร็จ",
        description: `สร้างโปรแกรมการขาย "${name}" เรียบร้อยแล้ว`,
      });
      fetchSalesPrograms();
    } catch (error) {
      console.error("Error creating sales program:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างรายการได้",
        variant: "destructive",
      });
    }
  };

  // ------------------------------------------------------------------
  // 2. ฟังก์ชันสร้างหมวดหมู่อุปกรณ์ใหม่
  // ------------------------------------------------------------------
  const handleCreateEquipmentCategory = async (
    name: string,
    includeInPrice: boolean,
    isRequired: boolean
  ) => {
    try {
      // เนื่องจาก Category อิงจาก column 'product_category' ในตาราง products
      // เราจึงต้องสร้าง "สินค้าเริ่มต้น" 1 ชิ้น เพื่อให้หมวดหมู่นี้ปรากฏขึ้นมา
      const { error } = await supabase.from("products").insert({
        name: "Standard Item", // ชื่อสินค้าเริ่มต้น
        product_category: name,
        unit: "Unit",
        cost_fixed: 0,
        // คุณอาจต้องเพิ่ม field อื่นๆ ตามที่ database require
      });

      if (error) throw error;

      toast({
        title: "สร้างสำเร็จ",
        description: `สร้างหมวดหมู่ "${name}" เรียบร้อยแล้ว`,
      });
      fetchEquipmentCategories();
    } catch (error) {
      console.error("Error creating category:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างหมวดหมู่ได้",
        variant: "destructive",
      });
    }
  };

  // ------------------------------------------------------------------
  // 3. ฟังก์ชัน Duplicate โปรแกรมการขาย
  // ------------------------------------------------------------------
  const handleDuplicateSalesProgram = async (id: string) => {
    try {
      // 3.1 ดึงข้อมูลต้นฉบับ
      const { data: original, error: fetchError } = await supabase
        .from("sale_packages")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // 3.2 สร้างใหม่โดยต่อท้ายชื่อด้วย (Copy)
      const { id: _, created_at, updated_at, ...rest } = original;
      const { data: newPkg, error: insertError } = await supabase
        .from("sale_packages")
        .insert({
          ...rest,
          sale_name: `${original.sale_name} (Copy)`,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // (Optional) ถ้าต้องการ Copy ราคาใน sale_package_prices ด้วย ต้องเขียนเพิ่มตรงนี้

      toast({
        title: "คัดลอกสำเร็จ",
        description: "สร้างสำเนาโปรแกรมการขายเรียบร้อยแล้ว",
      });
      fetchSalesPrograms();
    } catch (error) {
      console.error("Error duplicating sales program:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถคัดลอกรายการได้",
        variant: "destructive",
      });
    }
  };

  // ------------------------------------------------------------------
  // 4. ฟังก์ชัน Duplicate หมวดหมู่อุปกรณ์
  // ------------------------------------------------------------------
  const handleDuplicateCategory = async (id: string) => {
    try {
      // 4.1 ดึงสินค้าทั้งหมดในหมวดเดิม
      const { data: products, error: fetchError } = await supabase
        .from("products")
        .select("*")
        .eq("product_category", id);

      if (fetchError) throw fetchError;
      if (!products || products.length === 0) return;

      // 4.2 เตรียมข้อมูลใหม่ โดยเปลี่ยนชื่อหมวดหมู่
      const newCategoryName = `${id} (Copy)`;
      
      const newProducts = products.map((product) => {
        const { id: _, created_at, updated_at, ...rest } = product;
        return {
          ...rest,
          product_category: newCategoryName,
        };
      });

      // 4.3 Insert ข้อมูลชุดใหม่
      const { error: insertError } = await supabase
        .from("products")
        .insert(newProducts);

      if (insertError) throw insertError;

      toast({
        title: "คัดลอกสำเร็จ",
        description: `สร้างหมวดหมู่ "${newCategoryName}" เรียบร้อยแล้ว`,
      });
      fetchEquipmentCategories();
    } catch (error) {
      console.error("Error duplicating category:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถคัดลอกหมวดหมู่ได้",
        variant: "destructive",
      });
    }
  };
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