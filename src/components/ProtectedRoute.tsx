import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // 1. ตัวดักจับเวลามีการ Redirect กลับมาจาก Google/Microsoft
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        await verifyAccess(session);
      } else if (!window.location.hash.includes("access_token")) {
        // ถ้าไม่มี session และไม่มี token ใน URL ค่อยเตะออก
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    // 2. เช็ค Session เริ่มต้นตอนโหลดหน้าเว็บ
    checkInitialSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkInitialSession = async () => {
    try {
      // 🌟 ทริคสำคัญ: ถ้ามีคำว่า access_token ใน URL ให้ "หยุดรอ" อย่าเพิ่งเตะออก ปล่อยให้ onAuthStateChange ทำงาน
      if (window.location.hash.includes("access_token")) {
        return; 
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await verifyAccess(session);
      } else {
        setIsAuthenticated(false);
        setLoading(false);
      }
    } catch (error) {
      console.error("Auth check error:", error);
      setLoading(false);
    }
  };
  const verifyAccess = async (session: any) => {
    try {
      setIsAuthenticated(true);
      
      console.log("🕵️‍♂️ [Debug] ข้อมูล User ทั้งหมด:", session.user);
      
      const rawEmail = 
        session.user.email || 
        session.user.user_metadata?.email || 
        session.user.user_metadata?.preferred_username || 
        session.user.user_metadata?.name || 
        "";
        
      const email = rawEmail.toLowerCase().trim();
      console.log("📧 [Debug] สรุปอีเมลที่หาเจอคือ:", `"${email}"`);

      // เช็คสิทธิ์ VIP
      const isVIP = email === "yaimai2909@gmail.com" || email === "yaimai2909@outlook.com" || email === "thanaporn.sada@kmutt.ac.th";
      console.log("👑 [Debug] ตรงกับ VIP ไหม?:", isVIP);
      
      if (email.endsWith("@ponix.co.th") || isVIP) {
        console.log("✅ [Debug] ผ่าน! ให้สิทธิ์ Admin อัตโนมัติ");
        // 🌟 แอบจดสิทธิ์ Admin ลงในเครื่องทันที
        localStorage.setItem("userRole", "admin");
        setIsAuthorized(true);
      } else {
        console.log("🔍 [Debug] ไม่ใช่ VIP กำลังเช็คสิทธิ์และ Role ในฐานข้อมูล...");
        
        // 🌟 เพิ่มคำว่า role ในการ select ข้อมูล
        const { data, error } = await supabase
          .from("allowed_users")
          .select("email, role") 
          .eq("email", email)
          .maybeSingle();

        if (error) console.log("❌ [Debug] หาในตารางไม่เจอ Error:", error.message);
        console.log("📋 [Debug] เจอข้อมูลในตารางไหม?:", !!data);
        
        if (data) {
          console.log(`✅ [Debug] ผ่าน! คุณได้รับสิทธิ์: ${data.role}`);
          // 🌟 แอบจด Role ที่ได้จากฐานข้อมูลลงในเครื่อง
          localStorage.setItem("userRole", data.role || "viewer"); 
          setIsAuthorized(true);
        } else {
          // 🌟 ถ้าไม่มีสิทธิ์ ให้ลบความจำ Role ทิ้งไปเลย
          localStorage.removeItem("userRole"); 
          setIsAuthorized(false);
        }
      }
    } catch (error) {
      console.error("Verify access error:", error);
      setIsAuthorized(false);
      localStorage.removeItem("userRole");
    } finally {
      setLoading(false);
    }
  };
  
  // หน้าจอตอนกำลังโหลดเช็คสิทธิ์
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center gap-3 bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">กำลังตรวจสอบสิทธิ์...</p>
      </div>
    );
  }

  // ถ้ายังไม่ Login เตะไปหน้า /login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // ถ้า Login แล้ว แต่ไม่มีสิทธิ์ โชว์หน้า Access Denied
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

  // ถ้าผ่านหมด ปล่อยผ่านให้เห็นหน้าเว็บได้!
  return <Outlet />;
}