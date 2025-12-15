import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  determineOptimizerSize,
  calculateOptimizerQty,
} from "@/utils/additional-equipment-logic";

export const useAutoGenerateAdditionalItems = () => {
  const [isGeneratingAdditional, setIsGeneratingAdditional] = useState(false);

  const generateAdditionalEquipment = async (quotationId: string) => {
    setIsGeneratingAdditional(true);
    try {
      // 1. ดึงข้อมูล Quotation
      const { data: quote, error: quoteError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .single();

      if (quoteError || !quote) throw new Error("Quotation not found");

      const projectSizeWatt = quote.kw_size || 0;
      const brand = quote.inverter_brand?.toLowerCase() || "";

      // 2. ดึงรายการสินค้าที่บันทึกไปแล้ว (Main Equipment)
      // เพื่อหา ขนาดแผง และ ขนาด Inverter ที่ถูกเลือกไป
      const { data: existingItems, error: itemsError } = await supabase
        .from("product_line_items")
        .select(
          `
          quantity,
          products (
            id,
            product_category,
            min_kw,
            max_kw,
            name
          )
        `
        )
        .eq("quotation_id", quotationId);

      if (itemsError) throw itemsError;

      // หาแผงโซลาร์ที่ถูกเลือกไป
      const selectedPanelItem = existingItems?.find(
        (item) => item.products?.product_category === "solar_panel"
      );
      const panelWatt = selectedPanelItem?.products?.min_kw || 0;
      const totalPanels = selectedPanelItem?.quantity || 0;

      // หา Inverter ที่ถูกเลือกไป (เอาตัวแรกที่เจอที่เป็น Inverter หลัก)
      const selectedInverterItem = existingItems?.find(
        (item) =>
          item.products?.product_category === "inverter" &&
          (item.products?.min_kw || 0) > 0 // ไม่เอา accessories
      );
      // แปลง Watt เป็น kW (เช่น 5000 -> 5)
      const inverterKw = (selectedInverterItem?.products?.min_kw || 0) / 1000;

      // 3. ดึง Products ทั้งหมดมาเตรียมเลือก
      const { data: allProducts, error: prodError } = await supabase
        .from("products")
        .select("*");

      if (prodError || !allProducts)
        throw new Error("Failed to fetch products");

      const additionalItemsToInsert: any[] = [];

      // =========================================================
      // 1. Optimizer
      // =========================================================
      if (brand.includes("optimizer")) {
        // คำนวณขนาดที่ต้องการ
        const targetOptSize = determineOptimizerSize(inverterKw, panelWatt);

        if (targetOptSize) {
          // หา Product ใน Database ที่ตรงกับขนาดนี้
          // (สมมติว่า product_category ของ optimizer คือ 'inverter' หรือ 'optimizer' ก็ได้ แล้วแต่คุณตั้ง
          // แต่ในโจทย์ไม่ได้ระบุหมวดมาชัดเจน ผมจะสมมติว่ามันชื่อ 'optimizer' หรืออยู่ใน 'inverter' ที่ชื่อมีคำว่า optimizer)
          const optimizerProduct = allProducts.find(
            (p) =>
              // เช็คขนาด (min_kw)
              p.min_kw === targetOptSize &&
              // เช็คว่าเป็น optimizer (ดูจากชื่อหรือหมวด)
              (p.name.toLowerCase().includes("optimizer") ||
                (p.product_category as any) === "optimizer")
          );

          if (optimizerProduct) {
            const qty = calculateOptimizerQty(targetOptSize, totalPanels);
            additionalItemsToInsert.push({
              quotation_id: quotationId,
              product_id: optimizerProduct.id,
              quantity: qty,
              is_edited_product_price: false,
              is_edited_installation_price: false,
              is_edited_quantity: false,
            });
          }
        }
      }

      // =========================================================
      // 2. Support Inverter (> 30kW)
      // =========================================================
      if (projectSizeWatt >= 30000) {
        const supportInv = allProducts.find(
          (p) =>
            (p.product_category as any) === "support_inverter" &&
            (p.min_kw || 0) <= projectSizeWatt &&
            (p.max_kw === null || (p.max_kw || 0) >= projectSizeWatt)
        );
        if (supportInv) {
          additionalItemsToInsert.push({
            quotation_id: quotationId,
            product_id: supportInv.id,
            quantity: 1,
            is_edited_product_price: false,
            is_edited_installation_price: false,
            is_edited_quantity: false,
          });
        }
      }

      // =========================================================
      // 3. ระบบน้ำ & Walkway (>= 100kW)
      // =========================================================
      if (projectSizeWatt >= 100000) {
        // Water service
        const waterService = allProducts.find(
          (p) =>
            (p.product_category as any) === "service" &&
            p.name.toLowerCase().includes("water service")
        );
        if (waterService) {
          additionalItemsToInsert.push({
            quotation_id: quotationId,
            product_id: waterService.id,
            quantity: 1,
            is_edited_product_price: false,
            is_edited_installation_price: false,
            is_edited_quantity: false,
          });
        }

        // Walk way
        const walkway = allProducts.find(
          (p) =>
            (p.product_category as any) === "service" &&
            p.name.toLowerCase().includes("walk way") // แก้คำสะกดตาม Database จริงของคุณ
        );
        if (walkway) {
          additionalItemsToInsert.push({
            quotation_id: quotationId,
            product_id: walkway.id,
            quantity: 1,
            is_edited_product_price: false,
            is_edited_installation_price: false,
            is_edited_quantity: false,
          });
        }
      }

      // =========================================================
      // 4. Rapid Shutdown (>= 200kW && Huawei)
      // =========================================================
      if (projectSizeWatt >= 200000 && brand.includes("huawei")) {
        const rapidShutdown = allProducts.find(
          (p) =>
            (p.product_category as any) === "electrical_management" &&
            p.name.toLowerCase().includes("rapid shutdown") &&
            p.min_kw === 2
        );
        if (rapidShutdown) {
          additionalItemsToInsert.push({
            quotation_id: quotationId,
            product_id: rapidShutdown.id,
            quantity: 1,
            is_edited_product_price: false,
            is_edited_installation_price: false,
            is_edited_quantity: false,
          });
        }
      }

      // =========================================================
      // 5. PQM (>= 250kW)
      // =========================================================
      if (projectSizeWatt >= 250000) {
        const pqm = allProducts.find(
          (p) =>
            (p.product_category as any) === "electrical_management" &&
            p.name.toLowerCase().includes("pqm512 pro")
        );
        if (pqm) {
          additionalItemsToInsert.push({
            quotation_id: quotationId,
            product_id: pqm.id,
            quantity: 1,
            is_edited_product_price: false,
            is_edited_installation_price: false,
            is_edited_quantity: false,
          });
        }
      }

      // =========================================================
      // บันทึกลง Database
      // =========================================================
      if (additionalItemsToInsert.length > 0) {
        // ใช้การ Insert เพิ่มเข้าไป (ไม่ได้ลบของเก่าทั้งหมด เพราะเดี๋ยว Main Equipment หาย)
        // **แต่ต้องระวังซ้ำ** ถ้ากดปุ่มสร้างซ้ำๆ อาจจะต้องมี logic เช็คหรือลบเฉพาะหมวด additional ทิ้งก่อน
        // ในที่นี้สมมติว่าให้ Insert เพิ่มเข้าไปเลย

        const { error: insertError } = await supabase
          .from("product_line_items")
          .insert(additionalItemsToInsert);

        if (insertError) throw insertError;

        toast({
          title: "เพิ่มอุปกรณ์เสริมเรียบร้อย",
          description: `เพิ่มรายการ: ${additionalItemsToInsert.length} รายการ`,
        });
      }
    } catch (error) {
      console.error("Generate Additional Equipment Error:", error);
      toast({
        title: "เกิดข้อผิดพลาด (Additional Item)",
        description:
          error instanceof Error
            ? error.message
            : "ไม่สามารถสร้างรายการอุปกรณ์เพิ่มเติมได้",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAdditional(false);
    }
  };

  return { generateAdditionalEquipment, isGeneratingAdditional };
};
