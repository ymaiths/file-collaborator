import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export const SearchBar = () => {
  return (
    <div className="relative max-w-full mb-8">
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
      <Input
        type="text"
        placeholder="ค้นหาโครงการ"
        className="pl-12 py-6 text-base bg-card border-border"
      />
    </div>
  );
};
