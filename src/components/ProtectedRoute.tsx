import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function ProtectedRoute() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [suspendMessage, setSuspendMessage] = useState(false); // 🌟 State เพื่อโชว์ข้อความว่าโดนแบน
  
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email && isMounted) {
        setIsAuthenticated(true);
        setUserEmail(session.user.email.toLowerCase().trim());
      } else if (!window.location.hash.includes("access_token") && isMounted) {
        setIsAuthenticated(false);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT') {
        setIsAuthenticated(false);
        setIsAuthorized(false);
        setSuspendMessage(false);
        setUserEmail(null);
        localStorage.removeItem("userRole");
        setLoading(false);
      } else if (session?.user?.email) {
        setIsAuthenticated(true);
        setUserEmail(session.user.email.toLowerCase().trim()); 
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userEmail) return; 

    let isMounted = true;

    const checkRoleInDatabase = async () => {
      try {
        const isVIP = userEmail === "yaimai2909@gmail.com" || userEmail === "yaimai2909@outlook.com" || userEmail === "thanaporn.sada@kmutt.ac.th";
        
        if (userEmail.endsWith("@ponix.co.th") || isVIP) {
          localStorage.setItem("userRole", "admin");
          if (isMounted) {
            setIsAuthorized(true);
            setSuspendMessage(false);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("allowed_users")
          .select("email, role")
          .eq("email", userEmail)
          .maybeSingle();

        if (isMounted) {
          if (data) {
            // 🌟 เช็คว่าโดนแบนไหม?
            if (data.role === "suspended") {
                localStorage.removeItem("userRole");
                setIsAuthorized(false);
                setSuspendMessage(true); // เปิดข้อความ "บัญชีถูกระงับ"
            } else {
                localStorage.setItem("userRole", data.role || "viewer");
                setIsAuthorized(true);
                setSuspendMessage(false);
            }
          } else {
            localStorage.removeItem("userRole");
            setIsAuthorized(false);
            setSuspendMessage(false);
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
          setLoading(false); 
        }
      }
    };

    checkRoleInDatabase();

    return () => {
      isMounted = false;
    };
  }, [userEmail]); 

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
        <>
            <h1 className="text-3xl font-bold text-destructive mb-2">Access Denied</h1>
            <p className="text-muted-foreground mb-6">อีเมลของคุณไม่มีสิทธิ์เข้าถึงระบบนี้ กรุณาติดต่อผู้ดูแลระบบ</p>
        </>
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