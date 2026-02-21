import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      toast({
        title: "ส่งลิงก์เข้าสู่ระบบแล้ว!",
        description: "กรุณาตรวจสอบอีเมลของคุณเพื่อคลิกลิงก์เข้าสู่ระบบ",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "เกิดข้อผิดพลาด",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="max-w-md w-full p-8 bg-card border rounded-2xl shadow-sm text-center">
        <h1 className="text-2xl font-bold mb-2">เข้าสู่ระบบ</h1>
        <p className="text-muted-foreground mb-6">กรอกอีเมลของคุณเพื่อรับลิงก์เข้าใช้งาน</p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            type="email"
            placeholder="name@ponix.co.th หรือ อีเมลของคุณ"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full text-center"
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            ส่งลิงก์เข้าสู่ระบบ (Magic Link)
          </Button>
        </form>
      </div>
    </div>
  );
}