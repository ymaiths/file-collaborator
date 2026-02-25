import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Users() {
  const [emails, setEmails] = useState<{ id: string; email: string; note?: string }[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // ดึงรายชื่อตอนโหลดหน้าเว็บ
  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        const email = session.user.email?.toLowerCase() || "";
        const isCompany = email.endsWith("@ponix.co.th");
        const isVIP = ["yaimai2909@gmail.com", "yaimai2909@outlook.com", "thanaporn.sada@kmutt.ac.th"].includes(email);
        
        // ถ้าไม่ใช่แอดมิน ให้เตะกลับไปหน้าแรกทันที
        if (!isCompany && !isVIP) {
        toast({ variant: "destructive", title: "ไม่มีสิทธิ์", description: "เฉพาะผู้ดูแลระบบเท่านั้นที่สามารถจัดการผู้ใช้งานได้" });
        window.location.href = "/";
        } else {
        fetchUsers(); // ถ้าเป็นแอดมินถึงจะโหลดข้อมูลตาราง
        }
    }
  };
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.from("allowed_users").select("*").order("id", { ascending: true });
      if (error) throw error;
      setEmails(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error.message);
    } finally {
      setLoading(false);
    }
  };

  // ฟังก์ชันเพิ่มอีเมล
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.includes("@")) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("allowed_users").insert([{ email: newEmail.toLowerCase().trim() }]);
      if (error) throw error;
      
      toast({ title: "เพิ่มผู้ใช้งานสำเร็จ!" });
      setNewEmail("");
      fetchUsers(); // รีเฟรชตาราง
    } catch (error: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
      setLoading(false);
    }
  };

  // ฟังก์ชันลบอีเมล
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">ตั้งค่าผู้ใช้งานระบบ (Allowed Users)</h1>
      
      {/* ฟอร์มเพิ่มคน */}
      <form onSubmit={handleAddUser} className="flex gap-3 mb-8 bg-card p-6 rounded-xl border shadow-sm">
        <Input 
          type="email" 
          placeholder="กรอกอีเมลที่ต้องการให้สิทธิ์เข้าสู่ระบบ..." 
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
          เพิ่มสิทธิ์
        </Button>
      </form>

      {/* ตารางแสดงรายชื่อ */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 bg-muted/50 p-4 font-semibold text-muted-foreground border-b">
          <div className="col-span-1">ID</div>
          <div className="col-span-9">อีเมล (Email)</div>
          <div className="col-span-2 text-center">จัดการ</div>
        </div>
        
        {loading && emails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">กำลังโหลดข้อมูล...</div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">ยังไม่มีรายชื่อในระบบ</div>
        ) : (
          <div className="divide-y">
            {emails.map((user) => (
              <div key={user.id} className="grid grid-cols-12 p-4 items-center hover:bg-muted/30 transition-colors">
                <div className="col-span-1 text-muted-foreground">{user.id}</div>
                <div className="col-span-9 font-medium">{user.email}</div>
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