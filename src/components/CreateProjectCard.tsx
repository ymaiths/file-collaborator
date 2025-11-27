import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";

export const CreateProjectCard = () => {
  const navigate = useNavigate();

  return (
    <Card 
      className="p-6 flex flex-col items-center justify-center min-h-[280px] cursor-pointer hover:shadow-lg transition-shadow bg-muted/30 border-2 border-dashed border-border hover:border-primary"
      onClick={() => navigate("/quotation/new")}
    >
      <div className="rounded-full bg-card w-24 h-24 flex items-center justify-center mb-4 shadow-sm">
        <Plus className="w-12 h-12 text-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-center">
        Created
        <br />
        New Project
      </h3>
    </Card>
  );
};
