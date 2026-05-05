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
      access_requests: {
        Row: {
          email: string
          id: string
          notified_at: string | null
          requested_at: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          email: string
          id?: string
          notified_at?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          email?: string
          id?: string
          notified_at?: string | null
          requested_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      accounts: {
        Row: {
          color: string
          created_at: string
          id: string
          initial_balance: number
          name: string
          type: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          initial_balance?: number
          name: string
          type?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          initial_balance?: number
          name?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      blacklist: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      card_payments: {
        Row: {
          card_id: string
          id: string
          month: number
          paid: boolean
          user_id: string
          year: number
        }
        Insert: {
          card_id: string
          id?: string
          month: number
          paid?: boolean
          user_id: string
          year: number
        }
        Update: {
          card_id?: string
          id?: string
          month?: number
          paid?: boolean
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_payments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          account_id: string
          closing_day: number
          color: string
          created_at: string
          due_day: number
          id: string
          name: string
          user_id: string
        }
        Insert: {
          account_id: string
          closing_day?: number
          color?: string
          created_at?: string
          due_day?: number
          id?: string
          name: string
          user_id: string
        }
        Update: {
          account_id?: string
          closing_day?: number
          color?: string
          created_at?: string
          due_day?: number
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      debits: {
        Row: {
          account_id: string
          amount: number
          auto_debit: boolean
          auto_debit_day: number | null
          created_at: string
          date: string
          description: string
          id: string
          installments_count: number
          is_parent: boolean
          paid: boolean
          required: boolean
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          auto_debit?: boolean
          auto_debit_day?: number | null
          created_at?: string
          date: string
          description: string
          id?: string
          installments_count?: number
          is_parent?: boolean
          paid?: boolean
          required?: boolean
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          auto_debit?: boolean
          auto_debit_day?: number | null
          created_at?: string
          date?: string
          description?: string
          id?: string
          installments_count?: number
          is_parent?: boolean
          paid?: boolean
          required?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          date: string
          description: string
          id: string
          installments_count: number
          is_parent: boolean
          received: boolean
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          date: string
          description: string
          id?: string
          installments_count?: number
          is_parent?: boolean
          received?: boolean
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          date?: string
          description?: string
          id?: string
          installments_count?: number
          is_parent?: boolean
          received?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      installments: {
        Row: {
          amount: number
          created_at: string
          due_date: string
          id: string
          month: number
          number: number
          paid: boolean
          parent_id: string | null
          parent_type: string
          purchase_id: string | null
          total: number
          user_id: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          due_date: string
          id?: string
          month: number
          number: number
          paid?: boolean
          parent_id?: string | null
          parent_type?: string
          purchase_id?: string | null
          total: number
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          due_date?: string
          id?: string
          month?: number
          number?: number
          paid?: boolean
          parent_id?: string | null
          parent_type?: string
          purchase_id?: string | null
          total?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "installments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          date: string
          id: string
          percentage: number
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          date?: string
          id?: string
          percentage?: number
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          date?: string
          id?: string
          percentage?: number
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "investments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_documents: {
        Row: {
          file_path: string
          id: string
          kind: string
          mime: string | null
          original_name: string
          size: number | null
          uploaded_at: string
          user_id: string
          year: number
        }
        Insert: {
          file_path: string
          id?: string
          kind?: string
          mime?: string | null
          original_name: string
          size?: number | null
          uploaded_at?: string
          user_id: string
          year: number
        }
        Update: {
          file_path?: string
          id?: string
          kind?: string
          mime?: string | null
          original_name?: string
          size?: number | null
          uploaded_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      irpf_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string | null
          description: string
          document_id: string | null
          id: string
          raw: Json | null
          source: string | null
          subcategory: string | null
          user_id: string
          year: number
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date?: string | null
          description?: string
          document_id?: string | null
          id?: string
          raw?: Json | null
          source?: string | null
          subcategory?: string | null
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string | null
          description?: string
          document_id?: string | null
          id?: string
          raw?: Json | null
          source?: string | null
          subcategory?: string | null
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "irpf_entries_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "irpf_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_year_snapshots: {
        Row: {
          account_id: string | null
          created_at: string
          id: string
          investment_id: string | null
          label: string
          updated_at: string
          user_id: string
          value: number
          year: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          id?: string
          investment_id?: string | null
          label: string
          updated_at?: string
          user_id: string
          value?: number
          year: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          id?: string
          investment_id?: string | null
          label?: string
          updated_at?: string
          user_id?: string
          value?: number
          year?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          card_id: string
          created_at: string
          description: string
          id: string
          installments_count: number
          purchase_date: string
          total_amount: number
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          description: string
          id?: string
          installments_count?: number
          purchase_date: string
          total_amount: number
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          description?: string
          id?: string
          installments_count?: number
          purchase_date?: string
          total_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_passkeys: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          device_name: string
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webauthn_challenges: {
        Row: {
          challenge: string
          created_at: string
          email: string | null
          expires_at: string
          id: string
          type: string
          user_id: string | null
        }
        Insert: {
          challenge: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          type: string
          user_id?: string | null
        }
        Update: {
          challenge?: string
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whitelist: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
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
      is_email_whitelisted: { Args: { _email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
    },
  },
} as const
