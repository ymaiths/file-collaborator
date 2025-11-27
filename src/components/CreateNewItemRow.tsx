import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

interface CreateNewItemRowProps {
  label: string;
  onCreate: (name: string, includeInPrice: boolean, isRequired: boolean) => void;
  showCheckboxes?: boolean;
}

export const CreateNewItemRow = ({ label, onCreate, showCheckboxes = false }: CreateNewItemRowProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [includeInPrice, setIncludeInPrice] = useState(false);
  const [isRequired, setIsRequired] = useState(false);

  const handleConfirm = () => {
    if (name.trim()) {
      onCreate(name, includeInPrice, isRequired);
      setName("");
      setIncludeInPrice(false);
      setIsRequired(false);
      setIsCreating(false);
    }
  };

  if (isCreating) {
    return (
      <div className="flex items-center gap-3 p-4 bg-card border-b border-border">
        <div className="w-6 h-6 rounded-full border-2 border-foreground flex items-center justify-center flex-shrink-0">
          <Plus className="h-4 w-4" />
        </div>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name Category"
          className="flex-1"
        />
        {showCheckboxes && (
          <>
            <div className="flex items-center gap-2">
              <Checkbox
                id="include-price"
                checked={includeInPrice}
                onCheckedChange={(checked) => setIncludeInPrice(checked as boolean)}
              />
              <label htmlFor="include-price" className="text-sm cursor-pointer">
                รวมในราคาขาย
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="required"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(checked as boolean)}
              />
              <label htmlFor="required" className="text-sm cursor-pointer">
                required
              </label>
            </div>
          </>
        )}
        <Button onClick={handleConfirm} size="sm">
          ตกลง
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setIsCreating(true)}
      className="flex items-center gap-3 p-4 bg-card hover:bg-accent/50 transition-colors border-b border-border w-full text-left"
    >
      <div className="w-6 h-6 rounded-full border-2 border-foreground flex items-center justify-center">
        <Plus className="h-4 w-4" />
      </div>
      <span className="text-base font-medium text-foreground">{label}</span>
    </button>
  );
};
