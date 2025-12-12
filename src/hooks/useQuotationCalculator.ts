import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type InverterBrand = Database["public"]["Enums"]["inverter_brand"];

interface CalculationResult {
  price: number | null;
  unitPrice: number | null;
  isLoading: boolean;
  error: string | null;
  debugInfo?: string;
}

export const useQuotationCalculator = (
  kwSize: number | null,
  brand: string | null,
  programName: string | null
) => {
  const [result, setResult] = useState<CalculationResult>({
    price: null,
    unitPrice: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    const calculate = async () => {
      // 1. Check Inputs: ต้องมีครบทั้ง 3 ค่าถึงจะคำนวณได้แม่นยำ
      if (!kwSize || !brand || !programName) {
        setResult({
          price: null,
          unitPrice: null,
          isLoading: false,
          error: null,
        });
        return;
      }

      setResult((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // 2. [Step ใหม่] หา ID ของโปรแกรมการขาย จากชื่อ (programName)
        const { data: packageData, error: packageError } = await supabase
          .from("sale_packages")
          .select("id")
          .eq("sale_name", programName as any) // sale_name เป็น text แล้ว
          .maybeSingle();

        if (packageError) throw packageError;

        if (!packageData) {
          throw new Error(`ไม่พบโปรแกรมการขายชื่อ: ${programName}`);
        }

        // 3. ดึงราคาโดยอิงจาก Brand AND Program ID
        const { data: priceData, error: priceError } = await supabase
          .from("sale_package_prices")
          .select("*")
          .eq("inverter_brand", brand as InverterBrand)
          .eq("sale_package_id", packageData.id) // <--- [สำคัญ] กรองเฉพาะของโปรแกรมนี้
          .order("kw_min", { ascending: true });

        if (priceError) throw priceError;

        if (!priceData || priceData.length === 0) {
          throw new Error(
            `ไม่พบข้อมูลราคาสำหรับยี่ห้อ ${brand} ในโปรแกรม ${programName}`
          );
        }

        // 4. หาช่วงราคาที่ถูกต้อง (Range Matching)
        const matchedPrice = priceData.find((p) => {
          const minPass = p.kw_min <= kwSize;
          const maxPass = p.kw_max === null || p.kw_max >= kwSize;
          return minPass && maxPass;
        });

        if (!matchedPrice) {
          throw new Error(`ไม่อยู่ในช่วงราคาที่รองรับ (Size: ${kwSize}kW)`);
        }

        // 5. คำนวณราคา (Exact vs Formula)
        let finalPrice = 0;
        let unitPrice = 0;

        if (matchedPrice.is_exact_price) {
          // โหมดราคาเหมา
          finalPrice = matchedPrice.price_exact ?? matchedPrice.price ?? 0;
          unitPrice = kwSize > 0 ? finalPrice / (kwSize * 1000) : 0;
        } else {
          // โหมดสูตร c
          const c = matchedPrice.price_percentage ?? 0;
          finalPrice = c * kwSize * 1000;
          unitPrice = c;
        }

        setResult({
          price: finalPrice,
          unitPrice: unitPrice,
          isLoading: false,
          error: null,
          debugInfo: `Matched: ${matchedPrice.kw_min}-${
            matchedPrice.kw_max ?? "Max"
          } (${programName})`,
        });
      } catch (err) {
        console.error("Calculation Error:", err);
        setResult({
          price: null,
          unitPrice: null,
          isLoading: false,
          error:
            err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการคำนวณ",
        });
      }
    };

    const timeoutId = setTimeout(calculate, 500);
    return () => clearTimeout(timeoutId);
  }, [kwSize, brand, programName]);

  return result;
};
