import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  selectInverters,
  selectInverterAccessories,
} from "@/utils/equipment-logic";
import { calculateSystemSpecs } from "@/utils/kwpcalculations";

// Helper สำหรับเช็คหมวดหมู่ (รองรับทั้ง Key เก่า และชื่อใหม่)
const isCategory = (productCat: string | null, keys: string[]) => {
  if (!productCat) return false;
  return keys.includes(productCat);
};

export const useAutoGenerateLineItems = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMainEquipment = async (quotationId: string) => {
    setIsGenerating(true);
    try {
      // 1. ดึงข้อมูล Quotation
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

      // 2. ดึงข้อมูล Products ทั้งหมด
      const { data: allProducts, error: prodError } = await supabase
        .from("products")
        .select("*");

      if (prodError || !allProducts)
        throw new Error("Failed to fetch products");

      const lineItemsToInsert: any[] = [];

      // ====================================================
      // 1. แผงโซลาร์เซลล์ (PV Module)
      // ====================================================
      const solarPanel = allProducts.find(
        (p) =>
          // ✅ แก้ไข: เช็คทั้ง solar_panel และ Solar Panel
          isCategory(p.product_category, ["solar_panel", "Solar Panel"]) && 
          p.min_kw === panelSizeWatt
      );

      if (solarPanel) {
        const { numberOfPanels } = calculateSystemSpecs(
          projectSizeWatt,
          panelSizeWatt
        );

        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: solarPanel.id,
          quantity: numberOfPanels,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });
      }

      // ====================================================
      // 2. อินเวอร์เตอร์ (Inverter)
      // ====================================================
      let targetBrand = brand?.toLowerCase().trim() || "";
      if (targetBrand.includes("huawei")) {
        targetBrand = "huawei";
      }

      const availableInverters = allProducts.filter(
        (p) =>
          // ✅ แก้ไข: เช็คทั้ง inverter และ Inverter
          isCategory(p.product_category, ["inverter", "Inverter"]) &&
          p.brand?.toLowerCase().trim() === targetBrand
      );

      const selectedInverters = selectInverters(
        availableInverters,
        projectSizeWatt,
        projectPhase
      );

      let totalInverterQty = 0;
      selectedInverters.forEach((item) => {
        totalInverterQty += item.quantity;
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: item.product.id,
          quantity: item.quantity,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });
      });

      // ====================================================
      // 3. โครงสร้างติดตั้ง (PV Mounting Structure)
      // ====================================================
      const mounting = allProducts.find(
        (p) => isCategory(p.product_category, ["pv_mounting_structure", "PV Mounting Structure"])
      );
      if (mounting) {
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: mounting.id,
          quantity: projectSizeWatt,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });
      }

      // ====================================================
      // 4. Zero Export or Smart Logger
      // ====================================================
      const potentialAccessories = allProducts.filter(
        (p) =>
          isCategory(p.product_category, ["inverter", "Inverter"]) ||
          isCategory(p.product_category, ["zero_export_smart_logger", "Zero Export & Smart Logger"])
      );

      const accessoryResult = selectInverterAccessories(
        potentialAccessories,
        totalInverterQty,
        projectPhase
      );

      if (accessoryResult) {
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: accessoryResult.product.id,
          quantity: accessoryResult.quantity,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });
      }

      // ====================================================
      // 5. ตู้ AC/DC (AC Box, DC Box)
      // ====================================================
      const acBox = allProducts.find(
        (p) =>
          isCategory(p.product_category, ["ac_box", "AC Box"]) &&
          (p.min_kw || 0) <= projectSizeWatt &&
          (p.max_kw === null || (p.max_kw || 0) >= projectSizeWatt)
      );
      if (acBox)
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: acBox.id,
          quantity: 1,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });

      const dcBox = allProducts.find(
        (p) =>
          isCategory(p.product_category, ["dc_box", "DC Box"]) &&
          (p.min_kw || 0) <= projectSizeWatt &&
          (p.max_kw === null || (p.max_kw || 0) >= projectSizeWatt)
      );
      if (dcBox)
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: dcBox.id,
          quantity: 1,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });

      // ====================================================
      // 6. สายไฟ (Cabling & Conduit Set)
      // ====================================================
      const cables = allProducts.filter((p) => isCategory(p.product_category, ["cable", "Cable & Connector"]));

      cables.slice(0, 3).forEach((cable) => {
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: cable.id,
          quantity: 1,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });
      });

      // ====================================================
      // 7. การดำเนินการ (Operation)
      // ====================================================
      const operations = allProducts
        .filter((p) => isCategory(p.product_category, ["operation", "Operation & Maintenance"]))
        .filter(
          (p) =>
            (p.min_kw || 0) <= projectSizeWatt &&
            (p.max_kw === null || (p.max_kw || 0) >= projectSizeWatt)
        );

      operations.slice(0, 6).forEach((op) => {
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: op.id,
          quantity: 1,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });
      });

      // ====================================================
      // FINAL: บันทึกลง Database
      // ====================================================
      if (lineItemsToInsert.length > 0) {
        await supabase
          .from("product_line_items")
          .delete()
          .eq("quotation_id", quotationId);

        const { error: insertError } = await supabase
          .from("product_line_items")
          .insert(lineItemsToInsert);

        if (insertError) throw insertError;

        toast({
          title: "สร้างรายการอุปกรณ์สำเร็จ",
          description: `เพิ่มอุปกรณ์หลักเรียบร้อยแล้ว (${lineItemsToInsert.length} รายการ)`,
        });
      } else {
        toast({
          title: "ไม่พบรายการอุปกรณ์",
          description: "ไม่สามารถจับคู่อุปกรณ์ตามเงื่อนไขได้",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Generate Equipment Error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description:
          error instanceof Error
            ? error.message
            : "ไม่สามารถสร้างรายการอุปกรณ์ได้",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return { generateMainEquipment, isGenerating };
};