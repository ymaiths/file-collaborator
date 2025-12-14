import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { calculateSystemSpecs } from "@/utils/kwpcalculations";
import { useAutoGenerateLineItems } from "@/hooks/useAutoGenerateLineItems";
import { useAutoGenerateAdditionalItems } from "@/hooks/useAutoGenerateAdditionalItems";

// Helper function: จัดรูปแบบชื่อ Brand ให้สวยงาม (ตัวพิมพ์ใหญ่)
const formatBrandName = (brand: string) => {
  if (!brand) return "";
  // แปลง huawei -> Huawei, huawei_optimizer -> Huawei Optimizer
  return brand
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const CreateQuotation = () => {
  const navigate = useNavigate();
  const { id: quotationId } = useParams<{ id: string }>();
  const [showQuotation, setShowQuotation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(
    null
  );

  const [availablePrograms, setAvailablePrograms] = useState<
    { id: string; name: string }[]
  >([]);

  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availablePanelSizes, setAvailablePanelSizes] = useState<number[]>([]);
  const { generateMainEquipment, isGenerating } = useAutoGenerateLineItems();
  const { generateAdditionalEquipment } = useAutoGenerateAdditionalItems();

  const [formData, setFormData] = useState({
    customerName: "",
    installLocation: "",
    projectSize: "",
    solarPanelSize: "",
    documentNumber: "",
    serviceProvider: "",
    additionalInfo: "",
    salesProgram: "",
    brand: "",
  });

  // 1. โหลดรายชื่อโปรแกรมการขายตอนเริ่มต้น
  useEffect(() => {
    const fetchSalesPrograms = async () => {
      try {
        const { data, error } = await supabase
          .from("sale_packages")
          .select("id, sale_name")
          .order("sale_name");

        if (error) throw error;

        if (data) {
          setAvailablePrograms(
            data.map((p) => ({
              id: p.id,
              name: p.sale_name,
            }))
          );
        }
      } catch (error) {
        console.error("Error loading programs:", error);
      }
    };

    fetchSalesPrograms();
  }, []);

  // 2. [ใหม่] โหลดรายชื่อ Brand เมื่อ "โปรแกรมการขาย" เปลี่ยน
  useEffect(() => {
    const fetchBrandsForProgram = async () => {
      // ถ้ายังไม่เลือกโปรแกรม ให้เคลียร์ Brand ทิ้ง
      if (!formData.salesProgram) {
        setAvailableBrands([]);
        return;
      }

      // หา ID ของโปรแกรมจากชื่อที่เลือก
      const selectedProgram = availablePrograms.find(
        (p) => p.name === formData.salesProgram
      );
      if (!selectedProgram) return;

      try {
        // ดึงเฉพาะ Brand ที่มีใน sale_package_prices ของโปรแกรมนี้
        const { data, error } = await supabase
          .from("sale_package_prices")
          .select("inverter_brand")
          .eq("sale_package_id", selectedProgram.id);

        if (error) throw error;

        if (data) {
          // กรองชื่อซ้ำออก (Unique)
          const uniqueBrands = Array.from(
            new Set(data.map((item) => item.inverter_brand))
          );
          setAvailableBrands(uniqueBrands);

          // เช็คว่า Brand ที่เลือกค้างอยู่ ยังมีขายในโปรแกรมนี้ไหม? ถ้าไม่มีให้เคลียร์ทิ้ง
          if (formData.brand && !uniqueBrands.includes(formData.brand as any)) {
            setFormData((prev) => ({ ...prev, brand: "" }));
          }
        }
      } catch (error) {
        console.error("Error fetching brands:", error);
        toast({
          title: "โหลดข้อมูลยี่ห้อไม่สำเร็จ",
          description: "ไม่สามารถดึงข้อมูลยี่ห้อของโปรแกรมนี้ได้",
          variant: "destructive",
        });
      }
    };

    fetchBrandsForProgram();
  }, [formData.salesProgram, availablePrograms]);

  // โหลดรายการขนาดแผงโซลาร์ (min_kw) จากตาราง products
  useEffect(() => {
    const fetchPanelSizes = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("min_kw")
          .eq("product_category", "solar_panel")
          .not("min_kw", "is", null); // เอาเฉพาะที่มีค่า

        if (error) throw error;

        if (data) {
          // ดึงเฉพาะค่า min_kw มาทำเป็น Array และกรองค่าซ้ำ (Unique)
          const sizes = Array.from(new Set(data.map((p) => p.min_kw)))
            .filter((size): size is number => size !== null)
            .sort((a, b) => a - b); // เรียงจากน้อยไปมาก

          setAvailablePanelSizes(sizes);
        }
      } catch (error) {
        console.error("Error fetching panel sizes:", error);
      }
    };

    fetchPanelSizes();
  }, []);

  // Load existing quotation data when editing
  useEffect(() => {
    const loadQuotationData = async () => {
      if (!quotationId || quotationId === "new") return;

      setIsLoadingData(true);
      try {
        const { data, error } = await supabase
          .from("quotations")
          .select(
            `
            *,
            customers:customer_id (
              customer_name
            ),
            sale_packages:sale_package_id (
              id,
              sale_name
            )
          `
          )
          .eq("id", quotationId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setCurrentQuotationId(data.id);
          setFormData({
            customerName: data.customers?.customer_name || "",
            installLocation: data.location || "",
            projectSize: data.kw_size?.toString() || "",
            solarPanelSize: data.kw_panel?.toString() || "",
            documentNumber: data.document_num || "",
            serviceProvider: data.creater_name || "",
            additionalInfo: data.note || "",
            salesProgram: data.sale_packages?.sale_name || "",
            brand: data.inverter_brand || "",
          });
          setShowQuotation(true);
        }
      } catch (error) {
        console.error("Error loading quotation:", error);
        toast({
          title: "ไม่สามารถโหลดข้อมูลได้",
          description: "กรุณาลองใหม่อีกครั้ง",
          variant: "destructive",
        });
      } finally {
        setIsLoadingData(false);
      }
    };

    loadQuotationData();
  }, [quotationId, availablePrograms]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateQuotation = async () => {
    if (
      !formData.projectSize ||
      !formData.salesProgram ||
      !formData.brand ||
      !formData.solarPanelSize
    ) {
      toast({
        title: "กรุณากรอกข้อมูลที่จำเป็น",
        description: "กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Customer
      let customerId = null;
      if (formData.customerName) {
        const { data: existingCustomer } = await supabase
          .from("customers")
          .select("id")
          .eq("customer_name", formData.customerName)
          .maybeSingle();

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer, error: createError } = await supabase
            .from("customers")
            .insert({ customer_name: formData.customerName })
            .select("id")
            .single();

          if (createError) throw createError;
          customerId = newCustomer.id;
        }
      }

      // Step 2: Sale Package (หา ID จาก List ที่โหลดมาแล้วได้เลย แม่นยำกว่า)
      let salePackageId = null;
      if (formData.salesProgram) {
        const selectedProgram = availablePrograms.find(
          (p) => p.name === formData.salesProgram
        );
        if (selectedProgram) {
          salePackageId = selectedProgram.id;
        } else {
          // กรณี Fallback (ไม่น่าเกิดถ้าเลือกจาก Dropdown)
          const { data: newPkg, error: newPkgError } = await supabase
            .from("sale_packages")
            .insert({ sale_name: formData.salesProgram as any })
            .select("id")
            .single();
          if (newPkgError) throw newPkgError;
          salePackageId = newPkg.id;
        }
      }
      // คำนวณกำลังไฟสูงสุด (kw_peak)
      const projectSizeVal = formData.projectSize
        ? parseFloat(formData.projectSize)
        : 0;
      const panelSizeVal = formData.solarPanelSize
        ? parseFloat(formData.solarPanelSize)
        : 0;

      // เรียกใช้ Logic ใหม่ (ส่ง Watt เข้าไปตรงๆ)
      const { kwPeak } = calculateSystemSpecs(projectSizeVal, panelSizeVal);

      console.log(
        `Calculation: Project=${projectSizeVal}W, Panel=${panelSizeVal}W -> Peak=${kwPeak}W`
      );

      // Step 3: Create Quotation
      const quotationData = {
        customer_id: customerId,
        location: formData.installLocation || null,
        kw_size: formData.projectSize ? parseFloat(formData.projectSize) : null,
        kw_panel: formData.solarPanelSize
          ? parseFloat(formData.solarPanelSize)
          : null,
        kw_peak: kwPeak, // ค่าที่คำนวณได้
        document_num: formData.documentNumber || null,
        creater_name: formData.serviceProvider || null,
        note: formData.additionalInfo || null,
        sale_package_id: salePackageId,
        inverter_brand: formData.brand || null,
      };

      let targetId = currentQuotationId;
      if (currentQuotationId) {
        // 👉 กรณี 1: มี ID แล้ว (เป็นการแก้ไข) -> สั่ง UPDATE
        const { error: updateError } = await supabase
          .from("quotations")
          .update({
            ...quotationData,
            updated_at: new Date().toISOString(), // อัปเดตเวลาล่าสุด
          })
          .eq("id", currentQuotationId); // ระบุว่าให้อัปเดตแถวไหน

        if (updateError) throw updateError;

        toast({
          title: "บันทึกการแก้ไขสำเร็จ",
          description: "ข้อมูลถูกอัปเดตเรียบร้อยแล้ว",
        });
      } else {
        // 👉 กรณี 2: ยังไม่มี ID (สร้างใหม่) -> สั่ง INSERT
        const { data: quotation, error: insertError } = await supabase
          .from("quotations")
          .insert({
            ...quotationData,
            edited_price: 0, // กำหนดราคาเริ่มต้นเฉพาะตอนสร้างใหม่
          })
          .select()
          .single();

        if (insertError) throw insertError;
        targetId = quotation.id;
        // [สำคัญ] บันทึก ID เก็บไว้ เพื่อให้กดครั้งต่อไปกลายเป็นการ Update
        setCurrentQuotationId(quotation.id);

        toast({
          title: "สร้างใบเสนอราคาสำเร็จ",
          description: "บันทึกข้อมูลเรียบร้อยแล้ว",
        });
      }

      if (targetId) {
        console.log("Generating main items for:", targetId);
        await generateMainEquipment(targetId);

        console.log("Generating additional items for:", targetId);
        await generateAdditionalEquipment(targetId);
      }
      // แสดงส่วน Preview (ถ้ามี)
      setShowQuotation(true);

      // ============================================================
      // จบส่วนที่แก้ไข
      // ============================================================
    } catch (error) {
      console.error("Error creating/updating quotation:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถบันทึกข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditQuotation = async () => {
    if (!isEditMode) {
      setIsEditMode(true);
      toast({ title: "โหมดแก้ไข", description: "เข้าสู่โหมดแก้ไขใบเสนอราคา" });
    } else {
      if (currentQuotationId) {
        try {
          const { error } = await supabase
            .from("quotations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", currentQuotationId);

          if (error) throw error;
          toast({
            title: "เสร็จสิ้น",
            description: "บันทึกการแก้ไขเรียบร้อยแล้ว",
          });
        } catch (error) {
          console.error("Error updating:", error);
        }
      }
      setIsEditMode(false);
    }
  };

  const handleExportPDF = () =>
    toast({ title: "บันทึก PDF", description: "Coming soon..." });
  const handleExportExcel = () =>
    toast({ title: "บันทึก EXCEL", description: "Coming soon..." });

  if (isLoadingData) {
    return (
      <div className="min-h-screen bg-muted/30 p-6 flex items-center justify-center">
        <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> ย้อนกลับ
      </Button>

      <div className="bg-card rounded-lg shadow-sm p-8 mb-6 border border-border">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="customerName">ชื่อลูกค้า</Label>
              <Input
                id="customerName"
                placeholder="ชื่อลูกค้า"
                value={formData.customerName}
                onChange={(e) =>
                  handleInputChange("customerName", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="installLocation">สถานที่ติดตั้ง</Label>
              <Input
                id="installLocation"
                placeholder="สถานที่ติดตั้ง"
                value={formData.installLocation}
                onChange={(e) =>
                  handleInputChange("installLocation", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="documentNumber">เลขที่เอกสาร</Label>
              <Input
                id="documentNumber"
                placeholder="เลขที่เอกสาร"
                value={formData.documentNumber}
                onChange={(e) =>
                  handleInputChange("documentNumber", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="serviceProvider">ชื่อผู้ให้บริการ</Label>
              <Input
                id="serviceProvider"
                placeholder="ชื่อผู้ให้บริการ"
                value={formData.serviceProvider}
                onChange={(e) =>
                  handleInputChange("serviceProvider", e.target.value)
                }
              />
            </div>
            <div>
              <Label htmlFor="additionalInfo">ข้อมูลเพิ่มเติม</Label>
              <Textarea
                id="additionalInfo"
                placeholder="ข้อมูลเพิ่มเติม"
                value={formData.additionalInfo}
                onChange={(e) =>
                  handleInputChange("additionalInfo", e.target.value)
                }
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="projectSize">ขนาดโครงการ (Watt)*</Label>
              <Input
                id="projectSize"
                type="number"
                placeholder="เช่น 3000"
                value={formData.projectSize}
                onChange={(e) =>
                  handleInputChange("projectSize", e.target.value)
                }
              />
            </div>

            {/* Dropdown โปรแกรมการขาย */}
            <div>
              <Label htmlFor="salesProgram">โปรแกรมการขาย*</Label>
              <Select
                value={formData.salesProgram}
                onValueChange={(value) =>
                  handleInputChange("salesProgram", value)
                }
              >
                <SelectTrigger id="salesProgram">
                  <SelectValue
                    placeholder={
                      availablePrograms.length > 0
                        ? "เลือกโปรแกรม"
                        : "กำลังโหลด..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availablePrograms.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      ไม่มีรายการ
                    </div>
                  ) : (
                    availablePrograms.map((program) => (
                      <SelectItem key={program.id} value={program.name}>
                        {program.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Dropdown ยี่ห้อ Inverter (Dynamic ตามโปรแกรมที่เลือก) */}
            <div>
              <Label htmlFor="brand">ยี่ห้อ Inverter*</Label>
              <Select
                value={formData.brand}
                onValueChange={(value) => handleInputChange("brand", value)}
                disabled={!formData.salesProgram} // บังคับเลือกโปรแกรมก่อน
              >
                <SelectTrigger id="brand">
                  <SelectValue
                    placeholder={
                      formData.salesProgram
                        ? "เลือกยี่ห้อ"
                        : "กรุณาเลือกโปรแกรมการขายก่อน"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableBrands.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      {formData.salesProgram
                        ? "ไม่พบยี่ห้อในโปรแกรมนี้"
                        : "รอการเลือกโปรแกรม"}
                    </div>
                  ) : (
                    availableBrands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {formatBrandName(brand)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* แก้ไขตรงนี้: เปลี่ยน Input เป็น Select */}
            <div>
              <Label htmlFor="solarPanelSize">ขนาดแผงโซลาร์เซลล์ (Watt)*</Label>
              <Select
                value={formData.solarPanelSize}
                onValueChange={(value) =>
                  handleInputChange("solarPanelSize", value)
                }
              >
                <SelectTrigger id="solarPanelSize">
                  <SelectValue
                    placeholder={
                      availablePanelSizes.length > 0
                        ? "เลือกขนาดแผง"
                        : "ไม่พบข้อมูลแผง"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availablePanelSizes.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      กรุณาเพิ่มข้อมูล Solar Panel ในฐานข้อมูลก่อน
                    </div>
                  ) : (
                    availablePanelSizes.map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size.toLocaleString()} Watt
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleCreateQuotation}
            size="lg"
            disabled={isLoading}
            className="w-full md:w-auto px-8"
          >
            {isLoading ? "กำลังบันทึก..." : "สร้างใบเสนอราคา"}
          </Button>
        </div>
      </div>

      {showQuotation && (
        <div className="bg-card rounded-lg shadow-sm p-8 relative border border-border animate-in fade-in">
          <div className="absolute top-4 right-4 flex gap-2">
            <Button variant="outline" onClick={handleEditQuotation}>
              {isEditMode ? "เสร็จสิ้น" : "แก้ไข"}
            </Button>
            <Button variant="outline" onClick={handleExportPDF}>
              บันทึก PDF
            </Button>
            <Button variant="outline" onClick={handleExportExcel}>
              บันทึก EXCEL
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <h2 className="text-2xl font-semibold text-center mb-2">
              ส่วนแสดงใบเสนอราคา
            </h2>
            <p className="text-muted-foreground">
              (พื้นที่แสดงผล PDF/Quotation ในอนาคต)
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuotation;
