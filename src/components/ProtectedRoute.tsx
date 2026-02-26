import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  // 🌟 สร้าง State ใหม่ เพื่อเก็บอีเมลที่ล็อคอินผ่านแล้ว ค่อยเอาไปเช็คสิทธิ์ทีหลัง
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // ==========================================
  // 🟢 คิวที่ 1: ตรวจสอบการล็อกอิน (Auth เท่านั้น ห้ามดึง DB ตรงนี้)
  // ==========================================
  useEffect(() => {
    let isMounted = true;

    // เช็คตอนโหลดหน้าครั้งแรก
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email && isMounted) {
        setIsAuthenticated(true);
        setUserEmail(session.user.email.toLowerCase().trim()); // โยนให้คิว 2 ทำงานต่อ
      } else if (!window.location.hash.includes("access_token") && isMounted) {
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    // ดักจับเวลามีคนกด Login / Logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setIsAuthorized(false);
        setUserEmail(null);
        localStorage.removeItem("userRole");
        setLoading(false);
      } else if (session?.user?.email) {
        setIsAuthenticated(true);
        setUserEmail(session.user.email.toLowerCase().trim()); // โยนให้คิว 2 ทำงานต่อ
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ==========================================
  // 🔵 คิวที่ 2: ดึงฐานข้อมูลเช็คสิทธิ์ (ทำงานเมื่อรู้ Email แล้วเท่านั้น)
  // ==========================================
  useEffect(() => {
    if (!userEmail) return; // ถ้ายังไม่ได้อีเมล ให้รอไปก่อน

    let isMounted = true;

    const checkRoleInDatabase = async () => {
      try {
        const isVIP = userEmail === "yaimai2909@gmail.com" || userEmail === "yaimai2909@outlook.com" || userEmail === "thanaporn.sada@kmutt.ac.th";
        
        if (userEmail.endsWith("@ponix.co.th") || isVIP) {
          localStorage.setItem("userRole", "admin");
          if (isMounted) {
            setIsAuthorized(true);
            setLoading(false);
          }
          return;
        }

        // 🌟 ดึงข้อมูลจากฐานข้อมูล (แยกออกมาทำคิวนี้ จะไม่ค้างแล้ว!)
        const { data, error } = await supabase
          .from("allowed_users")
          .select("email, role")
          .eq("email", userEmail)
          .maybeSingle();

        if (isMounted) {
          if (data) {
            localStorage.setItem("userRole", data.role || "viewer");
            setIsAuthorized(true);
          } else {
            localStorage.removeItem("userRole");
            setIsAuthorized(false);
          }
        }
      } catch (error) {
        console.error("Role check error:", error);
        if (isMounted) {
          setIsAuthorized(false);
          localStorage.removeItem("userRole");
        }
      } finally {
        if (isMounted) {
          setLoading(false); // การันตีปิดหน้าโหลด
        }
      }
    };

    checkRoleInDatabase();

    return () => {
      isMounted = false;
    };
  }, [userEmail]); // 👈 สั่งให้ useEffect นี้ทำงานก็ต่อเมื่อ userEmail มีค่า

  // ==========================================
  // 🔴 ส่วนแสดงผลหน้าจอ (UI)
  // ==========================================
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-3 bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-destructive/5 text-center p-4">
        <h1 className="text-3xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-6">อีเมลของคุณไม่มีสิทธิ์เข้าถึงระบบนี้ กรุณาติดต่อผู้ดูแลระบบ</p>
        <button 
          onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')} 
          className="underline text-primary hover:text-primary/80"
        >
          กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    );
  }

  return <Outlet />;
}