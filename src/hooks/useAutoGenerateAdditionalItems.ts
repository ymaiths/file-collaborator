import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { determineOptimizerSize, calculateOptimizerQty } from "@/utils/additional-equipment-logic";

const isWithinRange = (p: any, size: number) => {
  const min = p.min_kw || 0;
  const max = p.max_kw === null ? Infinity : p.max_kw;
  return size >= min && size <= max;
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
      
      const brand = quote.inverter_brand?.toLowerCase().trim() || "";

      const { data: existingItems, error: itemsError } = await supabase
        .from("product_line_items")
        .select(`quantity, products (id, product_category, min_kw, max_kw, name)`)
        .eq("quotation_id", quotationId);

      if (itemsError) throw itemsError;

      const selectedPanelItem = existingItems?.find(item => item.products?.product_category === "STANDARD Solar Panel");
      const panelWatt = selectedPanelItem?.products?.min_kw || 0;
      const totalPanels = selectedPanelItem?.quantity || 0;

      const selectedInverterItem = existingItems?.find(
        (item) => item.products?.product_category === "STANDARD Inverter / Zero Export / Smart Logger" && !item.products?.name.toLowerCase().includes("logger")
      );
      const inverterKw = (selectedInverterItem?.products?.min_kw || 0) / 1000;

      const { data: allProducts, error: prodError } = await supabase.from("products").select("*");
      if (prodError || !allProducts) throw new Error("Failed to fetch products");

      const additionalItemsToInsert: any[] = [];
      const pushItem = (productId: string, qty: number) => {
        additionalItemsToInsert.push({
          quotation_id: quotationId,
          product_id: productId,
          quantity: qty,
          is_edited_product_price: false,
          is_edited_installation_price: false,
          is_edited_quantity: false,
        });
      };

      // =========================================================
      // 1. Optimizer (STANDARD Huawei Optimizer)
      // =========================================================
      if (brand.includes("optimizer")) {
        const targetOptSize = determineOptimizerSize(inverterKw, panelWatt);
        if (targetOptSize) {
          const optimizerProduct = allProducts.find((p) => p.product_category === "STANDARD Huawei Optimizer" && p.min_kw === targetOptSize);
          if (optimizerProduct) pushItem(optimizerProduct.id, calculateOptimizerQty(targetOptSize, totalPanels));
        }
      }

      // =========================================================
      // 2. Data-Driven Logic: กวาดหมวด Included / Excluded Price Items 🌟
      // =========================================================
      const dynamicCategories = ["STANDARD Included Price Items", "STANDARD Excluded Price Items"];
      
      const dynamicAddons = allProducts.filter((p) => {
          if (!dynamicCategories.includes(p.product_category)) return false;
          if (!isWithinRange(p, projectSizeWatt)) return false;

          // ยกเว้น Rapid Shutdown ต้องใช้ Inverter Huawei เท่านั้น
          if (p.name.toLowerCase().includes("rapid shutdown") && !brand.includes("huawei")) {
              return false;
          }

          return true;
      });

      // 🌟 คำนวณหาจำนวน (Quantity) 
      dynamicAddons.forEach(addon => {
          let qty = 1; // ค่าเริ่มต้นคือ 1
          
          // ถ้าเป็น Rapid Shutdown ให้เอาจำนวนแผงหาร 2 (ปัดเศษขึ้นเผื่อเป็นแผงคี่)
          if (addon.name.toLowerCase().includes("rapid shutdown")) {
              qty = Math.ceil(totalPanels / 2);
          }

          pushItem(addon.id, qty);
      });

      // =========================================================
      // FINAL: บันทึกลง Database
      // =========================================================
      if (additionalItemsToInsert.length > 0) {
        const { error: insertError } = await supabase.from("product_line_items").insert(additionalItemsToInsert);
        if (insertError) throw insertError;
        toast({ title: "เพิ่มอุปกรณ์เสริมเรียบร้อย", description: `เพิ่มรายการ: ${additionalItemsToInsert.length} รายการ` });
      }
    } catch (error) {
      console.error("Generate Additional Equipment Error:", error);
      toast({ title: "เกิดข้อผิดพลาด (Additional Item)", description: error instanceof Error ? error.message : "ไม่สามารถสร้างรายการอุปกรณ์เพิ่มเติมได้", variant: "destructive" });
    } finally {
      setIsGeneratingAdditional(false);
    }
  };

  return { generateAdditionalEquipment, isGeneratingAdditional };
};