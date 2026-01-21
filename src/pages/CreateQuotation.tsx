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
import { QuotationPreview, PreviewData } from "@/components/QuotationPreview";

// Helper function: จัดรูปแบบชื่อ Brand
const formatBrandName = (brand: string) => {
  if (!brand) return "";
  return brand
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function: แยกข้อความเงื่อนไข
const parseTerms = (text: string | null) => {
  if (!text) return ["-"];
  if (text.includes("\n")) {
    return text
      .split("\n")
      .map((t) => t.trim().replace(/^\d+\.\s*/, ""))
      .filter((t) => t !== "");
  }
  const parts = text.split(/(?=\d+\.\s)/);
  if (parts.length > 0) {
    return parts
      .map((t) => t.trim().replace(/^\d+\.\s*/, ""))
      .filter((t) => t !== "");
  }
  return [text];
};

const CreateQuotation = () => {
  const navigate = useNavigate();
  const { id: quotationId } = useParams<{ id: string }>();
  const [showQuotation, setShowQuotation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(null);

  const [availablePrograms, setAvailablePrograms] = useState<{ id: string; name: string }[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availablePanelSizes, setAvailablePanelSizes] = useState<number[]>([]);
  
  const { generateMainEquipment } = useAutoGenerateLineItems();
  const { generateAdditionalEquipment } = useAutoGenerateAdditionalItems();
  const { calculateAndSavePricing } = useCalculatePricing();

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

  // State สำหรับ Preview
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // ------------------------------------------------------------------
  // ✅ 1. แก้ไข loadPreviewData ให้ดึง Terms จาก sale_packages
  // ------------------------------------------------------------------
  const loadPreviewData = async (quotationId: string) => {
    try {
      const { data: quoteData } = await supabase.from("quotations").select("*").eq("id", quotationId).single();
      const { data: lineItems } = await supabase.from("product_line_items").select(`*, products(*)`).eq("quotation_id", quotationId);
      
      if (!quoteData || !lineItems) return;

      let paymentTerms = ["-"];
      let warrantyTerms = ["-"];
      let remarks = "-";
      
      // 👇 เปลี่ยนตรงนี้: ดึงจาก sale_packages แทน sale_package_prices
      if (quoteData.sale_package_id) {
          const { data: pkgData } = await supabase
             .from("sale_packages")
             .select("payment_terms, warranty_terms, note") // ใช้ชื่อ column ที่เพิ่มใหม่
             .eq("id", quoteData.sale_package_id)
             .maybeSingle();

          if (pkgData) {
             paymentTerms = parseTerms(pkgData.payment_terms);
             warrantyTerms = parseTerms(pkgData.warranty_terms);
             remarks = pkgData.note || "-";
          }
      }

      const mappedItems = lineItems.map((item) => {
          const product = item.products;
          const categoryRaw = product?.product_category || "";
          const isSectionB = categoryRaw === "operation"; 
          
          return {
             name: product?.name || "Unknown",
             brand: product?.brand || "-",
             category: isSectionB ? "B" : "A",
             _rawCategory: categoryRaw,
             qty: item.quantity || 0,
             unit: product?.unit || "Unit",
             matUnit: item.product_price, 
             labUnit: item.installation_price,
             total: (item.product_price || 0) + (item.installation_price || 0)
          };
      });

      const sectionAOrder = ["solar_panel", "pv_mounting_structure", "inverter", "optimizer", "zero_export_smart_logger", "ac_box", "dc_box", "cable", "service", "support_inverter", "electrical_management", "other"];
      
      const itemsA = mappedItems.filter(i => i.category === "A").sort((a, b) => {
         const idxA = sectionAOrder.indexOf(a._rawCategory); const idxB = sectionAOrder.indexOf(b._rawCategory);
         return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });
      const itemsB = mappedItems.filter(i => i.category === "B");

      setPreviewData({
         customerName: formData.customerName,
         projectName: `โซลาร์เซลล์ ${((quoteData.kw_size||0)/1000)} kW`,
         docNumber: quoteData.document_num || "DRAFT",
         date: new Date().toLocaleDateString("th-TH"),
         items: [...itemsA, ...itemsB],
         paymentTerms,
         warrantyTerms,
         remarks,
         vatRate: 0.07,
         discount: 0 
      });

    } catch (e) {
      console.error("Preview Error", e);
    }
  };

  // ------------------------------------------------------------------
  // ✅ 2. แก้ไข handleExportExcel ให้ดึง Terms จาก sale_packages
  // ------------------------------------------------------------------
  const handleExportExcel = async () => {
    if (!currentQuotationId) {
      toast({ title: "ไม่พบข้อมูล", description: "กรุณาบันทึกใบเสนอราคาก่อนดาวน์โหลด", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      // 1. Quotation Info
      const { data: quoteData, error: quoteError } = await supabase
        .from("quotations")
        .select(`sale_package_id, kw_size, kw_peak, inverter_brand, document_num, electrical_phase`)
        .eq("id", currentQuotationId)
        .single();
      if (quoteError) throw quoteError;

      // 2. Line Items
      const { data: lineItems, error: itemsError } = await supabase
        .from("product_line_items")
        .select(`*, products(*)`)
        .eq("quotation_id", currentQuotationId)
        .order("id", { ascending: true });
      if (itemsError) throw itemsError;

      // 3. Company Info
      const { data: companyData } = await supabase.from("company_info").select("*").limit(1).maybeSingle();

      // 4. Terms (ดึงจาก sale_packages)
      let paymentTermsDB = ["-"];
      let warrantyTermsDB = ["-"];
      let noteDB = "-";

      if (quoteData?.sale_package_id) {
        // 👇 เปลี่ยนตรงนี้: ดึงจาก sale_packages
        const { data: pkgData } = await supabase
          .from("sale_packages")
          .select("payment_terms, warranty_terms, note")
          .eq("id", quoteData.sale_package_id)
          .limit(1)
          .maybeSingle();

        if (pkgData) {
          paymentTermsDB = parseTerms(pkgData.payment_terms);
          warrantyTermsDB = parseTerms(pkgData.warranty_terms);
          noteDB = pkgData.note || "-";
        }
      }

      // 5. Calculations
      const projectKw = (quoteData.kw_size || 0) / 1000;
      const projectSizeStr = `${projectKw} kW`;
      const peakKw = (quoteData.kw_peak || 0) / 1000;
      const maxPowerDisplay = `กำลังไฟสูงสุด ( ${peakKw.toFixed(2)} kWp )`;
      const brandStr = (quoteData.inverter_brand || "-").toUpperCase();

      // 6. Map Items
      const mappedItems = lineItems?.map((item, index) => {
          const product = item.products;
          const categoryRaw = (product?.product_category || "") as string;
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

      // 7. Sorting
      const sectionBOrder = ["Electrical drawing, Facility system", "Common Temporary Facilities", "Safety Operation", "Comissioning test", "Tempolary Utility Expense", "ดำเนินการยื่นเอกสารขออนุญาต"];
      const sectionAOrder = ["solar_panel", "pv_mounting_structure", "inverter", "optimizer", "zero_export_smart_logger", "ac_box", "dc_box", "cable", "service", "support_inverter", "electrical_management", "other"];

      const itemsA = mappedItems.filter((i) => i.category === "A");
      const itemsB = mappedItems.filter((i) => i.category === "B");
      
      itemsA.sort((a, b) => {
        const indexA = sectionAOrder.indexOf(a._rawCategory);
        const indexB = sectionAOrder.indexOf(b._rawCategory);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      itemsB.sort((a, b) => {
        const indexA = sectionBOrder.findIndex((orderName) => a.name.toLowerCase().trim().includes(orderName.toLowerCase().trim()));
        const indexB = sectionBOrder.findIndex((orderName) => b.name.toLowerCase().trim().includes(orderName.toLowerCase().trim()));
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      const sortedItems = [...itemsA, ...itemsB];

      // 8. Export Data
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
        date: new Date().toLocaleDateString("th-TH", { day: "numeric", month: "numeric", year: "numeric" }),
        docNumber: quoteData.document_num || formData.documentNumber || "DRAFT",
        items: sortedItems as any,
        paymentTerms: paymentTermsDB,
        warrantyTerms: warrantyTermsDB,
        remarks: noteDB,
        discount: 0,
        vatRate: 0.07,
      };

      await generateQuotationExcel(exportData);
      toast({ title: "ดาวน์โหลดสำเร็จ", description: "สร้างไฟล์ Excel เรียบร้อยแล้ว" });

    } catch (error) {
      console.error("Export Excel Error:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถสร้างไฟล์ Excel ได้", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = () => {
    toast({ title: "Coming Soon", description: "ฟีเจอร์นี้กำลังอยู่ในระหว่างการพัฒนา" });
  };

  useEffect(() => {
     if(currentQuotationId && showQuotation) {
        loadPreviewData(currentQuotationId);
     }
  }, [currentQuotationId, showQuotation]);

  useEffect(() => {
    const fetchSalesPrograms = async () => {
      try {
        const { data, error } = await supabase.from("sale_packages").select("id, sale_name").order("sale_name");
        if (error) throw error;
        if (data) setAvailablePrograms(data.map((p) => ({ id: p.id, name: p.sale_name })));
      } catch (error) { console.error("Error loading programs:", error); }
    };
    fetchSalesPrograms();
  }, []);

  useEffect(() => {
    const fetchBrandsForProgram = async () => {
      if (!formData.salesProgram) { setAvailableBrands([]); return; }
      const selectedProgram = availablePrograms.find((p) => p.name === formData.salesProgram);
      if (!selectedProgram) return;

      try {
        const { data, error } = await supabase.from("sale_package_prices").select("inverter_brand").eq("sale_package_id", selectedProgram.id);
        if (error) throw error;
        if (data) {
          const uniqueBrands = Array.from(new Set(data.map((item) => item.inverter_brand)));
          setAvailableBrands(uniqueBrands);
          if (formData.brand && !uniqueBrands.includes(formData.brand as any)) {
            setFormData((prev) => ({ ...prev, brand: "" }));
          }
        }
      } catch (error) { console.error("Error fetching brands:", error); }
    };
    fetchBrandsForProgram();
  }, [formData.salesProgram, availablePrograms]);

  useEffect(() => {
    const fetchPanelSizes = async () => {
      try {
        const { data, error } = await supabase.from("products").select("min_kw").eq("product_category", "solar_panel").not("min_kw", "is", null);
        if (error) throw error;
        if (data) {
          const sizes = Array.from(new Set(data.map((p) => p.min_kw))).filter((size): size is number => size !== null).sort((a, b) => a - b);
          setAvailablePanelSizes(sizes);
        }
      } catch (error) { console.error("Error fetching panel sizes:", error); }
    };
    fetchPanelSizes();
  }, []);

  useEffect(() => {
    const loadQuotationData = async () => {
      if (!quotationId || quotationId === "new") return;
      setIsLoadingData(true);
      try {
        const { data, error } = await supabase.from("quotations").select(`*, customers:customer_id(customer_name), sale_packages:sale_package_id(id, sale_name)`).eq("id", quotationId).maybeSingle();
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
      } finally { setIsLoadingData(false); }
    };
    loadQuotationData();
  }, [quotationId, availablePrograms]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateQuotation = async () => {
    if (!formData.projectSize || !formData.salesProgram || !formData.brand || !formData.solarPanelSize) {
      toast({ title: "กรุณากรอกข้อมูลที่จำเป็น", description: "กรุณากรอกข้อมูลที่มีเครื่องหมาย * ให้ครบถ้วน", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      let customerId = null;
      if (formData.customerName) {
        const { data: existingCustomer } = await supabase.from("customers").select("id").eq("customer_name", formData.customerName).maybeSingle();
        if (existingCustomer) customerId = existingCustomer.id;
        else {
          const { data: newCustomer, error: createError } = await supabase.from("customers").insert({ customer_name: formData.customerName }).select("id").single();
          if (createError) throw createError;
          customerId = newCustomer.id;
        }
      }

      let salePackageId = null;
      if (formData.salesProgram) {
        const selectedProgram = availablePrograms.find((p) => p.name === formData.salesProgram);
        if (selectedProgram) salePackageId = selectedProgram.id;
        else {
          const { data: newPkg, error: newPkgError } = await supabase.from("sale_packages").insert({ sale_name: formData.salesProgram as any }).select("id").single();
          if (newPkgError) throw newPkgError;
          salePackageId = newPkg.id;
        }
      }

      const projectSizeVal = formData.projectSize ? parseFloat(formData.projectSize) : 0;
      const panelSizeVal = formData.solarPanelSize ? parseFloat(formData.solarPanelSize) : 0;
      const { kwPeak } = calculateSystemSpecs(projectSizeVal, panelSizeVal);

      const quotationData = {
        customer_id: customerId,
        location: formData.installLocation || null,
        kw_size: formData.projectSize ? parseFloat(formData.projectSize) : null,
        kw_panel: formData.solarPanelSize ? parseFloat(formData.solarPanelSize) : null,
        kw_peak: kwPeak,
        electrical_phase: formData.electricalPhase || "single_phase",
        document_num: formData.documentNumber || null,
        creater_name: formData.serviceProvider || null,
        note: formData.additionalInfo || null,
        sale_package_id: salePackageId,
        inverter_brand: formData.brand || null,
      };

      let targetId = currentQuotationId;
      if (currentQuotationId) {
        const { error: updateError } = await supabase.from("quotations").update({ ...quotationData, updated_at: new Date().toISOString() }).eq("id", currentQuotationId);
        if (updateError) throw updateError;
        toast({ title: "บันทึกการแก้ไขสำเร็จ", description: "ข้อมูลถูกอัปเดตเรียบร้อยแล้ว" });
      } else {
        const { data: quotation, error: insertError } = await supabase.from("quotations").insert({ ...quotationData, edited_price: 0 }).select().single();
        if (insertError) throw insertError;
        targetId = quotation.id;
        setCurrentQuotationId(quotation.id);
        toast({ title: "สร้างใบเสนอราคาสำเร็จ", description: "บันทึกข้อมูลเรียบร้อยแล้ว" });
      }

      if (targetId) {
        await generateMainEquipment(targetId);
        await generateAdditionalEquipment(targetId);
        await calculateAndSavePricing(targetId);
        await loadPreviewData(targetId);
      }
      setShowQuotation(true);

    } catch (error) {
      console.error("Error creating/updating quotation:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกข้อมูลได้", variant: "destructive" });
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
          const { error } = await supabase.from("quotations").update({ updated_at: new Date().toISOString() }).eq("id", currentQuotationId);
          if (error) throw error;
          toast({ title: "เสร็จสิ้น", description: "บันทึกการแก้ไขเรียบร้อยแล้ว" });
        } catch (error) { console.error("Error updating:", error); }
      }
      setIsEditMode(false);
    }
  };

  if (isLoadingData) return <div className="min-h-screen bg-muted/30 p-6 flex items-center justify-center"><p className="text-muted-foreground">กำลังโหลดข้อมูล...</p></div>;

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> ย้อนกลับ
      </Button>

      <div className={`grid gap-4 items-start ${showQuotation ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 max-w-3xl mx-auto"}`}>
        
        {/* INPUT FORM (Compact Version 1/3) */}
        <div className="w-full lg:col-span-1">
          <div className="bg-card rounded-lg shadow-sm p-5 border border-border">
            <h2 className="text-lg font-semibold mb-3 text-primary">กรอกข้อมูลใบเสนอราคา</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">ชื่อลูกค้า</Label>
                <Input className="h-9 mt-1" placeholder="ชื่อลูกค้า" value={formData.customerName} onChange={(e) => handleInputChange("customerName", e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">สถานที่ติดตั้ง</Label>
                <Input className="h-9 mt-1" placeholder="สถานที่ติดตั้ง" value={formData.installLocation} onChange={(e) => handleInputChange("installLocation", e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">เลขที่เอกสาร</Label>
                <Input className="h-9 mt-1" placeholder="เลขที่เอกสาร" value={formData.documentNumber} onChange={(e) => handleInputChange("documentNumber", e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">ผู้ให้บริการ</Label>
                <Input className="h-9 mt-1" placeholder="ชื่อผู้ให้บริการ" value={formData.serviceProvider} onChange={(e) => handleInputChange("serviceProvider", e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">ขนาดโครงการ (Watt)*</Label>
                <Input type="number" className="h-9 mt-1" placeholder="เช่น 5000" value={formData.projectSize} onChange={(e) => handleInputChange("projectSize", e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">ระบบไฟฟ้า*</Label>
                <Select value={formData.electricalPhase} onValueChange={(value) => handleInputChange("electricalPhase", value)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_phase">1 Phase</SelectItem>
                    <SelectItem value="three_phase">3 Phase</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">โปรแกรมการขาย*</Label>
                <Select value={formData.salesProgram} onValueChange={(value) => handleInputChange("salesProgram", value)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="เลือกโปรแกรม" /></SelectTrigger>
                  <SelectContent>{availablePrograms.map((program) => (<SelectItem key={program.id} value={program.name}>{program.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">ยี่ห้อ Inverter*</Label>
                <Select value={formData.brand} onValueChange={(value) => handleInputChange("brand", value)} disabled={!formData.salesProgram}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="เลือกยี่ห้อ" /></SelectTrigger>
                  <SelectContent>{availableBrands.map((brand) => (<SelectItem key={brand} value={brand}>{formatBrandName(brand)}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">ขนาดแผง (Watt)*</Label>
                <Select value={formData.solarPanelSize} onValueChange={(value) => handleInputChange("solarPanelSize", value)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="เลือกขนาดแผง" /></SelectTrigger>
                  <SelectContent>{availablePanelSizes.map((size) => (<SelectItem key={size} value={size.toString()}>{size.toLocaleString()} Watt</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">หมายเหตุเพิ่มเติม</Label>
                <Textarea className="mt-1 min-h-[60px]" placeholder="ระบุข้อมูลเพิ่มเติม..." value={formData.additionalInfo} onChange={(e) => handleInputChange("additionalInfo", e.target.value)} />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t">
              <Button onClick={handleCreateQuotation} size="sm" disabled={isLoading} className="w-full h-10">
                {isLoading ? "กำลังบันทึก..." : (currentQuotationId ? "บันทึกการแก้ไข" : "สร้างใบเสนอราคา")}
              </Button>
            </div>
          </div>
        </div>

        {/* PREVIEW SECTION (2/3) */}
        {showQuotation && (
          <div className="w-full lg:col-span-2 lg:sticky lg:top-4">
            <div className="bg-card rounded-lg shadow-sm p-4 relative border border-border animate-in fade-in">
              <div className="absolute top-3 right-3 flex gap-2 z-10">
                <Button variant="outline" size="sm" onClick={handleEditQuotation}>{isEditMode ? "เสร็จสิ้น" : "แก้ไข"}</Button>
                <Button variant="outline" size="sm" onClick={handleExportPDF}>PDF</Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>EXCEL</Button>
              </div>
              <div className="flex flex-col items-center justify-center min-h-[400px] overflow-auto mt-12">
                {previewData ? (
                  <div className="origin-top scale-95 transition-transform w-full flex justify-center">
                    <QuotationPreview data={previewData} />
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground mt-10"><p>กำลังโหลดตัวอย่างเอกสาร...</p></div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateQuotation;