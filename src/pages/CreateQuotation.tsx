import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import type { Database } from "@/integrations/supabase/types";

const CreateQuotation = () => {
  const navigate = useNavigate();
  const [showQuotation, setShowQuotation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(
    null
  );
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

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateQuotation = async () => {
    // Validate required fields
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
      // Step 1: Create or find customer
      let customerId = null;

      if (formData.customerName) {
        const { data: existingCustomer, error: customerFindError } =
          await supabase
            .from("customers")
            .select("id")
            .eq("customer_name", formData.customerName)
            .maybeSingle();

        if (customerFindError) throw customerFindError;

        if (existingCustomer) {
          customerId = existingCustomer.id;
        } else {
          const { data: newCustomer, error: customerCreateError } =
            await supabase
              .from("customers")
              .insert({
                customer_name: formData.customerName,
              })
              .select("id")
              .single();

          if (customerCreateError) throw customerCreateError;
          customerId = newCustomer.id;
        }
      }

      // Step 2: Find or create sale package
      let salePackageId = null;

      if (formData.salesProgram) {
        const saleNameValue =
          formData.salesProgram as Database["public"]["Enums"]["sale_name"];

        const { data: existingSalePackage, error: salePackageFindError } =
          await supabase
            .from("sale_packages")
            .select("id")
            .eq("sale_name", saleNameValue)
            .maybeSingle();

        if (salePackageFindError) throw salePackageFindError;

        if (existingSalePackage) {
          salePackageId = existingSalePackage.id;
        } else {
          const { data: newSalePackage, error: salePackageCreateError } =
            await supabase
              .from("sale_packages")
              .insert({
                sale_name: saleNameValue,
              })
              .select("id")
              .single();

          if (salePackageCreateError) throw salePackageCreateError;
          salePackageId = newSalePackage.id;
        }
      }

      // Step 3: Create quotation
      const { data: quotation, error: quotationError } = await supabase
        .from("quotations")
        .insert({
          customer_id: customerId,
          location: formData.installLocation || null,
          kw_size: formData.projectSize
            ? parseFloat(formData.projectSize)
            : null,
          kw_panel: formData.solarPanelSize
            ? parseFloat(formData.solarPanelSize)
            : null,
          document_num: formData.documentNumber || null,
          creater_name: formData.serviceProvider || null,
          note: formData.additionalInfo || null,
          sale_package_id: salePackageId,
          inverter_brand: formData.brand || null,
        })
        .select()
        .single();

      if (quotationError) throw quotationError;

      // Store quotation ID for later updates
      setCurrentQuotationId(quotation.id);

      toast({
        title: "สร้างใบเสนอราคาสำเร็จ",
        description: "บันทึกข้อมูลเรียบร้อยแล้ว",
      });

      setShowQuotation(true);
    } catch (error) {
      console.error("Error creating quotation:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างใบเสนอราคาได้ กรุณาลองใหม่อีกครั้ง",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditQuotation = async () => {
    if (!isEditMode) {
      // Entering edit mode
      setIsEditMode(true);
      toast({
        title: "โหมดแก้ไข",
        description: "เข้าสู่โหมดแก้ไขใบเสนอราคา",
      });
    } else {
      // Exiting edit mode - save changes and update updated_at
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
          console.error("Error updating quotation:", error);
          toast({
            title: "เกิดข้อผิดพลาด",
            description: "ไม่สามารถบันทึกการแก้ไขได้",
            variant: "destructive",
          });
        }
      }
      setIsEditMode(false);
    }
  };

  const handleExportPDF = () => {
    toast({
      title: "บันทึก PDF",
      description: "กำลังสร้างไฟล์ PDF (ฟังก์ชันจะพัฒนาต่อ)",
    });
  };

  const handleExportExcel = () => {
    toast({
      title: "บันทึก EXCEL",
      description: "กำลังสร้างไฟล์ Excel (ฟังก์ชันจะพัฒนาต่อ)",
    });
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        ย้อนกลับ
      </Button>

      {/* Form Section */}
      <div className="bg-card rounded-lg shadow-sm p-8 mb-6">
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
              <Label htmlFor="projectSize">ขนาดโครงการ*</Label>
              <Input
                id="projectSize"
                type="number"
                placeholder="watt"
                value={formData.projectSize}
                onChange={(e) =>
                  handleInputChange("projectSize", e.target.value)
                }
              />
            </div>

            <div>
              <Label htmlFor="brand">ยี่ห้อ*</Label>
              <Select
                value={formData.brand}
                onValueChange={(value) => handleInputChange("brand", value)}
              >
                <SelectTrigger id="brand">
                  <SelectValue placeholder="ยี่ห้อ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="huawei">Huawei</SelectItem>
                  <SelectItem value="sungrow">Sungrow</SelectItem>
                  <SelectItem value="growatt">Growatt</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="salesProgram">โปรแกรมการขาย*</Label>
              <Select
                value={formData.salesProgram}
                onValueChange={(value) =>
                  handleInputChange("salesProgram", value)
                }
              >
                <SelectTrigger id="salesProgram">
                  <SelectValue placeholder="โปรแกรมการขาย" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Direct</SelectItem>
                  <SelectItem value="partner_a">Partner A</SelectItem>
                  <SelectItem value="partner_b">Partner B</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="solarPanelSize">ขนาดแผงโซลาร์เซลล์*</Label>
              <Input
                id="solarPanelSize"
                type="number"
                placeholder="watt"
                value={formData.solarPanelSize}
                onChange={(e) =>
                  handleInputChange("solarPanelSize", e.target.value)
                }
              />
            </div>
          </div>
        </div>

        {/* Create Button */}
        <div className="flex justify-end mt-6">
          <Button
            onClick={handleCreateQuotation}
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? "กำลังบันทึก..." : "สร้างใบเสนอราคา"}
          </Button>
        </div>
      </div>

      {/* Quotation Display Section */}
      {showQuotation && (
        <div className="bg-card rounded-lg shadow-sm p-8 relative">
          {/* Export Buttons */}
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

          {/* Quotation Content */}
          <div className="flex items-center justify-center min-h-[400px]">
            <h2 className="text-2xl font-semibold text-center">
              ส่วนแสดงใบเสนอราคา
            </h2>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateQuotation;
