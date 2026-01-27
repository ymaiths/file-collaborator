import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
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

// ✅ 1. Update Interface to include ALL fields
export interface SelectedProduct {
  id: string | null;
  name: string;
  isNew: boolean;
  // Optional fields that come from DB
  brand?: string | null;
  unit?: string | null;
  min_kw?: number | null;
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

export function ProductSelector({ onSelect, section }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  // ✅ 2. Update State Type to allow all fields
  const [products, setProducts] = useState<any[]>([]); 
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select(`
          id, 
          name, 
          brand, 
          unit, 
          min_kw,
          product_category,
          is_fixed_cost,
          cost_fixed,
          cost_percentage,
          is_fixed_installation_cost,
          fixed_installation_cost,
          installation_cost_percentage
        `)
        .order("name");
      
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []); // Removed [open] dependency to prevent repeated fetches

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-xs h-9 bg-white border-gray-400 text-gray-600 hover:bg-blue-50"
        >
          <span className="flex items-center gap-2">
             <Plus className="h-3 w-3" /> เพิ่มรายการ...
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="center">
        <Command>
          <CommandInput 
            placeholder="ค้นหาชื่อสินค้า หรือ ยี่ห้อ..." 
            onValueChange={setSearchQuery} 
          />
          <CommandList>
            <CommandEmpty className="py-3 px-3 text-center">
                <p className="text-sm text-gray-500 mb-2">ไม่พบสินค้าในระบบ</p>
                <Button 
                    size="sm" 
                    variant="default"
                    className="w-full"
                    onClick={() => {
                        onSelect({ id: null, name: searchQuery, isNew: true }); 
                        setOpen(false);
                    }}
                >
                    <Plus className="mr-1 h-3 w-3" /> สร้างใหม่: "{searchQuery}"
                </Button>
            </CommandEmpty>
            <CommandGroup heading="เลือกจากรายการที่มีอยู่">
              {products.map((product) => {
                const searchKey = `${product.name} ${product.brand || ""} ${product.min_kw || ""}`;
                
                return (
                    <CommandItem
                    key={product.id}
                    value={searchKey}
                    onSelect={() => {
                        // ✅ 3. CRITICAL FIX: Spread the entire product object
                        // This passes cost_fixed, cost_percentage, etc. to the parent
                        onSelect({ 
                            ...product, 
                            isNew: false 
                        });
                        setOpen(false);
                    }}
                    className="flex flex-col items-start gap-1 py-2 cursor-pointer border-b last:border-0"
                    >
                        <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{product.name}</span>
                            {product.min_kw && <Badge variant="secondary" className="text-[10px] h-5">{product.min_kw} kW</Badge>}
                        </div>
                        {product.brand && (
                            <span className="text-xs text-muted-foreground">
                                Brand: <span className="text-primary font-semibold">{product.brand}</span>
                            </span>
                        )}
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