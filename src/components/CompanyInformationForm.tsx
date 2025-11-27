import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export const CompanyInformationForm = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    companyName: "",
    address: "",
    phone: "",
    taxId: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    toast({
      title: "บันทึกข้อมูลสำเร็จ",
      description: `ชื่อบริษัท: ${formData.companyName || "ไม่ระบุ"}`,
    });
    console.log("Saved company data:", formData);
  };

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
          <Button onClick={handleSave} size="lg" className="px-8">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};
