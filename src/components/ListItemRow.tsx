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
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClick?: () => void;
}

export const ListItemRow = ({
  name,
  onRename,
  onDuplicate,
  onDelete,
  onClick,
}: ListItemRowProps) => {
  return (
    <div className="flex items-center justify-between p-4 bg-card hover:bg-accent/50 transition-colors border-b border-border">
      <button
        onClick={onClick}
        className="flex-1 text-left text-base font-medium text-foreground hover:text-primary transition-colors"
      >
        {name}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>Duplicated</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            Deleted
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
