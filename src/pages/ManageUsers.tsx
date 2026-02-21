import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Trash2, UserPlus, Users, Loader2 } from "lucide-react";

export default function ManageUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // ดึงข้อมูลรายชื่อเมื่อเปิดหน้าเว็บ
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("allowed_users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error.message);
      alert("ไม่สามารถดึงข้อมูลได้: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;

    setIsAdding(true);
    try {
      const { error } = await supabase
        .from("allowed_users")
        .insert([{ email: newEmail, note: newNote }]);

      if (error) {
        if (error.code === '23505') {
          alert("อีเมลนี้มีอยู่ในระบบแล้วครับ!");
        } else {
          throw error;
        }
      } else {
        setNewEmail("");
        setNewNote("");
        fetchUsers(); // รีเฟรชข้อมูลใหม่
      }
    } catch (error: any) {
      console.error("Error adding user:", error.message);
      alert("เพิ่มผู้ใช้งานไม่สำเร็จ: " + error.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสิทธิ์ของ ${email} ?`)) return;

    try {
      const { error } = await supabase
        .from("allowed_users")
        .delete()
        .eq("id", id);

      if (error) throw error;
      fetchUsers(); // รีเฟรชข้อมูลใหม่
    } catch (error: any) {
      console.error("Error deleting user:", error.message);
      alert("ลบผู้ใช้งานไม่สำเร็จ: " + error.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3 border-b pb-4">
        <div className="bg-primary/10 p-3 rounded-full text-primary">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดการสิทธิ์ผู้ใช้งาน (Whitelist)</h1>
          <p className="text-muted-foreground">เพิ่มหรือลบอีเมลบุคคลภายนอกที่ต้องการให้เข้าถึงระบบ</p>
        </div>
      </div>

      {/* ฟอร์มเพิ่มผู้ใช้งาน */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          เพิ่มผู้ใช้งานใหม่
        </h2>
        <form onSubmit={handleAddUser} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              type="email"
              placeholder="อีเมล (เช่น intern@gmail.com)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex-1">
            <Input
              type="text"
              placeholder="หมายเหตุ (เช่น น้องฝึกงานฝ่ายขาย)"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
            />
          </div>
          <button
            type="submit"
            disabled={isAdding}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 font-medium disabled:opacity-50 flex items-center justify-center min-w-[120px]"
          >
            {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : "เพิ่มรายชื่อ"}
          </button>
        </form>
      </div>

      {/* ตารางแสดงรายชื่อ */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        <div className="p-0">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-6 py-4 font-medium">อีเมล</th>
                <th className="px-6 py-4 font-medium">หมายเหตุ</th>
                <th className="px-6 py-4 font-medium text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">
                    ยังไม่มีบุคคลภายนอกในระบบ
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-medium">{user.email}</td>
                    <td className="px-6 py-4 text-muted-foreground">{user.note || "-"}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.email)}
                        className="text-destructive hover:bg-destructive/10 p-2 rounded-md transition-colors"
                        title="ลบสิทธิ์"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}