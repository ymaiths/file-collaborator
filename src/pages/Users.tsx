import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, UserPlus, Loader2, ArrowLeft, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// 🌟 Import UI Select Component เข้ามาใช้งาน
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type AllowedUser = {
  id: string;
  email: string;
  note?: string;
  role: "admin" | "general" | "viewer" | "suspended";
};

export default function Users() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "general" | "viewer" | "suspended">("viewer"); 
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const role = localStorage.getItem("userRole");
    
    if (role !== "admin") {
      toast({ variant: "destructive", title: "ไม่มีสิทธิ์", description: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการผู้ใช้งานได้" });
      navigate("/");
    } else {
      fetchUsers(); 
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("allowed_users").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      setUsers(data as AllowedUser[] || []);
    } catch (error: any) {
      console.error("Error fetching users:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes("@")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("allowed_users").insert([
        { email: newEmail.toLowerCase().trim(), role: newRole as AllowedUser["role"] }
      ]);
      if (error) throw error;
      
      toast({ title: "เพิ่มผู้ใช้งานสำเร็จ!" });
      setNewEmail("");
      setNewRole("viewer");
      fetchUsers(); 
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId: string, currentRole: string, nextRole: string) => {
    if (currentRole === nextRole) return; 

    // 🛡️ Guardrail: เช็ค Admin คนสุดท้าย
    if (currentRole === "admin" && nextRole !== "admin") {
        const adminCount = users.filter(u => u.role === "admin").length;
        if (adminCount <= 1) {
            toast({ 
                variant: "destructive", 
                title: "ไม่อนุญาต", 
                description: "ระบบต้องมี Admin อย่างน้อย 1 คนเสมอ คุณไม่สามารถลดขั้น Admin คนสุดท้ายได้" 
            });
            return;
        }
    }

    // Optimistic Update
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.id === userId ? { ...user, role: nextRole as AllowedUser["role"] } : user
      )
    );

    try {
      const { data, error } = await supabase
        .from("allowed_users")
        .update({ role: nextRole as AllowedUser["role"] })
        .eq("id", userId)
        .select();
        
      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("บันทึกไม่สำเร็จ! ไม่ได้รับสิทธิ์แก้ไขฐานข้อมูล");
      }
      
      toast({ title: "อัปเดตสิทธิ์สำเร็จ!" });
      
    } catch (error: any) {
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId ? { ...user, role: currentRole as AllowedUser["role"] } : user
        )
      );
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    }
  };

  const handleDelete = async (id: string, emailToDelete: string, currentRole: string) => {
    // 🛡️ Guardrail: ห้ามลบ Admin คนสุดท้าย
    if (currentRole === "admin") {
        const adminCount = users.filter(u => u.role === "admin").length;
        if (adminCount <= 1) {
            toast({ 
                variant: "destructive", 
                title: "ไม่อนุญาต", 
                description: "ไม่สามารถลบ Admin คนสุดท้ายออกจากระบบได้" 
            });
            return;
        }
    }

    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${emailToDelete} ออกจากระบบ?`)) return;

    setLoading(true);
    try {
      // 🌟 เติม .select() เพื่อเช็คว่าลบสำเร็จจริงๆ ไม่ได้โดน RLS บล็อก
      const { data, error } = await supabase
        .from("allowed_users")
        .delete()
        .eq("id", id)
        .select(); 
        
      if (error) throw error;

      // ถ้า data ว่างเปล่า แปลว่าโดนฐานข้อมูลบล็อกไม่ให้ลบ
      if (!data || data.length === 0) {
        throw new Error("ลบไม่สำเร็จ! ไม่ได้รับสิทธิ์แก้ไขฐานข้อมูล (RLS Policy)");
      }
      
      toast({ title: "ลบผู้ใช้งานสำเร็จ!" });
      fetchUsers(); 
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("userRole");
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getSelectStyle = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200';
      case 'general': return 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200';
      case 'suspended': return 'bg-orange-100 text-orange-800 border-orange-200 hover:bg-orange-200';
      case 'viewer':
      default: return 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="p-8 max-w-5xl mx-auto">
        
        <div className="flex justify-between items-center mb-1">
          <Button variant="ghost" onClick={() => navigate("/")} className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-6">ตั้งค่าผู้ใช้งานระบบ (User Management)</h1>
        
        <form onSubmit={handleAddUser} className="flex flex-wrap md:flex-nowrap gap-3 mb-8 bg-card p-6 rounded-xl border shadow-sm">
          <Input 
            type="email" 
            placeholder="กรอกอีเมลที่ต้องการให้สิทธิ์..." 
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            className="flex-1 min-w-[200px]"
          />
          
          <SelectRoleDropdown value={newRole} onChange={setNewRole} />

          <Button type="submit" disabled={loading} className="w-full md:w-auto">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
            เพิ่มสิทธิ์
          </Button>
        </form>

        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 bg-muted/50 p-4 font-semibold text-muted-foreground border-b">
            <div className="col-span-7 md:col-span-8">อีเมล (Email)</div>
            <div className="col-span-4 md:col-span-3 text-center">ระดับสิทธิ์ (Role)</div>
            <div className="col-span-1 text-center">ลบ</div>
          </div>
          
          {loading && users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">ยังไม่มีรายชื่อในระบบ</div>
          ) : (
            <div className="divide-y">
              {users.map((user) => (
                <div key={user.id} className="grid grid-cols-12 p-4 items-center hover:bg-muted/30 transition-colors">
                  <div className="col-span-7 md:col-span-8 font-medium truncate pr-4 text-sm md:text-base">{user.email}</div>
                  
                  {/* 🌟 อัปเกรดเป็น Select Component ของระบบ */}
                  <div className="col-span-4 md:col-span-3 flex justify-center">
                    <Select 
                      value={user.role} 
                      onValueChange={(value) => handleUpdateRole(user.id, user.role, value)}
                    >
                      <SelectTrigger 
                        className={`h-8 w-[115px] text-xs font-semibold rounded-full border border-transparent shadow-none focus:ring-2 focus:ring-offset-1 transition-colors ${getSelectStyle(user.role)}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-1 text-center pl-2 md:pl-0">
                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleDelete(user.id, user.email, user.role)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 🌟 1. ระบุ Type ของ val ให้ตรงกับ State ไปเลย
function SelectRoleDropdown({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (val: "admin" | "general" | "viewer" | "suspended") => void; 
}) {
  return (
    // 🌟 2. ใช้ as แคสต์ค่าที่จะส่งกลับให้เป็น Type ที่ถูกต้อง
    <Select value={value} onValueChange={(val) => onChange(val as "admin" | "general" | "viewer" | "suspended")}>
      <SelectTrigger className="flex h-10 w-[180px] bg-background">
        <SelectValue placeholder="เลือกระดับสิทธิ์" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="viewer">Viewer (อ่านอย่างเดียว)</SelectItem>
        <SelectItem value="general">General (ผู้ใช้งานทั่วไป)</SelectItem>
        <SelectItem value="admin">Admin (ผู้ดูแลระบบ)</SelectItem>
        <SelectItem value="suspended">Suspended (ระงับใช้งาน)</SelectItem>
      </SelectContent>
    </Select>
  );
}