import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const { toast } = useToast();

  // 1. ฟังก์ชัน Login ด้วย Magic Link (อีเมล)
  const handleMagicLink = async (e: React.FormEvent) => {
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

  // 2. ฟังก์ชัน Login ด้วย Google หรือ Microsoft
  const handleOAuthLogin = async (provider: 'google' | 'azure') => {
    setOauthLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "ระบบขัดข้อง",
        description: error.message,
      });
      setOauthLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full p-8 bg-card border rounded-2xl shadow-sm text-center">
        <h1 className="text-2xl font-bold mb-2">Sign In</h1>
        <p className="text-muted-foreground mb-8">Select a sign-in method</p>
        
        {/* กลุ่มปุ่ม Social Login */}
        <div className="space-y-3 mb-6">
          <Button 
            variant="outline" 
            className="w-full relative" 
            onClick={() => handleOAuthLogin('google')}
            disabled={oauthLoading !== null || loading}
          >
            {oauthLoading === 'google' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </Button>

          <Button 
            variant="outline" 
            className="w-full relative" 
            onClick={() => handleOAuthLogin('azure')}
            disabled={oauthLoading !== null || loading}
          >
            {oauthLoading === 'azure' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            <svg className="w-5 h-5 mr-2" viewBox="0 0 21 21">
              <path fill="#f25022" d="M1 1h9v9H1z" />
              <path fill="#7fba00" d="M11 1h9v9h-9z" />
              <path fill="#00a4ef" d="M1 11h9v9H1z" />
              <path fill="#ffb900" d="M11 11h9v9h-9z" />
            </svg>
            Continue with Microsoft
          </Button>
        </div>

        {/* เส้นคั่นกลาง */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">or sign in with email</span>
          </div>
        </div>

        {/* ฟอร์ม Magic Link */}
        <form onSubmit={handleMagicLink} className="space-y-4">
          <Input
            type="email"
            placeholder="Enter your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full text-center"
          />
          <Button type="submit" className="w-full" disabled={loading || oauthLoading !== null}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
            Send verification link
          </Button>
        </form>
      </div>
    </div>
  );
}