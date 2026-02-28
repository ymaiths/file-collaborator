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
  
  // 🌟 1. ดึงสิทธิ์จากเครื่อง (เพื่อเช็คว่าเป็น Viewer หรือไม่)
  const userRole = localStorage.getItem("userRole");
  const canEdit = userRole === "admin" || userRole === "general";

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
          location: quotation.location || "ไม่ระบุสถานที่",
          // 🌟 1. เช็คถ้า >= 1000 ให้หารพันแล้วโชว์ kW ถ้าน้อยกว่าให้โชว์ W
          projectSize: quotation.kw_size 
             ? (quotation.kw_size >= 1000 ? `${(quotation.kw_size / 1000).toLocaleString()} kW` : `${quotation.kw_size.toLocaleString()} W`) 
             : "ไม่ระบุขนาด",
          // 🌟 2. แอบเก็บค่าดิบที่เป็น Watt เอาไว้ให้ระบบ Search ค้นหาเจอ
          rawProjectSize: quotation.kw_size ? quotation.kw_size.toString() : "",
          
          price: totalPrice > 0 ? `${totalPrice.toLocaleString()} บาท` : "0 บาท",
            salesProgramme: quotation.sale_packages?.sale_name || "ไม่ระบุโปรแกรม",
          note: quotation.note,
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

  const filteredProjects = projects.filter((p) => {
    const query = searchQuery.toLowerCase();
    return (
      p.customerName.toLowerCase().includes(query) ||
      p.location.toLowerCase().includes(query) || 
      p.projectSize.toLowerCase().includes(query) ||
      p.rawProjectSize.includes(query) || // 🌟 เพิ่มให้ค้นหาจากค่า Watt แบบตัวเลขเพียวๆ ได้
      p.docNumber.toLowerCase().includes(query) 
    );
  });
  
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProjects = filteredProjects.slice(startIndex, startIndex + itemsPerPage);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleDeleteProject = async (id: string) => {
    // 🌟 ป้องกัน Viewer ลบผ่าน URL/Console
    if (!canEdit) return; 
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
    // 🌟 ป้องกัน Viewer คัดลอกผ่าน URL/Console
    if (!canEdit) return;
    try {
      setIsLoading(true);
      // ... (โค้ด duplicate เดิม)
      const { data: originalQuotation, error: fetchError } = await supabase.from("quotations").select("*").eq("id", id).single();
      if (fetchError) throw fetchError;
      const { data: lineItems, error: itemsError } = await supabase.from("product_line_items").select("*").eq("quotation_id", id);
      if (itemsError) throw itemsError;
      const { id: _, created_at: __, updated_at: ___, ...quotationData } = originalQuotation;
      const newQuotationData = { ...quotationData, location: `${quotationData.location || ""} (Copy)` };
      const { data: newQuotation, error: insertError } = await supabase.from("quotations").insert([newQuotationData]).select().single();
      if (insertError) throw insertError;
      if (lineItems && lineItems.length > 0) {
        const newLineItems = lineItems.map(item => {
          const { id: oldItemId, created_at: oldCreated, updated_at: oldUpdated, quotation_id: oldQId, ...itemData } = item;
          return { ...itemData, quotation_id: newQuotation.id };
        });
        const { error: linesInsertError } = await supabase.from("product_line_items").insert(newLineItems);
        if (linesInsertError) throw linesInsertError;
      }
      await fetchQuotations();
      toast({ title: "คัดลอกสำเร็จ", description: "สร้างสำเนาใบเสนอราคาเรียบร้อยแล้ว" });
    } catch (error) {
      console.error("Error duplicating project:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถคัดลอกข้อมูลได้", variant: "destructive" });
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
            
            <div className="flex flex-col md:flex-row items-center gap-4 w-full">
              
              <div className="relative w-full md:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหาชื่อลูกค้า, สถานที่, ขนาดโครงการ..."
                  className="pl-10 w-full"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); 
                  }}
                />
              </div>

              {/* 🌟 2. ซ่อนปุ่ม "Create New Project" ถ้าเป็นแค่ Viewer */}
              {canEdit && (
                <Button 
                  onClick={() => navigate("/quotation/new")} 
                  className="shadow-sm whitespace-nowrap w-full md:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" /> Create New Project
                </Button>
              )}
            </div>

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
                        // 🌟 3. ปิดฟังก์ชันลบ/คัดลอก โดยส่งเป็นค่าว่างๆ ไปแทนถ้าเป็น Viewer
                        onDelete={canEdit ? handleDeleteProject : () => {}} 
                        onDuplicate={canEdit ? handleDuplicateProject : () => {}}
                        // 🌟 แถม: ถ้าคุณมี Props canEdit ให้ส่งเข้าไปใน ProjectCard ด้วย!
                        // canEdit={canEdit}
                      />
                    ))
                  ) : (
                    <div className="col-span-full text-center text-muted-foreground py-20 border-2 border-dashed rounded-xl bg-muted/20">
                      {searchQuery ? "ไม่พบข้อมูลที่ค้นหา" : "ยังไม่มีใบเสนอราคาในระบบ"}
                    </div>
                  )}
                </div>

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