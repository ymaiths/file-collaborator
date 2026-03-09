import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CompanyInformationForm } from "@/components/CompanyInformationForm";
import { ListManagementView } from "@/components/ListManagementView";
import { EquipmentCategoryDetail } from "@/components/EquipmentCategoryDetail";
import { SalesProgramDetail } from "@/components/SalesProgramDetail";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type DatabaseSubTab = "company" | "sales" | "equipment";

const STANDARD_CATEGORIES = [
  "STANDARD Solar Panel",
  "STANDARD PV Mounting Structure",
  "STANDARD Inverter / Zero Export / Smart Logger",
  "STANDARD Huawei Optimizer",
  "STANDARD AC Box",
  "STANDARD DC Box",
  "STANDARD Cable",
  "STANDARD Operation", // (ใช้ชื่อเต็มตามที่ตกลงกันไว้นะครับ)
  "STANDARD Included Price Items",
  "STANDARD Excluded Price Items"
];

const checkIsSystemCategory = (val: string | null | undefined) => {
  if (!val) return false;
  return STANDARD_CATEGORIES.includes(val); 
};

export const DatabaseTabContent = () => {
  const [activeSubTab, setActiveSubTab] = useState<DatabaseSubTab>("company");
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string; } | null>(null);
  const [selectedSalesProgram, setSelectedSalesProgram] = useState<{ id: string; name: string; } | null>(null);
  
  const [equipmentCategories, setEquipmentCategories] = useState<{ id: string; name: string; isSystem: boolean }[]>([]);
  const [salesPrograms, setSalesPrograms] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // 🌟 เช็คสิทธิ์
  const userRole = localStorage.getItem("userRole");
  const canEdit = userRole === "admin" || userRole === "general";

  useEffect(() => {
    if (activeSubTab === "equipment") {
      fetchEquipmentCategories();
    } else if (activeSubTab === "sales") {
      fetchSalesPrograms();
    }
  }, [activeSubTab]);

  const handleRenameSalesProgram = async (id: string, oldName: string, newName: string) => {
    if (!canEdit) return;
    
    if (!newName || newName.trim() === "" || newName === oldName) return;

    try {
      const { error } = await supabase
        .from("sale_packages")
        .update({ sale_name: newName.trim() })
        .eq("id", id);
        
      if (error) throw error;
      
      toast({ title: "เปลี่ยนชื่อสำเร็จ", description: `เปลี่ยนเป็น "${newName}" เรียบร้อยแล้ว` });
      fetchSalesPrograms();
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถเปลี่ยนชื่อโปรแกรมได้", variant: "destructive" });
    }
  };
  
  const handleRenameCategory = async (id: string, oldName: string, newName: string) => {
    if (!canEdit) return;
    
    // ใช้ฟังก์ชันตัวใหม่ที่เราสร้างขึ้นมา
    if (checkIsSystemCategory(id) || checkIsSystemCategory(oldName)) {
        toast({ title: "การดำเนินการถูกปฏิเสธ", description: "ไม่สามารถเปลี่ยนชื่อหมวดหมู่มาตรฐานของระบบได้", variant: "destructive" });
        return;
    }
    
    if (!newName || newName.trim() === "" || newName === oldName) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({ product_category: newName.trim() })
        .eq("product_category", id);
        
      if (error) throw error;
      
      toast({ title: "เปลี่ยนชื่อสำเร็จ", description: `เปลี่ยนหมวดหมู่เป็น "${newName}" เรียบร้อยแล้ว` });
      fetchEquipmentCategories();
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถเปลี่ยนชื่อหมวดหมู่ได้", variant: "destructive" });
    }
  };
  
  const fetchEquipmentCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("products").select("product_category");
      if (error) throw error;

      // 🌟 เพิ่ม .filter(Boolean) เพื่อกรองค่า null, undefined หรือช่องว่างทิ้ง ป้องกันระบบแครช
      const dbCategories = Array.from(new Set(data?.map((p) => p.product_category).filter(Boolean) || [])) as string[];

      const combinedCategoryIds = Array.from(new Set([...STANDARD_CATEGORIES, ...dbCategories]));

      const uniqueCategories = combinedCategoryIds.map((catId) => {
        return {
            id: catId,
            name: catId,
            isSystem: checkIsSystemCategory(catId)
        };
      });

      uniqueCategories.sort((a, b) => {
        if (a.isSystem && b.isSystem) {
          return STANDARD_CATEGORIES.indexOf(a.name) - STANDARD_CATEGORIES.indexOf(b.name);
        }
        if (a.isSystem && !b.isSystem) return -1;
        if (!a.isSystem && b.isSystem) return 1;
        return a.name.localeCompare(b.name);
      });

      setEquipmentCategories(uniqueCategories);
    } catch (error) {
      console.error("Error fetching equipment categories:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPrograms = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("sale_packages").select("id, sale_name").order("sale_name");
      if (error) throw error;

      const seenNames = new Set<string>();
      const uniquePrograms: { id: string; name: string }[] = [];
      for (const p of data || []) {
        if (!seenNames.has(p.sale_name)) {
          seenNames.add(p.sale_name);
          uniquePrograms.push({ id: p.id, name: p.sale_name });
        }
      }
      setSalesPrograms(uniquePrograms);
    } catch (error) {
      console.error("Error fetching sales programs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryClick = (id: string, name: string) => setSelectedCategory({ id, name });
  const handleSalesProgramClick = (id: string, name: string) => setSelectedSalesProgram({ id, name });

  const handleBackToList = () => {
    setSelectedCategory(null);
    setSelectedSalesProgram(null);
    if (activeSubTab === "sales") fetchSalesPrograms();
    if (activeSubTab === "equipment") fetchEquipmentCategories();
  };

  const handleDeleteSalesProgram = async (id: string) => {
    if (!canEdit) return;
    try {
      const { error } = await supabase.from("sale_packages").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "ลบสำเร็จ", description: "ลบโปรแกรมการขายเรียบร้อยแล้ว" });
      fetchSalesPrograms();
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบรายการได้", variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!canEdit) return;
    
    // ใช้ฟังก์ชันตัวใหม่ที่เราสร้างขึ้นมา
    if (checkIsSystemCategory(id)) {
        toast({ title: "การดำเนินการถูกปฏิเสธ", description: "ไม่สามารถลบหมวดหมู่มาตรฐานของระบบได้", variant: "destructive" });
        return;
    }
    
    try {
      const { error } = await supabase.from("products").delete().eq("product_category", id);
      if (error) throw error;
      toast({ title: "ลบสำเร็จ", description: "ลบหมวดหมู่และอุปกรณ์ภายในทั้งหมดแล้ว" });
      fetchEquipmentCategories();
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบหมวดหมู่ได้", variant: "destructive" });
    }
  };

  const handleCreateSalesProgram = async (name: string) => {
    if (!canEdit) return;
    try {
      const { error } = await supabase.from("sale_packages").insert({ sale_name: name });
      if (error) throw error;
      toast({ title: "สร้างสำเร็จ", description: `สร้างโปรแกรมการขาย "${name}" เรียบร้อยแล้ว` });
      fetchSalesPrograms();
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถสร้างรายการได้", variant: "destructive" });
    }
  };

  const handleCreateEquipmentCategory = async (name: string, includeInPrice: boolean) => {
    if (!canEdit) return;
    try {
      const { error } = await supabase.from("products").insert({
        name: "Standard Item",
        product_category: name,
        unit: "Unit",
        cost_fixed: 0,
      });
      if (error) throw error;
      toast({ title: "สร้างสำเร็จ", description: `สร้างหมวดหมู่ "${name}" เรียบร้อยแล้ว` });
      fetchEquipmentCategories();
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถสร้างหมวดหมู่ได้", variant: "destructive" });
    }
  };

  const handleDuplicateSalesProgram = async (id: string) => {
    if (!canEdit) return;
    const toastId = toast({ title: "Processing", description: "กำลังคัดลอกโปรแกรมการขาย..." });
    try {
      const { data: original, error: fetchError } = await supabase.from("sale_packages").select("*").eq("id", id).single();
      if (fetchError) throw fetchError;

      const { id: _, created_at, updated_at, ...parentRest } = original;
      const { data: newPkg, error: insertError } = await supabase.from("sale_packages").insert({
          ...parentRest,
          sale_name: `${original.sale_name} (Copy)`,
        }).select().single();
      if (insertError) throw insertError;
      
      const newPackageId = newPkg.id; 
      const { data: originalPrices, error: pricesError } = await supabase.from("sale_package_prices").select("*").eq("sale_package_id", id);
      if (pricesError) throw pricesError;

      if (originalPrices && originalPrices.length > 0) {
        const newPrices = originalPrices.map((price) => {
            const { id: _childId, created_at: _c, updated_at: _u, ...childRest } = price;
            return { ...childRest, sale_package_id: newPackageId };
        });
        const { error: insertPricesError } = await supabase.from("sale_package_prices").insert(newPrices);
        if (insertPricesError) throw insertPricesError;
      }
      toast({ title: "คัดลอกสำเร็จ", description: `สร้างสำเนา "${newPkg.sale_name}" พร้อมข้อมูลราคาเรียบร้อยแล้ว` });
      fetchSalesPrograms();
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถคัดลอกรายการได้", variant: "destructive" });
    }
  };

  const handleDuplicateCategory = async (id: string) => {
    if (!canEdit) return;
    try {
      const { data: products, error: fetchError } = await supabase.from("products").select("*").eq("product_category", id);
      if (fetchError) throw fetchError;
      if (!products || products.length === 0) return;

      const newCategoryName = `${id} (Copy)`;
      const newProducts = products.map((product) => {
        const { id: _, created_at, updated_at, ...rest } = product;
        return { ...rest, product_category: newCategoryName };
      });

      const { error: insertError } = await supabase.from("products").insert(newProducts);
      if (insertError) throw insertError;

      toast({ title: "คัดลอกสำเร็จ", description: `สร้างหมวดหมู่ "${newCategoryName}" เรียบร้อยแล้ว` });
      fetchEquipmentCategories();
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถคัดลอกหมวดหมู่ได้", variant: "destructive" });
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <Button variant={activeSubTab === "company" ? "secondary" : "outline"} onClick={() => setActiveSubTab("company")} className="px-6 py-5 text-base font-medium">ข้อมูลบริษัท</Button>
        <Button variant={activeSubTab === "sales" ? "secondary" : "outline"} onClick={() => setActiveSubTab("sales")} className="px-6 py-5 text-base font-medium">โปรแกรมการขาย</Button>
        <Button variant={activeSubTab === "equipment" ? "secondary" : "outline"} onClick={() => setActiveSubTab("equipment")} className="px-6 py-5 text-base font-medium">อุปกรณ์และการดำเนินงาน</Button>
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
            <div className="p-4 text-center text-muted-foreground">กำลังโหลดรายการโปรแกรมการขาย...</div>
          ) : (
            <ListManagementView
              title="Sales Programme"
              items={salesPrograms}
              createNewLabel="Create New SalesProgramme"
              newItemPlaceholder="Name Sales Program"
              onItemClick={handleSalesProgramClick}
              onCreateNew={canEdit ? handleCreateSalesProgram : undefined}
              onDeleteItem={canEdit ? handleDeleteSalesProgram : undefined}
              onDuplicateItem={canEdit ? handleDuplicateSalesProgram : undefined}
              onRenameItem={canEdit ? handleRenameSalesProgram : undefined}
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
              onRenameSuccess={(oldId, newName) => {
                  handleRenameCategory(oldId, selectedCategory.name, newName);
                  setSelectedCategory({ id: newName, name: newName }); 
              }}
            />
          ) : loading ? (
            <div className="p-4 text-center text-muted-foreground">กำลังโหลดรายการหมวดหมู่...</div>
          ) : (
            <ListManagementView
              title="Equipment & Operation"
              items={equipmentCategories}
              createNewLabel="Create New Equipment & Operation"
              showCheckboxes={true}
              newItemPlaceholder="Name Category"
              onItemClick={handleCategoryClick}
              onCreateNew={canEdit ? handleCreateEquipmentCategory : undefined}
              onDeleteItem={canEdit ? handleDeleteCategory : undefined}
              onDuplicateItem={canEdit ? handleDuplicateCategory : undefined}
              onRenameItem={canEdit ? handleRenameCategory : undefined}
            />
          )}
        </>
      )}
    </div>
  );
};