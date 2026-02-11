import { useState, useEffect } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
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

export interface SelectedProduct {
  id: string | null;
  name: string;
  isNew: boolean;
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
  const [products, setProducts] = useState<any[]>([]); 
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("products")
        .select(`*`) // ดึงมาทั้งหมดเพื่อใช้ในงานคำนวณราคา
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
      <PopoverContent className="w-[400px] p-0" align="center">
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
                const showWatt = (product.min_kw || 0) >= 10;
                // ✅ 2. สร้าง Search Key สำหรับกรอง Name, Brand, Category, Spec
                const searchKey = `${product.name} ${product.product_category || ""} ${product.brand || ""} ${product.min_kw || ""}`;
                
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
                        <div className="flex items-center justify-between w-full">
                            <span className="font-medium">{product.name}</span>
                            {/* ✅ แสดง Watt พร้อมลูกน้ำเฉพาะที่ >= 10 */}
                            {showWatt && (
                              <Badge variant="secondary" className="text-[10px] h-5">
                                {Number(product.min_kw).toLocaleString()} Watt
                              </Badge>
                            )}
                        </div>
                        <div className="flex gap-2 text-[10px] text-muted-foreground uppercase">
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