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
import { calculateDefaultLineItem } from "@/utils/pricing-logic";

// เพิ่ม imports เหล่านี้เข้าไป
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Helper function: Brand formatting
const formatBrandName = (brand: string) => {
  if (!brand) return "";
  return brand
    .split(/[_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// Helper function: Parse terms
const parseTerms = (text: string | null) => {
  if (!text || text === "-" || text.trim() === "") return [];

  let items: string[] = [];

  // 1. ถ้าใน Database มีการกด Enter (New line) มาแล้ว ให้ยึดตามนั้น
  if (text.includes("\n")) {
    items = text.split("\n");
  } 
  // 2. ถ้าเป็น Text ยาวๆ ที่มีเลขข้อ (เช่น "1. xxx 2. xxx") ให้ตัดด้วย Regex
  else {
    // ตัด string โดยมองหา Pattern "ตัวเลข+จุด+เว้นวรรค"
    items = text.split(/(?=\d+\.\s)/);
  }

  // Clean ข้อมูล
  return items
    .map((t) => t.trim())       // ตัดช่องว่างหน้าหลัง
    .filter((t) => t !== "")    // กรองบรรทัดว่างทิ้ง
    .map((t) => t.replace(/^\d+\.\s*/, "")); // ✅ เพิ่มบรรทัดนี้: ลบ "1. ", "2. " ออกจากข้อความเสมอ
};

const CreateQuotation = () => {
  const navigate = useNavigate();
  const { id: quotationId } = useParams<{ id: string }>();
  const [showQuotation, setShowQuotation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(null);
  // ✅ เพิ่ม State นี้กลับเข้ามาเพื่อแก้ Error
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null);

  const [availablePrograms, setAvailablePrograms] = useState<{ id: string; name: string }[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availablePanelSizes, setAvailablePanelSizes] = useState<number[]>([]);
  
  const { generateMainEquipment } = useAutoGenerateLineItems();
  const { generateAdditionalEquipment } = useAutoGenerateAdditionalItems();
  const { calculateAndSavePricing } = useCalculatePricing();

  const [formData, setFormData] = useState({
    customerName: "",
    customerTaxId: "", 
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

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [conflictData, setConflictData] = useState<{ id: string; oldName: string; newName: string } | null>(null);
  // ------------------------------------------------------------------
  // Handlers for In-Place Editing & Updates
  // ------------------------------------------------------------------
  
  const SYNCED_GROUP_KEYWORDS = [
    "Common Temporary Facilities, Construction Facilities",
    "Electrical drawing, Facility system, layout and schematic",
    "Commissioning test", 
    "Tempolary Utility Expense", 
    "Safety Operation"
  ];

  const handleAddItem = async (section: "A" | "B", selectedProduct: any) => {
  if (!currentQuotationId) return;
    // 🔍 DEBUG: Check inputs
    const projectSizeVal = parseFloat(formData.projectSize) || 0; 
    console.log("---------------- DEBUG ADD ITEM ----------------");
    console.log("1. Project Size:", projectSizeVal);
    console.log("2. Selected Product Data:", selectedProduct);
    console.log("   - is_fixed_cost:", selectedProduct.is_fixed_cost);
    console.log("   - cost_fixed:", selectedProduct.cost_fixed);
    console.log("   - cost_percentage:", selectedProduct.cost_percentage);
    console.log("------------------------------------------------");
  try {
    const projectSizeVal = parseFloat(formData.projectSize) || 0; 

    // 1. Calculate Default Values
    const defaults = calculateDefaultLineItem(
      selectedProduct, 
      projectSizeVal, 
      1 
    );

    // 2. Insert into Supabase (No need to select data back)
    const { error } = await supabase
      .from("product_line_items")
      .insert({
        quotation_id: currentQuotationId,
        product_id: selectedProduct.id,
        quantity: defaults.quantity,
        product_price: defaults.product_price,
        installation_price: defaults.installation_price,
        is_additional_item: true, 
      });

    if (error) throw error;

    // 3. Refresh the Preview
    await loadPreviewData(currentQuotationId);

    toast({
      title: "เพิ่มรายการสำเร็จ",
      description: `เพิ่ม ${selectedProduct.name} เรียบร้อยแล้ว`,
    });

  } catch (error) {
    console.error("Error adding item:", error);
    toast({
      title: "เกิดข้อผิดพลาด",
      description: "ไม่สามารถเพิ่มรายการได้",
      variant: "destructive",
    });
  }
};

  const handleUpdateItem = async (itemId: string, field: string, value: any) => {
    
    try {
      let updateData: any = {};
      
      if (["edited_name", "edited_brand", "edited_unit"].includes(field)) {
         updateData[field] = value;
      } else if (["quantity", "product_price", "installation_price"].includes(field)) {
         updateData[field] = value;
         updateData[`is_edited_${field}`] = true; 
      }

      // Logic for Section B Synced Group
      if (field === "product_price") {
        const { data: currentItem } = await supabase.from("product_line_items").select("*, products(name)").eq("id", itemId).single();
        const itemName = currentItem?.products?.name || "";
        const isSyncedItem = SYNCED_GROUP_KEYWORDS.some(keyword => itemName.toLowerCase().includes(keyword.toLowerCase()));

        if (isSyncedItem) {
            console.log("🔄 Updating Synced Group for Section B...");
            const { data: allItems } = await supabase.from("product_line_items").select("*, products(name)").eq("quotation_id", currentQuotationId);
            if (allItems) {
                const itemsToUpdate = allItems.filter(i => SYNCED_GROUP_KEYWORDS.some(k => i.products?.name?.toLowerCase().includes(k.toLowerCase())));
                const updates = itemsToUpdate.map(i => ({ id: i.id, product_price: value, is_edited_product_price: true }));
                await Promise.all(updates.map(u => supabase.from("product_line_items").update(u).eq("id", u.id)));
            }
        } else {
            await supabase.from("product_line_items").update(updateData).eq("id", itemId);
        }
      } else {
        await supabase.from("product_line_items").update(updateData).eq("id", itemId);
      }

      if (["quantity", "product_price", "installation_price"].includes(field)) {
         await calculateAndSavePricing(currentQuotationId!); 
         await loadPreviewData(currentQuotationId!);
      } else {
         await loadPreviewData(currentQuotationId!);
      }
    } catch (err) {
      console.error("Update Error:", err);
      toast({ title: "Update Failed", variant: "destructive" });
    }
  };

  const handleUpdateTotalOverride = async (type: 'net' | 'grand', value: number) => {
     if (!currentQuotationId) return;
     try {
        let newNetTotal = 0;
        const currentDiscount = previewData?.discount || 0; 
        if (type === 'net') {
            newNetTotal = value;
        } else {
            const totalAfterVatRemoved = value / 1.07;
            newNetTotal = totalAfterVatRemoved + currentDiscount;
            newNetTotal = Math.round((newNetTotal + Number.EPSILON) * 100) / 100;
        }
        await calculateAndSavePricing(currentQuotationId, newNetTotal);
        await loadPreviewData(currentQuotationId);
        toast({ title: "Pricing Updated", description: "Re-calculated based on new total." });
     } catch (error) {
        console.error("Total Override Error:", error);
        toast({ title: "Error", description: "Failed to update total.", variant: "destructive" });
     }
  };

  const handleUpdateTerms = async (field: string, value: string) => {
    try {
       const { error } = await supabase.from("quotations").update({ [field]: value }).eq("id", currentQuotationId);
       if (error) throw error;
       await loadPreviewData(currentQuotationId!);
    } catch (err) {
       console.error("Update Terms Error:", err);
       toast({ title: "Update Failed", variant: "destructive" });
    }
  };

  // ------------------------------------------------------------------
  // ✅ เพิ่มฟังก์ชันนี้: handleUpdateDiscount
  // ------------------------------------------------------------------
  const handleUpdateDiscount = async (value: number) => {
    if (!currentQuotationId) return;
    try {
      const { error } = await supabase
        .from("quotations")
        .update({ edited_discount: value })
        .eq("id", currentQuotationId);

      if (error) throw error;
      await loadPreviewData(currentQuotationId);
    } catch (err) {
      console.error("Update Discount Error:", err);
      toast({ title: "Error", description: "Failed to update discount", variant: "destructive" });
    }
  };

  // ------------------------------------------------------------------
  // ✅ แก้ไขฟังก์ชัน: loadPreviewData
  // ------------------------------------------------------------------
  const loadPreviewData = async (quotationId: string) => {
    try {
      const { data: quoteData } = await supabase.from("quotations").select("*").eq("id", quotationId).single();
      const { data: lineItems } = await supabase.from("product_line_items").select(`*, products(*)`).eq("quotation_id", quotationId);
      if (!quoteData || !lineItems) return;

      // 1. ดึงค่า Default จาก Sale Package
      let defaultPayment = "-"; 
      let defaultWarranty = "-"; 
      let defaultNote = "-";
      
      if (quoteData.sale_package_id) {
          const { data: pkgData } = await supabase.from("sale_packages").select("payment_terms, warranty_terms, note").eq("id", quoteData.sale_package_id).maybeSingle();
          if (pkgData) { 
            defaultPayment = pkgData.payment_terms || "-"; 
            defaultWarranty = pkgData.warranty_terms || "-"; 
            defaultNote = pkgData.note || "-"; 
          }
      }

      // 2. ✅ ประกาศตัวแปร final... ตรงนี้เลย (เพื่อให้ใช้ข้างล่างได้)
      // Logic: ถ้าใน quotation มีค่า (ไม่เป็น null) ให้ใช้ค่าที่แก้แล้ว ถ้าไม่มีให้ใช้ default
      const finalPayment = quoteData.edited_payment_terms !== null ? quoteData.edited_payment_terms : defaultPayment;
      const finalWarranty = quoteData.edited_warranty_terms !== null ? quoteData.edited_warranty_terms : defaultWarranty;
      const finalNote = quoteData.edited_note !== null ? quoteData.edited_note : defaultNote;
      const finalDiscount = quoteData.edited_discount || 0;

      // 3. จัดการ Items A / B (Logic เดิม)
      const mappedItems = lineItems.map((item) => {
          const product = item.products;
          const categoryRaw = product?.product_category || "";
          // เช็ค Section B (ทั้งชื่อเก่าและใหม่)
          const isSectionB = categoryRaw === "operation" || categoryRaw === "Operation & Maintenance"; 
          return {
             id: item.id,
             name: item.edited_name || product?.name || "Unknown",
             brand: item.edited_brand || product?.brand || "-",
             edited_name: item.edited_name,
             edited_brand: item.edited_brand,
             edited_unit: item.edited_unit,
             category: isSectionB ? "B" : "A",
             _rawCategory: categoryRaw,
             qty: item.quantity || 0,
             unit: item.edited_unit || product?.unit || "Unit",
             matUnit: item.product_price, 
             labUnit: item.installation_price,
             total: (item.product_price || 0) + (item.installation_price || 0)
          };
      });

      // 4. เรียงลำดับ (Logic เดิม)
      const sectionAOrder = ["solar_panel", "Solar Panel", "pv_mounting_structure", "PV Mounting Structure", "inverter", "Inverter", "optimizer", "Optimizer", "zero_export_smart_logger", "Zero Export & Smart Logger", "ac_box", "AC Box", "dc_box", "DC Box", "cable", "Cable & Connector", "service", "Service", "support_inverter", "Support Inverter", "electrical_management", "Electrical Management", "others", "Others"];
      
      const sectionBOrder = ["Electrical drawing, Facility system, layout and schematic", "Common Temporary Facilities, Construction Facilities", "Safety Operation", "Comissioning Test", "Commissioning Test", "Tempolary Utility Expense", "ดำเนินการยื่นเอกสารขออนุญาตการไฟฟ้า/กกพ."];

      const itemsA = mappedItems.filter(i => i.category === "A").sort((a, b) => {
          const idxA = sectionAOrder.indexOf(a._rawCategory); const idxB = sectionAOrder.indexOf(b._rawCategory);
          return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });

      const itemsB = mappedItems.filter(i => i.category === "B").sort((a, b) => {
          const getOrderIndex = (name: string) => {
             const index = sectionBOrder.findIndex(key => name.toLowerCase().includes(key.toLowerCase()));
             return index === -1 ? 999 : index;
          };
          return getOrderIndex(a.name) - getOrderIndex(b.name);
      });

      // 5. ✅ Set Data (ตอนนี้รู้จักตัวแปร final... แล้ว)
      setPreviewData({
         customerName: formData.customerName,
         projectName: `โซลาร์เซลล์ ${((quoteData.kw_size||0)/1000)} kW`,
         docNumber: quoteData.document_num || "DRAFT",
         date: new Date().toLocaleDateString("th-TH"),
         quotationId: quoteData.id,
         items: [...itemsA, ...itemsB],
         
         paymentTerms: parseTerms(finalPayment), // ใช้ตัวแปรที่ประกาศไว้ข้างบน
         warrantyTerms: parseTerms(finalWarranty),
         remarks: finalNote || "",
         
         rawPaymentTerms: finalPayment || "",
         rawWarrantyTerms: finalWarranty || "",
         
         vatRate: 0.07,
         discount: finalDiscount
      });
    } catch (e) { console.error("Preview Error", e); }
  };
  // ------------------------------------------------------------------
  // Export Excel
  // ------------------------------------------------------------------
  const handleExportExcel = async () => {
    if (!currentQuotationId) { toast({ title: "Not Found", description: "Please save first.", variant: "destructive" }); return; }
    setIsLoading(true);
    try {
      const { data: quoteData } = await supabase.from("quotations").select(`*, sale_packages(*)`).eq("id", currentQuotationId).single();
      if (!quoteData) throw new Error("Quotation not found");

      let rawPayment = "-"; let rawWarranty = "-"; let rawNote = "-";
      if (quoteData.sale_package_id) {
        const { data: pkgData } = await supabase.from("sale_packages").select("*").eq("id", quoteData.sale_package_id).maybeSingle();
        if (pkgData) { rawPayment = pkgData.payment_terms || "-"; rawWarranty = pkgData.warranty_terms || "-"; rawNote = pkgData.note || "-"; }
      }
      if (quoteData.edited_payment_terms) rawPayment = quoteData.edited_payment_terms;
      if (quoteData.edited_warranty_terms) rawWarranty = quoteData.edited_warranty_terms;
      if (quoteData.edited_note) rawNote = quoteData.edited_note;

      const { data: lineItems } = await supabase.from("product_line_items").select(`*, products(*)`).eq("quotation_id", currentQuotationId);
      const { data: companyData } = await supabase.from("company_info").select("*").maybeSingle();
      const projectKw = (quoteData.kw_size || 0) / 1000;
      const peakKw = (quoteData.kw_peak || 0) / 1000;
      
      const mappedItems = lineItems?.map((item, index) => {
          const product = item.products;
          const categoryRaw = (product?.product_category || "") as string;
          // เช็คทั้ง key เก่า ('operation') และชื่อใหม่ ('Operation & Maintenance')
          const isSectionB = categoryRaw === "operation" || categoryRaw === "Operation & Maintenance";
          const finalName = item.edited_name || product?.name || "Unknown";
          const finalBrand = item.edited_brand || product?.brand || "-";
          const qty = item.quantity || 0;
          const matPrice = item.product_price || 0;
          const labPrice = item.installation_price || 0;

          return {
            no: index + 1,
            name: finalName,
            brand: finalBrand,
            qty: qty,
            unit: item.edited_unit || product?.unit || "Unit",
            matUnit: isSectionB ? 0 : qty > 0 ? matPrice / qty : 0,
            matTotal: isSectionB ? 0 : matPrice,
            labUnit: isSectionB ? 0 : qty > 0 ? labPrice / qty : 0,
            labTotal: isSectionB ? 0 : labPrice,
            total: matPrice + labPrice,
            category: isSectionB ? "B" : "A",
            _rawCategory: categoryRaw,
          };
        }) || [];

      const sectionAOrder = ["solar_panel", "pv_mounting_structure", "inverter", "optimizer", "zero_export_smart_logger", "ac_box", "dc_box", "cable", "service", "support_inverter", "electrical_management", "other"];
      const itemsA = mappedItems.filter((i) => i.category === "A").sort((a, b) => {
        const indexA = sectionAOrder.indexOf(a._rawCategory); const indexB = sectionAOrder.indexOf(b._rawCategory);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });
      const sectionBOrder = [
        "Electrical drawing, Facility system, layout and schematic",
        "Common Temporary Facilities, Construction Facilities",
        "Safety Operation",
        "Comissioning Test",
        "Commissioning Test",
        "Tempolary Utility Expense",
        "ดำเนินการยื่นเอกสารขออนุญาตการไฟฟ้า/กกพ."
      ];
      const itemsB = mappedItems  
        .filter((i) => i.category === "B")
        .sort((a, b) => {
          const getOrderIndex = (name: string) => {
      const index = sectionBOrder.findIndex(key => 
        name.toLowerCase().includes(key.toLowerCase())
      );
      return index === -1 ? 999 : index;
    };
    return getOrderIndex(a.name) - getOrderIndex(b.name);
  });
      const exportData = {
        companyName: companyData?.name || "Company Name",
        companyAddress: companyData?.address || "-",
        companyPhone: companyData?.phone_number || "-",
        companyTaxId: companyData?.id_tax || "-",
        customerName: formData.customerName || "-",
        customerAddress: formData.installLocation || "-",
        customerID: "-",
        projectName: `โซลาร์เซลล์ ${projectKw} kW`,
        maxPower: `กำลังไฟสูงสุด ( ${peakKw.toFixed(2)} kWp )`,
        inverterBrand: (quoteData.inverter_brand || "-").toUpperCase(),
        date: new Date().toLocaleDateString("th-TH"),
        docNumber: quoteData.document_num || formData.documentNumber || "DRAFT",
        items: [...itemsA, ...itemsB] as any,
        paymentTerms: parseTerms(rawPayment),
        warrantyTerms: parseTerms(rawWarranty),
        remarks: rawNote,
        discount: 0,
        vatRate: 0.07,
      };
      await generateQuotationExcel(exportData);
      toast({ title: "Success", description: "Excel downloaded." });
    } catch (error) {
      console.error("Export Excel Error:", error);
      toast({ title: "Error", variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  // ------------------------------------------------------------------
  // ✅ 1. Auto-fill: พิมพ์ชื่อเสร็จ -> ดึง Tax ID
  // ------------------------------------------------------------------
  const handleNameBlur = async () => {
    const name = formData.customerName.trim();
    if (!name) return;

    // ถ้า Tax ID มีอยู่แล้ว ไม่ต้องดึง (เดี๋ยวจะไปตีกันตอน Save แทน)
    if (formData.customerTaxId) return; 

    try {
      const { data } = await supabase
        .from("customers")
        .select("id, id_tax")
        .eq("customer_name", name)
        .maybeSingle();

      if (data && data.id_tax) {
        setFormData((prev) => ({ ...prev, customerTaxId: data.id_tax || "" }));
        setCurrentCustomerId(data.id);
        toast({ title: "Found Customer", description: "Auto-filled Tax ID from database." });
      }
    } catch (error) {
      console.error("Auto-fill error:", error);
    }
  };

  // ------------------------------------------------------------------
  // ✅ 2. Auto-fill: พิมพ์ Tax ID เสร็จ -> ดึงชื่อ
  // ------------------------------------------------------------------
  const handleTaxBlur = async () => {
    const taxId = formData.customerTaxId.trim();
    if (!taxId) return;

    // ถ้าชื่อมีอยู่แล้ว ไม่ต้องดึง (ให้ Priority ชื่อที่พิมพ์มา)
    if (formData.customerName) return;

    try {
      const { data } = await supabase
        .from("customers")
        .select("id, customer_name")
        .eq("id_tax", taxId)
        .maybeSingle();

      if (data && data.customer_name) {
        setFormData((prev) => ({ ...prev, customerName: data.customer_name }));
        setCurrentCustomerId(data.id);
        toast({ title: "Found Customer", description: "Auto-filled Name from database." });
      }
    } catch (error) {
      console.error("Auto-fill error:", error);
    }
  };

  // ------------------------------------------------------------------
  // ✅ 3. Action เมื่อกด "ตกลง" ใน Popup เปลี่ยนชื่อ
  // ------------------------------------------------------------------
  const handleConfirmRename = async () => {
    if (!conflictData) return;
    
    try {
      setIsLoading(true);
      // อัปเดตชื่อลูกค้าใน DB
      const { error } = await supabase
        .from("customers")
        .update({ customer_name: conflictData.newName })
        .eq("id", conflictData.id);

      if (error) throw error;

      toast({ title: "Updated", description: "Customer name updated successfully." });
      
      // ปิด Dialog
      setShowRenameDialog(false);
      setConflictData(null);
      setCurrentCustomerId(conflictData.id);

      // เรียก Save อีกครั้ง (คราวนี้จะผ่านฉลุยเพราะชื่อตรงแล้ว)
      // *หมายเหตุ: ต้องแก้ handleCreateQuotation ให้รับ parameter skipCheck ได้ หรือเรียกซ้ำได้เลย*
      handleCreateQuotation(true); 

    } catch (error) {
      console.error("Rename error:", error);
      toast({ title: "Error", description: "Failed to rename customer.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // useEffects
  // ------------------------------------------------------------------
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
        const { data, error } = await supabase
          .from("products")
          .select("min_kw, product_category")
          // ✅ เปลี่ยนเป็น .in() เพื่อหาทั้งชื่อเก่าและชื่อใหม่
          .in("product_category", ["solar_panel", "Solar Panel"]) 
          .not("min_kw", "is", null);

        if (error) throw error;
        if (data) {
          const sizes = Array.from(new Set(data.map((p) => p.min_kw)))
            .filter((size): size is number => size !== null)
            .sort((a, b) => a - b);
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
        const { data, error } = await supabase.from("quotations").select(`*, customers:customer_id(customer_name, id_tax), sale_packages:sale_package_id(id, sale_name)`).eq("id", quotationId).maybeSingle();
        if (error) throw error;
        if (data) {
          setCurrentQuotationId(data.id);
          // ✅ เก็บ ID และ Tax ID เมื่อโหลดข้อมูล
          setCurrentCustomerId(data.customer_id); 
          setFormData({
            customerName: data.customers?.customer_name || "",
            customerTaxId: data.customers?.id_tax || "",
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

  // ------------------------------------------------------------------
  // ✅ CREATE / SAVE QUOTATION (With Tax ID Priority Logic)
  // ------------------------------------------------------------------
  const handleCreateQuotation = async (skipCheck = false) => {
    // 1. Validation
    if (!formData.projectSize || !formData.salesProgram || !formData.brand || !formData.solarPanelSize) {
      toast({ title: "Required", description: "Please fill all required fields (*)", variant: "destructive" });
      return;
    }

    // ---------------------------------------------------------
    // 🟢 ตรวจสอบความขัดแย้งก่อน Save
    // ---------------------------------------------------------
    // ถ้าไม่ใช่การข้าม (คือการกด Save ปกติ ไม่ใช่กดจาก Popup)
    if (!skipCheck) {
        const inputName = formData.customerName.trim();
        const inputTaxId = formData.customerTaxId ? formData.customerTaxId.trim() : "";

        if (inputTaxId) {
            // 🔍 A. ค้นหาจาก Tax ID ก่อน
            const { data: taxMatch } = await supabase
                .from("customers")
                .select("*")
                .eq("id_tax", inputTaxId)
                .maybeSingle();

            if (taxMatch) {
                // เจอ Tax ID นี้ในระบบ
                // เปรียบเทียบชื่อ (ตัดช่องว่างซ้ายขวาออกทั้งคู่)
                if (taxMatch.customer_name.trim() !== inputName) {
                    // ⚠️ ชื่อไม่ตรง! (Rebranding Case) -> เปิด Popup ถาม
                    setConflictData({
                        id: taxMatch.id,
                        oldName: taxMatch.customer_name,
                        newName: inputName
                    });
                    setShowRenameDialog(true);
                    return; // ⛔️ หยุดการทำงาน รอ User ตัดสินใจ
                } 
                // ถ้าชื่อตรงกันเป๊ะ -> ผ่าน (ไป Save ต่อข้างล่าง)
            } else {
                // ไม่เจอ Tax ID นี้ -> แต่ถ้าชื่อไปซ้ำกับคนอื่นที่มี Tax ID ต่างกัน?
                 const { data: nameMatch } = await supabase
                    .from("customers")
                    .select("*")
                    .eq("customer_name", inputName)
                    .maybeSingle();
                 
                 if (nameMatch && nameMatch.id_tax && nameMatch.id_tax !== inputTaxId) {
                     // ❌ ชื่อซ้ำ แต่ Tax ID ไม่ตรง -> ห้ามบันทึก
                     toast({ 
                        title: "ชื่อลูกค้าซ้ำ!", 
                        description: `ชื่อ "${inputName}" มีอยู่ในระบบแล้ว (Tax ID: ${nameMatch.id_tax}) กรุณาเปลี่ยนชื่อ`,
                        variant: "destructive" 
                    });
                    return;
                 }
            }
        }
    }

    // ---------------------------------------------------------
    // 💾 เริ่มกระบวนการบันทึกจริง
    // ---------------------------------------------------------
    setIsLoading(true);

    try {
      let finalCustomerId = currentCustomerId;
      const inputName = formData.customerName.trim();
      const inputTaxId = formData.customerTaxId ? formData.customerTaxId.trim() : "";
      
      let finalName = inputName;
      let finalTaxId = inputTaxId;

      if (inputName) {
        if (!finalCustomerId) {
            // ถ้ายังไม่มี ID (และผ่านด่าน skipCheck มาแล้ว)
            // ลองหาจาก Tax ID อีกรอบเพื่อความชัวร์ หรือหาจากชื่อ
            let match = null;
            if (inputTaxId) {
                const { data } = await supabase.from("customers").select("*").eq("id_tax", inputTaxId).maybeSingle();
                match = data;
            } else {
                const { data } = await supabase.from("customers").select("*").eq("customer_name", inputName).maybeSingle();
                match = data;
            }

            if (match) {
                finalCustomerId = match.id;
            }
        }

        // SAVE / UPDATE CUSTOMER
        if (finalCustomerId) {
            // Update
            await supabase.from("customers").update({ 
                customer_name: finalName,
                id_tax: finalTaxId || null
            }).eq("id", finalCustomerId);
        } else {
            // New Insert
            const { data: newCustomer, error: createError } = await supabase
              .from("customers")
              .insert({ 
                  customer_name: finalName || "-", 
                  id_tax: finalTaxId || null
              })
              .select("id")
              .single();
            
            if (createError) throw createError;
            finalCustomerId = newCustomer.id;
        }

        // Update UI State
        setFormData(prev => ({ ...prev, customerName: finalName, customerTaxId: finalTaxId }));
        setCurrentCustomerId(finalCustomerId);
      }

      // Sale Package & KW Logic
      let salePackageId = null;
      if (formData.salesProgram) {
        const selectedProgram = availablePrograms.find((p) => p.name === formData.salesProgram);
        if (selectedProgram) salePackageId = selectedProgram.id;
        else {
          const { data: newPkg } = await supabase.from("sale_packages").insert({ sale_name: formData.salesProgram as any }).select("id").single();
          salePackageId = newPkg?.id;
        }
      }
      const projectSizeVal = formData.projectSize ? parseFloat(formData.projectSize) : 0;
      const panelSizeVal = formData.solarPanelSize ? parseFloat(formData.solarPanelSize) : 0;
      const { kwPeak } = calculateSystemSpecs(projectSizeVal, panelSizeVal);

      const quotationData = {
        customer_id: finalCustomerId,
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
        toast({ title: "Updated", description: "Quotation updated successfully." });
      } else {
        const { data: quotation, error: insertError } = await supabase.from("quotations").insert({ ...quotationData, edited_price: 0 }).select().single();
        if (insertError) throw insertError;
        targetId = quotation.id;
        setCurrentQuotationId(quotation.id);
        toast({ title: "Created", description: "Quotation created successfully." });
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
      toast({ title: "Error", description: "Failed to save quotation.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };
  const handleEditQuotation = async () => {
    if (!isEditMode) {
      setIsEditMode(true);
      toast({ title: "Edit Mode", description: "You can now edit the preview directly." });
    } else {
      if (currentQuotationId) {
        try {
          const { error } = await supabase.from("quotations").update({ updated_at: new Date().toISOString() }).eq("id", currentQuotationId);
          if (error) throw error;
          toast({ title: "Saved", description: "All changes saved." });
        } catch (error) { console.error("Error updating:", error); }
      }
      setIsEditMode(false);
    }
  };

  if (isLoadingData) return <div className="min-h-screen bg-muted/30 p-6 flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-muted/30 p-4">
      <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className={`grid gap-4 items-start ${showQuotation ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1 max-w-3xl mx-auto"}`}>
        
        {/* INPUT FORM (Compact Version 1/3) */}
        <div className="w-full lg:col-span-1">
          <div className="bg-card rounded-lg shadow-sm p-5 border border-border">
            <h2 className="text-lg font-semibold mb-3 text-primary">Quotation Data</h2>
            
            {/* ✅ GRID LAYOUT 2 Columns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Customer</Label>
                <Input className="h-9 mt-1" placeholder="Name" value={formData.customerName} onChange={(e) => handleInputChange("customerName", e.target.value)} onBlur={handleNameBlur} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Tax ID</Label>
                <Input className="h-9 mt-1" placeholder="Tax ID" value={formData.customerTaxId} onChange={(e) => handleInputChange("customerTaxId", e.target.value)} onBlur={handleNameBlur} />
              </div>

              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Location</Label>
                <Input className="h-9 mt-1" placeholder="Location" value={formData.installLocation} onChange={(e) => handleInputChange("installLocation", e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Doc No.</Label>
                <Input className="h-9 mt-1" placeholder="Doc No" value={formData.documentNumber} onChange={(e) => handleInputChange("documentNumber", e.target.value)} />
              </div>

              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Project (Watt)*</Label>
                <Input type="number" className="h-9 mt-1" placeholder="5000" value={formData.projectSize} onChange={(e) => handleInputChange("projectSize", e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Phase*</Label>
                <Select value={formData.electricalPhase} onValueChange={(value) => handleInputChange("electricalPhase", value)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single_phase">1 Phase</SelectItem>
                    <SelectItem value="three_phase">3 Phase</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Program*</Label>
                <Select value={formData.salesProgram} onValueChange={(value) => handleInputChange("salesProgram", value)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Program" /></SelectTrigger>
                  <SelectContent>{availablePrograms.map((program) => (<SelectItem key={program.id} value={program.name}>{program.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Brand*</Label>
                <Select value={formData.brand} onValueChange={(value) => handleInputChange("brand", value)} disabled={!formData.salesProgram}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Brand" /></SelectTrigger>
                  <SelectContent>{availableBrands.map((brand) => (<SelectItem key={brand} value={brand}>{formatBrandName(brand)}</SelectItem>))}</SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Panel (Watt)*</Label>
                <Select value={formData.solarPanelSize} onValueChange={(value) => handleInputChange("solarPanelSize", value)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Panel Size" /></SelectTrigger>
                  <SelectContent>{availablePanelSizes.map((size) => (<SelectItem key={size} value={size.toString()}>{size.toLocaleString()} Watt</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <Input className="h-9 mt-1" placeholder="Provider" value={formData.serviceProvider} onChange={(e) => handleInputChange("serviceProvider", e.target.value)} />
              </div>

              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Remarks</Label>
                <Textarea className="mt-1 min-h-[60px]" placeholder="Additional info..." value={formData.additionalInfo} onChange={(e) => handleInputChange("additionalInfo", e.target.value)} />
              </div>
            </div>

            <div className="mt-4 pt-2 border-t">
              <Button onClick={() => handleCreateQuotation(false)} size="sm" disabled={isLoading} className="w-full h-10">
                {isLoading ? "Saving..." : (currentQuotationId ? "Save Changes" : "Create Quotation")}
              </Button>
            </div>
          </div>
        </div>

        {/* PREVIEW SECTION (2/3) */}
        {showQuotation && (
          <div className="w-full lg:col-span-2 lg:sticky lg:top-4">
            <div className="bg-card rounded-lg shadow-sm p-4 relative border border-border animate-in fade-in">
              <div className="absolute top-3 right-3 flex gap-2 z-10">
                <Button variant="outline" size="sm" onClick={handleEditQuotation}>{isEditMode ? "Done" : "Edit"}</Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>EXCEL</Button>
              </div>
              <div className="flex flex-col items-center justify-center min-h-[400px] overflow-auto mt-12">
                {previewData ? (
                  <div className="origin-top scale-95 transition-transform w-full flex justify-center">
                    <QuotationPreview 
                        data={previewData} 
                        isEditMode={isEditMode}
                        onUpdateItem={handleUpdateItem}
                        onUpdateTerms={handleUpdateTerms}
                        onUpdateTotalOverride={handleUpdateTotalOverride}
                        onAddItem={handleAddItem}
                        onUpdateDiscount={handleUpdateDiscount}
                    />
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground mt-10"><p>Loading Preview...</p></div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <AlertDialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการเปลี่ยนชื่อลูกค้า</AlertDialogTitle>
            <AlertDialogDescription>
              หมายเลขผู้เสียภาษี <b>{formData.customerTaxId}</b><br/>
              เดิมชื่อ: <b className="text-destructive">{conflictData?.oldName}</b><br/><br/>
              ต้องการเปลี่ยนชื่อเป็น: <b className="text-green-600">{conflictData?.newName}</b> หรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictData(null)}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRename}>ตกลง</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreateQuotation;