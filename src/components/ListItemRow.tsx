import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ListItemRowProps {
  name: string;
  onRename?: () => void;
  onDuplicate?: () => void; // 🌟 1. เติม ? เพื่อให้รับค่า undefined (ไม่มีสิทธิ์) ได้
  onDelete?: () => void; 
  onClick?: () => void;
}

export const ListItemRow = ({
  name,
  onRename,
  onDuplicate,
  onDelete,
  onClick,
}: ListItemRowProps) => {
  // 🌟 2. เช็คว่ามีสิทธิ์ทำอะไรสักอย่างไหม (ถ้าไม่มีเลย จะได้ซ่อนจุด 3 จุดไปเลย)
  const hasActions = !!onRename || !!onDuplicate || !!onDelete;

  return (
    <div className="flex items-center justify-between p-4 bg-card hover:bg-accent/50 transition-colors border-b border-border">
      <button
        onClick={onClick}
        className="flex-1 text-left text-base font-medium text-foreground hover:text-primary transition-colors"
      >
        {name}
      </button>
      
      {/* 🌟 3. โชว์เมนูจุด 3 จุด ก็ต่อเมื่อมีสิทธิ์ (hasActions = true) เท่านั้น */}
      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRename && (
              <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
            )}
            
            {/* 🌟 4. ครอบเงื่อนไขให้ปุ่ม Duplicate */}
            {onDuplicate && (
              <DropdownMenuItem onClick={onDuplicate}>Duplicate</DropdownMenuItem>
            )}

            {onDelete && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};