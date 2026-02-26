import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TabNavigationProps {
  activeTab: "quotation" | "database";
  onTabChange: (tab: "quotation" | "database") => void;
}

export const TabNavigation = ({
  activeTab,
  onTabChange,
}: TabNavigationProps) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  
  // 🌟 1. ดึง Role จากที่ระบบจำไว้
  const userRole = localStorage.getItem("userRole"); 
  const isAdmin = userRole === "admin"; // เช็คว่าเป็น Admin ไหม

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        setEmail(session.user.email.toLowerCase());
      }
    };
    checkUser();
  }, []);

  const handleLogout = async () => {
    localStorage.removeItem("userRole"); // ล้างความจำตอนออก
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="flex justify-between items-center mb-6 w-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full">
            <User className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56 mt-2">
          <DropdownMenuLabel className="font-normal text-muted-foreground truncate">
            {email || "กำลังโหลด..."}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* 🌟 2. ถ้าเป็น Admin ถึงจะเห็นเมนู "จัดการผู้ใช้งาน" */}
          {isAdmin && (
            <>
              <DropdownMenuItem 
                onClick={() => navigate("/users")} 
                className="cursor-pointer py-3 text-base"
              >
                จัดการผู้ใช้งาน
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          
          <DropdownMenuItem 
            onClick={handleLogout} 
            className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer py-3 text-base"
          >
            ออกจากระบบ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex gap-2">
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
    </div>
  );
};
