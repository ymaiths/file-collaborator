import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      // 1. เช็คว่ามีคน Login อยู่ไหม? (ถามยามหน้าหมู่บ้าน)
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      setIsAuthenticated(true);
      const email = session.user.email || "";

      // 2. เช็คบัตร VIP (ถามนิติบุคคล)
      if (email.endsWith("@ponix.co.th") || email === "yaimai2909@gmail.com") {
        setIsAuthorized(true);
      } else {
        // 3. ถ้าไม่ใช่ VIP ไปค้นรายชื่อใน Whitelist
        const { data } = await supabase
          .from("allowed_users")
          .select("email")
          .eq("email", email)
          .single();

        if (data) {
          setIsAuthorized(true);
        } else {
          setIsAuthorized(false);
        }
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  // ถ้ายังไม่ Login เตะไปหน้า /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ถ้า Login แล้ว แต่ไม่มีสิทธิ์ (เช่น คนนอกที่ไม่มีชื่อ) เตะออกแจ้งเตือน
  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-destructive/10 text-center p-4">
        <h1 className="text-3xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">อีเมลของคุณไม่มีสิทธิ์เข้าถึงระบบนี้ กรุณาติดต่อผู้ดูแลระบบ</p>
        <button onClick={() => supabase.auth.signOut().then(() => window.location.reload())} className="underline text-primary hover:text-primary/80">
          ออกจากระบบ
        </button>
      </div>
    );
  }

  // ถ้าผ่านหมด ปล่อยผ่านให้เห็นหน้าเว็บได้!
  return <Outlet />;
}