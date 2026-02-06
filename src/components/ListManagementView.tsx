import { useState, useEffect } from "react";
import { ListItemRow } from "./ListItemRow";
import { CreateNewItemRow } from "./CreateNewItemRow";
import { toast } from "@/hooks/use-toast";

interface Item {
  id: string;
  name: string;
  isSystem?: boolean; // ✅ 1. เพิ่ม Optional Prop นี้
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
    } else {
      const newItem = {
        id: `${id}-copy-${Date.now()}`,
        name: `${name} (Copy)`,
      };
      setItems([...items, newItem]);
      toast({
        title: "Duplicated",
        description: `Created a copy of ${name}`,
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (onDeleteItem) {
      try {
        await onDeleteItem(id);
      } catch (error) {
        console.error("Delete failed", error);
      }
    } else {
      setItems(items.filter((item) => item.id !== id));
      toast({
        title: "Deleted",
        description: `${name} has been deleted`,
        variant: "destructive",
      });
    }
  };

  const handleCreateNew = async (
    name: string,
    includeInPrice: boolean,
    isRequired: boolean
  ) => {
    if (onCreateNew) {
      await onCreateNew(name, includeInPrice, isRequired);
    } else {
      const newItem = {
        id: `new-${Date.now()}`,
        name: name,
      };
      setItems([...items, newItem]);
      toast({
        title: "Created",
        description: `${name} has been created`,
      });
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
          onRename={() => handleRename(item.id)}
          onDuplicate={() => handleDuplicate(item.id, item.name)}
          
          // ✅ 2. เช็ค isSystem: ถ้าเป็น System Category ให้ส่ง undefined เพื่อซ่อน/Disable ปุ่มลบ
          // (หมายเหตุ: คุณต้องไปแก้ ListItemRow ให้รองรับการรับค่า undefined หรือรับ prop isLocked เพิ่ม ถ้าต้องการแสดงแม่กุญแจ)
          onDelete={item.isSystem ? undefined : () => handleDelete(item.id, item.name)}
          
          // หรือถ้า ListItemRow รับ prop 'isLocked' หรือ 'readOnly' ให้ส่งไปแบบนี้:
          // isLocked={item.isSystem} 
          
          onClick={() => handleItemClick(item.id, item.name)}
        />
      ))}
      <CreateNewItemRow
        label={createNewLabel}
        onCreate={handleCreateNew}
        showCheckboxes={showCheckboxes}
        placeholder={newItemPlaceholder}
      />
    </div>
  );
};