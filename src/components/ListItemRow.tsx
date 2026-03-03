import { useState } from "react";
import { MoreVertical, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ListItemRowProps {
  name: string;
  // 🌟 รับค่า newName กลับไปให้ฟังก์ชันแม่
  onRename?: (newName: string) => Promise<void>;
  onDuplicate?: () => void;
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
  const hasActions = !!onRename || !!onDuplicate || !!onDelete;
  
  // 🌟 State สำหรับจัดการโหมดแก้ไข
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(name);
  const [isSaving, setIsSaving] = useState(false);

  // 🌟 ฟังก์ชันบันทึกตอนกดติ๊กถูก หรือ Enter
  const handleSave = async () => {
    if (!editValue.trim() || editValue === name) {
      setIsEditing(false);
      return;
    }
    if (onRename) {
      setIsSaving(true);
      try {
        await onRename(editValue);
        setIsEditing(false);
      } finally {
        setIsSaving(false);
      }
    }
  };

  // 🌟 หน้าตาตอนกด Edit (เป็นช่อง Input)
  if (isEditing) {
    return (
      <div className="flex items-center justify-between p-3 bg-accent/30 border-b border-border">
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="flex-1 mr-4 h-9 bg-background"
          autoFocus
          disabled={isSaving}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setEditValue(name);
              setIsEditing(false);
            }
          }}
        />
        <div className="flex items-center gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => { setEditValue(name); setIsEditing(false); }} 
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
          <Button 
            size="icon" 
            className="h-8 w-8"
            onClick={handleSave} 
            disabled={isSaving}
          >
            {isSaving ? <span className="text-xs">...</span> : <Check className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    );
  }

  // 🌟 หน้าตาปกติ (เป็นปุ่มกด)
  return (
    <div className="flex items-center justify-between p-4 bg-card hover:bg-accent/50 transition-colors border-b border-border group">
      <button
        onClick={onClick}
        className="flex-1 text-left text-base font-medium text-foreground hover:text-primary transition-colors"
      >
        {name}
      </button>
      
      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-50 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRename && (
              <DropdownMenuItem onClick={() => { setEditValue(name); setIsEditing(true); }}>
                Rename
              </DropdownMenuItem>
            )}
            
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