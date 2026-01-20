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
import { useCalculatePricing } from "@/hooks/useCalculatePricing";
import { generateQuotationExcel } from "@/utils/ExportExcel";
import { bahttext } from "bahttext";

// Helper function: จัดรูปแบบชื่อ Brand ให้สวยงาม (ตัวพิมพ์ใหญ่)
const formatBrandName = (brand: string) => {
  if (!brand) return "";
  // แปลง huawei -> Huawei, huawei_optimizer -> Huawei Optimizer
  return brand
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function: แยกข้อความเงื่อนไขที่มีเลขนำหน้า (1. 2. 3.) ให้เป็น Array
const parseTerms = (text: string | null) => {
  if (!text) return ["-"];

  // 1. ถ้ามี Newline (\n) ให้แยกบรรทัดก่อน
  if (text.includes("\n")) {
    return text
      .split("\n")
      .map((t) => t.trim().replace(/^\d+\.\s*/, "")) // ตัดเลขข้อนำหน้าออก (ถ้ามี)
      .filter((t) => t !== "");
  }

  // 2. ถ้าเป็นบรรทัดเดียวแต่มีเลขข้อ (1. ... 2. ...) ให้ใช้ Regex แยก
  // Regex นี้จะหาจุดที่มีตัวเลขตามด้วยจุดและเว้นวรรค (เช่น "2. ")
  const parts = text.split(/(?=\d+\.\s)/);

  if (parts.length > 0) {
    return parts
      .map((t) => t.trim().replace(/^\d+\.\s*/, "")) // ตัดเลขข้อนำหน้าออก
      .filter((t) => t !== "");
  }

  // 3. ถ้าไม่เข้าเงื่อนไขเลย ให้คืนค่าเดิมกลับไป
  return [text];
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
  const { calculateAndSavePricing, isCalculating: isPricing } =
    useCalculatePricing();

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
    electricalPhase: "",
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
            electricalPhase: data.electrical_phase || "single_phase",
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
        electrical_phase: formData.electricalPhase || "single_phase",
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

        console.log("Calculating Prices...");
        await calculateAndSavePricing(targetId);
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

  // ในไฟล์ src/pages/CreateQuotation.tsx

  const handleExportExcel = async () => {
    if (!currentQuotationId) {
      toast({
        title: "ไม่พบข้อมูล",
        description: "กรุณาบันทึกใบเสนอราคาก่อนดาวน์โหลด",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // 1. ดึงข้อมูล Quotation
      const { data: quoteData, error: quoteError } = await supabase
        .from("quotations")
        .select(
          `
            sale_package_id, 
            kw_size, 
            kw_peak, 
            inverter_brand, 
            document_num, 
            electrical_phase
        `
        )
        .eq("id", currentQuotationId)
        .single();

      if (quoteError) throw quoteError;

      // 2. ดึงข้อมูลสินค้า (Line Items)
      const { data: lineItems, error: itemsError } = await supabase
        .from("product_line_items")
        .select(`*, products(*)`)
        .eq("quotation_id", currentQuotationId)
        .order("id", { ascending: true });

      if (itemsError) throw itemsError;

      // 3. ดึงข้อมูลบริษัท
      const { data: companyData } = await supabase
        .from("company_info")
        .select("*")
        .limit(1)
        .maybeSingle();

      // 4. ดึงเงื่อนไข (Terms)
      let paymentTermsDB = ["-"];
      let warrantyTermsDB = ["-"];
      let noteDB = "-";

      if (quoteData?.sale_package_id) {
        const { data: termsData } = await supabase
          .from("sale_package_prices")
          .select("payment_terms, warranty_terms, note")
          .eq("sale_package_id", quoteData.sale_package_id)
          .limit(1)
          .maybeSingle();

        if (termsData) {
          // ✅ ใช้ฟังก์ชัน parseTerms แยกข้อความให้อัตโนมัติ
          paymentTermsDB = parseTerms(termsData.payment_terms);
          warrantyTermsDB = parseTerms(termsData.warranty_terms);
          noteDB = termsData.note || "-";
        }
      }

      // ---------------------------------------------------------
      // 5. คำนวณค่าและจัดรูปแบบ Project Info
      // ---------------------------------------------------------
      const projectKw = (quoteData.kw_size || 0) / 1000;
      const projectSizeStr = `${projectKw} kW`;
      const peakKw = (quoteData.kw_peak || 0) / 1000;
      const maxPowerDisplay = `กำลังไฟสูงสุด ( ${peakKw.toFixed(2)} kWp )`;
      const brandStr = (quoteData.inverter_brand || "-").toUpperCase();

      // ---------------------------------------------------------
      // 6. Map Line Items และจัดหมวดหมู่
      // ---------------------------------------------------------
      const mappedItems =
        lineItems?.map((item, index) => {
          const product = item.products;
          const categoryRaw = (product?.product_category || "") as string;

          // เฉพาะ operation เท่านั้นที่เป็น Section B
          const isSectionB = categoryRaw === "operation";

          const qty = item.quantity || 0;
          const matPrice = item.product_price || 0;
          const labPrice = item.installation_price || 0;

          return {
            no: index + 1,
            name: product?.name || "Unknown Item",
            brand: product?.brand || "-",
            qty: qty,
            unit: product?.unit || "Unit",
            matUnit: isSectionB ? 0 : qty > 0 ? matPrice / qty : 0,
            matTotal: isSectionB ? 0 : matPrice,
            labUnit: isSectionB ? 0 : qty > 0 ? labPrice / qty : 0,
            labTotal: isSectionB ? 0 : labPrice,
            total: matPrice + labPrice,
            category: isSectionB ? "B" : "A",
            _rawCategory: categoryRaw,
          };
        }) || [];

      // ---------------------------------------------------------
      // 7. จัดเรียงลำดับ Section B (Sorting)
      // ---------------------------------------------------------

      // ลำดับที่ต้องการ (ตามตาราง)
      const sectionBOrder = [
        "Electrical drawing, Facility system",
        "Common Temporary Facilities",
        "Safety Operation",
        "Comissioning test",
        "Tempolary Utility Expense",
        "ดำเนินการยื่นเอกสารขออนุญาต",
      ];

      const sectionAOrder = [
        "solar_panel",
        "pv_mounting_structure",
        "inverter",
        "optimizer",
        "zero_export_smart_logger",
        "ac_box",
        "dc_box",
        "cable",
        "service",
        "support_inverter",
        "electrical_management",
        "other",
      ];

      // แยกหมวด A และ B เพื่อจัดเรียงเฉพาะ B
      const itemsA = mappedItems.filter((i) => i.category === "A");
      const itemsB = mappedItems.filter((i) => i.category === "B");
      itemsA.sort((a, b) => {
        const indexA = sectionAOrder.indexOf(a._rawCategory);
        const indexB = sectionAOrder.indexOf(b._rawCategory);

        // ถ้าหา Category ไม่เจอ ให้ไปอยู่ท้ายๆ
        const valA = indexA === -1 ? 999 : indexA;
        const valB = indexB === -1 ? 999 : indexB;

        return valA - valB;
      });

      itemsB.sort((a, b) => {
        const indexA = sectionBOrder.findIndex((orderName) =>
          a.name.toLowerCase().trim().includes(orderName.toLowerCase().trim())
        );
        const indexB = sectionBOrder.findIndex((orderName) =>
          b.name.toLowerCase().trim().includes(orderName.toLowerCase().trim())
        );

        // ถ้าหาไม่เจอ ให้ไปต่อท้ายสุด (999)
        const valA = indexA === -1 ? 999 : indexA;
        const valB = indexB === -1 ? 999 : indexB;

        return valA - valB;
      });

      // รวมกลับเป็น Array เดียว (ExportExcel จะไปแยก A/B เองอีกที)
      const sortedItems = [...itemsA, ...itemsB];

      // ---------------------------------------------------------
      // 8. เตรียม Object ส่งออก Excel
      // ---------------------------------------------------------
      const exportData = {
        companyName: companyData?.name || "บริษัท โพนิซ จำกัด",
        companyAddress: companyData?.address || "-",
        companyPhone: companyData?.phone_number || "-",
        companyTaxId: companyData?.id_tax || "-",

        customerName: formData.customerName || "-",
        customerAddress: formData.installLocation || "-",
        customerID: "-",

        projectName: `โซลาร์เซลล์ ${projectSizeStr}`,
        maxPower: maxPowerDisplay,
        inverterBrand: brandStr,

        date: new Date().toLocaleDateString("th-TH", {
          day: "numeric",
          month: "numeric",
          year: "numeric",
        }),
        docNumber: quoteData.document_num || formData.documentNumber || "DRAFT",

        items: sortedItems as any, // ส่งข้อมูลที่เรียงแล้วเข้าไป

        paymentTerms: paymentTermsDB,
        warrantyTerms: warrantyTermsDB,
        remarks: noteDB,

        discount: 0,
        vatRate: 0.07,
      };

      await generateQuotationExcel(exportData);

      toast({
        title: "ดาวน์โหลดสำเร็จ",
        description: "สร้างไฟล์ Excel เรียบร้อยแล้ว",
      });
    } catch (error) {
      console.error("Export Excel Error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถสร้างไฟล์ Excel ได้",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
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
          <div className="grid grid-cols-2 gap-4">
            {/* ซ้าย: ขนาดโครงการ */}
            <div>
              <Label htmlFor="projectSize">ขนาดโครงการ (Watt)*</Label>
              <Input
                id="projectSize"
                type="number"
                placeholder="เช่น 5000"
                value={formData.projectSize}
                onChange={(e) =>
                  handleInputChange("projectSize", e.target.value)
                }
              />
            </div>

            {/* ขวา: ระบบไฟฟ้า (Phase) */}
            <div>
              <Label htmlFor="electricalPhase">ระบบไฟฟ้า*</Label>
              <Select
                value={formData.electricalPhase}
                onValueChange={(value) =>
                  handleInputChange("electricalPhase", value)
                }
              >
                <SelectTrigger id="electricalPhase">
                  <SelectValue placeholder="เลือกระบบไฟ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_phase">1 Phase (220V)</SelectItem>
                  <SelectItem value="three_phase">3 Phase (380V)</SelectItem>
                </SelectContent>
              </Select>
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
