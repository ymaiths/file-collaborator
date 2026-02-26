import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
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
import { CustomerAutocomplete } from "@/components/CustomerAutocomplete";

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

  if (text.includes("\n")) {
    items = text.split("\n");
  } else {
    items = text.split(/(?=\d+\.\s)/);
  }

  return items
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .map((t) => t.replace(/^\d+\.\s*/, ""));
};

interface ProgramWithRange {
  id: string;
  name: string;
  prices: {
    kw_min: number | null;
    kw_max: number | null;
    inverter_brand: string;      
    electronic_phase: string;
  }[];
}

const CreateQuotation = () => {
  const navigate = useNavigate();
  const { id: quotationId } = useParams<{ id: string }>();
  const userRole = localStorage.getItem("userRole");
  const canEdit = userRole === "admin" || userRole === "general";
  const [showQuotation, setShowQuotation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [currentQuotationId, setCurrentQuotationId] = useState<string | null>(null);
  const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null);

  const [allPrograms, setAllPrograms] = useState<ProgramWithRange[]>([]);
  const [filteredPrograms, setFilteredPrograms] = useState<ProgramWithRange[]>([]);
  const [availableBrands, setAvailableBrands] = useState<string[]>([]);
  const [availablePanelSizes, setAvailablePanelSizes] = useState<number[]>([]);
  const [availablePhases, setAvailablePhases] = useState<string[]>([]);

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
  
  const SYNCED_GROUP_KEYWORDS = [
    "Common Temporary Facilities, Construction Facilities",
    "Electrical drawing, Facility system, layout and schematic",
    "Commissioning test", 
    "Tempolary Utility Expense", 
    "Safety Operation"
  ];

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  const handleAddItem = async (section: "A" | "B", selectedProduct: any) => {
    if (!canEdit) return;
    if (!currentQuotationId) return;
    try {
      const projectSizeVal = parseFloat(formData.projectSize) || 0; 
      const defaults = calculateDefaultLineItem(selectedProduct, projectSizeVal, 1);

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
      await loadPreviewData(currentQuotationId);
      toast({ title: "เพิ่มรายการสำเร็จ", description: `เพิ่ม ${selectedProduct.name} เรียบร้อยแล้ว` });
    } catch (error) {
      console.error("Error adding item:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถเพิ่มรายการได้", variant: "destructive" });
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!canEdit) return;
    if (!currentQuotationId) return;
    try {
      const { error } = await supabase.from("product_line_items").delete().eq("id", itemId);
      if (error) throw error;
      await calculateAndSavePricing(currentQuotationId);
      await loadPreviewData(currentQuotationId);
      toast({ title: "Deleted", description: "ลบรายการเรียบร้อยแล้ว" });
    } catch (error) {
      console.error("Delete Error:", error);
      toast({ title: "Error", description: "ไม่สามารถลบรายการได้", variant: "destructive" });
    }
  };

  const handleUpdateItem = async (itemId: string, field: string, value: any) => {
    if (!canEdit) return;
    try {
      // 1. ดึงข้อมูล Item ปัจจุบันพร้อมข้อมูลสินค้า (Products) เพื่อใช้คำนวณ
      const { data: currentItem } = await supabase
        .from("product_line_items")
        .select("*, products(*)")
        .eq("id", itemId)
        .single();

      if (!currentItem) return;

      let updateData: any = {};

      // =========================================================
      // 🧠 CASE 1: แก้ไขจำนวน (Quantity) -> ต้องคำนวณราคารวมใหม่
      // =========================================================
      if (field === "quantity") {
        const newQty = parseFloat(value);
        const oldQty = currentItem.quantity || 1;
        const projectSizeVal = parseFloat(formData.projectSize) || 0;

        // ฟังก์ชันช่วยคำนวณราคาใหม่ (แยกเคส Edited vs Default)
        const getNewPrice = (currentTotal: number, isEdited: boolean, type: 'product' | 'installation') => {
            if (isEdited) {
                // 🅰️ เคยแก้ราคามา: ให้รักษาราคาต่อหน่วยเดิม (Scale Linear)
                const unitPrice = (currentTotal || 0) / oldQty;
                return unitPrice * newQty;
            } else {
                // 🅱️ ไม่เคยแก้: คำนวณใหม่ตามสูตรมาตรฐาน (Recalculate Default)
                const defaults = calculateDefaultLineItem(currentItem.products, projectSizeVal, newQty);
                return type === 'product' ? defaults.product_price : defaults.installation_price;
            }
        };

        updateData = {
          quantity: newQty,
          product_price: getNewPrice(currentItem.product_price, currentItem.is_edited_product_price, 'product'),
          installation_price: getNewPrice(currentItem.installation_price, currentItem.is_edited_installation_price, 'installation')
          // ไม่ต้องเปลี่ยน flag edited เพราะเราให้ระบบจัดการ auto
        };
      } 
      // =========================================================
      // 🧠 CASE 2: แก้ไขฟิลด์อื่นๆ (ราคา, ชื่อ, แบรนด์)
      // =========================================================
      else {
        if (["edited_name", "edited_brand", "edited_unit"].includes(field)) {
            updateData[field] = value;
        } else if (["product_price", "installation_price"].includes(field)) {
            updateData[field] = value;
            updateData[`is_edited_${field}`] = true; // ✅ Mark ว่า User แก้เอง
        }
      }

      // =========================================================
      // 💾 DATABASE UPDATE (รวม Logic Synced Group)
      // =========================================================
      if (field === "product_price") {
        const itemName = currentItem?.products?.name || "";
        const isSyncedItem = SYNCED_GROUP_KEYWORDS.some(keyword => itemName.toLowerCase().includes(keyword.toLowerCase()));

        if (isSyncedItem) {
            // ถ้าเป็นรายการในกลุ่ม Synced (Section B) ให้แก้เพื่อนๆ ด้วย
            const { data: allItems } = await supabase.from("product_line_items").select("*, products(name)").eq("quotation_id", currentQuotationId);
            if (allItems) {
                const itemsToUpdate = allItems.filter(i => SYNCED_GROUP_KEYWORDS.some(k => i.products?.name?.toLowerCase().includes(k.toLowerCase())));
                const updates = itemsToUpdate.map(i => ({ id: i.id, product_price: value, is_edited_product_price: true }));
                await Promise.all(updates.map(u => supabase.from("product_line_items").update(u).eq("id", u.id)));
            }
        } else {
            // รายการปกติ
            await supabase.from("product_line_items").update(updateData).eq("id", itemId);
        }
      } else {
        // กรณีแก้ Quantity หรือฟิลด์อื่นๆ
        await supabase.from("product_line_items").update(updateData).eq("id", itemId);
      }

      // 3. Recalculate & Refresh UI
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
       if (type === 'net') {
           await calculateAndSavePricing(currentQuotationId, { manualNetTotal: value });
       } else {
           await calculateAndSavePricing(currentQuotationId, { manualGrandTotal: value });
       }
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

  const handleUpdateDiscount = async (value: number) => {
    if (!currentQuotationId) return;
    try {
      await calculateAndSavePricing(currentQuotationId, { manualDiscount: value });
      await loadPreviewData(currentQuotationId);
    } catch (err) {
      console.error("Update Discount Error:", err);
      toast({ title: "Error", description: "Failed to update discount", variant: "destructive" });
    }
  };

  const loadPreviewData = async (quotationId: string) => {
    try {
      const { data: quoteData } = await supabase.from("quotations").select("*").eq("id", quotationId).single();
      const { data: lineItems } = await supabase.from("product_line_items").select(`*, products(*)`).eq("quotation_id", quotationId);
      if (!quoteData || !lineItems) return;

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

      const finalPayment = quoteData.edited_payment_terms !== null ? quoteData.edited_payment_terms : defaultPayment;
      const finalWarranty = quoteData.edited_warranty_terms !== null ? quoteData.edited_warranty_terms : defaultWarranty;
      const finalNote = quoteData.edited_note !== null ? quoteData.edited_note : defaultNote;
      const finalDiscount = quoteData.edited_discount || 0;

      const mappedItems = lineItems.map((item) => {
          const product = item.products;
          const categoryRaw = product?.product_category || "";
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

      setPreviewData({
         customerName: formData.customerName,
         projectName: `โซลาร์เซลล์ ${((quoteData.kw_size||0)/1000)} kW`,
         docNumber: quoteData.document_num || "DRAFT",
         date: new Date().toLocaleDateString("th-TH"),
         quotationId: quoteData.id,
         items: [...itemsA, ...itemsB],
         paymentTerms: parseTerms(finalPayment),
         warrantyTerms: parseTerms(finalWarranty),
         remarks: finalNote || "",
         rawPaymentTerms: finalPayment || "",
         rawWarrantyTerms: finalWarranty || "",
         vatRate: 0.07,
         discount: finalDiscount,
         electricalPhase: formData.electricalPhase,
         inverterBrand: formData.brand
      });
    } catch (e) { console.error("Preview Error", e); }
  };

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
              const index = sectionBOrder.findIndex(key => name.toLowerCase().includes(key.toLowerCase()));
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
  // Auto-fill Handlers
  // ------------------------------------------------------------------
  const handleNameBlur = async () => {
    const name = formData.customerName.trim();
    if (!name) return;
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

  const handleTaxBlur = async () => {
    const taxId = formData.customerTaxId.trim();
    if (!taxId) return;
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

  const handleConfirmRename = async () => {
    if (!conflictData) return;
    
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from("customers")
        .update({ customer_name: conflictData.newName })
        .eq("id", conflictData.id);

      if (error) throw error;

      toast({ title: "Updated", description: "Customer name updated successfully." });
      
      setShowRenameDialog(false);
      setConflictData(null);
      setCurrentCustomerId(conflictData.id);

      handleCreateQuotation(true); 

    } catch (error) {
      console.error("Rename error:", error);
      toast({ title: "Error", description: "Failed to rename customer.", variant: "destructive" });
      setIsLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // ✅ CREATE / SAVE QUOTATION (Mixed Logic)
  // ------------------------------------------------------------------
  const handleCreateQuotation = async (skipCheck = false) => {
    if (!canEdit) {
      toast({ title: "ไม่มีสิทธิ์", description: "คุณอยู่ในสถานะ Viewer ไม่สามารถบันทึกหรือสร้างข้อมูลได้", variant: "destructive" });
      return;
    }
    // 1. Validation
    if (!formData.projectSize || !formData.salesProgram || !formData.brand || !formData.solarPanelSize) {
      toast({ title: "Required", description: "Please fill all required fields (*)", variant: "destructive" });
      return;
    }

    const isValidProgram = filteredPrograms.some(p => p.name === formData.salesProgram);

    if (!isValidProgram) {
      toast({ title: "Required", description: "Please fill all required fields (*)", variant: "destructive" });
      setFormData(prev => ({ ...prev, salesProgram: "", brand: "" }));
      return; 
    }
    // ---------------------------------------------------------
    // 🟢 ตรวจสอบความขัดแย้งก่อน Save (ใช้ Logic แบบใหม่ที่รัดกุมขึ้น)
    // ---------------------------------------------------------
    if (!skipCheck) {
        const inputName = formData.customerName.trim();
        const inputTaxId = formData.customerTaxId ? formData.customerTaxId.trim() : "";

        if (inputTaxId) {
            // A. ค้นหาจาก Tax ID ก่อน (Priority สูงสุด)
            const { data: taxMatch } = await supabase
                .from("customers")
                .select("*")
                .eq("id_tax", inputTaxId)
                .maybeSingle();

            if (taxMatch) {
                // เจอ Tax ID นี้ -> เช็คชื่อว่าตรงกันไหม
                if (taxMatch.customer_name.trim() !== inputName) {
                    // ⚠️ ชื่อไม่ตรง -> แสดง Popup ถาม User
                    setConflictData({ id: taxMatch.id, oldName: taxMatch.customer_name, newName: inputName });
                    setShowRenameDialog(true);
                    return; 
                }
            } else {
                // B. ไม่เจอ Tax ID นี้ -> เช็คว่าชื่อซ้ำกับคนอื่นที่มี Tax ID ต่างกันหรือไม่?
                 const { data: nameMatch } = await supabase
                    .from("customers")
                    .select("*")
                    .eq("customer_name", inputName)
                    .maybeSingle();
                 
                 if (nameMatch && nameMatch.id_tax && nameMatch.id_tax !== inputTaxId) {
                      // ❌ ชื่อซ้ำ แต่ Tax ID ไม่ตรง -> แจ้งเตือนห้ามบันทึก
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

    setIsLoading(true);

    try {
      // 2. Prepare Customer Data
      let finalCustomerId = currentCustomerId;
      const inputName = formData.customerName.trim();
      const inputTaxId = formData.customerTaxId ? formData.customerTaxId.trim() : "";
      
      let finalName = inputName;
      let finalTaxId = inputTaxId;

      if (inputName) {
         if (!finalCustomerId) {
            // Logic หากยังไม่มี ID (เช่น User พิมพ์ใหม่) พยายามหา match ครั้งสุดท้าย
            let match = null;
            if (inputTaxId) {
                const { data } = await supabase.from("customers").select("*").eq("id_tax", inputTaxId).maybeSingle();
                match = data;
            } else {
                const { data } = await supabase.from("customers").select("*").eq("customer_name", inputName).maybeSingle();
                match = data;
            }
            if (match) finalCustomerId = match.id;
         }

         // SAVE / UPDATE CUSTOMER
         if (finalCustomerId) {
             await supabase.from("customers").update({ 
                customer_name: finalName,
                id_tax: finalTaxId || null
             }).eq("id", finalCustomerId);
         } else {
             const { data: newCust, error } = await supabase.from("customers").insert({ 
                 customer_name: finalName || "-", 
                 id_tax: finalTaxId || null
             }).select("id").single();
             if (error) throw error;
             finalCustomerId = newCust.id;
         }
         setCurrentCustomerId(finalCustomerId);
      }

      // 3. Prepare Quotation Data
      let newSalePackageId = null;
      if (formData.salesProgram) {
        const selectedProgram = allPrograms.find((p) => p.name === formData.salesProgram);
        if (selectedProgram) newSalePackageId = selectedProgram.id;
      }
      
      const newProjectSize = formData.projectSize ? parseFloat(formData.projectSize) : 0;
      const newPanelSize = formData.solarPanelSize ? parseFloat(formData.solarPanelSize) : 0;
      const { kwPeak } = calculateSystemSpecs(newProjectSize, newPanelSize);

      const quotationData = {
        customer_id: finalCustomerId,
        location: formData.installLocation || null,
        kw_size: newProjectSize,
        kw_panel: newPanelSize,
        kw_peak: kwPeak,
        electrical_phase: formData.electricalPhase || "single_phase",
        document_num: formData.documentNumber || null,
        creater_name: formData.serviceProvider || null,
        note: formData.additionalInfo || null,
        sale_package_id: newSalePackageId,
        inverter_brand: formData.brand || null,
      };

      let targetId = currentQuotationId;

      // =========================================================
      // 🧠 Logic Decision: "แค่แก้หัว" หรือ "แก้โครงสร้าง" ?
      // =========================================================
      
      if (currentQuotationId) {
        // --- กรณี Save Changes ---
        const { data: oldQuote } = await supabase.from("quotations").select("*").eq("id", currentQuotationId).single();

        if (!oldQuote) throw new Error("Quotation not found");

        // เช็คการเปลี่ยนโครงสร้าง (Structural Change)
        const isStructuralChange = 
            oldQuote.kw_size !== newProjectSize ||          
            oldQuote.kw_panel !== newPanelSize ||           
            oldQuote.inverter_brand !== formData.brand ||    
            oldQuote.electrical_phase !== formData.electricalPhase || 
            oldQuote.sale_package_id !== newSalePackageId;   

        await supabase
            .from("quotations")
            .update({ ...quotationData, updated_at: new Date().toISOString() })
            .eq("id", currentQuotationId);

        if (isStructuralChange) {
            console.log("⚠️ Structural Change Detected: Regenerating All Items...");
            await generateMainEquipment(currentQuotationId);      
            await generateAdditionalEquipment(currentQuotationId); 
            await calculateAndSavePricing(currentQuotationId);    
            toast({ title: "Re-calculated", description: "สเปคเปลี่ยน: สร้างรายการสินค้าและคำนวณราคาใหม่เรียบร้อย" });
        } else {
            console.log("✅ Cosmetic Change Only: Updated Header, Preserved Items.");
            toast({ title: "Updated", description: "บันทึกข้อมูลทั่วไปเรียบร้อย (รายการสินค้าคงเดิม)" });
        }

      } else {
        // --- กรณี Create New (สร้างใหม่ครั้งแรก) ---
        const { data: quotation, error: insertError } = await supabase
            .from("quotations")
            .insert({ ...quotationData, edited_price: 0 })
            .select()
            .single();
        
        if (insertError) throw insertError;
        
        targetId = quotation.id;
        setCurrentQuotationId(quotation.id);

        await generateMainEquipment(targetId);
        await generateAdditionalEquipment(targetId);
        await calculateAndSavePricing(targetId);

        toast({ title: "Created", description: "สร้างใบเสนอราคาใหม่เรียบร้อย" });
      }

      if (targetId) {
        await loadPreviewData(targetId);
      }
      setShowQuotation(true);

    } catch (error) {
      console.error("Error:", error);
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
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

  const handleReset = async () => {
    if (!canEdit) return;
    if (!currentQuotationId) return;

    if (!window.confirm("คุณต้องการรีเซ็ตรายการสินค้าทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่? \n(ราคาที่แก้ไข, ส่วนลด, และรายการที่เพิ่มเอง จะหายไปทั้งหมด)")) {
      return;
    }

    setIsLoading(true);
    try {
      const projectSizeVal = formData.projectSize ? parseFloat(formData.projectSize) : 0;
      const panelSizeVal = formData.solarPanelSize ? parseFloat(formData.solarPanelSize) : 0;
      const { kwPeak } = calculateSystemSpecs(projectSizeVal, panelSizeVal);
      
      let salePackageId = null;
      if (formData.salesProgram) {
        const selectedProgram = allPrograms.find((p) => p.name === formData.salesProgram);
        if (selectedProgram) salePackageId = selectedProgram.id;
      }

      await supabase.from("quotations").update({
        kw_size: projectSizeVal,
        kw_panel: panelSizeVal,
        kw_peak: kwPeak,
        inverter_brand: formData.brand,
        electrical_phase: formData.electricalPhase,
        sale_package_id: salePackageId,
        edited_price: null,       
        edited_discount: null,    
        edited_payment_terms: null,
        edited_warranty_terms: null,
        edited_note: null,
        updated_at: new Date().toISOString()
      }).eq("id", currentQuotationId);

      await generateMainEquipment(currentQuotationId);
      await generateAdditionalEquipment(currentQuotationId);
      await calculateAndSavePricing(currentQuotationId);
      await loadPreviewData(currentQuotationId);

      toast({
        title: "Reset Successful",
        description: "คืนค่ารายการสินค้า เงื่อนไข และราคาเป็นค่ามาตรฐานเรียบร้อย",
      });

    } catch (error) {
      console.error("Reset Error:", error);
      toast({ title: "Error", description: "Failed to reset.", variant: "destructive" });
    } finally {
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
        const { data, error } = await supabase
          .from("sale_packages")
          .select(`
            id, 
            sale_name, 
            sale_package_prices:sale_package_prices!sale_package_prices_sale_package_id_fkey (
              kw_min, 
              kw_max,
              inverter_brand,
              electronic_phase
            )
          `)
          .order("sale_name");

        if (error) throw error;
        
        if (data) {
          const programs = data.map((p: any) => ({
            id: p.id,
            name: p.sale_name,
            prices: p.sale_package_prices || [] 
          }));
          
          setAllPrograms(programs);
          setFilteredPrograms(programs);
        }
      } catch (error) { 
        console.error("Error loading programs:", error); 
      }
    };
    
    fetchSalesPrograms();
  }, []);

  useEffect(() => {
    const fetchPanelSizes = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("min_kw, product_category")
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
  }, [quotationId, allPrograms]);
// -------------------------------------------------------
  // ✅ LOGIC: Auto-Select & Filter Phase
  // -------------------------------------------------------
// 🟡 LEVEL 1: Project Size Changed -> Filter Programs
  useEffect(() => {
    const sizeInWatt = parseFloat(formData.projectSize);
    
    // Debug: ดูว่าค่าที่กรอกเข้ามาคือเท่าไหร่
    // console.log("Filtering for Size:", sizeInWatt);

    if (!formData.projectSize || isNaN(sizeInWatt)) {
      setFilteredPrograms(allPrograms);
      return;
    }

    const validPrograms = allPrograms.filter((prog) => {
      if (!prog.prices || prog.prices.length === 0) return false;
      
      // เช็คว่า Program นี้มี Price Tier ไหนที่รองรับ Size นี้ไหม?
      const isSupported = prog.prices.some((price) => {
        // 1. แปลงเป็นตัวเลขให้ชัวร์ (หน่วย Watt)
        const min = Number(price.kw_min || 0);

        // 2. ⚠️ จุดแก้ไขสำคัญ: 
        // ถ้ามี max ให้ใช้ max
        // ถ้า max เป็น null/0 ให้ถือว่าเป็น Fix Size (max = min) 
        // *ยกเว้น* ถ้าคุณตั้งใจให้ null แปลว่า Infinity จริงๆ ค่อยเปลี่ยนกลับ
        const max = (price.kw_max !== null && Number(price.kw_max) > 0) 
                    ? Number(price.kw_max) 
                    : min; 

        // Debug: ดูช่วงข้อมูลของแต่ละโปรแกรม (กด F12 ดูได้ถ้าสงสัย)
        // console.log(`Check ${prog.name}: Input ${sizeInWatt} vs Range ${min}-${max}`);

        return sizeInWatt >= min && sizeInWatt <= max;
      });

      return isSupported;
    });

    setFilteredPrograms(validPrograms);

    // 3. Auto-Reset Logic (เหมือนเดิม)
    if (formData.salesProgram) {
       const isStillValid = validPrograms.some(p => p.name === formData.salesProgram);
       if (!isStillValid) {
          setFormData(prev => ({ ...prev, salesProgram: "", brand: "", electricalPhase: "" }));
       }
    }
  }, [formData.projectSize, allPrograms]);
// 🟡 LEVEL 2: Filter Brands (ยืดหยุ่น: ขอแค่มี Size ก็ทำงานได้)
  useEffect(() => {
    // 1. ถ้าไม่มี Size -> จบข่าว หา Brand ไม่ได้ (เพราะ Inverter ขึ้นกับ Size)
    if (!formData.projectSize) {
        setAvailableBrands([]);
        return;
    }

    const sizeInWatt = parseFloat(formData.projectSize);

    // 2. เริ่มต้นจาก "โปรแกรมทั้งหมด" หรือ "โปรแกรมที่เลือกอยู่"
    let scopePrograms = allPrograms;
    if (formData.salesProgram) {
        scopePrograms = allPrograms.filter(p => p.name === formData.salesProgram);
    }

    // 3. กวาดหา Brand ทั้งหมดที่รองรับ Size นี้ (จาก Scope ที่เหลือ)
    const validBrands: string[] = [];
    scopePrograms.forEach(prog => {
        if (prog.prices) {
            prog.prices.forEach(price => {
                const min = price.kw_min || 0;
                const max = (price.kw_max !== null && Number(price.kw_max) > 0) ? Number(price.kw_max) : min;
                // เช็คว่า Size นี้อยู่ในช่วงราคาไหม
                if (sizeInWatt >= min && sizeInWatt <= max) {
                    validBrands.push(price.inverter_brand);
                }
            });
        }
    });

    const uniqueBrands = Array.from(new Set(validBrands));
    setAvailableBrands(uniqueBrands);

    // 4. Auto-Reset Brand (ถ้า Brand เดิมไม่อยู่ในลิสต์ใหม่)
    if (formData.brand && !uniqueBrands.includes(formData.brand)) {
         setFormData(prev => ({ ...prev, brand: "", electricalPhase: "" }));
    }

  }, [formData.salesProgram, formData.projectSize, allPrograms]);


  // 🟡 LEVEL 3: Filter Phase & Auto Select (ยืดหยุ่น: ขอแค่มี Size ก็ทำงานได้)
  useEffect(() => {
    // 1. ถ้าไม่มี Size -> จบข่าว หา Phase ไม่ได้
    if (!formData.projectSize) {
        setAvailablePhases([]);
        return;
    }

    const sizeInWatt = parseFloat(formData.projectSize);

    // 2. เริ่มต้น Scope จากทุกโปรแกรม
    let scopePrograms = allPrograms;

    // 2.1 ถ้าเลือก Program ไว้ -> กรอง Scope ให้แคบลง
    if (formData.salesProgram) {
        scopePrograms = allPrograms.filter(p => p.name === formData.salesProgram);
    }

    // 3. กวาดหา Phase จาก Scope Programs ที่เหลือ
    const validPhases: string[] = [];
    scopePrograms.forEach(prog => {
        if (prog.prices) {
            prog.prices.forEach(price => {
                const min = price.kw_min || 0;
                const max = (price.kw_max !== null && Number(price.kw_max) > 0) ? Number(price.kw_max) : min;
                // เงื่อนไข 1: Size ต้องตรง
                const isSizeMatch = sizeInWatt >= min && sizeInWatt <= max;
                
                // เงื่อนไข 2: ถ้าเลือก Brand ไว้ Brand ต้องตรง (ถ้าไม่เลือก Brand ก็ผ่านตลอด)
                const isBrandMatch = !formData.brand || (price.inverter_brand === formData.brand);

                if (isSizeMatch && isBrandMatch) {
                    validPhases.push(price.electronic_phase);
                }
            });
        }
    });
    
    const uniquePhases = Array.from(new Set(validPhases));
    setAvailablePhases(uniquePhases);

    // 4. 🤖 AUTO-ACTION (เหมือนเดิม)
    if (uniquePhases.length === 1) {
        if (formData.electricalPhase !== uniquePhases[0]) {
            setFormData(prev => ({ ...prev, electricalPhase: uniquePhases[0] }));
        }
    } else if (uniquePhases.length === 0) {
        if (formData.electricalPhase) {
            setFormData(prev => ({ ...prev, electricalPhase: "" }));
        }
    } else {
        // มี 2 ตัวเลือก -> เช็คว่าค่าที่เลือกอยู่ยัง Valid ไหม
        if (formData.electricalPhase && !uniquePhases.includes(formData.electricalPhase)) {
             setFormData(prev => ({ ...prev, electricalPhase: "" }));
        }
    }

  }, [formData.brand, formData.salesProgram, formData.projectSize, allPrograms]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
            
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Customer</Label>
                <CustomerAutocomplete 
                  value={formData.customerName}
                  onInputChange={(text) => {
                    setFormData(prev => ({ ...prev, customerName: text }));
                    setCurrentCustomerId(null); // ถือว่าเป็นลูกค้าใหม่ไว้ก่อน
                  }}

                  // 2. ถ้าจิ้มเลือกจากลิสต์ -> อัปเดตชื่อ + จำ ID (ลูกค้าเก่า) + เติม Tax ID
                  onSelect={(customer) => {
                    setFormData(prev => ({ 
                        ...prev, 
                        customerName: customer.customer_name,
                        customerTaxId: customer.id_tax 
                    }));
                    setCurrentCustomerId(customer.id); // จำ ID ไว้
                  }}
                  onClear={() => {
                    setFormData(prev => ({ ...prev, customerName: "", customerTaxId: "" }));
                    setCurrentCustomerId(null);
                  }}
                />
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
                <Label className="text-xs text-muted-foreground">Project Size (Watt)*</Label>
                <Input type="number" className="h-9 mt-1" placeholder="5000" value={formData.projectSize} onChange={(e) => handleInputChange("projectSize", e.target.value)} />
              </div>
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Phase*</Label>
                <Select 
                  value={formData.electricalPhase} 
                  onValueChange={(value) => handleInputChange("electricalPhase", value)}
                  disabled={availablePhases.length <= 1} 
                >
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder={availablePhases.length === 0 ? "Enter Project Size first" : "Select"} /></SelectTrigger>
                  <SelectContent>
                    {availablePhases.map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        {phase === "single_phase" ? "1 Phase" : "3 Phase"}
                      </SelectItem>
                    ))}
                    {/* Fallback เผื่อไว้ */}
                    {availablePhases.length === 0 && (
                        <div className="p-2 text-xs text-muted-foreground text-center">No options</div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Program*</Label>
                <Select 
                  value={formData.salesProgram} 
                  onValueChange={(value) => handleInputChange("salesProgram", value)}
                  disabled={!formData.projectSize} 
                >
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue placeholder={formData.projectSize ? "Select Program" : "Enter Project Size first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPrograms.length > 0 ? (
                      filteredPrograms.map((program) => (
                        <SelectItem key={program.id} value={program.name}>
                          {program.name}
                        </SelectItem>
                      ))
                    ) : (
                      <div className="p-2 text-xs text-muted-foreground text-center">
                          ไม่มีโปรแกรมสำหรับขนาด {formData.projectSize} Watt
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Brand*</Label>
                <Select value={formData.brand} onValueChange={(value) => handleInputChange("brand", value)} disabled={!formData.salesProgram}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Enter Program first" /></SelectTrigger>
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

            {canEdit && (
              <div className="mt-4 pt-2 border-t">
                <Button onClick={() => handleCreateQuotation(false)} size="sm" disabled={isLoading} className="w-full h-10">
                  {isLoading ? "Saving..." : (currentQuotationId ? "Save Changes" : "Create Quotation")}
                </Button>
              </div>)}
          </div>
        </div>

        {/* PREVIEW SECTION (2/3) */}
        {showQuotation && (
          <div className="w-full lg:col-span-2 lg:sticky lg:top-4">
            <div className="bg-card rounded-lg shadow-sm p-4 relative border border-border animate-in fade-in">
              <div className="absolute top-3 right-3 flex gap-2 z-10">
                {canEdit && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleReset} className="border-dashed"> 
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleEditQuotation}>
                      {isEditMode ? "Done" : "Edit"}
                    </Button>
                  </>
                )}
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
                        onDeleteItem={handleDeleteItem}
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