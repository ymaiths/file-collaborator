import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  determineOptimizerSize,
  calculateOptimizerQty,
} from "@/utils/additional-equipment-logic";

// Helper สำหรับเช็คหมวดหมู่
const isCategory = (productCat: string | null, keys: string[]) => {
  if (!productCat) return false;
  return keys.includes(productCat);
};

export const useAutoGenerateAdditionalItems = () => {
  const [isGeneratingAdditional, setIsGeneratingAdditional] = useState(false);

  const generateAdditionalEquipment = async (quotationId: string) => {
    setIsGeneratingAdditional(true);
    try {
      const { data: quote, error: quoteError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .single();

      if (quoteError || !quote) throw new Error("Quotation not found");

      const projectSizeWatt = quote.kw_size || 0;
      const brand = quote.inverter_brand?.toLowerCase() || "";

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

      // ✅ แก้ไข: หา Solar Panel จากรายการที่มีอยู่ (เช็คทั้งเก่าและใหม่)
      const selectedPanelItem = existingItems?.find(
        (item) => isCategory(item.products?.product_category || "", ["solar_panel", "Solar Panel"])
      );
      const panelWatt = selectedPanelItem?.products?.min_kw || 0;
      const totalPanels = selectedPanelItem?.quantity || 0;

      // ✅ แก้ไข: หา Inverter (เช็คทั้งเก่าและใหม่)
      const selectedInverterItem = existingItems?.find(
        (item) =>
          isCategory(item.products?.product_category || "", ["inverter", "Inverter"]) &&
          (item.products?.min_kw || 0) > 0
      );
      const inverterKw = (selectedInverterItem?.products?.min_kw || 0) / 1000;

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
        const targetOptSize = determineOptimizerSize(inverterKw, panelWatt);

        if (targetOptSize) {
          const optimizerProduct = allProducts.find(
            (p) =>
              p.min_kw === targetOptSize &&
              // ✅ แก้ไข: เช็คหมวด Optimizer
              isCategory(p.product_category, ["optimizer", "Optimizer"])
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
            // ✅ แก้ไข: เช็คหมวด Support Inverter
            isCategory(p.product_category, ["support_inverter", "Support Inverter"]) &&
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
            isCategory(p.product_category, ["service", "Service"]) &&
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
            isCategory(p.product_category, ["service", "Service"]) &&
            p.name.toLowerCase().includes("walk way")
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
            isCategory(p.product_category, ["electrical_management", "Electrical Management"]) &&
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
            isCategory(p.product_category, ["electrical_management", "Electrical Management"]) &&
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

      if (additionalItemsToInsert.length > 0) {
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