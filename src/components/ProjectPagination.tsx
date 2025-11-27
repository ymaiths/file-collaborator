import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export const ProjectPagination = () => {
  return (
    <div className="flex items-center justify-center gap-2 mt-8 py-6 bg-muted/30 rounded-lg">
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Button variant="ghost" size="sm" className="h-9 px-3">
        1
      </Button>
      <Button variant="ghost" size="sm" className="h-9 px-3">
        2
      </Button>
      <Button variant="ghost" size="sm" className="h-9 px-3">
        3
      </Button>
      
      <span className="px-2 text-muted-foreground">. . .</span>
      
      <Button variant="ghost" size="sm" className="h-9 px-3">
        4
      </Button>
      <Button variant="ghost" size="sm" className="h-9 px-3">
        5
      </Button>
      
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );
};
