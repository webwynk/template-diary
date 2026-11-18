export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      palette_presets: {
        Row: {
          colors: Json;
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
          use_count: number;
        };
        Insert: {
          colors?: Json;
          created_at?: string;
          id?: string;
          name: string;
          owner_id?: string;
          updated_at?: string;
          use_count?: number;
        };
        Update: {
          colors?: Json;
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
          use_count?: number;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          owner_id: string;
          updated_at: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          owner_id?: string;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          owner_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      template_tags: {
        Row: {
          created_at: string;
          owner_id: string;
          tag_id: string;
          template_id: string;
        };
        Insert: {
          created_at?: string;
          owner_id?: string;
          tag_id: string;
          template_id: string;
        };
        Update: {
          created_at?: string;
          owner_id?: string;
          tag_id?: string;
          template_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_tags_tag_id_owner_id_fkey";
            columns: ["tag_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id", "owner_id"];
          },
          {
            foreignKeyName: "template_tags_template_id_owner_id_fkey";
            columns: ["template_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "templates";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
      templates: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          feature_image_path: string | null;
          feature_image_source: Database["public"]["Enums"]["feature_image_source"];
          id: string;
          is_favorite: boolean;
          name: string;
          notes: string | null;
          owner_id: string;
          type: Database["public"]["Enums"]["template_type"];
          updated_at: string;
          used_in: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          feature_image_path?: string | null;
          feature_image_source?: Database["public"]["Enums"]["feature_image_source"];
          id?: string;
          is_favorite?: boolean;
          name: string;
          notes?: string | null;
          owner_id?: string;
          type: Database["public"]["Enums"]["template_type"];
          updated_at?: string;
          used_in?: string | null;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          feature_image_path?: string | null;
          feature_image_source?: Database["public"]["Enums"]["feature_image_source"];
          id?: string;
          is_favorite?: boolean;
          name?: string;
          notes?: string | null;
          owner_id?: string;
          type?: Database["public"]["Enums"]["template_type"];
          updated_at?: string;
          used_in?: string | null;
        };
        Relationships: [];
      };
      user_settings: {
        Row: {
          default_device: number;
          default_feature_mode: Database["public"]["Enums"]["feature_image_source"];
          last_backup_at: string | null;
          owner_id: string;
          trash_retention_days: number;
          updated_at: string;
        };
        Insert: {
          default_device?: number;
          default_feature_mode?: Database["public"]["Enums"]["feature_image_source"];
          last_backup_at?: string | null;
          owner_id?: string;
          trash_retention_days?: number;
          updated_at?: string;
        };
        Update: {
          default_device?: number;
          default_feature_mode?: Database["public"]["Enums"]["feature_image_source"];
          last_backup_at?: string | null;
          owner_id?: string;
          trash_retention_days?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      variations: {
        Row: {
          changes: Json;
          content: string;
          created_at: string;
          deleted_at: string | null;
          detected: Json;
          feature_image_path: string | null;
          id: string;
          is_original: boolean;
          name: string;
          owner_id: string;
          parent_variation_id: string | null;
          template_id: string;
          updated_at: string;
          used_in: string | null;
        };
        Insert: {
          changes?: Json;
          content: string;
          created_at?: string;
          deleted_at?: string | null;
          detected?: Json;
          feature_image_path?: string | null;
          id?: string;
          is_original?: boolean;
          name: string;
          owner_id?: string;
          parent_variation_id?: string | null;
          template_id: string;
          updated_at?: string;
          used_in?: string | null;
        };
        Update: {
          changes?: Json;
          content?: string;
          created_at?: string;
          deleted_at?: string | null;
          detected?: Json;
          feature_image_path?: string | null;
          id?: string;
          is_original?: boolean;
          name?: string;
          owner_id?: string;
          parent_variation_id?: string | null;
          template_id?: string;
          updated_at?: string;
          used_in?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "variations_parent_variation_id_owner_id_fkey";
            columns: ["parent_variation_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "variations";
            referencedColumns: ["id", "owner_id"];
          },
          {
            foreignKeyName: "variations_template_id_owner_id_fkey";
            columns: ["template_id", "owner_id"];
            isOneToOne: false;
            referencedRelation: "templates";
            referencedColumns: ["id", "owner_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_template: {
        Args: {
          p_content: string;
          p_detected?: Json;
          p_name: string;
          p_notes?: string;
          p_tag_ids?: string[];
          p_type: Database["public"]["Enums"]["template_type"];
          p_used_in?: string;
        };
        Returns: string;
      };
      list_tags_with_counts: {
        Args: never;
        Returns: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          template_count: number;
          updated_at: string;
        }[];
      };
      use_palette_preset: { Args: { p_id: string }; Returns: number };
      valid_preset_colors: { Args: { p_colors: Json }; Returns: boolean };
    };
    Enums: {
      feature_image_source: "none" | "auto" | "upload";
      template_type: "custom" | "elementor";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      feature_image_source: ["none", "auto", "upload"],
      template_type: ["custom", "elementor"],
    },
  },
} as const;
