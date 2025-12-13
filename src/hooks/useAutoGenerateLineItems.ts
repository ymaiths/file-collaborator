import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
// อย่าลืมตรวจสอบว่า path ของ 2 ไฟล์นี้ถูกต้อง
import {
  selectInverters,
  selectInverterAccessories,
} from "@/utils/equipment-logic";
import { calculateSystemSpecs } from "@/utils/kwpcalculations";

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

      // เตรียมตัวแปรหลัก (ค่าใน DB เป็น Watt ตามที่คุณระบุ)
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
          p.product_category === "solar_panel" && p.min_kw === panelSizeWatt
      );

      if (solarPanel) {
        // คำนวณจำนวนแผง
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
      const availableInverters = allProducts.filter(
        (p) =>
          p.product_category === "inverter" &&
          p.brand?.toLowerCase() === brand?.toLowerCase()
      );

      // เรียกใช้ Algorithm เลือก Inverter
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
        (p) => p.product_category === "pv_mounting_structure"
      );
      if (mounting) {
        lineItemsToInsert.push({
          quotation_id: quotationId,
          product_id: mounting.id,
          quantity: projectSizeWatt, // จำนวนเท่ากับขนาดโครงการ (Watt)
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
          p.product_category === "inverter" ||
          p.product_category === "zero_export_smart_logger"
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
      // AC Box
      const acBox = allProducts.find(
        (p) =>
          p.product_category === "ac_box" &&
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

      // DC Box
      const dcBox = allProducts.find(
        (p) =>
          p.product_category === "dc_box" &&
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
      // เลือก 3 รายการจากหมวด cable
      const cables = allProducts.filter((p) => p.product_category === "cable");

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
        .filter((p) => p.product_category === "operation")
        .filter(
          (p) =>
            // ตรวจสอบช่วง Watt (min <= project <= max)
            (p.min_kw || 0) <= projectSizeWatt &&
            (p.max_kw === null || (p.max_kw || 0) >= projectSizeWatt)
        );

      // เลือกมา 6 รายการ
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
        // ลบข้อมูลเก่าของ Quotation นี้ทิ้งก่อน (เพื่อไม่ให้ซ้ำซ้อน)
        await supabase
          .from("product_line_items")
          .delete()
          .eq("quotation_id", quotationId);

        // Insert ข้อมูลชุดใหม่
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
