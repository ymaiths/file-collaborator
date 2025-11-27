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

const Index = () => {
  const [activeTab, setActiveTab] = useState<"quotation" | "database">("quotation");
  const [projects, setProjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchQuotations();
  }, []);

  const fetchQuotations = async () => {
    try {
      const { data, error } = await supabase
        .from("quotations")
        .select(`
          *,
          customers:customer_id (
            customer_name
          ),
          sale_packages:sale_package_id (
            sale_name,
            sale_package_prices:price_id (
              price
            )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedProjects = data?.map((quotation) => ({
        id: quotation.id,
        customerName: quotation.customers?.customer_name || "ไม่ระบุชื่อลูกค้า",
        location: quotation.location || "ไม่ระบุสถานที่",
        projectSize: quotation.kw_size ? `${quotation.kw_size} kW` : "ไม่ระบุขนาด",
        price: quotation.sale_packages?.sale_package_prices?.price 
          ? `${quotation.sale_packages.sale_package_prices.price.toLocaleString()} บาท`
          : "ไม่ระบุราคา",
        salesProgramme: quotation.sale_packages?.sale_name || "ไม่ระบุโปรแกรม",
        editedDate: quotation.updated_at 
          ? format(new Date(quotation.updated_at), "dd/MM/yy", { locale: th })
          : "-",
        createdDate: quotation.created_at
          ? format(new Date(quotation.created_at), "dd/MM/yy", { locale: th })
          : "-",
      })) || [];

      setProjects(formattedProjects);
    } catch (error) {
      console.error("Error fetching quotations:", error);
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
                  {projects.map((project) => (
                    <ProjectCard key={project.id} {...project} />
                  ))}
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
