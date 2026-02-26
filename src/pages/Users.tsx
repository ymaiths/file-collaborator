import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, UserPlus, Loader2, ShieldCheck, User, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// 🌟 กำหนด Type ให้มี role ด้วย
type AllowedUser = {
  id: string;
  email: string;
  note?: string;
  role: "admin" | "general" | "viewer";
};

export default function Users() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  // 🌟 สร้าง State สำหรับเก็บค่า Role ที่กำลังจะเพิ่ม (ค่าเริ่มต้นคือ viewer เพื่อความปลอดภัย)
  const [newRole, setNewRole] = useState<"admin" | "general" | "viewer">("viewer"); 
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  // 🌟 ฟังก์ชันเช็คว่าคนที่เปิดหน้านี้เป็น Admin จริงไหม
  const checkAdminStatus = async () => {
    const role = localStorage.getItem("userRole");
    
    // ถ้าไม่ใช่ admin ให้เตะกลับหน้าแรกทันที
    if (role !== "admin") {
      toast({ variant: "destructive", title: "ไม่มีสิทธิ์", description: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการผู้ใช้งานได้" });
      window.location.href = "/";
    } else {
      fetchUsers(); // ถ้าเป็นแอดมินถึงจะโหลดข้อมูลตาราง
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
      // 🌟 ส่งค่า role ที่เลือกเข้าไปบันทึกในฐานข้อมูลด้วย
      const { error } = await supabase.from("allowed_users").insert([
        { email: newEmail.toLowerCase().trim(), role: newRole }
      ]);
      if (error) throw error;
      
      toast({ title: "เพิ่มผู้ใช้งานสำเร็จ!" });
      setNewEmail("");
      setNewRole("viewer"); // คืนค่ากลับเป็น viewer
      fetchUsers(); // รีเฟรชตาราง
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, emailToDelete: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ์ของ ${emailToDelete}?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("allowed_users").delete().eq("id", id);
      if (error) throw error;
      
      toast({ title: "ลบผู้ใช้งานสำเร็จ!" });
      fetchUsers(); // รีเฟรชตาราง
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
      setLoading(false);
    }
  };

  // 🌟 ฟังก์ชันช่วยสร้างป้าย (Badge) สีสันสวยงามตามระดับสิทธิ์
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full"><ShieldCheck className="w-3.5 h-3.5"/> Admin</span>;
      case 'general':
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 px-2.5 py-1 rounded-full"><User className="w-3.5 h-3.5"/> General</span>;
      case 'viewer':
      default:
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full"><Eye className="w-3.5 h-3.5"/> Viewer</span>;
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">ตั้งค่าผู้ใช้งานระบบ (User Management)</h1>
      
      {/* ฟอร์มเพิ่มคน */}
      <form onSubmit={handleAddUser} className="flex flex-wrap md:flex-nowrap gap-3 mb-8 bg-card p-6 rounded-xl border shadow-sm">
        <Input 
          type="email" 
          placeholder="กรอกอีเมลที่ต้องการให้สิทธิ์..." 
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          className="flex-1 min-w-[200px]"
        />
        
        {/* 🌟 ช่องสำหรับเลือกระดับสิทธิ์ (Dropdown) */}
        <select 
          value={newRole} 
          onChange={(e) => setNewRole(e.target.value as any)}
          className="flex h-10 w-[180px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="viewer">Viewer (อ่านอย่างเดียว)</option>
          <option value="general">General (ผู้ใช้งานทั่วไป)</option>
          <option value="admin">Admin (ผู้ดูแลระบบ)</option>
        </select>

        <Button type="submit" disabled={loading} className="w-full md:w-auto">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          เพิ่มสิทธิ์
        </Button>
      </form>

      {/* ตารางแสดงรายชื่อ */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 bg-muted/50 p-4 font-semibold text-muted-foreground border-b">
          <div className="col-span-6 md:col-span-7">อีเมล (Email)</div>
          <div className="col-span-4 md:col-span-3 text-center">ระดับสิทธิ์ (Role)</div>
          <div className="col-span-2 text-center">จัดการ</div>
        </div>
        
        {loading && users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">ยังไม่มีรายชื่อในระบบ</div>
        ) : (
          <div className="divide-y">
            {users.map((user) => (
              <div key={user.id} className="grid grid-cols-12 p-4 items-center hover:bg-muted/30 transition-colors">
                <div className="col-span-6 md:col-span-7 font-medium truncate pr-4">{user.email}</div>
                <div className="col-span-4 md:col-span-3 text-center">
                  {/* 🌟 เรียกใช้ฟังก์ชันแสดงป้ายสี */}
                  {getRoleBadge(user.role)}
                </div>
                <div className="col-span-2 text-center">
                  <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(user.id, user.email)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}