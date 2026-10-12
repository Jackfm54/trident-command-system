export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      contacts: {
        Row: {
          ai_confidence: number | null
          ai_reasoning: string | null
          altitude_ft: number | null
          bearing: number | null
          classification: string
          created_at: string
          domain: string
          heading: number | null
          id: string
          lat: number | null
          lon: number | null
          platform_type: string | null
          range_nm: number | null
          scenario_id: string | null
          speed_kts: number | null
          status: string
          target_unit_id: string | null
          track_id: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_reasoning?: string | null
          altitude_ft?: number | null
          bearing?: number | null
          classification?: string
          created_at?: string
          domain: string
          heading?: number | null
          id?: string
          lat?: number | null
          lon?: number | null
          platform_type?: string | null
          range_nm?: number | null
          scenario_id?: string | null
          speed_kts?: number | null
          status?: string
          target_unit_id?: string | null
          track_id: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_reasoning?: string | null
          altitude_ft?: number | null
          bearing?: number | null
          classification?: string
          created_at?: string
          domain?: string
          heading?: number | null
          id?: string
          lat?: number | null
          lon?: number | null
          platform_type?: string | null
          range_nm?: number | null
          scenario_id?: string | null
          speed_kts?: number | null
          status?: string
          target_unit_id?: string | null
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_commands: {
        Row: {
          command_type: string
          created_at: string
          created_by: string
          exercise_id: string
          id: string
          payload: Json
          unit_id: string | null
        }
        Insert: {
          command_type: string
          created_at?: string
          created_by: string
          exercise_id: string
          id?: string
          payload?: Json
          unit_id?: string | null
        }
        Update: {
          command_type?: string
          created_at?: string
          created_by?: string
          exercise_id?: string
          id?: string
          payload?: Json
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_commands_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_commands_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "exercise_units"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_units: {
        Row: {
          alert_level: string
          ammo_pct: number
          created_at: string
          exercise_id: string
          hull_integrity: number
          id: string
          impacts: number
          kills: number
          name: string
          pos_x_nm: number
          pos_y_nm: number
          power: number
          propulsion: number
          scenario_id: string | null
          shots: number
          status: string
          updated_at: string
          weapons: Json
        }
        Insert: {
          alert_level?: string
          ammo_pct?: number
          created_at?: string
          exercise_id: string
          hull_integrity?: number
          id?: string
          impacts?: number
          kills?: number
          name: string
          pos_x_nm?: number
          pos_y_nm?: number
          power?: number
          propulsion?: number
          scenario_id?: string | null
          shots?: number
          status?: string
          updated_at?: string
          weapons?: Json
        }
        Update: {
          alert_level?: string
          ammo_pct?: number
          created_at?: string
          exercise_id?: string
          hull_integrity?: number
          id?: string
          impacts?: number
          kills?: number
          name?: string
          pos_x_nm?: number
          pos_y_nm?: number
          power?: number
          propulsion?: number
          scenario_id?: string | null
          shots?: number
          status?: string
          updated_at?: string
          weapons?: Json
        }
        Relationships: [
          {
            foreignKeyName: "exercise_units_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_units_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          created_at: string
          created_by: string
          ended_at: string | null
          id: string
          mode: string
          name: string
          scenario_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          ended_at?: string | null
          id?: string
          mode?: string
          name: string
          scenario_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          ended_at?: string | null
          id?: string
          mode?: string
          name?: string
          scenario_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercises_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          domain: string
          id: string
          is_template: boolean
          name: string
          threat_level: string
          threats: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain?: string
          id?: string
          is_template?: boolean
          name: string
          threat_level?: string
          threats?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          domain?: string
          id?: string
          is_template?: boolean
          name?: string
          threat_level?: string
          threats?: Json
        }
        Relationships: []
      }
      tactical_events: {
        Row: {
          contact_id: string | null
          created_at: string
          domain: string
          event_type: string
          id: string
          message: string
          metadata: Json | null
          scenario_id: string | null
          severity: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          domain: string
          event_type: string
          id?: string
          message: string
          metadata?: Json | null
          scenario_id?: string | null
          severity?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          domain?: string
          event_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          scenario_id?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "tactical_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tactical_events_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      unit_members: {
        Row: {
          created_at: string
          id: string
          station: string
          unit_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          station?: string
          unit_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          station?: string
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unit_members_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "exercise_units"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_unit_member: {
        Args: { _unit_id: string; _user_id: string }
        Returns: boolean
      }
      set_user_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "instructor" | "operator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["instructor", "operator"],
    },
  },
} as const
