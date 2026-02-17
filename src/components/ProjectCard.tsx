import { MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface ProjectCardProps {
  id: string;
  customerName: string;
  location: string;
  projectSize: string;
  price: string;
  salesProgramme: string;
  note?: string | null;
  editedDate: string;
  createdDate: string;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export const ProjectCard = ({
  id,
  customerName,
  location,
  projectSize,
  price,
  salesProgramme,
  note,
  editedDate,
  createdDate,
  onDelete,
  onDuplicate,
}: ProjectCardProps) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/quotation/${id}`);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // ป้องกันไม่ให้คลิกที่ Card ไปด้วย
    onDelete(id);
  };

  const handleDuplicateClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // ป้องกันไม่ให้คลิกที่ Card ไปด้วย
    onDuplicate(id);
  };

  return (
    <Card 
      className="p-6 min-h-[280px] flex flex-col cursor-pointer hover:shadow-lg transition-shadow relative bg-card"
      onClick={handleCardClick}
    >
      <div className="flex-1">
        <h3 className="text-lg font-bold text-foreground mb-1">
          {customerName}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">{location}</p>

        <div className="space-y-2 mb-4">
          <p className="text-sm text-foreground font-medium">{projectSize}</p>
          <p className="text-sm text-foreground font-medium">{price}</p>
          <p className="text-xs text-muted-foreground">{salesProgramme}</p>
        </div>
        
        {note && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider whitespace-nowrap mt-0.5">
                Note:
              </span>
              <p className="text-xs text-foreground/80 line-clamp-2 break-words leading-relaxed" title={note}>
                {note}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Edited Date : {editedDate}</p>
        <p>Created Date : {createdDate}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute bottom-4 right-4 h-8 w-8"
            onClick={(e)=>e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDuplicateClick}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive cursor-pointer" onClick={handleDeleteClick}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
};
