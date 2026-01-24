export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      company_info: {
        Row: {
          address: string | null;
          created_at: string | null;
          id: string;
          id_tax: string | null;
          name: string;
          phone_number: string | null;
          updated_at: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string | null;
          id?: string;
          id_tax?: string | null;
          name: string;
          phone_number?: string | null;
          updated_at?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string | null;
          id?: string;
          id_tax?: string | null;
          name?: string;
          phone_number?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          created_at: string | null;
          customer_name: string;
          id: string;
          id_tax: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          customer_name: string;
          id?: string;
          id_tax?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          customer_name?: string;
          id?: string;
          id_tax?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      product_line_items: {
        Row: {
          created_at: string | null;
          edited_brand: string | null;
          edited_name: string | null;
          edited_unit: string | null;
          id: string;
          installation_price: number | null;
          is_edited_installation_price: boolean | null;
          is_edited_product_price: boolean | null;
          is_edited_quantity: boolean | null;
          product_id: string | null;
          product_price: number | null;
          quantity: number;
          quotation_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          edited_brand?: string | null;
          edited_name?: string | null;
          edited_unit?: string | null;
          id?: string;
          installation_price?: number | null;
          is_edited_installation_price?: boolean | null;
          is_edited_product_price?: boolean | null;
          is_edited_quantity?: boolean | null;
          product_id?: string | null;
          product_price?: number | null;
          quantity?: number;
          quotation_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          edited_brand?: string | null;
          edited_name?: string | null;
          edited_unit?: string | null;
          id?: string;
          installation_price?: number | null;
          is_edited_installation_price?: boolean | null;
          is_edited_product_price?: boolean | null;
          is_edited_quantity?: boolean | null;
          product_id?: string | null;
          product_price?: number | null;
          quantity?: number;
          quotation_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_line_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_line_items_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "quotations";
            referencedColumns: ["id"];
          }
        ];
      };
      products: {
        Row: {
          brand: string | null;
          cost_fixed: number | null;
          cost_percentage: number | null;
          created_at: string | null;
          electrical_phase: string | null;
          fixed_installation_cost: number | null;
          id: string;
          installation_cost_percentage: number | null;
          is_exact_kw: boolean | null;
          is_fixed_cost: boolean | null;
          is_fixed_installation_cost: boolean | null;
          is_price_included: boolean | null;
          is_required_product: boolean | null;
          max_kw: number | null;
          min_kw: number | null;
          name: string;
          product_category: Database["public"]["Enums"]["product_category"];
          unit: string | null;
          updated_at: string | null;
        };
        Insert: {
          brand?: string | null;
          cost_fixed?: number | null;
          cost_percentage?: number | null;
          created_at?: string | null;
          electrical_phase?: string | null;
          fixed_installation_cost?: number | null;
          id?: string;
          installation_cost_percentage?: number | null;
          is_exact_kw?: boolean | null;
          is_fixed_cost?: boolean | null;
          is_fixed_installation_cost?: boolean | null;
          is_price_included?: boolean | null;
          is_required_product?: boolean | null;
          max_kw?: number | null;
          min_kw?: number | null;
          name: string;
          product_category: Database["public"]["Enums"]["product_category"];
          unit?: string | null;
          updated_at?: string | null;
        };
        Update: {
          brand?: string | null;
          cost_fixed?: number | null;
          cost_percentage?: number | null;
          created_at?: string | null;
          electrical_phase?: string | null;
          fixed_installation_cost?: number | null;
          id?: string;
          installation_cost_percentage?: number | null;
          is_exact_kw?: boolean | null;
          is_fixed_cost?: boolean | null;
          is_fixed_installation_cost?: boolean | null;
          is_price_included?: boolean | null;
          is_required_product?: boolean | null;
          max_kw?: number | null;
          min_kw?: number | null;
          name?: string;
          product_category?: Database["public"]["Enums"]["product_category"];
          unit?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      quotations: {
        Row: {
          created_at: string | null;
          creater_name: string | null;
          customer_id: string | null;
          document_num: string | null;
          edited_price: number | null;
          electrical_phase: string | null;
          id: string;
          inverter_brand: string | null;
          kw_panel: number | null;
          kw_peak: number | null;
          kw_size: number | null;
          location: string | null;
          note: string | null;
          sale_package_id: string | null;
          updated_at: string | null;
          // ✅ Added these 3 lines
          edited_payment_terms: string | null;
          edited_warranty_terms: string | null;
          edited_note: string | null;
        };
        Insert: {
          created_at?: string | null;
          creater_name?: string | null;
          customer_id?: string | null;
          document_num?: string | null;
          edited_price?: number | null;
          electrical_phase?: string | null;
          id?: string;
          inverter_brand?: string | null;
          kw_panel?: number | null;
          kw_peak?: number | null;
          kw_size?: number | null;
          location?: string | null;
          note?: string | null;
          sale_package_id?: string | null;
          updated_at?: string | null;
          // ✅ Added these 3 lines
          edited_payment_terms?: string | null;
          edited_warranty_terms?: string | null;
          edited_note?: string | null;
        };
        Update: {
          created_at?: string | null;
          creater_name?: string | null;
          customer_id?: string | null;
          document_num?: string | null;
          edited_price?: number | null;
          electrical_phase?: string | null;
          id?: string;
          inverter_brand?: string | null;
          kw_panel?: number | null;
          kw_peak?: number | null;
          kw_size?: number | null;
          location?: string | null;
          note?: string | null;
          sale_package_id?: string | null;
          updated_at?: string | null;
          // ✅ Added these 3 lines
          edited_payment_terms?: string | null;
          edited_warranty_terms?: string | null;
          edited_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotations_sale_package_id_fkey";
            columns: ["sale_package_id"];
            isOneToOne: false;
            referencedRelation: "sale_packages";
            referencedColumns: ["id"];
          }
        ];
      };
      sale_package_prices: {
        Row: {
          commission: string | null;
          created_at: string | null;
          electronic_phase: Database["public"]["Enums"]["electronic_phase"];
          id: string;
          inverter_brand: Database["public"]["Enums"]["inverter_brand"];
          is_exact_kw: boolean | null;
          is_exact_price: boolean | null;
          kw_max: number | null;
          kw_min: number;
          note: string | null;
          payment_terms: string | null;
          price: number;
          price_exact: number | null;
          price_percentage: number | null;
          sale_package_id: string | null;
          updated_at: string | null;
          warranty_terms: string | null;
        };
        Insert: {
          commission?: string | null;
          created_at?: string | null;
          electronic_phase: Database["public"]["Enums"]["electronic_phase"];
          id?: string;
          inverter_brand: Database["public"]["Enums"]["inverter_brand"];
          is_exact_kw?: boolean | null;
          is_exact_price?: boolean | null;
          kw_max?: number | null;
          kw_min: number;
          note?: string | null;
          payment_terms?: string | null;
          price: number;
          price_exact?: number | null;
          price_percentage?: number | null;
          sale_package_id?: string | null;
          updated_at?: string | null;
          warranty_terms?: string | null;
        };
        Update: {
          commission?: string | null;
          created_at?: string | null;
          electronic_phase?: Database["public"]["Enums"]["electronic_phase"];
          id?: string;
          inverter_brand?: Database["public"]["Enums"]["inverter_brand"];
          is_exact_kw?: boolean | null;
          is_exact_price?: boolean | null;
          kw_max?: number | null;
          kw_min?: number;
          note?: string | null;
          payment_terms?: string | null;
          price?: number;
          price_exact?: number | null;
          price_percentage?: number | null;
          sale_package_id?: string | null;
          updated_at?: string | null;
          warranty_terms?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_package_prices_sale_package_id_fkey";
            columns: ["sale_package_id"];
            isOneToOne: false;
            referencedRelation: "sale_packages";
            referencedColumns: ["id"];
          }
        ];
      };
      sale_packages: {
        Row: {
          created_at: string | null;
          edited_discount: number | null;
          edited_note: string | null;
          edited_payment_terms: string | null;
          edited_warranty_terms: string | null;
          payment_terms: string | null;
          warranty_terms: string | null;
          note: string | null;
          id: string;
          price_id: string | null;
          sale_name: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          edited_discount?: number | null;
          edited_note?: string | null;
          edited_payment_terms?: string | null;
          edited_warranty_terms?: string | null;
          payment_terms?: string | null;
          warranty_terms?: string | null;
          note?: string | null;
          id?: string;
          price_id?: string | null;
          sale_name: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          edited_discount?: number | null;
          edited_note?: string | null;
          edited_payment_terms?: string | null;
          edited_warranty_terms?: string | null;
          payment_terms?: string | null;
          warranty_terms?: string | null;
          note?: string | null;
          id?: string;
          price_id?: string | null;
          sale_name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sale_packages_price_id_fkey";
            columns: ["price_id"];
            isOneToOne: false;
            referencedRelation: "sale_package_prices";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      execute_sql: { Args: { sql: string }; Returns: Json };
    };
    Enums: {
      electronic_phase: "single_phase" | "three_phase";
      inverter_brand: "huawei" | "huawei_optimizer" | "solaredge" | "hoimine";
      product_category:
        | "solar_panel"
        | "inverter"
        | "ac_cabinet"
        | "dc_cabinet"
        | "other"
        | "ac_box"
        | "dc_box"
        | "service"
        | "pv_mounting_structure"
        | "zero_export_smart_logger"
        | "cable"
        | "operation"
        | "electrical_management";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
      DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
      DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R;
    }
    ? R
    : never
  : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I;
    }
    ? I
    : never
  : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U;
    }
    ? U
    : never
  : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never;

export const Constants = {
  public: {
    Enums: {
      electronic_phase: ["single_phase", "three_phase"],
      inverter_brand: [
        "huawei",
        "sungrow",
        "growatt",
        "other",
        "huawei__optimizer",
        "huaweioptimizer",
        "solaredge",
        "hoimine",
      ],
      product_category: [
        "solar_panel",
        "inverter",
        "ac_cabinet",
        "dc_cabinet",
        "other",
        "ac_box",
        "dc_box",
        "walk_way",
        "water_service",
        "pv_mounting_structure",
        "zero_export_smart_logger",
        "cable",
        "electrical_management",
      ],
    },
  },
} as const;