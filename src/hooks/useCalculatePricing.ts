import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import {
  calculateItemCost,
  isIncludedItem,
  roundToHundred,
} from "@/utils/pricing-logic";

type Product = Database["public"]["Tables"]["products"]["Row"];
type DbLineItem = Database["public"]["Tables"]["product_line_items"]["Row"];

interface CalculatedLineItem extends DbLineItem {
  products: Product | null;
  costEq: number;
  costInst: number;
  isIncluded: boolean;
  finalPriceEq: number;
  finalPriceInst: number;
}

export const useCalculatePricing = () => {
  const [isCalculating, setIsCalculating] = useState(false);

  const calculateAndSavePricing = async (quotationId: string) => {
    setIsCalculating(true);
    console.clear();
    console.log("🚀 Starting Calculation (Force Integer Mode)...");

    try {
      // 1. ดึงข้อมูล
      const { data: quote, error: quoteError } = await supabase
        .from("quotations")
        .select(`*, sale_packages(*)`)
        .eq("id", quotationId)
        .single();
      if (quoteError || !quote) throw new Error("Quotation not found");

      const projectSizeWatt = quote.kw_size || 0;
      const brand = quote.inverter_brand || "";
      const phase = quote.electrical_phase || "single_phase";
      const salePackageId = quote.sale_package_id;

      // 2. ราคาเป้าหมาย
      const { data: priceList } = await supabase
        .from("sale_package_prices")
        .select("*")
        .eq("sale_package_id", salePackageId)
        .eq("inverter_brand", brand as any)
        .eq("electronic_phase", phase as any);

      const matchedPrice = priceList?.find((p) =>
        p.is_exact_kw
          ? p.kw_min === projectSizeWatt
          : (p.kw_min || 0) <= projectSizeWatt &&
            (p.kw_max || 0) >= projectSizeWatt
      );

      if (!matchedPrice) throw new Error("Price not found");

      let rawTargetPrice = 0;
      const priceData = matchedPrice as any;
      if (priceData.is_exact_price) {
        rawTargetPrice = priceData.price_exact || 0;
      } else {
        rawTargetPrice = (priceData.price_percentage || 0) * projectSizeWatt;
      }

      // ปัดเศษยอดรวมโครงการให้เป็นจำนวนเต็มทันที
      const TOTAL_PROJECT_PRICE = Math.round(rawTargetPrice);
      console.log(`💰 Target Price (Rounded): ${TOTAL_PROJECT_PRICE.toLocaleString()}`);

      // 3. ดึงสินค้า
      const { data: lineItems } = await supabase
        .from("product_line_items")
        .select(`*, products(*)`)
        .eq("quotation_id", quotationId);

      if (!lineItems) throw new Error("No items found");

      // =========================================================
      // Step 1: คำนวณต้นทุน (Cost)
      // =========================================================
      let items: CalculatedLineItem[] = lineItems.map((item) => {
        const baseItem = {
          ...item,
          products: item.products as Product | null,
          costEq: 0,
          costInst: 0,
          isIncluded: false,
          finalPriceEq: 0,
          finalPriceInst: 0,
        };
        if (!item.products) return baseItem;

        const { costEq, costInst } = calculateItemCost(
          baseItem,
          projectSizeWatt
        );
        const isIncluded = isIncludedItem(item.products, projectSizeWatt);

        return { ...baseItem, costEq, costInst, isIncluded };
      });

      // =========================================================
      // Step 2: Excluded Items
      // =========================================================
      items = items.map((item) => {
        if (!item.isIncluded) {
          // ถ้าไม่รวมใน Markup -> ขายเท่าทุน
          return {
            ...item,
            finalPriceEq: item.costEq,
            finalPriceInst: item.costInst,
          };
        }
        return item;
      });

      // =========================================================
      // Step 3: Markup Calculation
      // =========================================================
      const includedItems = items.filter((i) => i.isIncluded);
      
      // Helper function เช็คว่าเป็น Mounting Structure หรือไม่ (แบบยืดหยุ่น)
      const isMountingItem = (category: string) => {
         const cat = category.toLowerCase().trim();
         return cat.includes("mounting") || cat.includes("structure");
      };

      const excludedInstallItems = includedItems.filter((i) =>
        ["solar_panel", "pv_mounting_structure"].includes(
          i.products?.product_category || ""
        )
      );
      const excludedInstallCost = excludedInstallItems.reduce(
        (sum, i) => sum + i.costInst,
        0
      );

      const totalIncludedCost = includedItems.reduce(
        (sum, item) => sum + item.costEq + item.costInst,
        0
      );

      const costBaseForMarkup = totalIncludedCost - excludedInstallCost;
      const priceTargetForMarkup = TOTAL_PROJECT_PRICE - excludedInstallCost;

      let markupRatio = 1;
      if (costBaseForMarkup > 0) {
        markupRatio = priceTargetForMarkup / costBaseForMarkup;
      }

      // 3.1 Apply Markup
      items = items.map((item) => {
        if (item.isIncluded) {
          let priceEq = item.costEq * markupRatio;
          let priceInst = item.costInst * markupRatio;

          if (
            ["solar_panel", "pv_mounting_structure"].includes(
              item.products?.product_category || ""
            )
          ) {
            priceInst = item.costInst;
          }
          return { ...item, finalPriceEq: priceEq, finalPriceInst: priceInst };
        }
        return item;
      });

      // =========================================================
      // 3.2 Rounding & Diff
      // =========================================================
      let currentSum = 0;
      let cableIndex = -1;

      items = items.map((item, index) => {
        const category = item.products?.product_category || "";
        const name = item.products?.name || "";
        const isMounting = isMountingItem(category);

        if (item.isIncluded) {
          const isCable = name.includes("สายไฟ VCT") || name.includes("THW");

          if (isCable) {
            cableIndex = index;
            const roundedInst = roundToHundred(item.finalPriceInst);
            const rawEq = item.finalPriceEq; 
            currentSum += rawEq + roundedInst;
            return {
              ...item,
              finalPriceEq: rawEq,
              finalPriceInst: roundedInst,
            };
          } else if (isMounting) {
            // Mounting (Included)
            // Equipment: Round Unit Price to Integer -> * Quantity
            // Installation: Round Unit Cost to Integer -> * Quantity
            
            const quantity = item.quantity || 1;
            
            // Calculate Unit Price based on Total / Quantity
            const rawUnitEq = item.finalPriceEq / quantity;
            const rawUnitInst = item.finalPriceInst / quantity;

            // Round Unit Price
            const roundedUnitEq = Math.round(rawUnitEq);
            const roundedUnitInst = Math.round(rawUnitInst);

            // Recalculate Total
            const finalEq = roundedUnitEq * quantity;
            const finalInst = roundedUnitInst * quantity;

            currentSum += finalEq + finalInst;
            
            return {
              ...item,
              finalPriceEq: finalEq,
              finalPriceInst: finalInst,
            };
          } else if (category === "solar_panel") {
            // Solar Panel (Included)
            // Equipment: Round Unit Price to 100 -> * Quantity
            // Installation: Round Unit Cost to Integer -> * Quantity

            const quantity = item.quantity || 1;

            const rawUnitEq = item.finalPriceEq / quantity;
            const rawUnitInst = item.finalPriceInst / quantity;

            // Round Unit
            const roundedUnitEq = roundToHundred(rawUnitEq);
            const roundedUnitInst = Math.round(rawUnitInst);

            // Recalculate Total
            const finalEq = roundedUnitEq * quantity;
            const finalInst = roundedUnitInst * quantity;

            currentSum += finalEq + finalInst;

            return {
              ...item,
              finalPriceEq: finalEq,
              finalPriceInst: finalInst,
            };
          } else {
            // General Items -> Round Total to 100
            const roundedEq = roundToHundred(item.finalPriceEq);
            const roundedInst = roundToHundred(item.finalPriceInst);
            currentSum += roundedEq + roundedInst;
            return {
              ...item,
              finalPriceEq: roundedEq,
              finalPriceInst: roundedInst,
            };
          }
        } else {
            // Excluded Items
            if (isMounting) {
                 const quantity = item.quantity || 1;
                 const rawUnitEq = item.finalPriceEq / quantity;
                 const rawUnitInst = item.finalPriceInst / quantity;

                 const finalEq = Math.round(rawUnitEq) * quantity;
                 const finalInst = Math.round(rawUnitInst) * quantity;

                return {
                    ...item,
                    finalPriceEq: finalEq,
                    finalPriceInst: finalInst,
                };
            }
        }
        return item;
      });

      // Adjust Diff
      if (cableIndex !== -1) {
        const diff = TOTAL_PROJECT_PRICE - currentSum;
        items[cableIndex].finalPriceEq += diff;
      }

      // =========================================================
      // Step 4: Update DB
      // =========================================================
      const finalUpdates = items.map((item) => {
        let finalEq = isNaN(item.finalPriceEq) ? 0 : item.finalPriceEq;
        let finalInst = isNaN(item.finalPriceInst) ? 0 : item.finalPriceInst;
        
        // Safety check: ensure they are integers if not already handled
        finalEq = Math.round(finalEq);
        finalInst = Math.round(finalInst);

        return {
            id: item.id,
            product_price: finalEq,
            installation_price: finalInst,
        };
      });

      // 🔍 Log for verify
      console.log("📋 Final Payload to DB:", finalUpdates);

      await Promise.all(
        finalUpdates.map((update) =>
          supabase
            .from("product_line_items")
            .update({
              product_price: update.product_price,
              installation_price: update.installation_price,
            })
            .eq("id", update.id)
        )
      );

      await supabase
        .from("quotations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", quotationId);

      toast({
        title: "คำนวณราคาสำเร็จ",
        description: `ยอดรวม: ${TOTAL_PROJECT_PRICE.toLocaleString()} บาท`,
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "เกิดข้อผิดพลาดในการคำนวณ",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return { calculateAndSavePricing, isCalculating };
};