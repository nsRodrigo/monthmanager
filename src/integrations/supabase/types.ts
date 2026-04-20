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
          id: string
          percentage: number
          type: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          id?: string
          percentage?: number
          type: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
