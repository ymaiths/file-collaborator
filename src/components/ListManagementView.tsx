import { useState, useEffect } from "react";
import { ListItemRow } from "./ListItemRow";
import { CreateNewItemRow } from "./CreateNewItemRow";
import { toast } from "@/hooks/use-toast";

interface Item {
  id: string;
  name: string;
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
}: ListManagementViewProps) => {
  const [items, setItems] = useState(initialItems);

  // [Fix] ซิงค์ข้อมูลเมื่อ Props เปลี่ยน (เช่น โหลดข้อมูลเสร็จแล้ว หรือมีการเพิ่มรายการใหม่)
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const handleRename = (id: string) => {
    toast({
      title: "Rename functionality",
      description: `Renaming item ${id} - will be implemented with database`,
    });
  };

  const handleDuplicate = (id: string, name: string) => {
    const newItem = {
      id: `${id}-copy-${Date.now()}`,
      name: `${name} (Copy)`,
    };
    setItems([...items, newItem]);
    toast({
      title: "Duplicated",
      description: `Created a copy of ${name}`,
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (onDeleteItem) {
      try {
        await onDeleteItem(id);
        // ไม่ต้อง setItems เอง เพราะ Parent จะส่ง props ใหม่มาและ useEffect จะทำงาน
      } catch (error) {
        console.error("Delete failed", error);
      }
    } else {
      // Fallback กรณีไม่มี Parent Handler (ทำงานแบบ Local)
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
      // ไม่ต้อง setItems เอง เพราะ useEffect ด้านบนจะทำงานเมื่อ parent ส่ง data ใหม่มา
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
          onDelete={() => handleDelete(item.id, item.name)}
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
