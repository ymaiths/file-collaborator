import { useState, useEffect } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export interface SelectedProduct {
  id: string | null;
  name: string;
  isNew: boolean;
  brand?: string | null;
  unit?: string | null;
  min_kw?: number | null;
  max_kw?: number | null; 
  is_exact_kw?: boolean | null; 
  product_category?: string | null;
  is_fixed_cost?: boolean | null;
  cost_fixed?: number | null;
  cost_percentage?: number | null;
  is_fixed_installation_cost?: boolean | null;
  fixed_installation_cost?: number | null;
  installation_cost_percentage?: number | null;
}

interface ProductSelectorProps {
  onSelect: (product: SelectedProduct) => void;
  section: "A" | "B";
}

const formatDeviceSize = (prod: any) => {
  if (!prod || (prod.min_kw === null && prod.max_kw === null)) return null;
  
  const formatVal = (val: number | null) => {
      if (val === null) return "";
      return val >= 1000 ? `${val / 1000} kW` : `${val} W`;
  };

  if (prod.is_exact_kw || prod.min_kw === prod.max_kw || prod.max_kw === null) {
      return formatVal(prod.min_kw);
  } else {
      return `${formatVal(prod.min_kw)} - ${formatVal(prod.max_kw)}`;
  }
};

export function ProductSelector({ onSelect, section }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<any[]>([]); 
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select(`*`) 
        .order("name");
      
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between text-xs h-9 bg-white border-gray-400 text-gray-600"
        >
          <span className="flex items-center gap-2">
             <Plus className="h-3 w-3" /> เพิ่มรายการ...
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      {/* 🌟 1. ขยายความกว้างกล่องจาก 400px เป็น 550px เพื่อให้มีพื้นที่เพิ่มขึ้น */}
      <PopoverContent className="w-[550px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="พิมพ์เพื่อค้นหา (ชื่อ, หมวดหมู่, ยี่ห้อ, ขนาด...)" 
            onValueChange={setSearchQuery} 
          />
          <CommandList>
            <CommandEmpty className="py-3 px-3 text-center">
                <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                        onSelect({ id: null, name: searchQuery, isNew: true }); 
                        setOpen(false);
                    }}
                >
                    <Plus className="mr-1 h-3 w-3" /> สร้างรายการใหม่: "{searchQuery}"
                </Button>
            </CommandEmpty>
            <CommandGroup>
              {products.map((product) => {
                const sizeLabel = formatDeviceSize(product);
                const searchKey = `${product.name} ${product.product_category || ""} ${product.brand || ""} ${sizeLabel || ""}`;
                
                return (
                    <CommandItem
                    key={product.id}
                    value={searchKey}
                    onSelect={() => {
                        onSelect({ ...product, isNew: false });
                        setOpen(false);
                    }}
                    className="flex flex-col items-start gap-1 py-2 cursor-pointer border-b last:border-0"
                    >
                        {/* 🌟 2. ใช้ items-start และ gap-3 เพื่อจัดระเบียบใหม่ */}
                        <div className="flex items-start justify-between w-full gap-3">
                            {/* ให้ชื่อมีสิทธิ์ขึ้นบรรทัดใหม่ได้ถ้าที่บังคับ */}
                            <span className="font-medium leading-tight text-sm mt-0.5">{product.name}</span>
                            
                            {/* 🌟 3. ใส่ whitespace-nowrap และ shrink-0 บังคับห้ามตกบรรทัด ห้ามบีบเด็ดขาด */}
                            {sizeLabel && (
                              <Badge variant="secondary" className="text-[11px] h-6 px-2 whitespace-nowrap shrink-0">
                                {sizeLabel}
                              </Badge>
                            )}
                        </div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground uppercase mt-1">
                            {product.brand && <span>Brand: {product.brand}</span>}
                            {product.product_category && <span>Category: {product.product_category}</span>}
                        </div>
                    </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}