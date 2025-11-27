import { useState } from "react";
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
  onItemClick?: (id: string, name: string) => void;
  onCreateNew?: (name: string, includeInPrice: boolean, isRequired: boolean) => Promise<void>;
}

export const ListManagementView = ({
  title,
  items: initialItems,
  createNewLabel,
  showCheckboxes = false,
  onItemClick,
  onCreateNew,
}: ListManagementViewProps) => {
  const [items, setItems] = useState(initialItems);

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

  const handleDelete = (id: string, name: string) => {
    setItems(items.filter((item) => item.id !== id));
    toast({
      title: "Deleted",
      description: `${name} has been deleted`,
      variant: "destructive",
    });
  };

  const handleCreateNew = async (name: string, includeInPrice: boolean, isRequired: boolean) => {
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
        description: `Opening detail page for ${id} - will be implemented next`,
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
      <CreateNewItemRow label={createNewLabel} onCreate={handleCreateNew} showCheckboxes={showCheckboxes} />
    </div>
  );
};
