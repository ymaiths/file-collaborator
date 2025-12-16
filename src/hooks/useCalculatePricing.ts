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
    console.log("🚀 Starting Calculation...");

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

      // 2. ราคาเป้าหมาย (Target Price)
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

      let TOTAL_PROJECT_PRICE = 0;
      const priceData = matchedPrice as any;
      if (priceData.is_exact_price) {
        TOTAL_PROJECT_PRICE = priceData.price_exact || 0;
      } else {
        TOTAL_PROJECT_PRICE =
          (priceData.price_percentage || 0) * projectSizeWatt;
      }
      console.log(`💰 Target Price: ${TOTAL_PROJECT_PRICE.toLocaleString()}`);

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

        // คำนวณต้นทุน
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
        return item; // ถ้า Included ให้ข้ามไปก่อน (finalPrice ยังเป็น 0)
      });

      // =========================================================
      // Step 3: Markup Calculation
      // =========================================================
      const includedItems = items.filter((i) => i.isIncluded);

      const solarPanelInstallItem = includedItems.find(
        (i) => i.products?.product_category === "solar_panel"
      );
      const solarInstallCost = solarPanelInstallItem
        ? solarPanelInstallItem.costInst
        : 0;
      const totalIncludedCost = includedItems.reduce(
        (sum, item) => sum + item.costEq + item.costInst,
        0
      );

      const costBaseForMarkup = totalIncludedCost - solarInstallCost;
      const priceTargetForMarkup = TOTAL_PROJECT_PRICE - solarInstallCost;

      // ป้องกันการหารด้วย 0 หรือค่าติดลบ
      let markupRatio = 1;
      if (costBaseForMarkup > 0) {
        markupRatio = priceTargetForMarkup / costBaseForMarkup;
      }

      console.log("📊 Debug Markup:");
      console.log(
        `   - Total Included Cost: ${totalIncludedCost.toLocaleString()}`
      );
      console.log(`   - Cost Base: ${costBaseForMarkup.toLocaleString()}`);
      console.log(`   - Target Base: ${priceTargetForMarkup.toLocaleString()}`);
      console.log(`   - Ratio: ${markupRatio}`);

      // 3.1 Apply Markup
      items = items.map((item) => {
        if (item.isIncluded) {
          let priceEq = item.costEq * markupRatio;
          let priceInst = item.costInst * markupRatio;

          if (item.products?.product_category === "solar_panel") {
            priceInst = item.costInst;
          }
          return { ...item, finalPriceEq: priceEq, finalPriceInst: priceInst };
        }
        return item;
      });

      // 3.2 Rounding & Diff
      let currentSum = 0;
      let cableIndex = -1;

      items = items.map((item, index) => {
        if (item.isIncluded) {
          // เช็คชื่อสายไฟ
          const name = item.products?.name || "";
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
          } else {
            const roundedEq = roundToHundred(item.finalPriceEq);
            const roundedInst = roundToHundred(item.finalPriceInst);
            currentSum += roundedEq + roundedInst;
            return {
              ...item,
              finalPriceEq: roundedEq,
              finalPriceInst: roundedInst,
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
      // 🔍 FINAL CHECK ก่อนบันทึก (สำคัญมาก)
      // =========================================================
      const updates = items.map((item) => ({
        id: item.id,
        name: item.products?.name, // ใส่ชื่อมาดูใน log เฉยๆ
        cost: item.costEq, // ต้นทุน
        price: item.finalPriceEq, // ราคาขายที่จะบันทึก
        isIncluded: item.isIncluded,
      }));

      // กรองดูเฉพาะตัวที่เป็น Percent (พวกที่เคยเป็น 0)
      const problemItems = updates.filter(
        (u) => u.price === 0 || isNaN(u.price)
      );

      console.log("📋 PAYLOAD PREVIEW (Items that are 0 or NaN):");
      if (problemItems.length > 0) {
        console.table(problemItems); // ถ้ามีรายการไหนเป็น 0 จะโชว์ตรงนี้
        console.error("❌ พบสินค้าที่ราคายังเป็น 0 อยู่! เช็คตารางด้านบน");
      } else {
        console.log("✅ All items have price > 0. Ready to save.");
      }

      // =========================================================
      // Step 4: Update DB
      // =========================================================
      const finalUpdates = items.map((item) => ({
        id: item.id,
        product_price: isNaN(item.finalPriceEq) ? 0 : item.finalPriceEq, // กันเหนียว NaN
        installation_price: isNaN(item.finalPriceInst)
          ? 0
          : item.finalPriceInst,
      }));

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
        description: "ดู Console",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return { calculateAndSavePricing, isCalculating };
};
