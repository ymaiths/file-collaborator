import { useState, useEffect, useRef } from "react";
import { Check, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface CustomerAutocompleteProps {
  value: string;
  onSelect: (customer: any) => void;
  onInputChange: (value: string) => void;
  onClear?: () => void;
}

export function CustomerAutocomplete({ value, onSelect, onInputChange, onClear }: CustomerAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // ✅ เพิ่มตัวช่วยจำ: เช็คว่าเพิ่งกดเลือกมาหรือเปล่า?
  const isSelectionRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- LOGIC การค้นหา (แก้ไขใหม่) ---
  useEffect(() => {
    // 1. ถ้าตัวอักษรน้อยไป ให้ปิด
    if (!inputValue || inputValue.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // ✅ 2. วิธีเช็คใหม่: ถ้าเป็นการ "กดเลือก" (isSelectionRef เป็น true) ให้หยุด ไม่ต้องค้นหา
    if (isSelectionRef.current) {
      isSelectionRef.current = false; // รีเซ็ตค่ารอรอบต่อไป
      return; 
    }
    if (inputValue === value && document.activeElement !== inputRef.current) {
        return; 
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        console.log("🚀 กำลังค้นหา:", inputValue); // Debug ดูว่ายิงออกไปไหม

        const { data, error } = await supabase.rpc("search_customers_fuzzy" as any, {
          keyword: inputValue,
        });

        if (error) {
          console.error("Search Error:", error);
        } else {
          console.log("✅ เจอ:", data); // Debug ดูผลลัพธ์
          setSuggestions((data as any[]) || []);
          if ((data as any[]).length > 0) {
            if (document.activeElement === inputRef.current) {
                setOpen(true);
             }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, value]); // เอา value ออกจาก dependency เพื่อลดการรันซ้ำซ้อน

  const handleSelect = (customer: any) => {
    // ✅ บอกระบบว่า "นี่คือการเลือกนะ ไม่ใช่การพิมพ์"
    isSelectionRef.current = true;
    
    setInputValue(customer.customer_name);
    setOpen(false);
    onSelect(customer);
  };

  const handleCreateNew = () => {
    isSelectionRef.current = true; // อันนี้ก็นับเป็นการเลือก
    setOpen(false);
    onSelect({ 
        id: null, 
        customer_name: inputValue, 
        id_tax: "", 
        address: "" 
    }); 
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder="Customer Name"
          value={inputValue}
          onChange={(e) => {
            const val = e.target.value;
            setInputValue(val);
            onInputChange(val);
            
            if (val === "" && onClear) {
                onClear();
                setOpen(false);
            }
          }}
          className="pr-8" 
        />
        
        {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        )}
      </div>

      {open && (inputValue.length >= 2) && (
        <div className="absolute top-full left-0 z-50 w-full mt-1 bg-popover text-popover-foreground rounded-md border shadow-md animate-in fade-in-0 zoom-in-95 overflow-hidden">
          <Command shouldFilter={false} className="bg-transparent">
             <CommandList>
                {!loading && suggestions.length === 0 && (
                   <div className="p-1">
                       <div 
                         onClick={handleCreateNew}
                         className="flex items-center gap-2 p-2 text-sm rounded-sm hover:bg-accent cursor-pointer text-primary transition-colors"
                       >
                           <Plus className="h-4 w-4" />
                           <span>ใช้ชื่อ: "{inputValue}" (ลูกค้าใหม่)</span>
                       </div>
                   </div>
                )}

                {!loading && suggestions.length > 0 && (
                   <CommandGroup heading="Suggestions">
                       {suggestions.map((customer) => (
                           <CommandItem
                               key={customer.id}
                               value={customer.customer_name}
                               onSelect={() => handleSelect(customer)}
                               className="cursor-pointer"
                           >
                               <div className="flex flex-col w-full">
                                   <div className="flex items-center justify-between">
                                       <span className="font-medium">{customer.customer_name}</span>
                                       {value === customer.customer_name && <Check className="h-4 w-4 text-green-500" />}
                                   </div>
                                   {customer.id_tax && (
                                       <span className="text-[10px] text-muted-foreground">
                                           Tax: {customer.id_tax}
                                       </span>
                                   )}
                               </div>
                           </CommandItem>
                       ))}
                   </CommandGroup>
                )}
             </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}