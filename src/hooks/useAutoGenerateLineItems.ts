import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { selectInverters } from "@/utils/equipment-logic"; // 🌟 เอา selectInverterAccessories ออก เพราะเราเขียนลอจิกใหม่แล้ว
import { calculateSystemSpecs } from "@/utils/kwpcalculations";

// Helper เช็คช่วงขนาดโครงการ
const isWithinRange = (p: any, size: number) => {
  const min = p.min_kw || 0;
  const max = p.max_kw === null ? Infinity : p.max_kw;
  return size >= min && size <= max;
};

export const useAutoGenerateLineItems = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMainEquipment = async (quotationId: string) => {
    setIsGenerating(true);
    try {
      const { data: quote, error: quoteError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .single();

      if (quoteError || !quote) throw new Error("Quotation not found");

      const projectSizeWatt = quote.kw_size || 0;
      const panelSizeWatt = quote.kw_panel || 0;
      const projectPhase = quote.electrical_phase || "single_phase";
      const brand = quote.inverter_brand;

      const { data: allProducts, error: prodError } = await supabase
        .from("products")
        .select("*");

      if (prodError || !allProducts) throw new Error("Failed to fetch products");

      const lineItemsToInsert: any[] = [];
      const pushItem = (productId: string, qty: number) => {
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: productId,
          quantity: qty,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });
      };

      // ====================================================
      // 1. แผงโซลาร์เซลล์ (STANDARD Solar Panel)
      // ====================================================
      const solarPanel = allProducts.find(
        (p) => p.product_category === "STANDARD Solar Panel" && p.min_kw === panelSizeWatt
      );
      if (solarPanel) {
        const { numberOfPanels } = calculateSystemSpecs(projectSizeWatt, panelSizeWatt);
        pushItem(solarPanel.id, numberOfPanels);
      }

      // ====================================================
      // 2. อินเวอร์เตอร์ (STANDARD Inverter / Zero Export / Smart Logger)
      // ====================================================
      let targetBrand = brand?.toLowerCase().trim() || "";
      if (targetBrand.includes("huawei")) targetBrand = "huawei";

      // 🌟 กรองเอาเฉพาะ Inverter แท้ๆ (ตัดพวกคำว่า Zero, Logger ออก) เพื่อไปคำนวณจำนวน
      const availableInverters = allProducts.filter(
        (p) =>
          p.product_category === "STANDARD Inverter / Zero Export / Smart Logger" &&
          p.brand?.toLowerCase().trim() === targetBrand &&
          !p.name.toLowerCase().includes("logger") &&
          !p.name.toLowerCase().includes("zero") &&
          !p.name.includes("กันย้อน") &&
          !p.name.includes("สมาร์ท")
      );

      const selectedInverters = selectInverters(availableInverters, projectSizeWatt, projectPhase);
      let totalInverterQty = 0;
      
      selectedInverters.forEach((item) => {
        totalInverterQty += item.quantity;
        pushItem(item.product.id, item.quantity);
      });

      // ====================================================
      // 3. Zero Export หรือ Smart Logger (ลอจิกใหม่ตามเงื่อนไข)
      // ====================================================
      const invLoggerCategory = "STANDARD Inverter / Zero Export / Smart Logger";
      if (totalInverterQty === 1) {
         // กรณี Inverter 1 ตัว -> เลือก Zero Export ที่ Phase ตรงกัน
         const zeroExport = allProducts.find(p => 
             p.product_category === invLoggerCategory &&
             (p.name.toLowerCase().includes("zero") || p.name.includes("กันย้อน")) &&
             p.electrical_phase === projectPhase &&
             (p.brand?.toLowerCase().trim() === targetBrand || !p.brand)
         );
         if (zeroExport) pushItem(zeroExport.id, 1);
      } else if (totalInverterQty > 1) {
         // กรณี Inverter > 1 ตัว -> เลือก Smart Logger
         const smartLogger = allProducts.find(p => 
             p.product_category === invLoggerCategory &&
             (p.name.toLowerCase().includes("logger") || p.name.includes("สมาร์ท")) &&
             (p.brand?.toLowerCase().trim() === targetBrand || !p.brand)
         );
         if (smartLogger) pushItem(smartLogger.id, 1);
      }

      // ====================================================
      // 4. โครงสร้างติดตั้ง (ดึงมาทั้งหมด)
      // ====================================================
      const mountings = allProducts.filter((p) => p.product_category === "STANDARD PV Mounting Structure");
      mountings.forEach((m) => pushItem(m.id, projectSizeWatt)); // 🌟 จำนวน = Watt ของโปรเจกต์

      // ====================================================
      // 5. สายไฟ (ดึงมาทั้งหมด ไม่จำกัดแค่ 3 แถวแล้ว)
      // ====================================================
      const cables = allProducts.filter((p) => p.product_category === "STANDARD Cable");
      cables.forEach((cable) => pushItem(cable.id, 1));

      // ====================================================
      // 6. ตู้ AC/DC Box
      // ====================================================
      const acBox = allProducts.find((p) => p.product_category === "STANDARD AC Box" && isWithinRange(p, projectSizeWatt));
      if (acBox) pushItem(acBox.id, 1);

      const dcBox = allProducts.find((p) => p.product_category === "STANDARD DC Box" && isWithinRange(p, projectSizeWatt));
      if (dcBox) pushItem(dcBox.id, 1);

      // ====================================================
      // 7. การดำเนินการ (Operation) (ดึงมาทั้งหมดในช่วงขนาด)
      // ====================================================
      const operations = allProducts.filter(
        (p) => p.product_category === "STANDARD Operation" && isWithinRange(p, projectSizeWatt)
      );
      operations.forEach((op) => pushItem(op.id, 1));

      // ====================================================
      // FINAL: บันทึกลง Database
      // ====================================================
      if (lineItemsToInsert.length > 0) {
        await supabase.from("product_line_items").delete().eq("quotation_id", quotationId);
        const { error: insertError } = await supabase.from("product_line_items").insert(lineItemsToInsert);
        if (insertError) throw insertError;

        toast({
          title: "สร้างรายการอุปกรณ์สำเร็จ",
          description: `เพิ่มอุปกรณ์หลักเรียบร้อยแล้ว (${lineItemsToInsert.length} รายการ)`,
        });
      } else {
        toast({ title: "ไม่พบรายการอุปกรณ์", description: "ไม่สามารถจับคู่อุปกรณ์ตามเงื่อนไขได้", variant: "destructive" });
      }
    } catch (error) {
      console.error("Generate Equipment Error:", error);
      toast({ title: "เกิดข้อผิดพลาด", description: error instanceof Error ? error.message : "ไม่สามารถสร้างรายการอุปกรณ์ได้", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateMainEquipment, isGenerating };
};