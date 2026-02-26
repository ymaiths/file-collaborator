import { useState, useEffect } from "react";
import { CreateNewItemRow } from "./CreateNewItemRow";
import { ListItemRow } from "./ListItemRow";
import { toast } from "@/hooks/use-toast";

interface Item {
  id: string;
  name: string;
  isSystem?: boolean;
}

interface ListManagementViewProps {
  title: string;
  items: Item[];
  createNewLabel: string;
  showCheckboxes?: boolean;
  newItemPlaceholder?: string;
  onItemClick?: (id: string, name: string) => void;
  onCreateNew?: (
    name: string,
    includeInPrice: boolean,
    isRequired: boolean
  ) => Promise<void>;
  onDeleteItem?: (id: string) => Promise<void>;
  onDuplicateItem?: (id: string) => Promise<void>;
}

export const ListManagementView = ({
  title,
  items: initialItems,
  createNewLabel,
  showCheckboxes = false,
  newItemPlaceholder,
  onItemClick,
  onCreateNew,
  onDeleteItem,
  onDuplicateItem,
}: ListManagementViewProps) => {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleRename = (id: string) => {
    toast({
      title: "Rename functionality",
      description: `Renaming item ${id} - will be implemented with database`,
    });
  };

  const handleDuplicate = async (id: string, name: string) => {
    if (onDuplicateItem) {
      try {
        await onDuplicateItem(id);
      } catch (error) {
        console.error("Duplicate failed", error);
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (onDeleteItem) {
      try {
        await onDeleteItem(id);
      } catch (error) {
        console.error("Delete failed", error);
      }
    }
  };

  const handleCreateNew = async (
    name: string,
    includeInPrice: boolean,
    isRequired: boolean
  ) => {
    if (onCreateNew) {
      await onCreateNew(name, includeInPrice, isRequired);
    }
  };

  const handleItemClick = (id: string, name: string) => {
    if (onItemClick) {
      onItemClick(id, name);
    } else {
      toast({
        title: "Navigation",
        description: `Opening detail page for ${id}`,
      });
    }
  };

  return (
    <div className="space-y-0">
      {items.map((item) => (
        <ListItemRow
          key={item.id}
          name={item.name}
          // 🌟 1. ส่งค่า undefined ไปถ้าไม่มีสิทธิ์ หรือเป็นหมวดหมู่ระบบ (System)
          onRename={(!onDeleteItem || item.isSystem) ? undefined : () => handleRename(item.id)}
          onDuplicate={!onDuplicateItem ? undefined : () => handleDuplicate(item.id, item.name)}
          onDelete={(!onDeleteItem || item.isSystem) ? undefined : () => handleDelete(item.id, item.name)}
          onClick={() => handleItemClick(item.id, item.name)}
        />
      ))}
      
      {/* 🌟 2. ซ่อนกล่องพิมพ์สร้างรายการใหม่ไปเลย ถ้าไม่มีสิทธิ์ (onCreateNew เป็น undefined) */}
      {onCreateNew && (
        <CreateNewItemRow
          label={createNewLabel}
          onCreate={handleCreateNew}
          showCheckboxes={showCheckboxes}
          placeholder={newItemPlaceholder}
        />
      )}
    </div>
  );
};