import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import {
  calculateItemCost,
  isIncludedItem,
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

// ✅ Interface to handle all 3 edit cases
interface PricingOverrides {
  manualNetTotal?: number;   // Target Net Total (Sum of Items)
  manualGrandTotal?: number; // Target Grand Total (Net - Discount + VAT)
  manualDiscount?: number;   // Target Discount
}

export const useCalculatePricing = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Helper: Rounding
  const roundNearestHundred = (num: number) => Math.round(num / 100) * 100;
  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const calculateAndSavePricing = async (
      quotationId: string, 
      overrides: PricingOverrides = {} // ✅ Accepts object for flexibility
  ) => {
    setIsLoading(true);
    // console.clear();
    console.group("🚀 PRICING: UNIFIED LOGIC (Net / Grand / Discount)");

    try {
      // 1. Fetch Data
      const { data: quote, error: quoteError } = await supabase
        .from("quotations")
        .select(`*, sale_packages(*)`)
        .eq("id", quotationId)
        .single();
      if (quoteError || !quote) throw new Error("Quotation not found");

      const projectSizeWatt = quote.kw_size || 0;
      const VAT_RATE = 0.07;

      // =========================================================
      // 2. Determine "DISCOUNT"
      // =========================================================
      let CURRENT_DISCOUNT = quote.edited_discount || 0;
      let shouldUpdateDiscount = false;

      // If manual discount is provided, use it
      if (overrides.manualDiscount !== undefined && overrides.manualDiscount !== null) {
          CURRENT_DISCOUNT = overrides.manualDiscount;
          shouldUpdateDiscount = true;
          console.log(`📉 NEW DISCOUNT: ${CURRENT_DISCOUNT.toLocaleString()}`);
      }

      // =========================================================
      // 3. Determine "TARGET NET TOTAL" (Sum of Items)
      // =========================================================
      let TARGET_NET_TOTAL = 0;
      let GOAL_GRAND_TOTAL = 0; // Calculated for verification/logging

      // 🟢 CASE A: User Edited "Grand Total"
      // Formula: Net = (Grand / 1.07) + Discount
      if (overrides.manualGrandTotal !== undefined && overrides.manualGrandTotal !== null) {
          GOAL_GRAND_TOTAL = overrides.manualGrandTotal;
          const priceBeforeVat = GOAL_GRAND_TOTAL / (1 + VAT_RATE);
          TARGET_NET_TOTAL = round2(priceBeforeVat + CURRENT_DISCOUNT);
          console.log(`🔄 Reverse Calc: Grand(${GOAL_GRAND_TOTAL.toLocaleString()}) -> Net(${TARGET_NET_TOTAL.toLocaleString()})`);
      }
      // 🔵 CASE B: User Edited "Net Total"
      // Formula: Grand = (Net - Discount) * 1.07
      else if (overrides.manualNetTotal !== undefined && overrides.manualNetTotal !== null) {
          TARGET_NET_TOTAL = overrides.manualNetTotal;
          GOAL_GRAND_TOTAL = (TARGET_NET_TOTAL - CURRENT_DISCOUNT) * (1 + VAT_RATE);
          console.log(`➡️ Direct Input: Net(${TARGET_NET_TOTAL.toLocaleString()})`);
      }
      // 🟡 CASE C: No Price Edit (e.g., only Discount changed or re-calc) -> Use Saved DB Net Total
      else {
          // We agreed that 'edited_price' in DB stores 'Net Total'
          TARGET_NET_TOTAL = quote.edited_price || 0;
          
          // Safety: If DB is 0 (New Quote), calculate Standard Price
          if (TARGET_NET_TOTAL === 0) {
              const brand = quote.inverter_brand || "";
              const phase = quote.electrical_phase || "single_phase";
              const { data: priceList } = await supabase.from("sale_package_prices").select("*")
                  .eq("sale_package_id", quote.sale_package_id).eq("inverter_brand", brand as any).eq("electronic_phase", phase as any);
              const matchedPrice = priceList?.find((p) => p.is_exact_kw ? p.kw_min === projectSizeWatt : (p.kw_min||0) <= projectSizeWatt && (p.kw_max||0) >= projectSizeWatt);
              
              if (matchedPrice) {
                  const pData = matchedPrice as any;
                  TARGET_NET_TOTAL = pData.is_exact_price ? (pData.price_exact||0) : Math.round((pData.price_percentage||0) * projectSizeWatt);
              }
          }
          
          // Recalculate Grand Total based on this preserved Net Total
          GOAL_GRAND_TOTAL = (TARGET_NET_TOTAL - CURRENT_DISCOUNT) * (1 + VAT_RATE);
          console.log(`⏹️ Keep Current Net: ${TARGET_NET_TOTAL.toLocaleString()}`);
      }

      console.log(`🧮 CALCULATION SUMMARY:`);
      console.log(`   Target Net Total (Items): ${TARGET_NET_TOTAL.toLocaleString()}`);
      console.log(`   - Discount: ${CURRENT_DISCOUNT.toLocaleString()}`);
      console.log(`   * VAT 7%: ${((TARGET_NET_TOTAL - CURRENT_DISCOUNT) * VAT_RATE).toLocaleString()}`);
      console.log(`   = Grand Total: ${GOAL_GRAND_TOTAL.toLocaleString()}`);

      // 4. Line Items Processing (Target = TARGET_NET_TOTAL)
      const { data: lineItems } = await supabase
        .from("product_line_items")
        .select(`*, products(*)`)
        .eq("quotation_id", quotationId);

      if (!lineItems) throw new Error("No items found");

      // =========================================================
      // Step 1: Base Cost Setup
      // =========================================================
      let items: CalculatedLineItem[] = lineItems.map((item) => {
        const baseItem = {
          ...item,
          products: item.products as Product | null,
          costEq: 0, costInst: 0, isIncluded: false,
          finalPriceEq: item.product_price || 0,
          finalPriceInst: item.installation_price || 0,
          is_additional_item: item.is_additional_item ?? false 
        };
        if (!item.products) return baseItem;
        const { costEq, costInst } = calculateItemCost(baseItem, projectSizeWatt);
        const isIncluded = isIncludedItem(item.products, projectSizeWatt);
        return { ...baseItem, costEq, costInst, isIncluded };
      });
      
      const checkIsMajorItem = (product: Product | null) => { 
          if (!product) return false;
          const cat = product.product_category || "";
          const name = product.name.toLowerCase();
          if (cat === "STANDARD Solar Panel" || cat === "STANDARD Inverter / Zero Export / Smart Logger" || cat === "zero_export_smart_logger") return true;
          if (name.includes("STANDARD Huawei Optimizer") || name.includes("STANDARD Inverter / Zero Export / Smart Logger")) return true;
          return false;
      };
      const checkIsMounting = (product: Product | null) => {
          if (!product) return false;
          const cat = product.product_category || "";
          return cat === "STANDARD PV Mounting Structure" || product.name.toLowerCase().includes("mounting");
      };

      // Step 2: Identify Locked Price
      let totalFixedPrice = 0;
      let totalVariableBaseCost = 0;

      items = items.map(item => {
          if (!item.isIncluded || item.is_additional_item) {
              const finalEq = item.is_edited_product_price ? item.finalPriceEq : item.costEq;
              const finalInst = item.is_edited_installation_price ? item.finalPriceInst : item.costInst;
              totalFixedPrice += finalEq + finalInst;
              return { ...item, finalPriceEq: finalEq, finalPriceInst: finalInst };
          }
          return item;
      });

      items.filter(i => i.isIncluded && !i.is_additional_item).forEach(item => {
          const category = item.products?.product_category || "";
          if (item.is_edited_product_price) totalFixedPrice += item.finalPriceEq;
          else totalVariableBaseCost += item.costEq;

          if (item.is_edited_installation_price) totalFixedPrice += item.finalPriceInst;
          else {
              const isNoMarkupInst = ["STANDARD Solar Panel", "STANDARD PV Mounting Structure"].includes(category);
              if (isNoMarkupInst) totalFixedPrice += item.costInst;
              else totalVariableBaseCost += item.costInst;
          }
      });

      // ✅ Use TARGET_NET_TOTAL as the budget
      const remainingBudget = round2(TARGET_NET_TOTAL - totalFixedPrice);

      // =========================================================
      // 🔄 ROUND 1: Universal Distribution
      // =========================================================
      let ratio1 = 1;
      if (totalVariableBaseCost > 0) ratio1 = remainingBudget / totalVariableBaseCost;
      if (ratio1 < 0) ratio1 = 0;
      
      let sumRound1 = 0;
      items = items.map(item => {
          if (!item.isIncluded || item.is_additional_item) {
              sumRound1 += item.finalPriceEq + item.finalPriceInst;
              return item;
          }
          const product = item.products;
          const isMajor = checkIsMajorItem(product);
          const isMounting = checkIsMounting(product);
          const isNoMarkupInst = ["STANDARD Solar Panel", "STANDARD PV Mounting Structure"].includes(product?.product_category || "");
          const qty = item.quantity || 1;

          let finalEq = item.finalPriceEq;
          if (!item.is_edited_product_price) {
              const rawTotal = item.costEq * ratio1;
              if (isMajor) finalEq = roundNearestHundred(rawTotal / qty) * qty;
              else if (isMounting) finalEq = Math.round(rawTotal / qty) * qty;
              else finalEq = roundNearestHundred(rawTotal);
          }

          let finalInst = item.finalPriceInst;
          if (!item.is_edited_installation_price) {
              const rawTotalInst = isNoMarkupInst ? item.costInst : (item.costInst * ratio1);
              if (isMajor) finalInst = roundNearestHundred(rawTotalInst / qty) * qty;
              else if (isMounting) finalInst = Math.round(rawTotalInst / qty) * qty;
              else finalInst = roundNearestHundred(rawTotalInst);
          }
          sumRound1 += finalEq + finalInst;
          return { ...item, finalPriceEq: finalEq, finalPriceInst: finalInst };
      });

      const diff1 = TARGET_NET_TOTAL - sumRound1;

      // =========================================================
      // 🔄 ROUND 2: Low Quantity Adjustment
      // =========================================================
      if (diff1 !== 0) {
          const candidatesR2 = items.filter(item => 
              item.isIncluded && !item.is_additional_item &&
              (!item.is_edited_product_price || !item.is_edited_installation_price) &&
              (item.quantity || 1) < 100 
          );
          const currentSumCandidates = candidatesR2.reduce((sum, item) => {
              let s = 0;
              if (!item.is_edited_product_price) s += item.finalPriceEq;
              if (!item.is_edited_installation_price) s += item.finalPriceInst;
              return sum + s;
          }, 0);

          if (candidatesR2.length > 0 && currentSumCandidates > 0) {
               let ratio2 = (currentSumCandidates + diff1) / currentSumCandidates;
               if (ratio2 < 0) ratio2 = 0;
               items = items.map(item => {
                   if (!candidatesR2.find(c => c.id === item.id)) return item;
                   const qty = item.quantity || 1;
                   const isMajor = checkIsMajorItem(item.products);
                   const isMounting = checkIsMounting(item.products);

                   if (!item.is_edited_product_price) {
                       const rawTotal = item.finalPriceEq * ratio2;
                       if (isMajor) item.finalPriceEq = roundNearestHundred(rawTotal / qty) * qty;
                       else if (isMounting) item.finalPriceEq = Math.round(rawTotal / qty) * qty;
                       else item.finalPriceEq = roundNearestHundred(rawTotal);
                   }
                   if (!item.is_edited_installation_price) {
                       const isNoMarkup = ["STANDARD Solar Panel", "STANDARD PV Mounting Structure"].includes(item.products?.product_category||"");
                       if (!isNoMarkup) {
                           const rawTotal = item.finalPriceInst * ratio2;
                           if (isMajor) item.finalPriceInst = roundNearestHundred(rawTotal / qty) * qty;
                           else if (isMounting) item.finalPriceInst = Math.round(rawTotal / qty) * qty;
                           else item.finalPriceInst = roundNearestHundred(rawTotal);
                       }
                   }
                   return item;
               });
          }
      }
      const sumRound2 = items.reduce((sum, i) => sum + i.finalPriceEq + i.finalPriceInst, 0);
      const diff2 = round2(TARGET_NET_TOTAL - sumRound2);

      // =========================================================
      // 🔄 ROUND 3: Wire Adjustment (Final)
      // =========================================================
      if (diff2 !== 0) {
          const wireIndex = items.findIndex(item => 
              item.isIncluded && !item.is_additional_item &&
              !item.is_edited_product_price &&
              (item.products?.product_category === "STANDARD Cable" || (item.products?.name || "").includes("สายไฟ"))
          );
          
          if (wireIndex !== -1) {
              const item = items[wireIndex];
              if (diff2 < 0 && (item.finalPriceEq + diff2) < 0) {
                    const deductable = item.finalPriceEq;
                    item.finalPriceEq = 0;
                    const remainingDiff = diff2 + deductable;
                    if (Math.abs(remainingDiff) > 1) {
                        const largestItem = items.reduce((prev, current) => 
                            (!current.is_edited_product_price && !current.is_additional_item && current.finalPriceEq > prev.finalPriceEq) ? current : prev
                        , items.find(i => !i.is_additional_item && !i.is_edited_product_price) || items[0]);
                        if (largestItem) largestItem.finalPriceEq += remainingDiff;
                    }
               } else {
                    item.finalPriceEq += diff2;
               }
          } else {
              const largestItem = items.reduce((prev, current) => 
                   (!current.is_edited_product_price && !current.is_additional_item && current.finalPriceEq > prev.finalPriceEq) ? current : prev
              , items.find(i => !i.is_additional_item && !i.is_edited_product_price) || items[0]);
              if (largestItem) largestItem.finalPriceEq += diff2;
          }
      }
      
      const finalSum = items.reduce((sum, i) => sum + i.finalPriceEq + i.finalPriceInst, 0);
      console.log(`🏁 Final Net Total: ${finalSum.toLocaleString()} (Target: ${TARGET_NET_TOTAL.toLocaleString()})`);

      // =========================================================
      // 4. Save Updates
      // =========================================================
      const finalUpdates = items.map((item) => ({
            id: item.id,
            product_price: round2(item.finalPriceEq), 
            installation_price: round2(item.finalPriceInst),
      }));

      await Promise.all(
        finalUpdates.map((update) =>
          supabase.from("product_line_items").update(update).eq("id", update.id)
        )
      );

      await supabase.from("quotations").update({
          updated_at: new Date().toISOString(),
          edited_price: TARGET_NET_TOTAL,   // ✅ Net Total preserved
          edited_discount: CURRENT_DISCOUNT  // ✅ Discount preserved
      }).eq("id", quotationId);
      
      toast({ title: "Updated", description: `Net: ${TARGET_NET_TOTAL.toLocaleString()} | Disc: ${CURRENT_DISCOUNT.toLocaleString()}` });

    } catch (error) {
      console.error("Pricing Error:", error);
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return { calculateAndSavePricing, isLoading };
};