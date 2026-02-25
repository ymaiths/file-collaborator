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
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.email) {
        const userEmail = session.user.email.toLowerCase();
        setEmail(userEmail);
        
        const isCompany = userEmail.endsWith("@ponix.co.th");
        const isVIP = ["yaimai2909@gmail.com", "yaimai2909@outlook.com", "thanaporn.sada@kmutt.ac.th"].includes(userEmail);
        setIsAdmin(isCompany || isVIP);
      }
    };
    checkUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    // เปลี่ยนมาใช้ justify-between เพื่อแยกฝั่งซ้าย (โปรไฟล์) และขวา (แท็บ) ออกจากกัน
    <div className="flex justify-between items-center mb-6 w-full">
      
      {/* ฝั่งซ้ายสุด: เมนูจัดการผู้ใช้งาน & โปรไฟล์ (ทำเป็นวงกลม) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/* เพิ่ม rounded-full เพื่อให้ปุ่มเป็นวงกลมสมบูรณ์ */}
          <Button variant="outline" size="icon" className="h-14 w-14 rounded-full">
            <User className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        {/* เปลี่ยน align เป็น start เพื่อให้เมนูกางลงมาตรงกับขอบซ้ายพอดี */}
        <DropdownMenuContent align="start" className="w-56 mt-2">
          <DropdownMenuLabel className="font-normal text-muted-foreground truncate">
            {email || "กำลังโหลด..."}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {isAdmin && (
            <>
              <DropdownMenuItem 
                onClick={() => navigate("/users")} 
                className="cursor-pointer py-3 text-base"
              >
                จัดการผู้มีสิทธิ์ใช้งาน
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

      {/* ฝั่งขวาสุด: แท็บเมนูหลัก */}
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