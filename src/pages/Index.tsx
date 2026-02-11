import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TabNavigation } from "@/components/TabNavigation";
import { ProjectCard } from "@/components/ProjectCard";
import { DatabaseTabContent } from "@/components/DatabaseTabContent";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"quotation" | "database">("quotation");
  
  // Data States
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pagination & Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; 

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("quotations")
        .select(`
          *,
          customers:customer_id (customer_name),
          sale_packages:sale_package_id (sale_name),
          product_line_items (product_price, installation_price)
        `)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      const formattedProjects = data?.map((quotation) => {
        const totalPrice = quotation.product_line_items?.reduce((sum: number, item: any) => {
          return sum + (item.product_price || 0) + (item.installation_price || 0);
        }, 0) || 0;

        return {
          id: quotation.id,
          customerName: quotation.customers?.customer_name || "ไม่ระบุชื่อลูกค้า",
          // ✅ ตรวจสอบค่า location ให้แน่ใจว่าเป็น string เสมอ
          location: quotation.location || "ไม่ระบุสถานที่",
          // ✅ แปลงขนาดเป็น string เพื่อให้ค้นหาได้ (เช่น "5,000")
          projectSize: quotation.kw_size ? `${quotation.kw_size.toLocaleString()} kW` : "ไม่ระบุขนาด",
          price: totalPrice > 0 ? `${totalPrice.toLocaleString()} บาท` : "0 บาท",
          salesProgramme: quotation.sale_packages?.sale_name || "ไม่ระบุโปรแกรม",
          editedDate: quotation.updated_at ? format(new Date(quotation.updated_at), "dd/MM/yy", { locale: th }) : "-",
          createdDate: quotation.created_at ? format(new Date(quotation.created_at), "dd/MM/yy", { locale: th }) : "-",
          docNumber: quotation.document_num || ""
        };
      }) || [];

      setProjects(formattedProjects);
    } catch (error) {
      console.error("Error fetching quotations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // ✅ LOGIC: SEARCH FILTER (ค้นหาหลายเงื่อนไข)
  // ------------------------------------------------------------------
  const filteredProjects = projects.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.customerName.toLowerCase().includes(query) || // ค้นหาชื่อลูกค้า
      p.location.toLowerCase().includes(query) ||     // ค้นหาสถานที่
      p.projectSize.toLowerCase().includes(query) ||  // ค้นหาขนาด (เช่นพิมพ์ "5,000")
      p.docNumber.toLowerCase().includes(query)       // ค้นหาเลขที่เอกสาร
    );
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("คุณแน่ใจหรือไม่ที่จะลบใบเสนอราคานี้?")) return;
    try {
      const { error } = await supabase.from("quotations").delete().eq("id", id);
      if (error) throw error;
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast({ title: "ลบสำเร็จ", description: "ใบเสนอราคาถูกลบเรียบร้อยแล้ว" });
    } catch (error) {
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถลบได้", variant: "destructive" });
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
          <div className="space-y-6 mt-6">
            
            {/* ================= HEADER SECTION ================= */}
            <div className="flex flex-col md:flex-row items-center gap-4 w-full">
              
              {/* ช่องค้นหา */}
              <div className="relative w-full md:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  // ✅ อัปเดต Placeholder ให้ User รู้ว่าค้นอะไรได้บ้าง
                  placeholder="ค้นหาชื่อลูกค้า, สถานที่, ขนาดโครงการ..."
                  className="pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); 
                  }}
                />
              </div>

              {/* ปุ่ม Create New */}
              <Button 
                onClick={() => navigate("/quotation/new")} 
                className="shadow-sm whitespace-nowrap w-full md:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" /> Create New Project
              </Button>
            </div>

            {/* ================= GRID SECTION ================= */}
            {isLoading ? (
              <div className="flex justify-center items-center min-h-[400px]">
                <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {currentProjects.length > 0 ? (
                    currentProjects.map((project) => (
                      <ProjectCard 
                        key={project.id} 
                        {...project} 
                        onDelete={handleDeleteProject} 
                        onDuplicate={handleDuplicateProject} 
                      />
                    ))
                  ) : (
                    <div className="col-span-full text-center text-muted-foreground py-20 border-2 border-dashed rounded-xl bg-muted/20">
                      {searchQuery ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีใบเสนอราคาในระบบ"}
                    </div>
                  )}
                </div>

                {/* ================= PAGINATION CONTROLS ================= */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-8 py-4">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="text-sm text-muted-foreground mx-4">
                      หน้า {currentPage} จาก {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <DatabaseTabContent />
        )}
      </div>
    </div>
  );
};

export default Index;