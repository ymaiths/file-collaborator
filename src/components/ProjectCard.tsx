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
  editedDate: string;
  createdDate: string;
}

export const ProjectCard = ({
  id,
  customerName,
  location,
  projectSize,
  price,
  salesProgramme,
  editedDate,
  createdDate,
}: ProjectCardProps) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/quotation/${id}`);
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
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>Duplicate</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
};
