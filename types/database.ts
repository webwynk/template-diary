// Bootstrap copy written to match supabase/migrations/20261118000001_init.sql.
// The Database GitHub Action overwrites this file with `supabase gen types` output from the
// real database on its first run. After that it is generated only; never edit it by hand.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
        Relationships: [];
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
        Relationships: [];
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
