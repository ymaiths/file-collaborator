import { Button } from "@/components/ui/button";

interface TabNavigationProps {
  activeTab: "quotation" | "database";
  onTabChange: (tab: "quotation" | "database") => void;
}

export const TabNavigation = ({
  activeTab,
  onTabChange,
}: TabNavigationProps) => {
  return (
    <div className="flex gap-2 justify-end mb-6">
      <Button
        variant={activeTab === "quotation" ? "secondary" : "outline"}
        onClick={() => onTabChange("quotation")}
        className="px-6 py-5 text-base font-medium"
      >
        โครงการ
      </Button>
      <Button
        variant={activeTab === "database" ? "secondary" : "outline"}
        onClick={() => onTabChange("database")}
        className="px-6 py-5 text-base font-medium"
      >
        ฐานข้อมูล
      </Button>
    </div>
  );
};
