import { useState, useEffect } from "react";
import { TabNavigation } from "@/components/TabNavigation";
import { SearchBar } from "@/components/SearchBar";
import { CreateProjectCard } from "@/components/CreateProjectCard";
import { ProjectCard } from "@/components/ProjectCard";
import { ProjectPagination } from "@/components/ProjectPagination";
import { DatabaseTabContent } from "@/components/DatabaseTabContent";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"quotation" | "database">(
    "quotation"
  );
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      // ดึง product_line_items เพื่อเอามาบวกเลขเป็นราคารวม
      const { data, error } = await supabase
        .from("quotations")
        .select(
          `
          *,
          customers:customer_id (
            customer_name
          ),
          sale_packages:sale_package_id (
            sale_name
          ),
          product_line_items (
            product_price,
            installation_price
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase Error:", error); // ดู Error ใน Console ถ้ายั่งไม่ขึ้น
        throw error;
      }

      const formattedProjects =
        data?.map((quotation) => {
          // คำนวณราคารวมจากรายการสินค้า
          const totalPrice =
            quotation.product_line_items?.reduce((sum: number, item: any) => {
              return (
                sum + (item.product_price || 0) + (item.installation_price || 0)
              );
            }, 0) || 0;

          return {
            id: quotation.id,
            customerName:
              quotation.customers?.customer_name || "ไม่ระบุชื่อลูกค้า",
            location: quotation.location || "ไม่ระบุสถานที่",
            projectSize: quotation.kw_size
              ? `${quotation.kw_size.toLocaleString()} kW`
              : "ไม่ระบุขนาด",
            // แสดงราคาที่คำนวณได้
            price: totalPrice > 0 ? `${totalPrice.toLocaleString()} บาท` : null,
            salesProgramme:
              quotation.sale_packages?.sale_name || "ไม่ระบุโปรแกรม",
            editedDate: quotation.updated_at
              ? format(new Date(quotation.updated_at), "dd/MM/yy", {
                  locale: th,
                })
              : "-",
            createdDate: quotation.created_at
              ? format(new Date(quotation.created_at), "dd/MM/yy", {
                  locale: th,
                })
              : "-",
          };
        }) || [];

      setProjects(formattedProjects);
    } catch (error) {
      console.error("Error fetching quotations:", error);
    } finally {
      setIsLoading(false);
    }
  };
  const handleDeleteProject = async (id: string) => {
    // ถามยืนยันก่อนลบ (Optional)
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบใบเสนอราคานี้?")) return;

    try {
      const { error } = await supabase
        .from("quotations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // ลบออกจาก State หน้าจอทันที เพื่อให้ไม่ต้องโหลดใหม่
      setProjects((prev) => prev.filter((p) => p.id !== id));

      toast({
        title: "ลบสำเร็จ",
        description: "ใบเสนอราคาถูกลบเรียบร้อยแล้ว",
      });
    } catch (error) {
      console.error("Error deleting quotation:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถลบใบเสนอราคาได้",
        variant: "destructive",
      });
    }
  };

  const handleDuplicateProject = async (id: string) => {
    try {
      setIsLoading(true); // show loading ชั่วคราว

      // 1. ดึงข้อมูล Quotation ต้นฉบับ
      const { data: originalQuotation, error: fetchError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      // 2. ดึงรายการสินค้า (Line Items) ของ Quotation นั้น
      const { data: lineItems, error: itemsError } = await supabase
        .from("product_line_items")
        .select("*")
        .eq("quotation_id", id);

      if (itemsError) throw itemsError;

      // 3. เตรียมข้อมูลสำหรับ Quotation ใหม่ (ลบ id, created_at, updated_at ออก)
      const { id: _, created_at: __, updated_at: ___, ...quotationData } = originalQuotation;
      
      // Optional: เติมคำว่า (Copy) ต่อท้าย location หรือชื่อ
      const newQuotationData = {
        ...quotationData,
        location: `${quotationData.location || ""} (Copy)`,
      };

      // 4. Insert Quotation ใหม่
      const { data: newQuotation, error: insertError } = await supabase
        .from("quotations")
        .insert([newQuotationData])
        .select()
        .single();

      if (insertError) throw insertError;

      // 5. Duplicate Line Items (ถ้ามี)
      if (lineItems && lineItems.length > 0) {
        const newLineItems = lineItems.map(item => {
          // ลบ ID เก่า และใส่ quotation_id ใหม่
          const { id: oldItemId, created_at: oldCreated, updated_at: oldUpdated, quotation_id: oldQId, ...itemData } = item;
          return {
            ...itemData,
            quotation_id: newQuotation.id
          };
        });

        const { error: linesInsertError } = await supabase
          .from("product_line_items")
          .insert(newLineItems);

        if (linesInsertError) throw linesInsertError;
      }

      // 6. โหลดข้อมูลใหม่เพื่อแสดงผล
      await fetchQuotations();

      toast({
        title: "คัดลอกสำเร็จ",
        description: "สร้างสำเนาใบเสนอราคาเรียบร้อยแล้ว",
      });

    } catch (error) {
      console.error("Error duplicating project:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถคัดลอกข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === "quotation" ? (
          <>
            <SearchBar />

            {isLoading ? (
              <div className="flex justify-center items-center min-h-[400px]">
                <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  <CreateProjectCard />

                  {/* แสดงการ์ดโครงการ */}
                  {projects.length > 0 ? (
                    projects.map((project) => (
                      <ProjectCard key={project.id} {...project} onDelete={handleDeleteProject} onDuplicate={handleDuplicateProject} />
                    ))
                  ) : (
                    // กรณีไม่มีข้อมูล (แต่โหลดเสร็จแล้ว)
                    <div className="col-span-full text-center text-muted-foreground py-10">
                      ไม่พบใบเสนอราคาในระบบ
                    </div>
                  )}
                </div>

                <ProjectPagination />
              </>
            )}
          </>
        ) : (
          <DatabaseTabContent />
        )}
      </div>
    </div>
  );
};

export default Index;
