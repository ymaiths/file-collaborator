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

export const useCalculatePricing = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Helper: ปัดเศษหาค่าใกล้เคียง 100 ที่สุด
  const roundNearestHundred = (num: number) => Math.round(num / 100) * 100;
  const round2 = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

  const calculateAndSavePricing = async (quotationId: string, manualTargetPrice?: number) => {
    setIsLoading(true);
    // console.clear();
    console.group("🚀 PRICING: DB-BASED TARGET OVERRIDE");

    try {
      // 1. Fetch Data
      const { data: quote, error: quoteError } = await supabase
        .from("quotations")
        .select(`*, sale_packages(*)`)
        .eq("id", quotationId)
        .single();
      if (quoteError || !quote) throw new Error("Quotation not found");

      const projectSizeWatt = quote.kw_size || 0;
      let TOTAL_PROJECT_PRICE = 0;

      // ตัวแปรเช็คว่าต้องอัปเดตค่า edited_price ลง DB ไหม
      let shouldUpdateEditedPrice = false;
      let newEditedPriceVal = quote.edited_price || 0;

      // =========================================================
      // 2. Determine Target Price (Priority: Manual Arg > DB Edited > Standard)
      // =========================================================
      
      // ✅ CASE A: มีการส่งค่ามาใหม่ (User พิมพ์แก้ Net Total) -> ให้ใช้ค่านั้น และเตรียมบันทึก
      if (manualTargetPrice !== undefined && manualTargetPrice !== null) {
          TOTAL_PROJECT_PRICE = manualTargetPrice;
          shouldUpdateEditedPrice = true;       // สั่งให้บันทึกลง DB ด้วย
          newEditedPriceVal = manualTargetPrice; 
          console.log(`🎯 MANUAL TARGET OVERRIDE: ${TOTAL_PROJECT_PRICE.toLocaleString()}`);
      } 
      // ✅ CASE B: ไม่ได้ส่งค่ามา แต่ใน DB มีค่าที่เคยแก้ไว้ (Edited Price) -> ให้ใช้ค่าเดิมจาก DB
      else if (quote.edited_price && quote.edited_price > 0) {
          TOTAL_PROJECT_PRICE = quote.edited_price;
          console.log(`🎯 TARGET FROM DB (SAVED): ${TOTAL_PROJECT_PRICE.toLocaleString()}`);
      } 
      // ✅ CASE C: ไม่เคยแก้อะไรเลย -> ใช้ราคา Standard
      else {
          const brand = quote.inverter_brand || "";
          const phase = quote.electrical_phase || "single_phase";
          const salePackageId = quote.sale_package_id;

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

          if (matchedPrice) {
              const priceData = matchedPrice as any;
              if (priceData.is_exact_price) {
                TOTAL_PROJECT_PRICE = priceData.price_exact || 0;
              } else {
                TOTAL_PROJECT_PRICE = Math.round((priceData.price_percentage || 0) * projectSizeWatt);
              }
          }
          console.log(`💰 DB STANDARD TARGET: ${TOTAL_PROJECT_PRICE.toLocaleString()}`);
      }

      // 3. Line Items
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
          costEq: 0,
          costInst: 0,
          isIncluded: false,
          finalPriceEq: item.product_price || 0,
          finalPriceInst: item.installation_price || 0,
          // ✅ รับค่า is_additional_item มาด้วย (default false)
          is_additional_item: item.is_additional_item ?? false 
        };
        if (!item.products) return baseItem;

        const { costEq, costInst } = calculateItemCost(baseItem, projectSizeWatt);
        const isIncluded = isIncludedItem(item.products, projectSizeWatt);

        return { ...baseItem, costEq, costInst, isIncluded };
      });

      // Helpers Classification
      const checkIsMajorItem = (product: Product | null) => {
          if (!product) return false;
          const cat = product.product_category || "";
          const name = product.name.toLowerCase();
          if (cat === "solar_panel" || cat === "inverter" || cat === "zero_export_smart_logger") return true;
          if (name.includes("optimizer") || name.includes("inverter")) return true;
          return false;
      };
      const checkIsMounting = (product: Product | null) => {
          if (!product) return false;
          const cat = product.product_category || "";
          return cat === "pv_mounting_structure" || product.name.toLowerCase().includes("mounting");
      };

      // =========================================================
      // Step 2: Identify Locked Price (Fixed vs Variable)
      // =========================================================
      let totalFixedPrice = 0;
      let totalVariableBaseCost = 0;

      items = items.map(item => {
          // ✅ CHECK POINT 1: Excluded OR Additional Item -> Fixed Price (Lock)
          if (!item.isIncluded || item.is_additional_item) {
              const finalEq = item.is_edited_product_price ? item.finalPriceEq : item.costEq;
              const finalInst = item.is_edited_installation_price ? item.finalPriceInst : item.costInst;
              
              totalFixedPrice += finalEq + finalInst;
              return { ...item, finalPriceEq: finalEq, finalPriceInst: finalInst };
          }
          return item;
      });

      // วนลูปเฉพาะตัวที่เป็น Standard Items (Included และไม่ใช่ Additional)
      items.filter(i => i.isIncluded && !i.is_additional_item).forEach(item => {
          const category = item.products?.product_category || "";
          
          // Check Equipment
          if (item.is_edited_product_price) totalFixedPrice += item.finalPriceEq;
          else totalVariableBaseCost += item.costEq;

          // Check Installation
          if (item.is_edited_installation_price) totalFixedPrice += item.finalPriceInst;
          else {
              const isNoMarkupInst = ["solar_panel", "pv_mounting_structure"].includes(category);
              if (isNoMarkupInst) totalFixedPrice += item.costInst;
              else totalVariableBaseCost += item.costInst;
          }
      });

      const remainingBudget = round2(TOTAL_PROJECT_PRICE - totalFixedPrice);
      
      // =========================================================
      // 🔄 ROUND 1: เกลี่ยทุกตัวเท่ากัน (Universal Dist.)
      // =========================================================
      console.group("🔄 Round 1: Universal Distribution");
      
      let ratio1 = 1;
      if (totalVariableBaseCost > 0) ratio1 = remainingBudget / totalVariableBaseCost;
      if (ratio1 < 0) ratio1 = 0;

      console.log(`Ratio 1: ${ratio1.toFixed(6)}`);

      let sumRound1 = 0;

      items = items.map(item => {
          // ✅ CHECK POINT 2: Skip Additional Items
          if (!item.isIncluded || item.is_additional_item) {
              sumRound1 += item.finalPriceEq + item.finalPriceInst;
              return item;
          }
          
          const product = item.products;
          const isMajor = checkIsMajorItem(product);
          const isMounting = checkIsMounting(product);
          const isNoMarkupInst = ["solar_panel", "pv_mounting_structure"].includes(product?.product_category || "");
          const qty = item.quantity || 1;

          // --- Equipment ---
          let finalEq = item.finalPriceEq;
          if (!item.is_edited_product_price) {
              const rawTotal = item.costEq * ratio1;
              if (isMajor) finalEq = roundNearestHundred(rawTotal / qty) * qty;
              else if (isMounting) finalEq = Math.round(rawTotal / qty) * qty;
              else finalEq = roundNearestHundred(rawTotal);
          }

          // --- Installation ---
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

      const diff1 = TOTAL_PROJECT_PRICE - sumRound1;
      console.log(`Sum R1: ${sumRound1.toLocaleString()} | Diff R1: ${diff1}`);
      console.groupEnd();

      // =========================================================
      // 🔄 ROUND 2: เกลี่ยเฉพาะตัว Qty < 100
      // =========================================================
      console.group("🔄 Round 2: Low Quantity Adjustment (<100)");
      
      if (diff1 !== 0) {
          const candidatesR2 = items.filter(item => 
              item.isIncluded && !item.is_additional_item && // ✅ Skip Add-on
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

               console.log(`Candidates: ${candidatesR2.length} items | Ratio 2: ${ratio2.toFixed(6)}`);

               items = items.map(item => {
                   if (!candidatesR2.find(c => c.id === item.id)) return item;

                   const qty = item.quantity || 1;
                   const isMajor = checkIsMajorItem(item.products);
                   const isMounting = checkIsMounting(item.products);

                   // Eq
                   if (!item.is_edited_product_price) {
                       const rawTotal = item.finalPriceEq * ratio2;
                       if (isMajor) item.finalPriceEq = roundNearestHundred(rawTotal / qty) * qty;
                       else if (isMounting) item.finalPriceEq = Math.round(rawTotal / qty) * qty;
                       else item.finalPriceEq = roundNearestHundred(rawTotal);
                   }
                   // Inst
                   if (!item.is_edited_installation_price) {
                       const isNoMarkup = ["solar_panel", "pv_mounting_structure"].includes(item.products?.product_category||"");
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
      const diff2 = round2(TOTAL_PROJECT_PRICE - sumRound2);
      console.log(`Sum R2: ${sumRound2.toLocaleString()} | Diff R2: ${diff2}`);
      console.groupEnd();

      // =========================================================
      // 🔄 ROUND 3: สายไฟรับจบ (Wire Dump)
      // =========================================================
      console.group("🔄 Round 3: Wire Adjustment (Final)");
      
      if (diff2 !== 0) {
          const wireIndex = items.findIndex(item => 
              item.isIncluded && !item.is_additional_item && // ✅ Skip Add-on
              !item.is_edited_product_price &&
              (item.products?.product_category === "cable" || (item.products?.name || "").includes("สายไฟ"))
          );
          
          if (wireIndex !== -1) {
              const item = items[wireIndex];
              if (diff2 < 0 && (item.finalPriceEq + diff2) < 0) {
                    const deductable = item.finalPriceEq;
                    item.finalPriceEq = 0;
                    const remainingDiff = diff2 + deductable;

                    // Emergency Spillover to Largest Item (Standard Only)
                    if (Math.abs(remainingDiff) > 1) {
                        const largestItem = items.reduce((prev, current) => 
                            (!current.is_edited_product_price && !current.is_additional_item && current.finalPriceEq > prev.finalPriceEq) ? current : prev
                        , items.find(i => !i.is_additional_item && !i.is_edited_product_price) || items[0]);
                        
                        if (largestItem) largestItem.finalPriceEq += remainingDiff;
                    }
               } else {
                    item.finalPriceEq += diff2;
                    console.log(`✅ Wire Adjusted by: ${diff2}`);
               }
          } else {
              // Fallback to Largest Item (Standard Only)
              const largestItem = items.reduce((prev, current) => 
                   (!current.is_edited_product_price && !current.is_additional_item && current.finalPriceEq > prev.finalPriceEq) ? current : prev
              , items.find(i => !i.is_additional_item && !i.is_edited_product_price) || items[0]);
              
              if (largestItem) {
                  largestItem.finalPriceEq += diff2;
                  console.log(`✅ Fallback Adjusted Largest Item by: ${diff2}`);
              }
          }
      }
      
      const finalSum = items.reduce((sum, i) => sum + i.finalPriceEq + i.finalPriceInst, 0);
      console.log(`Final Sum: ${finalSum.toLocaleString(undefined, {minimumFractionDigits: 2})} (Target: ${TOTAL_PROJECT_PRICE.toLocaleString(undefined, {minimumFractionDigits: 2})})`);
      console.groupEnd();

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

      // ✅ จุดที่แก้ไข: บันทึก edited_price ลง DB ด้วย
      const quoteUpdatePayload: any = { 
          updated_at: new Date().toISOString() 
      };

      if (shouldUpdateEditedPrice) {
          quoteUpdatePayload.edited_price = newEditedPriceVal;
          console.log("💾 Saving edited_price to DB:", newEditedPriceVal);
      }

      await supabase.from("quotations").update(quoteUpdatePayload).eq("id", quotationId);
      
      console.groupEnd();
      toast({ title: "คำนวณราคาสำเร็จ", description: `Updated Total: ${TOTAL_PROJECT_PRICE.toLocaleString()}` });

    } catch (error) {
      console.error("Pricing Error:", error);
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return { calculateAndSavePricing, isLoading };
};