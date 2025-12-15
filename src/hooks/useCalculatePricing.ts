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
    // console.log("💰 Starting Price Calculation for:", quotationId);

    try {
      // 1. ดึงข้อมูล Quotation
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

      // 2. ดึงราคาขายรวม (Total Target Price)
      const { data: priceList, error: priceError } = await supabase
        .from("sale_package_prices")
        .select("*")
        .eq("sale_package_id", salePackageId)
        .eq("inverter_brand", brand as any)
        .eq("electronic_phase", phase as any);

      if (priceError) throw priceError;

      const matchedPrice = priceList?.find((p) => {
        if (p.is_exact_kw) {
          return p.kw_min === projectSizeWatt;
        } else {
          return (
            (p.kw_min || 0) <= projectSizeWatt &&
            (p.kw_max || 0) >= projectSizeWatt
          );
        }
      });

      if (!matchedPrice) {
        throw new Error(
          `ไม่พบราคาขายสำหรับเงื่อนไข: ${brand}, ${phase}, ${projectSizeWatt}W`
        );
      }

      // =========================================================
      // คำนวณราคาขายรวม (Total Project Price)
      // =========================================================
      let TOTAL_PROJECT_PRICE = 0;
      const priceData = matchedPrice as any;

      if (priceData.is_exact_price) {
        TOTAL_PROJECT_PRICE = priceData.price_exact || 0;
      } else {
        const pricePerUnit = priceData.price_percentage || 0;
        TOTAL_PROJECT_PRICE = pricePerUnit * projectSizeWatt;
      }

      // console.log(`💰 Final Target Price: ${TOTAL_PROJECT_PRICE.toLocaleString()}`);

      // 3. ดึงรายการสินค้า
      const { data: lineItems, error: itemsError } = await supabase
        .from("product_line_items")
        .select(`*, products(*)`)
        .eq("quotation_id", quotationId);

      if (itemsError || !lineItems) throw itemsError;

      // =========================================================
      // Step 1: คำนวณต้นทุน
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

        // ส่ง Watt เข้าไปคำนวณต้นทุน
        const { costEq, costInst } = calculateItemCost(
          baseItem,
          projectSizeWatt
        );
        const isIncluded = isIncludedItem(item.products, projectSizeWatt);

        return { ...baseItem, costEq, costInst, isIncluded };
      });

      // =========================================================
      // Step 2: Excluded Items (ขายเท่าทุน)
      // =========================================================
      items = items.map((item) => {
        if (!item.isIncluded) {
          return {
            ...item,
            finalPriceEq: item.costEq,
            finalPriceInst: item.costInst,
          };
        }
        return item;
      });

      // =========================================================
      // Step 3: Included Items (Markup Calculation)
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

      const markupRatio =
        costBaseForMarkup > 0 ? priceTargetForMarkup / costBaseForMarkup : 1;
      // console.log(`📊 Markup Ratio: ${markupRatio.toFixed(6)}`);

      // 3.1 Raw Price Calculation
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

      // 3.2 Rounding (ยกเว้น EQ สายไฟ)
      let currentSum = 0;
      let cableIndex = -1;

      items = items.map((item, index) => {
        if (item.isIncluded) {
          const isCable =
            item.products?.name.trim() === "สายไฟ VCT/THW" ||
            item.products?.name.includes("สายไฟ VCT/THW");

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

      // 3.3 Residual Adjustment
      const diff = TOTAL_PROJECT_PRICE - currentSum;

      if (cableIndex !== -1) {
        items[cableIndex].finalPriceEq += diff;
        // console.log(`✅ Adjusted Cable Price by ${diff}`);
      } else {
        if (Math.abs(diff) > 1) {
          // เตือนเฉพาะถ้ายอดไม่ตรง
          console.warn("⚠️ Warning: ไม่พบ 'สายไฟ VCT/THW' (Diff อาจตกหล่น)");
        }
      }

      // =========================================================
      // Step 4: Update DB
      // =========================================================
      const updates = items.map((item) => ({
        id: item.id,
        product_price: item.finalPriceEq,
        installation_price: item.finalPriceInst,
      }));

      await Promise.all(
        updates.map((update) =>
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
      console.error("Pricing Calculation Error:", error);
      toast({
        title: "เกิดข้อผิดพลาด",
        description:
          error instanceof Error ? error.message : "ไม่สามารถคำนวณราคาได้",
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return { calculateAndSavePricing, isCalculating };
};
