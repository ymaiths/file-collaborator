import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const CompanyInformationForm = () => {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    address: "",
    phone: "",
    taxId: "",
  });

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      const { data, error } = await supabase
        .from("company_info")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching company info:", error);
      } else if (data) {
        setCompanyId(data.id);
        setFormData({
          companyName: data.name || "",
          address: data.address || "",
          phone: data.phone_number || "",
          taxId: data.id_tax || "",
        });
      }
      setLoading(false);
    };

    fetchCompanyInfo();
  }, []);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      name: formData.companyName,
      address: formData.address,
      phone_number: formData.phone,
      id_tax: formData.taxId,
    };

    let error;
    if (companyId) {
      // Update existing record
      const result = await supabase
        .from("company_info")
        .update(payload)
        .eq("id", companyId);
      error = result.error;
    } else {
      // Insert new record
      const result = await supabase
        .from("company_info")
        .insert(payload)
        .select()
        .single();
      error = result.error;
      if (!error && result.data) {
        setCompanyId(result.data.id);
      }
    }

    setSaving(false);
    if (error) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "บันทึกข้อมูลสำเร็จ",
        description: `ชื่อบริษัท: ${formData.companyName || "ไม่ระบุ"}`,
      });
    }
  };

  if (loading) {
    return (
      <div className="bg-card rounded-lg p-8 border border-border">
        <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg p-8 border border-border">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-base">
            ชื่อบริษัท
          </Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => handleChange("companyName", e.target.value)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address" className="text-base">
            ที่อยู่
          </Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-base">
            เบอร์โทร
          </Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => handleChange("phone", e.target.value)}
            className="w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="taxId" className="text-base">
            เลขประจำตัวผู้เสียภาษี
          </Label>
          <Input
            id="taxId"
            value={formData.taxId}
            onChange={(e) => handleChange("taxId", e.target.value)}
            className="w-full"
          />
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} size="lg" className="px-8" disabled={saving}>
            {saving ? "กำลังบันทึก..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
};
