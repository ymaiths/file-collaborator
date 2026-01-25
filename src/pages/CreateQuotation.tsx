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
  // ✅ Destructure calculateAndSavePricing
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

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // ------------------------------------------------------------------
  // ✅ 1. Handlers for In-Place Editing
  // ------------------------------------------------------------------
  const SYNCED_GROUP_KEYWORDS = [
  "Common Temporary Facilities, Construction Facilities",
  "Electrical drawing, Facility system, layout and schematic",
  "Commissioning test", 
  "Tempolary Utility Expense", 
  "Safety Operation"
];

  // Handle Item Updates (Name, Brand, Qty, Price)
  const handleUpdateItem = async (itemId: string, field: string, value: any) => {
    try {
      let updateData: any = {};
      
      if (["edited_name", "edited_brand", "edited_unit"].includes(field)) {
         updateData[field] = value;
      } else if (["quantity", "product_price", "installation_price"].includes(field)) {
         updateData[field] = value;
         updateData[`is_edited_${field}`] = true; 
      }

      // --- LOGIC พิเศษสำหรับ Section B (Synced Group) ---
    if (field === "product_price") {
        const { data: currentItem } = await supabase
            .from("product_line_items")
            .select("*, products(name)")
            .eq("id", itemId)
            .single();

        const itemName = currentItem?.products?.name || "";
        const isSyncedItem = SYNCED_GROUP_KEYWORDS.some(keyword => 
            itemName.toLowerCase().includes(keyword.toLowerCase())
        );

        if (isSyncedItem) {
            console.log("🔄 Updating Synced Group for Section B...");
            const { data: allItems } = await supabase
                .from("product_line_items")
                .select("*, products(name)")
                .eq("quotation_id", currentQuotationId);

            if (allItems) {
                const itemsToUpdate = allItems.filter(i => 
                    SYNCED_GROUP_KEYWORDS.some(k => i.products?.name?.toLowerCase().includes(k.toLowerCase()))
                );

                const updates = itemsToUpdate.map(i => ({
                    id: i.id,
                    product_price: value, 
                    is_edited_product_price: true
                }));

                await Promise.all(
                    updates.map(u => supabase.from("product_line_items").update(u).eq("id", u.id))
                );
            }
        } else {
            const { error } = await supabase.from("product_line_items").update(updateData).eq("id", itemId);
            if (error) throw error;
        }
    } else {
        const { error } = await supabase.from("product_line_items").update(updateData).eq("id", itemId);
        if (error) throw error;
    }

    // Recalculate & Refresh UI
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

  // ✅ New Handler: Override Net/Grand Total
  const handleUpdateTotalOverride = async (type: 'net' | 'grand', value: number) => {
     if (!currentQuotationId) return;

     try {
        let newNetTotal = 0;
        const currentDiscount = previewData?.discount || 0; 

        if (type === 'net') {
            newNetTotal = value;
            console.log(`User Edited NET TOTAL: ${value}`);
        } else {
            // Formula: Net = (Grand / 1.07) + Discount
            const totalAfterVatRemoved = value / 1.07;
            newNetTotal = totalAfterVatRemoved + currentDiscount;
            console.log(`User Edited GRAND TOTAL: ${value} -> Calculated NET: ${newNetTotal}`);
        }

        // 🚀 Call Pricing Engine with Manual Target
        await calculateAndSavePricing(currentQuotationId, newNetTotal);
        
        await loadPreviewData(currentQuotationId);
        toast({ title: "Pricing Updated", description: "Re-calculated based on new total." });

     } catch (error) {
        console.error("Total Override Error:", error);
        toast({ title: "Error", description: "Failed to update total.", variant: "destructive" });
     }
  };

  // Handle Terms Updates (Payment, Warranty, Note)
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
  // ✅ 2. Load Preview Data
  // ------------------------------------------------------------------
  const loadPreviewData = async (quotationId: string) => {
    try {
      const { data: quoteData } = await supabase.from("quotations").select("*").eq("id", quotationId).single();
      const { data: lineItems } = await supabase.from("product_line_items").select(`*, products(*)`).eq("quotation_id", quotationId);
      
      if (!quoteData || !lineItems) return;

      let rawPayment = "-";
      let rawWarranty = "-";
      let rawNote = "-";

      if (quoteData.sale_package_id) {
          const { data: pkgData } = await supabase
             .from("sale_packages")
             .select("payment_terms, warranty_terms, note")
             .eq("id", quoteData.sale_package_id)
             .maybeSingle();

          if (pkgData) {
             rawPayment = pkgData.payment_terms || "-";
             rawWarranty = pkgData.warranty_terms || "-";
             rawNote = pkgData.note || "-";
          }
      }

      if (quoteData.edited_payment_terms) rawPayment = quoteData.edited_payment_terms;
      if (quoteData.edited_warranty_terms) rawWarranty = quoteData.edited_warranty_terms;
      if (quoteData.edited_note) rawNote = quoteData.edited_note;

      const mappedItems = lineItems.map((item) => {
          const product = item.products;
          const categoryRaw = product?.product_category || "";
          const isSectionB = categoryRaw === "operation"; 
          
          return {
             id: item.id,
             name: product?.name || "Unknown",
             brand: product?.brand || "-",
             edited_name: item.edited_name,
             edited_brand: item.edited_brand,
             edited_unit: item.edited_unit,
             
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
         quotationId: quoteData.id,
         items: [...itemsA, ...itemsB],
         paymentTerms: parseTerms(rawPayment),
         warrantyTerms: parseTerms(rawWarranty),
         remarks: rawNote,
         vatRate: 0.07,
         discount: 0 
      });

    } catch (e) {
      console.error("Preview Error", e);
    }
  };

  // ------------------------------------------------------------------
  // ✅ 3. Export Excel
  // ------------------------------------------------------------------
  const handleExportExcel = async () => {
    if (!currentQuotationId) {
      toast({ title: "Not Found", description: "Please save quotation first.", variant: "destructive" });
      return;
    }
    setIsLoading(true);

    try {
      const { data: quoteData } = await supabase
        .from("quotations")
        .select(`*, sale_packages(*)`) 
        .eq("id", currentQuotationId)
        .single();
        
      if (!quoteData) throw new Error("Quotation not found");

      let rawPayment = "-";
      let rawWarranty = "-";
      let rawNote = "-";

      if (quoteData.sale_package_id) {
        const { data: pkgData } = await supabase.from("sale_packages").select("*").eq("id", quoteData.sale_package_id).maybeSingle();
        if (pkgData) {
           rawPayment = pkgData.payment_terms || "-";
           rawWarranty = pkgData.warranty_terms || "-";
           rawNote = pkgData.note || "-";
        }
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
          const isSectionB = categoryRaw === "operation";
          
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
      const itemsB = mappedItems.filter((i) => i.category === "B"); 

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
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPDF = () => {
    toast({ title: "Coming Soon", description: "Feature under development." });
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
      toast({ title: "Required", description: "Please fill all required fields (*)", variant: "destructive" });
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
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground">Customer</Label>
                <Input className="h-9 mt-1" placeholder="Name" value={formData.customerName} onChange={(e) => handleInputChange("customerName", e.target.value)} />
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
                <Label className="text-xs text-muted-foreground">Provider</Label>
                <Input className="h-9 mt-1" placeholder="Provider" value={formData.serviceProvider} onChange={(e) => handleInputChange("serviceProvider", e.target.value)} />
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
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Panel (Watt)*</Label>
                <Select value={formData.solarPanelSize} onValueChange={(value) => handleInputChange("solarPanelSize", value)}>
                  <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Panel Size" /></SelectTrigger>
                  <SelectContent>{availablePanelSizes.map((size) => (<SelectItem key={size} value={size.toString()}>{size.toLocaleString()} Watt</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Remarks</Label>
                <Textarea className="mt-1 min-h-[60px]" placeholder="Additional info..." value={formData.additionalInfo} onChange={(e) => handleInputChange("additionalInfo", e.target.value)} />
              </div>
            </div>
            <div className="mt-4 pt-2 border-t">
              <Button onClick={handleCreateQuotation} size="sm" disabled={isLoading} className="w-full h-10">
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
                <Button variant="outline" size="sm" onClick={handleExportPDF}>PDF</Button>
                <Button variant="outline" size="sm" onClick={handleExportExcel}>EXCEL</Button>
              </div>
              <div className="flex flex-col items-center justify-center min-h-[400px] overflow-auto mt-12">
                {previewData ? (
                  <div className="origin-top scale-95 transition-transform w-full flex justify-center">
                    {/* ✅ Passed all necessary props including onUpdateTotalOverride */}
                    <QuotationPreview 
                        data={previewData} 
                        isEditMode={isEditMode}
                        onUpdateItem={handleUpdateItem}
                        onUpdateTerms={handleUpdateTerms}
                        onUpdateTotalOverride={handleUpdateTotalOverride}
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
    </div>
  );
};

export default CreateQuotation;