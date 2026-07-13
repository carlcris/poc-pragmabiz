export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_name: string
          account_number: string
          account_type: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_system_account: boolean | null
          level: number | null
          parent_account_id: string | null
          sort_order: number | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          account_name: string
          account_number: string
          account_type: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_account?: boolean | null
          level?: number | null
          parent_account_id?: string | null
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          account_name?: string
          account_number?: string
          account_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system_account?: boolean | null
          level?: number | null
          parent_account_id?: string | null
          sort_order?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_account_id_fkey"
            columns: ["parent_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_units_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_units_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_units_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          currency_code: string | null
          custom_fields: Json | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          legal_name: string | null
          name: string
          phone: string | null
          postal_code: string | null
          state: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          currency_code?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          currency_code?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_state: string | null
          business_unit_id: string | null
          company_id: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          credit_days: number | null
          credit_limit: number | null
          custom_fields: Json | null
          customer_code: string
          customer_name: string
          customer_type: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          payment_terms: string | null
          phone: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          tax_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
          website: string | null
        }
        Insert: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          business_unit_id?: string | null
          company_id: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          custom_fields?: Json | null
          customer_code: string
          customer_name: string
          customer_type?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          payment_terms?: string | null
          phone?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          website?: string | null
        }
        Update: {
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          business_unit_id?: string | null
          company_id?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          credit_days?: number | null
          credit_limit?: number | null
          custom_fields?: Json | null
          customer_code?: string
          customer_name?: string
          customer_type?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          payment_terms?: string | null
          phone?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      damaged_items: {
        Row: {
          action_taken: string | null
          created_at: string
          damage_type: string
          description: string | null
          grn_id: string
          id: string
          item_id: string
          qty: number
          reported_by: string
          reported_date: string
          status: string
          updated_at: string
        }
        Insert: {
          action_taken?: string | null
          created_at?: string
          damage_type: string
          description?: string | null
          grn_id: string
          id?: string
          item_id: string
          qty: number
          reported_by: string
          reported_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          action_taken?: string | null
          created_at?: string
          damage_type?: string
          description?: string | null
          grn_id?: string
          id?: string
          item_id?: string
          qty?: number
          reported_by?: string
          reported_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "damaged_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_item_adjustments: {
        Row: {
          adjustment_type: string
          company_id: string
          created_at: string
          created_by: string | null
          delivery_note_item_id: string
          dn_id: string
          id: string
          new_dispatched_qty: number
          prior_dispatched_qty: number
          qty_delta: number
          reason: string | null
        }
        Insert: {
          adjustment_type: string
          company_id: string
          created_at?: string
          created_by?: string | null
          delivery_note_item_id: string
          dn_id: string
          id?: string
          new_dispatched_qty: number
          prior_dispatched_qty: number
          qty_delta: number
          reason?: string | null
        }
        Update: {
          adjustment_type?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          delivery_note_item_id?: string
          dn_id?: string
          id?: string
          new_dispatched_qty?: number
          prior_dispatched_qty?: number
          qty_delta?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_item_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_adjustments_delivery_note_item_id_fkey"
            columns: ["delivery_note_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_adjustments_dn_id_fkey"
            columns: ["dn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_item_picks: {
        Row: {
          batch_location_sku: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivery_note_item_id: string
          dispatched_qty: number
          dn_id: string
          id: string
          is_mismatch_warning_acknowledged: boolean
          item_id: string
          mismatch_reason: string | null
          pick_list_id: string
          pick_list_item_id: string | null
          picked_at: string
          picked_batch_code: string
          picked_batch_received_at: string
          picked_location_id: string
          picked_qty: number
          picker_user_id: string | null
          received_qty: number
          reversed_qty: number
          source_warehouse_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          batch_location_sku?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_note_item_id: string
          dispatched_qty?: number
          dn_id: string
          id?: string
          is_mismatch_warning_acknowledged?: boolean
          item_id: string
          mismatch_reason?: string | null
          pick_list_id: string
          pick_list_item_id?: string | null
          picked_at?: string
          picked_batch_code: string
          picked_batch_received_at: string
          picked_location_id: string
          picked_qty?: number
          picker_user_id?: string | null
          received_qty?: number
          reversed_qty?: number
          source_warehouse_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          batch_location_sku?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_note_item_id?: string
          dispatched_qty?: number
          dn_id?: string
          id?: string
          is_mismatch_warning_acknowledged?: boolean
          item_id?: string
          mismatch_reason?: string | null
          pick_list_id?: string
          pick_list_item_id?: string | null
          picked_at?: string
          picked_batch_code?: string
          picked_batch_received_at?: string
          picked_location_id?: string
          picked_qty?: number
          picker_user_id?: string | null
          received_qty?: number
          reversed_qty?: number
          source_warehouse_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_item_picks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_delivery_note_item_id_fkey"
            columns: ["delivery_note_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_dn_id_fkey"
            columns: ["dn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_pick_list_item_id_fkey"
            columns: ["pick_list_item_id"]
            isOneToOne: false
            referencedRelation: "pick_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_picked_location_id_fkey"
            columns: ["picked_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_picker_user_id_fkey"
            columns: ["picker_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_picks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_item_receiving_scans: {
        Row: {
          accepted_qty: number
          adjustment_reason: string | null
          box_id: string
          business_unit_id: string | null
          company_id: string
          created_at: string
          dn_id: string
          dn_item_id: string
          id: string
          item_id: string
          item_unit_option_id: string | null
          notes: string | null
          qr_code: string
          qr_qty: number
          scanned_at: string
          scanned_by: string
          uom_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          accepted_qty: number
          adjustment_reason?: string | null
          box_id: string
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          dn_id: string
          dn_item_id: string
          id?: string
          item_id: string
          item_unit_option_id?: string | null
          notes?: string | null
          qr_code: string
          qr_qty: number
          scanned_at?: string
          scanned_by: string
          uom_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          accepted_qty?: number
          adjustment_reason?: string | null
          box_id?: string
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          dn_id?: string
          dn_item_id?: string
          id?: string
          item_id?: string
          item_unit_option_id?: string | null
          notes?: string | null
          qr_code?: string
          qr_qty?: number
          scanned_at?: string
          scanned_by?: string
          uom_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_item_receiving_scans_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_receiving_scans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_receiving_scans_dn_id_fkey"
            columns: ["dn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_receiving_scans_dn_item_id_fkey"
            columns: ["dn_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_receiving_scans_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_receiving_scans_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_receiving_scans_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_receiving_scans_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_item_receiving_scans_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_items: {
        Row: {
          allocated_qty: number
          company_id: string
          created_at: string
          dispatched_qty: number
          dn_id: string
          fulfilling_warehouse_id: string
          id: string
          is_voided: boolean
          item_id: string
          item_unit_option_id: string | null
          picked_qty: number
          received_qty: number
          receiving_discrepancy_flag: boolean
          receiving_notes: string | null
          receiving_overage_posted_qty: number
          receiving_overage_review_notes: string | null
          receiving_overage_review_status: string | null
          receiving_overage_reviewed_at: string | null
          receiving_overage_reviewed_by: string | null
          receiving_status: string
          receiving_variance_qty: number
          requesting_warehouse_id: string
          short_qty: number
          sr_id: string
          sr_item_id: string
          uom_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          allocated_qty?: number
          company_id: string
          created_at?: string
          dispatched_qty?: number
          dn_id: string
          fulfilling_warehouse_id: string
          id?: string
          is_voided?: boolean
          item_id: string
          item_unit_option_id?: string | null
          picked_qty?: number
          received_qty?: number
          receiving_discrepancy_flag?: boolean
          receiving_notes?: string | null
          receiving_overage_posted_qty?: number
          receiving_overage_review_notes?: string | null
          receiving_overage_review_status?: string | null
          receiving_overage_reviewed_at?: string | null
          receiving_overage_reviewed_by?: string | null
          receiving_status?: string
          receiving_variance_qty?: number
          requesting_warehouse_id: string
          short_qty?: number
          sr_id: string
          sr_item_id: string
          uom_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          allocated_qty?: number
          company_id?: string
          created_at?: string
          dispatched_qty?: number
          dn_id?: string
          fulfilling_warehouse_id?: string
          id?: string
          is_voided?: boolean
          item_id?: string
          item_unit_option_id?: string | null
          picked_qty?: number
          received_qty?: number
          receiving_discrepancy_flag?: boolean
          receiving_notes?: string | null
          receiving_overage_posted_qty?: number
          receiving_overage_review_notes?: string | null
          receiving_overage_review_status?: string | null
          receiving_overage_reviewed_at?: string | null
          receiving_overage_reviewed_by?: string | null
          receiving_status?: string
          receiving_variance_qty?: number
          requesting_warehouse_id?: string
          short_qty?: number
          sr_id?: string
          sr_item_id?: string
          uom_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_dn_id_fkey"
            columns: ["dn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_fulfilling_warehouse_id_fkey"
            columns: ["fulfilling_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_receiving_overage_reviewed_by_fkey"
            columns: ["receiving_overage_reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_requesting_warehouse_id_fkey"
            columns: ["requesting_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_sr_id_fkey"
            columns: ["sr_id"]
            isOneToOne: false
            referencedRelation: "stock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_sr_item_id_fkey"
            columns: ["sr_item_id"]
            isOneToOne: false
            referencedRelation: "stock_request_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_items_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_receiving_exceptions: {
        Row: {
          accepted_qty: number
          batch_number: string | null
          box_id: string
          business_unit_id: string | null
          company_id: string
          created_at: string
          dn_id: string
          id: string
          item_id: string
          item_unit_option_id: string | null
          location_id: string | null
          notes: string | null
          qr_code: string
          qr_qty: number
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scanned_at: string
          scanned_by: string
          status: string
          uom_id: string
          updated_at: string
        }
        Insert: {
          accepted_qty: number
          batch_number?: string | null
          box_id: string
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          dn_id: string
          id?: string
          item_id: string
          item_unit_option_id?: string | null
          location_id?: string | null
          notes?: string | null
          qr_code: string
          qr_qty: number
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scanned_at?: string
          scanned_by: string
          status?: string
          uom_id: string
          updated_at?: string
        }
        Update: {
          accepted_qty?: number
          batch_number?: string | null
          box_id?: string
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          dn_id?: string
          id?: string
          item_id?: string
          item_unit_option_id?: string | null
          location_id?: string | null
          notes?: string | null
          qr_code?: string
          qr_qty?: number
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scanned_at?: string
          scanned_by?: string
          status?: string
          uom_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_receiving_exceptions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_receiving_exceptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_receiving_exceptions_dn_id_fkey"
            columns: ["dn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_receiving_exceptions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_receiving_exceptions_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_receiving_exceptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_receiving_exceptions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_receiving_exceptions_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_receiving_exceptions_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_note_sources: {
        Row: {
          company_id: string
          created_at: string
          dn_id: string
          sr_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dn_id: string
          sr_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dn_id?: string
          sr_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_note_sources_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_sources_dn_id_fkey"
            columns: ["dn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_note_sources_sr_id_fkey"
            columns: ["sr_id"]
            isOneToOne: false
            referencedRelation: "stock_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_notes: {
        Row: {
          business_unit_id: string | null
          company_id: string
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivery_time: string | null
          dispatched_at: string | null
          dn_no: string
          driver_name: string | null
          driver_signature: string | null
          fulfilling_warehouse_id: string
          fulfillment_mode: string
          helper_name: string | null
          id: string
          notes: string | null
          picking_completed_at: string | null
          picking_completed_by: string | null
          picking_started_at: string | null
          picking_started_by: string | null
          plate_number: string | null
          received_at: string | null
          received_by: string | null
          receiving_completed_at: string | null
          receiving_completed_by: string | null
          receiving_discrepancy_notes: string | null
          receiving_has_discrepancy: boolean
          receiving_notes: string | null
          receiving_started_at: string | null
          receiving_started_by: string | null
          requesting_warehouse_id: string
          status: Database["public"]["Enums"]["delivery_note_status"]
          updated_at: string
          updated_by: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_time?: string | null
          dispatched_at?: string | null
          dn_no: string
          driver_name?: string | null
          driver_signature?: string | null
          fulfilling_warehouse_id: string
          fulfillment_mode?: string
          helper_name?: string | null
          id?: string
          notes?: string | null
          picking_completed_at?: string | null
          picking_completed_by?: string | null
          picking_started_at?: string | null
          picking_started_by?: string | null
          plate_number?: string | null
          received_at?: string | null
          received_by?: string | null
          receiving_completed_at?: string | null
          receiving_completed_by?: string | null
          receiving_discrepancy_notes?: string | null
          receiving_has_discrepancy?: boolean
          receiving_notes?: string | null
          receiving_started_at?: string | null
          receiving_started_by?: string | null
          requesting_warehouse_id: string
          status?: Database["public"]["Enums"]["delivery_note_status"]
          updated_at?: string
          updated_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_time?: string | null
          dispatched_at?: string | null
          dn_no?: string
          driver_name?: string | null
          driver_signature?: string | null
          fulfilling_warehouse_id?: string
          fulfillment_mode?: string
          helper_name?: string | null
          id?: string
          notes?: string | null
          picking_completed_at?: string | null
          picking_completed_by?: string | null
          picking_started_at?: string | null
          picking_started_by?: string | null
          plate_number?: string | null
          received_at?: string | null
          received_by?: string | null
          receiving_completed_at?: string | null
          receiving_completed_by?: string | null
          receiving_discrepancy_notes?: string | null
          receiving_has_discrepancy?: boolean
          receiving_notes?: string | null
          receiving_started_at?: string | null
          receiving_started_by?: string | null
          requesting_warehouse_id?: string
          status?: Database["public"]["Enums"]["delivery_note_status"]
          updated_at?: string
          updated_by?: string | null
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_notes_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_fulfilling_warehouse_id_fkey"
            columns: ["fulfilling_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_picking_completed_by_fkey"
            columns: ["picking_completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_picking_started_by_fkey"
            columns: ["picking_started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_receiving_completed_by_fkey"
            columns: ["receiving_completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_receiving_started_by_fkey"
            columns: ["receiving_started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_requesting_warehouse_id_fkey"
            columns: ["requesting_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_notes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      document_code_sequences: {
        Row: {
          code_prefix: string
          company_id: string
          created_at: string
          last_number: number
          updated_at: string
        }
        Insert: {
          code_prefix: string
          company_id: string
          created_at?: string
          last_number?: number
          updated_at?: string
        }
        Update: {
          code_prefix?: string
          company_id?: string
          created_at?: string
          last_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_code_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_distribution_locations: {
        Row: {
          assigned_date: string
          city: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          is_primary: boolean
          notes: string | null
          region_state: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_date?: string
          city: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          region_state: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_date?: string
          city?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          is_primary?: boolean
          notes?: string | null
          region_state?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_distribution_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_distribution_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_distribution_locations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_distribution_locations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_employee_commission_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_distribution_locations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_by_employee"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "employee_distribution_locations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_unit_id: string | null
          city: string | null
          commission_rate: number
          company_id: string
          country: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          department: string | null
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string
          employment_status: string
          first_name: string
          hire_date: string
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          postal_code: string | null
          region_state: string | null
          role: string
          termination_date: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          version: number
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_unit_id?: string | null
          city?: string | null
          commission_rate?: number
          company_id: string
          country?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          department?: string | null
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code: string
          employment_status?: string
          first_name: string
          hire_date: string
          id?: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          postal_code?: string | null
          region_state?: string | null
          role?: string
          termination_date?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          version?: number
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_unit_id?: string | null
          city?: string | null
          commission_rate?: number
          company_id?: string
          country?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          department?: string | null
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string
          employment_status?: string
          first_name?: string
          hire_date?: string
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          postal_code?: string | null
          region_state?: string | null
          role?: string
          termination_date?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      frame_job_order_items: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          issued_quantity: number
          item_description: string | null
          item_id: string
          job_order_id: string
          quotation_component_id: string | null
          quotation_item_id: string | null
          required_quantity: number
          sales_order_component_id: string | null
          sales_order_item_id: string | null
          total_amount: number
          unit_rate: number
          uom_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          issued_quantity?: number
          item_description?: string | null
          item_id: string
          job_order_id: string
          quotation_component_id?: string | null
          quotation_item_id?: string | null
          required_quantity: number
          sales_order_component_id?: string | null
          sales_order_item_id?: string | null
          total_amount?: number
          unit_rate?: number
          uom_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          issued_quantity?: number
          item_description?: string | null
          item_id?: string
          job_order_id?: string
          quotation_component_id?: string | null
          quotation_item_id?: string | null
          required_quantity?: number
          sales_order_component_id?: string | null
          sales_order_item_id?: string | null
          total_amount?: number
          unit_rate?: number
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frame_job_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "frame_job_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_quotation_component_id_fkey"
            columns: ["quotation_component_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_item_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_quotation_item_id_fkey"
            columns: ["quotation_item_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_sales_order_component_id_fkey"
            columns: ["sales_order_component_id"]
            isOneToOne: false
            referencedRelation: "sales_order_item_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_order_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      frame_job_orders: {
        Row: {
          business_unit_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          customer_id: string
          deleted_at: string | null
          id: string
          job_order_code: string
          notes: string | null
          order_date: string
          quotation_id: string | null
          sales_invoice_id: string | null
          sales_order_id: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          customer_id: string
          deleted_at?: string | null
          id?: string
          job_order_code: string
          notes?: string | null
          order_date?: string
          quotation_id?: string | null
          sales_invoice_id?: string | null
          sales_order_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          customer_id?: string
          deleted_at?: string | null
          id?: string
          job_order_code?: string
          notes?: string | null
          order_date?: string
          quotation_id?: string | null
          sales_invoice_id?: string | null
          sales_order_id?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frame_job_orders_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: true
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_orders_sales_invoice_id_fkey"
            columns: ["sales_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frame_job_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_boxes: {
        Row: {
          barcode: string
          batch_location_sku: string | null
          box_number: number
          container_number: string | null
          created_at: string
          delivery_date: string
          grn_item_id: string
          id: string
          qty_per_box: number
          seal_number: string | null
          warehouse_location_id: string | null
        }
        Insert: {
          barcode: string
          batch_location_sku?: string | null
          box_number: number
          container_number?: string | null
          created_at?: string
          delivery_date: string
          grn_item_id: string
          id?: string
          qty_per_box: number
          seal_number?: string | null
          warehouse_location_id?: string | null
        }
        Update: {
          barcode?: string
          batch_location_sku?: string | null
          box_number?: number
          container_number?: string | null
          created_at?: string
          delivery_date?: string
          grn_item_id?: string
          id?: string
          qty_per_box?: number
          seal_number?: string | null
          warehouse_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grn_boxes_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: false
            referencedRelation: "grn_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_boxes_warehouse_location_id_fkey"
            columns: ["warehouse_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      grn_items: {
        Row: {
          barcodes_printed: boolean | null
          created_at: string
          damaged_qty: number
          grn_id: string
          id: string
          item_id: string
          item_unit_option_id: string | null
          load_list_item_id: string | null
          load_list_qty: number
          notes: string | null
          num_boxes: number | null
          qty_per_unit: number
          received_qty: number
          unit_name: string
          updated_at: string
        }
        Insert: {
          barcodes_printed?: boolean | null
          created_at?: string
          damaged_qty?: number
          grn_id: string
          id?: string
          item_id: string
          item_unit_option_id?: string | null
          load_list_item_id?: string | null
          load_list_qty: number
          notes?: string | null
          num_boxes?: number | null
          qty_per_unit: number
          received_qty?: number
          unit_name: string
          updated_at?: string
        }
        Update: {
          barcodes_printed?: boolean | null
          created_at?: string
          damaged_qty?: number
          grn_id?: string
          id?: string
          item_id?: string
          item_unit_option_id?: string | null
          load_list_item_id?: string | null
          load_list_qty?: number
          notes?: string | null
          num_boxes?: number | null
          qty_per_unit?: number
          received_qty?: number
          unit_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grn_items_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_items_load_list_item_id_fkey"
            columns: ["load_list_item_id"]
            isOneToOne: false
            referencedRelation: "load_list_items"
            referencedColumns: ["id"]
          },
        ]
      }
      grns: {
        Row: {
          batch_number: string | null
          business_unit_id: string
          checked_by: string | null
          company_id: string
          container_number: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivery_date: string
          grn_number: string
          id: string
          load_list_id: string
          notes: string | null
          received_by: string | null
          receiving_date: string
          seal_number: string | null
          status: string
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          batch_number?: string | null
          business_unit_id: string
          checked_by?: string | null
          company_id: string
          container_number?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string
          grn_number: string
          id?: string
          load_list_id: string
          notes?: string | null
          received_by?: string | null
          receiving_date?: string
          seal_number?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          batch_number?: string | null
          business_unit_id?: string
          checked_by?: string | null
          company_id?: string
          container_number?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivery_date?: string
          grn_number?: string
          id?: string
          load_list_id?: string
          notes?: string | null
          received_by?: string | null
          receiving_date?: string
          seal_number?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "grns_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_checked_by_fkey"
            columns: ["checked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_load_list_id_fkey"
            columns: ["load_list_id"]
            isOneToOne: true
            referencedRelation: "load_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          company_id: string
          consumed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          item_id: string
          job_order_id: string | null
          quantity: number
          quotation_component_id: string | null
          quotation_id: string | null
          quotation_item_id: string | null
          released_at: string | null
          reservation_type: string
          reserved_at: string
          sales_order_component_id: string | null
          sales_order_id: string | null
          sales_order_item_id: string | null
          source_id: string
          source_type: string
          status: string
          uom_id: string
          updated_at: string
          updated_by: string | null
          warehouse_id: string
        }
        Insert: {
          company_id: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_id: string
          job_order_id?: string | null
          quantity: number
          quotation_component_id?: string | null
          quotation_id?: string | null
          quotation_item_id?: string | null
          released_at?: string | null
          reservation_type: string
          reserved_at?: string
          sales_order_component_id?: string | null
          sales_order_id?: string | null
          sales_order_item_id?: string | null
          source_id: string
          source_type: string
          status?: string
          uom_id: string
          updated_at?: string
          updated_by?: string | null
          warehouse_id: string
        }
        Update: {
          company_id?: string
          consumed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_id?: string
          job_order_id?: string | null
          quantity?: number
          quotation_component_id?: string | null
          quotation_id?: string | null
          quotation_item_id?: string | null
          released_at?: string | null
          reservation_type?: string
          reserved_at?: string
          sales_order_component_id?: string | null
          sales_order_id?: string | null
          sales_order_item_id?: string | null
          source_id?: string
          source_type?: string
          status?: string
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_job_order_id_fkey"
            columns: ["job_order_id"]
            isOneToOne: false
            referencedRelation: "frame_job_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_quotation_component_id_fkey"
            columns: ["quotation_component_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_item_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_quotation_item_id_fkey"
            columns: ["quotation_item_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_sales_order_component_id_fkey"
            columns: ["sales_order_component_id"]
            isOneToOne: false
            referencedRelation: "sales_order_item_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_employee_commissions: {
        Row: {
          commission_amount: number
          commission_split_percentage: number
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string
          id: string
          invoice_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_amount: number
          commission_split_percentage: number
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id: string
          id?: string
          invoice_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_amount?: number
          commission_split_percentage?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string
          id?: string
          invoice_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_employee_commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_employee_commissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_employee_commissions_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_employee_commissions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_employee_commissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_employees: {
        Row: {
          commission_amount: number
          commission_split_percentage: number
          company_id: string
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          invoice_id: string
        }
        Insert: {
          commission_amount?: number
          commission_split_percentage?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          invoice_id: string
        }
        Update: {
          commission_amount?: number
          commission_split_percentage?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_employee_commission_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "invoice_employees_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_by_employee"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "invoice_employees_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_code: string | null
          payment_date: string
          payment_method: string
          reference: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount: number
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_code?: string | null
          payment_date: string
          payment_method: string
          reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount?: number
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_code?: string | null
          payment_date?: string
          payment_method?: string
          reference?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      item_batch_locations: {
        Row: {
          batch_location_sku: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          item_batch_id: string
          item_id: string
          location_id: string
          qty_available: number | null
          qty_on_hand: number
          qty_reserved: number
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          batch_location_sku: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_batch_id: string
          item_id: string
          location_id: string
          qty_available?: number | null
          qty_on_hand?: number
          qty_reserved?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          batch_location_sku?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_batch_id?: string
          item_id?: string
          location_id?: string
          qty_available?: number | null
          qty_on_hand?: number
          qty_reserved?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_batch_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batch_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batch_locations_item_batch_id_fkey"
            columns: ["item_batch_id"]
            isOneToOne: false
            referencedRelation: "item_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batch_locations_item_batch_id_fkey"
            columns: ["item_batch_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_recon_item_batch_vs_batch_location"
            referencedColumns: ["item_batch_id"]
          },
          {
            foreignKeyName: "item_batch_locations_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batch_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batch_locations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batch_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      item_batches: {
        Row: {
          batch_code: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          item_id: string
          qty_available: number | null
          qty_on_hand: number
          qty_reserved: number
          received_at: string
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          batch_code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_id: string
          qty_available?: number | null
          qty_on_hand?: number
          qty_reserved?: number
          received_at: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          batch_code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_id?: string
          qty_available?: number | null
          qty_on_hand?: number
          qty_reserved?: number
          received_at?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      item_categories: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      item_prices: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          currency_code: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          item_id: string
          price: number
          price_tier: string
          price_tier_name: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          item_id: string
          price: number
          price_tier: string
          price_tier_name: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          item_id?: string
          price?: number
          price_tier?: string
          price_tier_name?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_prices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      item_unit_options: {
        Row: {
          barcode: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          is_base: boolean
          is_default: boolean
          item_id: string
          option_label: string | null
          qty_per_unit: number
          sort_order: number
          uom_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          barcode: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_base?: boolean
          is_default?: boolean
          item_id: string
          option_label?: string | null
          qty_per_unit: number
          sort_order?: number
          uom_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          barcode?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          is_base?: boolean
          is_default?: boolean
          item_id?: string
          option_label?: string | null
          qty_per_unit?: number
          sort_order?: number
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "item_unit_options_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_unit_options_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_unit_options_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_unit_options_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_unit_options_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      item_warehouse: {
        Row: {
          available_stock: number | null
          company_id: string
          created_at: string
          created_by: string | null
          current_stock: number | null
          default_location_id: string | null
          deleted_at: string | null
          estimated_arrival_date: string | null
          id: string
          in_transit: number
          is_active: boolean | null
          item_id: string
          max_quantity: number | null
          putaway_qty: number
          reorder_level: number | null
          reorder_quantity: number | null
          reserved_stock: number | null
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          available_stock?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          default_location_id?: string | null
          deleted_at?: string | null
          estimated_arrival_date?: string | null
          id?: string
          in_transit?: number
          is_active?: boolean | null
          item_id: string
          max_quantity?: number | null
          putaway_qty?: number
          reorder_level?: number | null
          reorder_quantity?: number | null
          reserved_stock?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          available_stock?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          current_stock?: number | null
          default_location_id?: string | null
          deleted_at?: string | null
          estimated_arrival_date?: string | null
          id?: string
          in_transit?: number
          is_active?: boolean | null
          item_id?: string
          max_quantity?: number | null
          putaway_qty?: number
          reorder_level?: number | null
          reorder_quantity?: number | null
          reserved_stock?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_warehouse_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          default_warehouse: string | null
          deleted_at: string | null
          description: string | null
          dimensions: Json | null
          id: string
          image_url: string | null
          import_cost: number | null
          import_currency: string | null
          is_active: boolean | null
          is_stock_item: boolean | null
          item_code: string
          item_name: string
          item_name_cn: string | null
          item_type: string
          purchase_price: number | null
          reorder_level: number
          reorder_quantity: number
          sales_price: number | null
          sop: number | null
          supplier_code: string | null
          track_batch: boolean | null
          track_serial: boolean | null
          uom_id: string
          updated_at: string
          updated_by: string | null
          version: number
          weight: number | null
          weight_uom: string | null
        }
        Insert: {
          category_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          default_warehouse?: string | null
          deleted_at?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          image_url?: string | null
          import_cost?: number | null
          import_currency?: string | null
          is_active?: boolean | null
          is_stock_item?: boolean | null
          item_code: string
          item_name: string
          item_name_cn?: string | null
          item_type: string
          purchase_price?: number | null
          reorder_level?: number
          reorder_quantity?: number
          sales_price?: number | null
          sop?: number | null
          supplier_code?: string | null
          track_batch?: boolean | null
          track_serial?: boolean | null
          uom_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          weight?: number | null
          weight_uom?: string | null
        }
        Update: {
          category_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          default_warehouse?: string | null
          deleted_at?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          image_url?: string | null
          import_cost?: number | null
          import_currency?: string | null
          is_active?: boolean | null
          is_stock_item?: boolean | null
          item_code?: string
          item_name?: string
          item_name_cn?: string | null
          item_type?: string
          purchase_price?: number | null
          reorder_level?: number
          reorder_quantity?: number
          sales_price?: number | null
          sop?: number | null
          supplier_code?: string | null
          track_batch?: boolean | null
          track_serial?: boolean | null
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          weight?: number | null
          weight_uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "item_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          journal_code: string
          posted_at: string | null
          posted_by: string | null
          posting_date: string
          reference_code: string | null
          reference_id: string | null
          reference_type: string | null
          source_module: string
          status: string
          total_credit: number
          total_debit: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          journal_code: string
          posted_at?: string | null
          posted_by?: string | null
          posting_date: string
          reference_code?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_module: string
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          journal_code?: string
          posted_at?: string | null
          posted_by?: string | null
          posting_date?: string
          reference_code?: string | null
          reference_id?: string | null
          reference_type?: string | null
          source_module?: string
          status?: string
          total_credit?: number
          total_debit?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          company_id: string
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          credit: number
          debit: number
          description: string | null
          id: string
          journal_entry_id: string
          line_number: number
          project_id: string | null
        }
        Insert: {
          account_id: string
          company_id: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id: string
          line_number: number
          project_id?: string | null
        }
        Update: {
          account_id?: string
          company_id?: string
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_entry_id?: string
          line_number?: number
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_entry_id_fkey"
            columns: ["journal_entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      load_list_items: {
        Row: {
          created_at: string
          damaged_qty: number
          id: string
          item_id: string
          item_unit_option_id: string | null
          load_list_id: string
          load_list_qty: number
          notes: string | null
          qty_per_unit: number
          received_qty: number
          shortage_qty: number | null
          total_price: number | null
          unit_name: string
          unit_price: number
          uom_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          damaged_qty?: number
          id?: string
          item_id: string
          item_unit_option_id?: string | null
          load_list_id: string
          load_list_qty: number
          notes?: string | null
          qty_per_unit: number
          received_qty?: number
          shortage_qty?: number | null
          total_price?: number | null
          unit_name: string
          unit_price?: number
          uom_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          damaged_qty?: number
          id?: string
          item_id?: string
          item_unit_option_id?: string | null
          load_list_id?: string
          load_list_qty?: number
          notes?: string | null
          qty_per_unit?: number
          received_qty?: number
          shortage_qty?: number | null
          total_price?: number | null
          unit_name?: string
          unit_price?: number
          uom_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_list_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_list_items_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_list_items_load_list_id_fkey"
            columns: ["load_list_id"]
            isOneToOne: false
            referencedRelation: "load_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_list_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      load_list_sr_items: {
        Row: {
          created_at: string
          fulfilled_qty: number
          id: string
          load_list_item_id: string
          sr_item_id: string
        }
        Insert: {
          created_at?: string
          fulfilled_qty: number
          id?: string
          load_list_item_id: string
          sr_item_id: string
        }
        Update: {
          created_at?: string
          fulfilled_qty?: number
          id?: string
          load_list_item_id?: string
          sr_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_list_sr_items_load_list_item_id_fkey"
            columns: ["load_list_item_id"]
            isOneToOne: false
            referencedRelation: "load_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_list_sr_items_sr_item_id_fkey"
            columns: ["sr_item_id"]
            isOneToOne: false
            referencedRelation: "stock_requisition_items"
            referencedColumns: ["id"]
          },
        ]
      }
      load_lists: {
        Row: {
          actual_arrival_date: string | null
          approved_by: string | null
          approved_date: string | null
          batch_number: string | null
          business_unit_id: string
          company_id: string
          container_number: string | null
          created_at: string
          created_by: string
          currency: string
          deleted_at: string | null
          estimated_arrival_date: string | null
          id: string
          liner_name: string | null
          ll_number: string
          load_date: string | null
          notes: string | null
          received_by: string | null
          received_date: string | null
          seal_number: string | null
          status: string
          supplier_id: string
          supplier_ll_number: string | null
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          actual_arrival_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          batch_number?: string | null
          business_unit_id: string
          company_id: string
          container_number?: string | null
          created_at?: string
          created_by: string
          currency?: string
          deleted_at?: string | null
          estimated_arrival_date?: string | null
          id?: string
          liner_name?: string | null
          ll_number: string
          load_date?: string | null
          notes?: string | null
          received_by?: string | null
          received_date?: string | null
          seal_number?: string | null
          status?: string
          supplier_id: string
          supplier_ll_number?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          actual_arrival_date?: string | null
          approved_by?: string | null
          approved_date?: string | null
          batch_number?: string | null
          business_unit_id?: string
          company_id?: string
          container_number?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          deleted_at?: string | null
          estimated_arrival_date?: string | null
          id?: string
          liner_name?: string | null
          ll_number?: string
          load_date?: string | null
          notes?: string | null
          received_by?: string | null
          received_date?: string | null
          seal_number?: string | null
          status?: string
          supplier_id?: string
          supplier_ll_number?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "load_lists_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_lists_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_lists_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_lists_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_lists_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "load_lists_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_operations: {
        Row: {
          assigned_to: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          manufacturing_order_id: string
          notes: string | null
          operation_code: string
          operation_name: string
          operation_type: string
          sequence_no: number
          started_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
          workstation_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          manufacturing_order_id: string
          notes?: string | null
          operation_code: string
          operation_name: string
          operation_type?: string
          sequence_no?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          workstation_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          manufacturing_order_id?: string
          notes?: string | null
          operation_code?: string
          operation_name?: string
          operation_type?: string
          sequence_no?: number
          started_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_operations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_operations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_operations_manufacturing_order_id_fkey"
            columns: ["manufacturing_order_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_operations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_operations_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_order_events: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          event_note: string | null
          event_type: string
          from_status: string | null
          id: string
          manufacturing_operation_id: string | null
          manufacturing_order_id: string
          to_status: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_note?: string | null
          event_type: string
          from_status?: string | null
          id?: string
          manufacturing_operation_id?: string | null
          manufacturing_order_id: string
          to_status?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          event_note?: string | null
          event_type?: string
          from_status?: string | null
          id?: string
          manufacturing_operation_id?: string | null
          manufacturing_order_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_order_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_events_manufacturing_operation_id_fkey"
            columns: ["manufacturing_operation_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_events_manufacturing_order_id_fkey"
            columns: ["manufacturing_order_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_order_items: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          id: string
          item_description: string | null
          item_id: string
          manufacturing_order_id: string
          quantity: number
          sales_order_item_id: string | null
          sort_order: number
          uom_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          item_description?: string | null
          item_id: string
          manufacturing_order_id: string
          quantity?: number
          sales_order_item_id?: string | null
          sort_order?: number
          uom_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          item_description?: string | null
          item_id?: string
          manufacturing_order_id?: string
          quantity?: number
          sales_order_item_id?: string | null
          sort_order?: number
          uom_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_items_manufacturing_order_id_fkey"
            columns: ["manufacturing_order_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_items_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_order_materials: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          issued_quantity: number
          item_description: string | null
          item_id: string
          manufacturing_order_id: string
          manufacturing_order_item_id: string | null
          material_status: string
          required_quantity: number
          sales_order_component_id: string | null
          sales_order_item_id: string | null
          sort_order: number
          total_amount: number
          unit_rate: number
          uom_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          issued_quantity?: number
          item_description?: string | null
          item_id: string
          manufacturing_order_id: string
          manufacturing_order_item_id?: string | null
          material_status?: string
          required_quantity: number
          sales_order_component_id?: string | null
          sales_order_item_id?: string | null
          sort_order?: number
          total_amount?: number
          unit_rate?: number
          uom_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          issued_quantity?: number
          item_description?: string | null
          item_id?: string
          manufacturing_order_id?: string
          manufacturing_order_item_id?: string | null
          material_status?: string
          required_quantity?: number
          sales_order_component_id?: string | null
          sales_order_item_id?: string | null
          sort_order?: number
          total_amount?: number
          unit_rate?: number
          uom_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_order_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_materials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_materials_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_materials_manufacturing_order_id_fkey"
            columns: ["manufacturing_order_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_materials_manufacturing_order_item_id_fkey"
            columns: ["manufacturing_order_item_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_materials_sales_order_component_id_fkey"
            columns: ["sales_order_component_id"]
            isOneToOne: false
            referencedRelation: "sales_order_item_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_materials_sales_order_item_id_fkey"
            columns: ["sales_order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_materials_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_order_materials_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_orders: {
        Row: {
          business_unit_id: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          current_workstation_id: string | null
          custom_fields: Json | null
          customer_id: string | null
          deleted_at: string | null
          due_date: string | null
          frame_job_order_id: string | null
          id: string
          manufacturing_order_code: string
          notes: string | null
          priority: string
          production_type: string
          quotation_id: string | null
          sales_order_id: string | null
          source_id: string
          source_type: string
          started_at: string | null
          status: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_workstation_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          frame_job_order_id?: string | null
          id?: string
          manufacturing_order_code: string
          notes?: string | null
          priority?: string
          production_type?: string
          quotation_id?: string | null
          sales_order_id?: string | null
          source_id: string
          source_type?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          current_workstation_id?: string | null
          custom_fields?: Json | null
          customer_id?: string | null
          deleted_at?: string | null
          due_date?: string | null
          frame_job_order_id?: string | null
          id?: string
          manufacturing_order_code?: string
          notes?: string | null
          priority?: string
          production_type?: string
          quotation_id?: string | null
          sales_order_id?: string | null
          source_id?: string
          source_type?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_orders_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_current_workstation_id_fkey"
            columns: ["current_workstation_id"]
            isOneToOne: false
            referencedRelation: "manufacturing_workstations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_frame_job_order_id_fkey"
            columns: ["frame_job_order_id"]
            isOneToOne: false
            referencedRelation: "frame_job_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      manufacturing_workstations: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          sort_order: number
          updated_at: string
          updated_by: string | null
          workstation_code: string
          workstation_name: string
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          workstation_code: string
          workstation_name: string
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
          workstation_code?: string
          workstation_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "manufacturing_workstations_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_workstations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_workstations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manufacturing_workstations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          capability_action: string | null
          capability_key: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_granular: boolean
          label: string | null
          parent_resource: string | null
          permission_group: string | null
          resource: string
          surface: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          capability_action?: string | null
          capability_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_granular?: boolean
          label?: string | null
          parent_resource?: string | null
          permission_group?: string | null
          resource: string
          surface?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          capability_action?: string | null
          capability_key?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_granular?: boolean
          label?: string | null
          parent_resource?: string | null
          permission_group?: string | null
          resource?: string
          surface?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_list_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          company_id: string
          pick_list_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          company_id: string
          pick_list_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          company_id?: string
          pick_list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_assignees_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_assignees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_assignees_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_assignees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_list_item_claims: {
        Row: {
          claimed_at: string
          claimed_by: string
          company_id: string
          expires_at: string
          pick_list_id: string
          pick_list_item_id: string
          released_at: string | null
          updated_at: string
        }
        Insert: {
          claimed_at?: string
          claimed_by: string
          company_id: string
          expires_at: string
          pick_list_id: string
          pick_list_item_id: string
          released_at?: string | null
          updated_at?: string
        }
        Update: {
          claimed_at?: string
          claimed_by?: string
          company_id?: string
          expires_at?: string
          pick_list_id?: string
          pick_list_item_id?: string
          released_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_item_claims_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_item_claims_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_item_claims_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_item_claims_pick_list_item_id_fkey"
            columns: ["pick_list_item_id"]
            isOneToOne: true
            referencedRelation: "pick_list_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_list_item_pick_operations: {
        Row: {
          company_id: string
          created_at: string
          operation_id: string
          pick_list_id: string
          pick_list_item_id: string
          picked_qty: number
          picker_user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          operation_id: string
          pick_list_id: string
          pick_list_item_id: string
          picked_qty: number
          picker_user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          operation_id?: string
          pick_list_id?: string
          pick_list_item_id?: string
          picked_qty?: number
          picker_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_item_pick_operations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_item_pick_operations_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_item_pick_operations_pick_list_item_id_fkey"
            columns: ["pick_list_item_id"]
            isOneToOne: false
            referencedRelation: "pick_list_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_item_pick_operations_picker_user_id_fkey"
            columns: ["picker_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_list_items: {
        Row: {
          allocated_qty: number
          company_id: string
          created_at: string
          dn_item_id: string
          id: string
          item_id: string
          item_unit_option_id: string | null
          pick_list_id: string
          picked_qty: number
          short_qty: number
          sr_id: string
          sr_item_id: string
          suggested_batch_location_sku: string | null
          suggested_pick_batch_code: string | null
          suggested_pick_batch_received_at: string | null
          suggested_pick_location_id: string | null
          uom_id: string
          updated_at: string
        }
        Insert: {
          allocated_qty?: number
          company_id: string
          created_at?: string
          dn_item_id: string
          id?: string
          item_id: string
          item_unit_option_id?: string | null
          pick_list_id: string
          picked_qty?: number
          short_qty?: number
          sr_id: string
          sr_item_id: string
          suggested_batch_location_sku?: string | null
          suggested_pick_batch_code?: string | null
          suggested_pick_batch_received_at?: string | null
          suggested_pick_location_id?: string | null
          uom_id: string
          updated_at?: string
        }
        Update: {
          allocated_qty?: number
          company_id?: string
          created_at?: string
          dn_item_id?: string
          id?: string
          item_id?: string
          item_unit_option_id?: string | null
          pick_list_id?: string
          picked_qty?: number
          short_qty?: number
          sr_id?: string
          sr_item_id?: string
          suggested_batch_location_sku?: string | null
          suggested_pick_batch_code?: string | null
          suggested_pick_batch_received_at?: string | null
          suggested_pick_location_id?: string | null
          uom_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_list_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_dn_item_id_fkey"
            columns: ["dn_item_id"]
            isOneToOne: false
            referencedRelation: "delivery_note_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_pick_list_id_fkey"
            columns: ["pick_list_id"]
            isOneToOne: false
            referencedRelation: "pick_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_sr_id_fkey"
            columns: ["sr_id"]
            isOneToOne: false
            referencedRelation: "stock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_sr_item_id_fkey"
            columns: ["sr_item_id"]
            isOneToOne: false
            referencedRelation: "stock_request_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_suggested_pick_location_id_fkey"
            columns: ["suggested_pick_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_list_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_lists: {
        Row: {
          business_unit_id: string | null
          cancel_reason: string | null
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          dn_id: string
          id: string
          notes: string | null
          pick_list_no: string
          started_at: string | null
          status: Database["public"]["Enums"]["pick_list_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          business_unit_id?: string | null
          cancel_reason?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dn_id: string
          id?: string
          notes?: string | null
          pick_list_no: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["pick_list_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          business_unit_id?: string | null
          cancel_reason?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          dn_id?: string
          id?: string
          notes?: string | null
          pick_list_no?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["pick_list_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pick_lists_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_dn_id_fkey"
            columns: ["dn_id"]
            isOneToOne: false
            referencedRelation: "delivery_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pick_lists_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transaction_items: {
        Row: {
          created_at: string
          discount: number
          id: string
          item_code: string
          item_id: string
          item_name: string
          line_total: number
          pos_transaction_id: string
          pricing_tier: string | null
          pricing_tier_name: string | null
          quantity: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount?: number
          id?: string
          item_code: string
          item_id: string
          item_name: string
          line_total: number
          pos_transaction_id: string
          pricing_tier?: string | null
          pricing_tier_name?: string | null
          quantity: number
          unit_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount?: number
          id?: string
          item_code?: string
          item_id?: string
          item_name?: string
          line_total?: number
          pos_transaction_id?: string
          pricing_tier?: string | null
          pricing_tier_name?: string | null
          quantity?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transaction_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transaction_items_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transaction_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: string
          pos_transaction_id: string
          reference: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method: string
          pos_transaction_id: string
          reference?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string
          pos_transaction_id?: string
          reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_transaction_payments_pos_transaction_id_fkey"
            columns: ["pos_transaction_id"]
            isOneToOne: false
            referencedRelation: "pos_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_transactions: {
        Row: {
          amount_paid: number
          business_unit_id: string | null
          cashier_id: string
          cashier_name: string
          change_amount: number
          company_id: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          id: string
          notes: string | null
          status: string
          subtotal: number
          tax_rate: number
          total_amount: number
          total_discount: number
          total_tax: number
          transaction_code: string
          transaction_date: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_paid: number
          business_unit_id?: string | null
          cashier_id: string
          cashier_name: string
          change_amount?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          status?: string
          subtotal: number
          tax_rate?: number
          total_amount: number
          total_discount?: number
          total_tax?: number
          transaction_code: string
          transaction_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_paid?: number
          business_unit_id?: string | null
          cashier_id?: string
          cashier_name?: string
          change_amount?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          status?: string
          subtotal?: number
          tax_rate?: number
          total_amount?: number
          total_discount?: number
          total_tax?: number
          transaction_code?: string
          transaction_date?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_transactions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          item_description: string | null
          item_id: string
          line_total: number
          notes: string | null
          purchase_order_id: string
          quantity: number
          quantity_received: number | null
          rate: number
          sort_order: number | null
          tax_amount: number | null
          tax_percent: number | null
          uom_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          item_description?: string | null
          item_id: string
          line_total: number
          notes?: string | null
          purchase_order_id: string
          quantity: number
          quantity_received?: number | null
          rate: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          uom_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          item_description?: string | null
          item_id?: string
          line_total?: number
          notes?: string | null
          purchase_order_id?: string
          quantity?: number
          quantity_received?: number | null
          rate?: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          delivery_address_line1: string
          delivery_address_line2: string | null
          delivery_city: string
          delivery_country: string
          delivery_postal_code: string
          delivery_state: string
          discount_amount: number | null
          expected_delivery_date: string
          id: string
          notes: string | null
          order_code: string
          order_date: string
          payment_terms: string | null
          priority: string | null
          status: string | null
          subtotal: number | null
          supplier_id: string
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          delivery_address_line1: string
          delivery_address_line2?: string | null
          delivery_city: string
          delivery_country: string
          delivery_postal_code: string
          delivery_state: string
          discount_amount?: number | null
          expected_delivery_date: string
          id?: string
          notes?: string | null
          order_code: string
          order_date: string
          payment_terms?: string | null
          priority?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_id: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          delivery_address_line1?: string
          delivery_address_line2?: string | null
          delivery_city?: string
          delivery_country?: string
          delivery_postal_code?: string
          delivery_state?: string
          discount_amount?: number | null
          expected_delivery_date?: string
          id?: string
          notes?: string | null
          order_code?: string
          order_date?: string
          payment_terms?: string | null
          priority?: string | null
          status?: string | null
          subtotal?: number | null
          supplier_id?: string
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_items: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          item_id: string
          notes: string | null
          purchase_order_item_id: string
          quantity_ordered: number
          quantity_received: number
          rate: number
          receipt_id: string
          uom_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_id: string
          notes?: string | null
          purchase_order_item_id: string
          quantity_ordered: number
          quantity_received: number
          rate: number
          receipt_id: string
          uom_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          purchase_order_item_id?: string
          quantity_ordered?: number
          quantity_received?: number
          rate?: number
          receipt_id?: string
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          batch_sequence_number: string | null
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          id: string
          notes: string | null
          purchase_order_id: string
          receipt_code: string
          receipt_date: string
          status: string | null
          supplier_id: string
          supplier_invoice_date: string | null
          supplier_invoice_number: string | null
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          batch_sequence_number?: string | null
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          purchase_order_id: string
          receipt_code: string
          receipt_date: string
          status?: string | null
          supplier_id: string
          supplier_invoice_date?: string | null
          supplier_invoice_number?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          batch_sequence_number?: string | null
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string
          receipt_code?: string
          receipt_date?: string
          status?: string | null
          supplier_id?: string
          supplier_invoice_date?: string | null
          supplier_invoice_number?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      putaway_tasks: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          item_id: string
          notes: string | null
          pending_quantity: number
          posted_quantity: number
          quantity: number
          source_batch_code: string | null
          source_id: string
          source_line_id: string
          source_qty_per_unit: number
          source_reference: string | null
          source_type: string
          source_unit_name: string
          status: string
          suggested_location_id: string | null
          unit_cost: number
          uom_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_id: string
          notes?: string | null
          pending_quantity: number
          posted_quantity?: number
          quantity: number
          source_batch_code?: string | null
          source_id: string
          source_line_id: string
          source_qty_per_unit: number
          source_reference?: string | null
          source_type: string
          source_unit_name: string
          status?: string
          suggested_location_id?: string | null
          unit_cost?: number
          uom_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          pending_quantity?: number
          posted_quantity?: number
          quantity?: number
          source_batch_code?: string | null
          source_id?: string
          source_line_id?: string
          source_qty_per_unit?: number
          source_reference?: string | null
          source_type?: string
          source_unit_name?: string
          status?: string
          suggested_location_id?: string | null
          unit_cost?: number
          uom_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "putaway_tasks_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_suggested_location_id_fkey"
            columns: ["suggested_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "putaway_tasks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_alert_acknowledgments: {
        Row: {
          acknowledged_at: string
          acknowledged_available_stock: number
          acknowledged_by: string | null
          company_id: string
          created_at: string
          deleted_at: string | null
          id: string
          item_id: string
          minimum_level: number
          policy_source: string
          reorder_point: number
          reorder_quantity: number
          season_id: string | null
          severity: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          acknowledged_at?: string
          acknowledged_available_stock: number
          acknowledged_by?: string | null
          company_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id: string
          minimum_level: number
          policy_source: string
          reorder_point: number
          reorder_quantity: number
          season_id?: string | null
          severity: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          acknowledged_at?: string
          acknowledged_available_stock?: number
          acknowledged_by?: string | null
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          item_id?: string
          minimum_level?: number
          policy_source?: string
          reorder_point?: number
          reorder_quantity?: number
          season_id?: string | null
          severity?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reorder_alert_acknowledgments_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alert_acknowledgments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alert_acknowledgments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alert_acknowledgments_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "reorder_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_alert_acknowledgments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_season_item_policies: {
        Row: {
          base_reorder_level: number | null
          base_reorder_quantity: number | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean
          item_id: string
          item_unit_option_id: string | null
          qty_per_unit: number
          reorder_level: number
          reorder_quantity: number
          season_id: string
          uom_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          base_reorder_level?: number | null
          base_reorder_quantity?: number | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          item_id: string
          item_unit_option_id?: string | null
          qty_per_unit: number
          reorder_level: number
          reorder_quantity: number
          season_id: string
          uom_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          base_reorder_level?: number | null
          base_reorder_quantity?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean
          item_id?: string
          item_unit_option_id?: string | null
          qty_per_unit?: number
          reorder_level?: number
          reorder_quantity?: number
          season_id?: string
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reorder_season_item_policies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_season_item_policies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_season_item_policies_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_season_item_policies_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_season_item_policies_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "reorder_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_season_item_policies_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_season_item_policies_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reorder_seasons: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          effective_from: string
          effective_to: string
          id: string
          is_active: boolean
          name: string
          priority: number
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from: string
          effective_to: string
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          effective_from?: string
          effective_to?: string
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "reorder_seasons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_seasons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_seasons_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      return_to_suppliers: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          business_unit_id: string
          company_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          grn_id: string | null
          id: string
          notes: string | null
          reason: string | null
          return_date: string
          rts_number: string
          status: string
          supplier_id: string
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          business_unit_id: string
          company_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          grn_id?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          return_date?: string
          rts_number: string
          status?: string
          supplier_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          business_unit_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          grn_id?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          return_date?: string
          rts_number?: string
          status?: string
          supplier_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_to_suppliers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_suppliers_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_suppliers_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_suppliers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_to_suppliers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          created_by: string | null
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_system_role: boolean
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_system_role?: boolean
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rts_items: {
        Row: {
          created_at: string
          grn_item_id: string | null
          id: string
          item_id: string
          reason: string | null
          return_qty: number
          rts_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grn_item_id?: string | null
          id?: string
          item_id: string
          reason?: string | null
          return_qty: number
          rts_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grn_item_id?: string | null
          id?: string
          item_id?: string
          reason?: string | null
          return_qty?: number
          rts_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rts_items_grn_item_id_fkey"
            columns: ["grn_item_id"]
            isOneToOne: false
            referencedRelation: "grn_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rts_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rts_items_rts_id_fkey"
            columns: ["rts_id"]
            isOneToOne: false
            referencedRelation: "return_to_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_distribution: {
        Row: {
          average_order_value: number
          city: string
          company_id: string
          created_at: string
          date: string
          employee_id: string
          id: string
          region_state: string
          total_commission: number
          total_sales: number
          transaction_count: number
          updated_at: string
        }
        Insert: {
          average_order_value?: number
          city: string
          company_id: string
          created_at?: string
          date: string
          employee_id: string
          id?: string
          region_state: string
          total_commission?: number
          total_sales?: number
          transaction_count?: number
          updated_at?: string
        }
        Update: {
          average_order_value?: number
          city?: string
          company_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          region_state?: string
          total_commission?: number
          total_sales?: number
          transaction_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_distribution_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_distribution_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_distribution_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_employee_commission_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "sales_distribution_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_by_employee"
            referencedColumns: ["employee_id"]
          },
        ]
      }
      sales_invoice_items: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_amount: number
          discount_percent: number
          id: string
          invoice_id: string
          item_description: string | null
          item_id: string
          line_total: number
          pricing_tier: string | null
          pricing_tier_name: string | null
          quantity: number
          rate: number
          skip_inventory: boolean
          sort_order: number
          tax_amount: number
          tax_percent: number
          uom_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_percent?: number
          id?: string
          invoice_id: string
          item_description?: string | null
          item_id: string
          line_total: number
          pricing_tier?: string | null
          pricing_tier_name?: string | null
          quantity: number
          rate: number
          skip_inventory?: boolean
          sort_order?: number
          tax_amount?: number
          tax_percent?: number
          uom_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_percent?: number
          id?: string
          invoice_id?: string
          item_description?: string | null
          item_id?: string
          line_total?: number
          pricing_tier?: string | null
          pricing_tier_name?: string | null
          quantity?: number
          rate?: number
          skip_inventory?: boolean
          sort_order?: number
          tax_amount?: number
          tax_percent?: number
          uom_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoice_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoice_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          billing_address_line1: string | null
          billing_address_line2: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          billing_state: string | null
          business_unit_id: string | null
          commission_split_count: number
          commission_total: number
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          customer_id: string
          deleted_at: string | null
          discount_amount: number
          due_date: string
          id: string
          invoice_code: string
          invoice_date: string
          notes: string | null
          payment_terms: string | null
          primary_employee_id: string | null
          sales_order_id: string | null
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string | null
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          business_unit_id?: string | null
          commission_split_count?: number
          commission_total?: number
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          customer_id: string
          deleted_at?: string | null
          discount_amount?: number
          due_date: string
          id?: string
          invoice_code: string
          invoice_date: string
          notes?: string | null
          payment_terms?: string | null
          primary_employee_id?: string | null
          sales_order_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string | null
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          billing_address_line1?: string | null
          billing_address_line2?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          billing_state?: string | null
          business_unit_id?: string | null
          commission_split_count?: number
          commission_total?: number
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          customer_id?: string
          deleted_at?: string | null
          discount_amount?: number
          due_date?: string
          id?: string
          invoice_code?: string
          invoice_date?: string
          notes?: string | null
          payment_terms?: string | null
          primary_employee_id?: string | null
          sales_order_id?: string | null
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_invoices_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_primary_employee_id_fkey"
            columns: ["primary_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_primary_employee_id_fkey"
            columns: ["primary_employee_id"]
            isOneToOne: false
            referencedRelation: "vw_employee_commission_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "sales_invoices_primary_employee_id_fkey"
            columns: ["primary_employee_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_by_employee"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "sales_invoices_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_item_components: {
        Row: {
          company_id: string
          component_type: string
          configuration_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          item_id: string
          order_item_id: string
          qty_per_frame: number
          quotation_component_id: string | null
          rounding_mode: string
          sort_order: number
          source: string
          total_amount: number
          total_quantity: number
          unit_rate: number
          uom_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          component_type: string
          configuration_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          item_id: string
          order_item_id: string
          qty_per_frame?: number
          quotation_component_id?: string | null
          rounding_mode?: string
          sort_order?: number
          source?: string
          total_amount?: number
          total_quantity: number
          unit_rate?: number
          uom_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          component_type?: string
          configuration_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          item_id?: string
          order_item_id?: string
          qty_per_frame?: number
          quotation_component_id?: string | null
          rounding_mode?: string
          sort_order?: number
          source?: string
          total_amount?: number
          total_quantity?: number
          unit_rate?: number
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_item_components_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_components_configuration_id_fkey"
            columns: ["configuration_id"]
            isOneToOne: false
            referencedRelation: "sales_order_item_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_components_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_components_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_components_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_components_quotation_component_id_fkey"
            columns: ["quotation_component_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_item_components"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_components_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_components_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_item_configurations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          fixed_allowance: number
          height: number
          id: string
          invoice_display_mode: string
          molding_item_id: string | null
          molding_stick_length: number | null
          molding_sticks_required: number | null
          order_item_id: string
          quotation_configuration_id: string | null
          service_fee_amount: number
          service_fee_mode: string
          service_type: string | null
          total_service_fee: number
          updated_at: string
          updated_by: string | null
          width: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fixed_allowance?: number
          height: number
          id?: string
          invoice_display_mode?: string
          molding_item_id?: string | null
          molding_stick_length?: number | null
          molding_sticks_required?: number | null
          order_item_id: string
          quotation_configuration_id?: string | null
          service_fee_amount?: number
          service_fee_mode?: string
          service_type?: string | null
          total_service_fee?: number
          updated_at?: string
          updated_by?: string | null
          width: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fixed_allowance?: number
          height?: number
          id?: string
          invoice_display_mode?: string
          molding_item_id?: string | null
          molding_stick_length?: number | null
          molding_sticks_required?: number | null
          order_item_id?: string
          quotation_configuration_id?: string | null
          service_fee_amount?: number
          service_fee_mode?: string
          service_type?: string | null
          total_service_fee?: number
          updated_at?: string
          updated_by?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_item_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_configurations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_configurations_molding_item_id_fkey"
            columns: ["molding_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_configurations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "sales_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_configurations_quotation_configuration_id_fkey"
            columns: ["quotation_configuration_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_item_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_item_configurations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_order_items: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          id: string
          item_description: string | null
          item_id: string
          line_total: number
          notes: string | null
          order_id: string
          pricing_tier: string | null
          pricing_tier_name: string | null
          quantity: number
          quantity_delivered: number | null
          quantity_shipped: number | null
          quotation_fulfilled_qty: number
          quotation_id: string | null
          quotation_item_id: string | null
          rate: number
          skip_inventory: boolean
          sort_order: number | null
          tax_amount: number | null
          tax_percent: number | null
          uom_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          item_description?: string | null
          item_id: string
          line_total: number
          notes?: string | null
          order_id: string
          pricing_tier?: string | null
          pricing_tier_name?: string | null
          quantity: number
          quantity_delivered?: number | null
          quantity_shipped?: number | null
          quotation_fulfilled_qty?: number
          quotation_id?: string | null
          quotation_item_id?: string | null
          rate: number
          skip_inventory?: boolean
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          uom_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          id?: string
          item_description?: string | null
          item_id?: string
          line_total?: number
          notes?: string | null
          order_id?: string
          pricing_tier?: string | null
          pricing_tier_name?: string | null
          quantity?: number
          quantity_delivered?: number | null
          quantity_shipped?: number | null
          quotation_fulfilled_qty?: number
          quotation_id?: string | null
          quotation_item_id?: string | null
          rate?: number
          skip_inventory?: boolean
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_quotation_item_id_fkey"
            columns: ["quotation_item_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_order_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_orders: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          customer_id: string
          deleted_at: string | null
          discount_amount: number | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_code: string
          order_date: string
          payment_terms: string | null
          price_list_id: string | null
          shipping_address: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          total_amount: number | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          customer_id: string
          deleted_at?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_code: string
          order_date: string
          payment_terms?: string | null
          price_list_id?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          customer_id?: string
          deleted_at?: string | null
          discount_amount?: number | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_code?: string
          order_date?: string
          payment_terms?: string | null
          price_list_id?: string | null
          shipping_address?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_orders_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotation_item_components: {
        Row: {
          company_id: string
          component_type: string
          configuration_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          item_id: string
          qty_per_frame: number
          quotation_item_id: string
          rounding_mode: string
          sort_order: number
          source: string
          total_amount: number
          total_quantity: number
          unit_rate: number
          uom_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          component_type: string
          configuration_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          item_id: string
          qty_per_frame?: number
          quotation_item_id: string
          rounding_mode?: string
          sort_order?: number
          source?: string
          total_amount?: number
          total_quantity: number
          unit_rate?: number
          uom_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          component_type?: string
          configuration_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          item_id?: string
          qty_per_frame?: number
          quotation_item_id?: string
          rounding_mode?: string
          sort_order?: number
          source?: string
          total_amount?: number
          total_quantity?: number
          unit_rate?: number
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotation_item_components_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_components_configuration_id_fkey"
            columns: ["configuration_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_item_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_components_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_components_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_components_quotation_item_id_fkey"
            columns: ["quotation_item_id"]
            isOneToOne: false
            referencedRelation: "sales_quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_components_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_components_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotation_item_configurations: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          fixed_allowance: number
          height: number
          id: string
          invoice_display_mode: string
          molding_item_id: string | null
          molding_stick_length: number | null
          molding_sticks_required: number | null
          quotation_item_id: string
          service_fee_amount: number
          service_fee_mode: string
          service_type: string | null
          total_service_fee: number
          updated_at: string
          updated_by: string | null
          width: number
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fixed_allowance?: number
          height: number
          id?: string
          invoice_display_mode?: string
          molding_item_id?: string | null
          molding_stick_length?: number | null
          molding_sticks_required?: number | null
          quotation_item_id: string
          service_fee_amount?: number
          service_fee_mode?: string
          service_type?: string | null
          total_service_fee?: number
          updated_at?: string
          updated_by?: string | null
          width: number
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          fixed_allowance?: number
          height?: number
          id?: string
          invoice_display_mode?: string
          molding_item_id?: string | null
          molding_stick_length?: number | null
          molding_sticks_required?: number | null
          quotation_item_id?: string
          service_fee_amount?: number
          service_fee_mode?: string
          service_type?: string | null
          total_service_fee?: number
          updated_at?: string
          updated_by?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotation_item_configurations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_configurations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_configurations_molding_item_id_fkey"
            columns: ["molding_item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_configurations_quotation_item_id_fkey"
            columns: ["quotation_item_id"]
            isOneToOne: true
            referencedRelation: "sales_quotation_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_item_configurations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotation_items: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          fulfilled_qty: number
          id: string
          item_description: string | null
          item_id: string
          line_total: number
          notes: string | null
          pricing_tier: string | null
          pricing_tier_name: string | null
          quantity: number
          quotation_id: string
          rate: number
          sort_order: number | null
          tax_amount: number | null
          tax_percent: number | null
          uom_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          fulfilled_qty?: number
          id?: string
          item_description?: string | null
          item_id: string
          line_total: number
          notes?: string | null
          pricing_tier?: string | null
          pricing_tier_name?: string | null
          quantity: number
          quotation_id: string
          rate: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          uom_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          fulfilled_qty?: number
          id?: string
          item_description?: string | null
          item_id?: string
          line_total?: number
          notes?: string | null
          pricing_tier?: string | null
          pricing_tier_name?: string | null
          quantity?: number
          quotation_id?: string
          rate?: number
          sort_order?: number | null
          tax_amount?: number | null
          tax_percent?: number | null
          uom_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotation_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_items_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotation_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_quotations: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          customer_id: string
          deleted_at: string | null
          discount_amount: number | null
          draft_invoice_id: string | null
          frame_job_order_id: string | null
          id: string
          notes: string | null
          price_list_id: string | null
          quotation_code: string
          quotation_date: string
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          terms_conditions: string | null
          total_amount: number | null
          updated_at: string
          updated_by: string | null
          valid_until: string | null
          version: number
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          customer_id: string
          deleted_at?: string | null
          discount_amount?: number | null
          draft_invoice_id?: string | null
          frame_job_order_id?: string | null
          id?: string
          notes?: string | null
          price_list_id?: string | null
          quotation_code: string
          quotation_date: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_conditions?: string | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          version?: number
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          customer_id?: string
          deleted_at?: string | null
          discount_amount?: number | null
          draft_invoice_id?: string | null
          frame_job_order_id?: string | null
          id?: string
          notes?: string | null
          price_list_id?: string | null
          quotation_code?: string
          quotation_date?: string
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          terms_conditions?: string | null
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_quotations_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_draft_invoice_id_fkey"
            columns: ["draft_invoice_id"]
            isOneToOne: false
            referencedRelation: "sales_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_frame_job_order_id_fkey"
            columns: ["frame_job_order_id"]
            isOneToOne: false
            referencedRelation: "frame_job_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quotations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          group_key: string
          id: string
          setting_key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          group_key: string
          id?: string
          setting_key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          group_key?: string
          id?: string
          setting_key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "settings_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_items: {
        Row: {
          adjusted_qty: number
          adjustment_id: string
          company_id: string
          created_at: string
          created_by: string
          current_qty: number
          deleted_at: string | null
          difference: number
          id: string
          item_batch_location_id: string | null
          item_code: string
          item_id: string
          item_name: string
          reason: string | null
          total_cost: number
          unit_cost: number
          uom_id: string
          uom_name: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          adjusted_qty: number
          adjustment_id: string
          company_id: string
          created_at?: string
          created_by: string
          current_qty?: number
          deleted_at?: string | null
          difference: number
          id?: string
          item_batch_location_id?: string | null
          item_code: string
          item_id: string
          item_name: string
          reason?: string | null
          total_cost: number
          unit_cost: number
          uom_id: string
          uom_name?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          adjusted_qty?: number
          adjustment_id?: string
          company_id?: string
          created_at?: string
          created_by?: string
          current_qty?: number
          deleted_at?: string | null
          difference?: number
          id?: string
          item_batch_location_id?: string | null
          item_code?: string
          item_id?: string
          item_name?: string
          reason?: string | null
          total_cost?: number
          unit_cost?: number
          uom_id?: string
          uom_name?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_item_batch_location_id_fkey"
            columns: ["item_batch_location_id"]
            isOneToOne: false
            referencedRelation: "item_batch_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_code: string
          adjustment_date: string
          adjustment_type: string
          approved_at: string | null
          approved_by: string | null
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string
          custom_fields: Json | null
          deleted_at: string | null
          id: string
          notes: string | null
          posted_at: string | null
          posted_by: string | null
          reason: string
          status: string | null
          stock_transaction_id: string | null
          total_value: number | null
          updated_at: string
          updated_by: string
          version: number
          warehouse_id: string
        }
        Insert: {
          adjustment_code: string
          adjustment_date: string
          adjustment_type: string
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by: string
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reason: string
          status?: string | null
          stock_transaction_id?: string | null
          total_value?: number | null
          updated_at?: string
          updated_by: string
          version?: number
          warehouse_id: string
        }
        Update: {
          adjustment_code?: string
          adjustment_date?: string
          adjustment_type?: string
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          posted_at?: string | null
          posted_by?: string | null
          reason?: string
          status?: string | null
          stock_transaction_id?: string | null
          total_value?: number | null
          updated_at?: string
          updated_by?: string
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_stock_transaction_id_fkey"
            columns: ["stock_transaction_id"]
            isOneToOne: false
            referencedRelation: "stock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_request_items: {
        Row: {
          created_at: string
          dispatch_qty: number | null
          id: string
          item_id: string
          item_unit_option_id: string | null
          notes: string | null
          picked_qty: number | null
          received_qty: number
          requested_qty: number
          selected_item_batch_id: string | null
          short_qty: number | null
          short_reason_code: string | null
          stock_request_id: string
          uom_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispatch_qty?: number | null
          id?: string
          item_id: string
          item_unit_option_id?: string | null
          notes?: string | null
          picked_qty?: number | null
          received_qty?: number
          requested_qty: number
          selected_item_batch_id?: string | null
          short_qty?: number | null
          short_reason_code?: string | null
          stock_request_id: string
          uom_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispatch_qty?: number | null
          id?: string
          item_id?: string
          item_unit_option_id?: string | null
          notes?: string | null
          picked_qty?: number | null
          received_qty?: number
          requested_qty?: number
          selected_item_batch_id?: string | null
          short_qty?: number | null
          short_reason_code?: string | null
          stock_request_id?: string
          uom_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_request_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_request_items_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_request_items_selected_item_batch_id_fkey"
            columns: ["selected_item_batch_id"]
            isOneToOne: false
            referencedRelation: "item_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_request_items_selected_item_batch_id_fkey"
            columns: ["selected_item_batch_id"]
            isOneToOne: false
            referencedRelation: "v_inventory_recon_item_batch_vs_batch_location"
            referencedColumns: ["item_batch_id"]
          },
          {
            foreignKeyName: "stock_request_items_stock_request_id_fkey"
            columns: ["stock_request_id"]
            isOneToOne: false
            referencedRelation: "stock_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_request_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          delivered_at: string | null
          delivered_by: string | null
          department: string | null
          fulfilling_warehouse_id: string | null
          id: string
          notes: string | null
          picked_at: string | null
          picked_by: string | null
          picking_started_at: string | null
          picking_started_by: string | null
          priority: string | null
          purpose: string | null
          received_at: string | null
          received_by: string | null
          request_code: string
          request_date: string
          requested_by_name: string | null
          requested_by_user_id: string
          requesting_warehouse_id: string
          required_date: string
          status: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          department?: string | null
          fulfilling_warehouse_id?: string | null
          id?: string
          notes?: string | null
          picked_at?: string | null
          picked_by?: string | null
          picking_started_at?: string | null
          picking_started_by?: string | null
          priority?: string | null
          purpose?: string | null
          received_at?: string | null
          received_by?: string | null
          request_code: string
          request_date?: string
          requested_by_name?: string | null
          requested_by_user_id: string
          requesting_warehouse_id: string
          required_date: string
          status?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          department?: string | null
          fulfilling_warehouse_id?: string | null
          id?: string
          notes?: string | null
          picked_at?: string | null
          picked_by?: string | null
          picking_started_at?: string | null
          picking_started_by?: string | null
          priority?: string | null
          purpose?: string | null
          received_at?: string | null
          received_by?: string | null
          request_code?: string
          request_date?: string
          requested_by_name?: string | null
          requested_by_user_id?: string
          requesting_warehouse_id?: string
          required_date?: string
          status?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_delivered_by_fkey"
            columns: ["delivered_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_fulfilling_warehouse_id_fkey"
            columns: ["fulfilling_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_picked_by_fkey"
            columns: ["picked_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_picking_started_by_fkey"
            columns: ["picking_started_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_requested_by_user_id_fkey"
            columns: ["requested_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_requesting_warehouse_id_fkey"
            columns: ["requesting_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requests_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_requisition_items: {
        Row: {
          created_at: string
          fulfilled_qty: number
          id: string
          item_id: string
          item_unit_option_id: string | null
          notes: string | null
          outstanding_qty: number | null
          requested_qty: number
          sr_id: string
          total_price: number | null
          unit_price: number
          uom_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fulfilled_qty?: number
          id?: string
          item_id: string
          item_unit_option_id?: string | null
          notes?: string | null
          outstanding_qty?: number | null
          requested_qty: number
          sr_id: string
          total_price?: number | null
          unit_price?: number
          uom_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fulfilled_qty?: number
          id?: string
          item_id?: string
          item_unit_option_id?: string | null
          notes?: string | null
          outstanding_qty?: number | null
          requested_qty?: number
          sr_id?: string
          total_price?: number | null
          unit_price?: number
          uom_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_requisition_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requisition_items_item_unit_option_id_fkey"
            columns: ["item_unit_option_id"]
            isOneToOne: false
            referencedRelation: "item_unit_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requisition_items_sr_id_fkey"
            columns: ["sr_id"]
            isOneToOne: false
            referencedRelation: "stock_requisitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requisition_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_requisitions: {
        Row: {
          business_unit_id: string
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          id: string
          notes: string | null
          requested_by: string
          required_by_date: string | null
          requisition_date: string
          sr_number: string
          status: string
          supplier_id: string
          total_amount: number | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          business_unit_id: string
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          requested_by: string
          required_by_date?: string | null
          requisition_date?: string
          sr_number: string
          status?: string
          supplier_id: string
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          business_unit_id?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          id?: string
          notes?: string | null
          requested_by?: string
          required_by_date?: string | null
          requisition_date?: string
          sr_number?: string
          status?: string
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_requisitions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requisitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requisitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requisitions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requisitions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_requisitions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transaction_items: {
        Row: {
          batch_no: string | null
          company_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          expiry_date: string | null
          id: string
          item_id: string
          notes: string | null
          posting_date: string
          posting_time: string
          qty_after: number
          qty_before: number
          quantity: number
          serial_no: string | null
          stock_value_after: number | null
          stock_value_before: number | null
          total_cost: number | null
          transaction_id: string
          unit_cost: number | null
          uom_id: string
          updated_at: string
          updated_by: string
          valuation_rate: number | null
        }
        Insert: {
          batch_no?: string | null
          company_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          expiry_date?: string | null
          id?: string
          item_id: string
          notes?: string | null
          posting_date?: string
          posting_time?: string
          qty_after?: number
          qty_before?: number
          quantity: number
          serial_no?: string | null
          stock_value_after?: number | null
          stock_value_before?: number | null
          total_cost?: number | null
          transaction_id: string
          unit_cost?: number | null
          uom_id: string
          updated_at?: string
          updated_by: string
          valuation_rate?: number | null
        }
        Update: {
          batch_no?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          expiry_date?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          posting_date?: string
          posting_time?: string
          qty_after?: number
          qty_before?: number
          quantity?: number
          serial_no?: string | null
          stock_value_after?: number | null
          stock_value_before?: number | null
          total_cost?: number | null
          transaction_id?: string
          unit_cost?: number | null
          uom_id?: string
          updated_at?: string
          updated_by?: string
          valuation_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transaction_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transaction_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transaction_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "stock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transaction_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transaction_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          from_location_id: string | null
          id: string
          notes: string | null
          reference_code: string | null
          reference_id: string | null
          reference_type: string | null
          status: string | null
          to_location_id: string | null
          to_warehouse_id: string | null
          transaction_code: string
          transaction_date: string
          transaction_type: string
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          from_location_id?: string | null
          id?: string
          notes?: string | null
          reference_code?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          to_location_id?: string | null
          to_warehouse_id?: string | null
          transaction_code: string
          transaction_date: string
          transaction_type: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          from_location_id?: string | null
          id?: string
          notes?: string | null
          reference_code?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
          to_location_id?: string | null
          to_warehouse_id?: string | null
          transaction_code?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          item_code: string
          item_id: string
          item_name: string
          notes: string | null
          quantity: number
          received_quantity: number | null
          sort_order: number | null
          transfer_id: string
          uom_id: string
          uom_name: string | null
          updated_at: string
          updated_by: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          item_code: string
          item_id: string
          item_name: string
          notes?: string | null
          quantity: number
          received_quantity?: number | null
          sort_order?: number | null
          transfer_id: string
          uom_id: string
          uom_name?: string | null
          updated_at?: string
          updated_by: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          item_code?: string
          item_id?: string
          item_name?: string
          notes?: string | null
          quantity?: number
          received_quantity?: number | null
          sort_order?: number | null
          transfer_id?: string
          uom_id?: string
          uom_name?: string | null
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          business_unit_id: string | null
          company_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string
          custom_fields: Json | null
          deleted_at: string | null
          from_warehouse_id: string
          id: string
          notes: string | null
          requested_at: string | null
          requested_by: string | null
          status: string | null
          to_warehouse_id: string
          total_items: number | null
          transfer_code: string
          transfer_date: string
          updated_at: string
          updated_by: string
          version: number
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by: string
          custom_fields?: Json | null
          deleted_at?: string | null
          from_warehouse_id: string
          id?: string
          notes?: string | null
          requested_at?: string | null
          requested_by?: string | null
          status?: string | null
          to_warehouse_id: string
          total_items?: number | null
          transfer_code: string
          transfer_date: string
          updated_at?: string
          updated_by: string
          version?: number
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string
          custom_fields?: Json | null
          deleted_at?: string | null
          from_warehouse_id?: string
          id?: string
          notes?: string | null
          requested_at?: string | null
          requested_by?: string | null
          status?: string | null
          to_warehouse_id?: string
          total_items?: number | null
          transfer_code?: string
          transfer_date?: string
          updated_at?: string
          updated_by?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_name: string | null
          billing_address_line1: string
          billing_address_line2: string | null
          billing_city: string
          billing_country: string
          billing_postal_code: string
          billing_state: string
          company_id: string
          contact_person: string
          created_at: string
          created_by: string | null
          credit_limit: number | null
          current_balance: number | null
          custom_fields: Json | null
          deleted_at: string | null
          email: string
          id: string
          lang: string
          mobile: string | null
          notes: string | null
          payment_terms: string
          phone: string
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_postal_code: string | null
          shipping_state: string | null
          status: string | null
          supplier_code: string
          supplier_name: string
          tax_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
          website: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          billing_address_line1: string
          billing_address_line2?: string | null
          billing_city: string
          billing_country: string
          billing_postal_code: string
          billing_state: string
          company_id: string
          contact_person: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          custom_fields?: Json | null
          deleted_at?: string | null
          email: string
          id?: string
          lang?: string
          mobile?: string | null
          notes?: string | null
          payment_terms?: string
          phone: string
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          status?: string | null
          supplier_code: string
          supplier_name: string
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          website?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          billing_address_line1?: string
          billing_address_line2?: string | null
          billing_city?: string
          billing_country?: string
          billing_postal_code?: string
          billing_state?: string
          company_id?: string
          contact_person?: string
          created_at?: string
          created_by?: string | null
          credit_limit?: number | null
          current_balance?: number | null
          custom_fields?: Json | null
          deleted_at?: string | null
          email?: string
          id?: string
          lang?: string
          mobile?: string | null
          notes?: string | null
          payment_terms?: string
          phone?: string
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_postal_code?: string | null
          shipping_state?: string | null
          status?: string | null
          supplier_code?: string
          supplier_name?: string
          tax_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transformation_lineage: {
        Row: {
          cost_attributed: number | null
          created_at: string
          id: string
          input_line_id: string
          input_quantity_used: number
          order_id: string
          output_line_id: string
          output_quantity_from: number
        }
        Insert: {
          cost_attributed?: number | null
          created_at?: string
          id?: string
          input_line_id: string
          input_quantity_used: number
          order_id: string
          output_line_id: string
          output_quantity_from: number
        }
        Update: {
          cost_attributed?: number | null
          created_at?: string
          id?: string
          input_line_id?: string
          input_quantity_used?: number
          order_id?: string
          output_line_id?: string
          output_quantity_from?: number
        }
        Relationships: [
          {
            foreignKeyName: "transformation_lineage_input_line_id_fkey"
            columns: ["input_line_id"]
            isOneToOne: false
            referencedRelation: "transformation_order_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_lineage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "transformation_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_lineage_output_line_id_fkey"
            columns: ["output_line_id"]
            isOneToOne: false
            referencedRelation: "transformation_order_outputs"
            referencedColumns: ["id"]
          },
        ]
      }
      transformation_order_inputs: {
        Row: {
          consumed_quantity: number | null
          created_at: string
          created_by: string
          id: string
          item_id: string
          notes: string | null
          order_id: string
          planned_quantity: number
          sequence: number
          stock_transaction_id: string | null
          total_cost: number | null
          unit_cost: number | null
          uom_id: string
          updated_at: string
          updated_by: string
          warehouse_id: string
        }
        Insert: {
          consumed_quantity?: number | null
          created_at?: string
          created_by: string
          id?: string
          item_id: string
          notes?: string | null
          order_id: string
          planned_quantity: number
          sequence?: number
          stock_transaction_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          uom_id: string
          updated_at?: string
          updated_by: string
          warehouse_id: string
        }
        Update: {
          consumed_quantity?: number | null
          created_at?: string
          created_by?: string
          id?: string
          item_id?: string
          notes?: string | null
          order_id?: string
          planned_quantity?: number
          sequence?: number
          stock_transaction_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          uom_id?: string
          updated_at?: string
          updated_by?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transformation_order_inputs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_inputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_inputs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "transformation_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_inputs_stock_transaction_id_fkey"
            columns: ["stock_transaction_id"]
            isOneToOne: false
            referencedRelation: "stock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_inputs_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_inputs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_inputs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      transformation_order_outputs: {
        Row: {
          allocated_cost_per_unit: number | null
          created_at: string
          created_by: string
          id: string
          is_scrap: boolean
          item_id: string
          notes: string | null
          order_id: string
          planned_quantity: number
          produced_quantity: number | null
          sequence: number
          stock_transaction_id: string | null
          stock_transaction_waste_id: string | null
          total_allocated_cost: number | null
          uom_id: string
          updated_at: string
          updated_by: string
          warehouse_id: string
          waste_reason: string | null
          wasted_quantity: number | null
        }
        Insert: {
          allocated_cost_per_unit?: number | null
          created_at?: string
          created_by: string
          id?: string
          is_scrap?: boolean
          item_id: string
          notes?: string | null
          order_id: string
          planned_quantity: number
          produced_quantity?: number | null
          sequence?: number
          stock_transaction_id?: string | null
          stock_transaction_waste_id?: string | null
          total_allocated_cost?: number | null
          uom_id: string
          updated_at?: string
          updated_by: string
          warehouse_id: string
          waste_reason?: string | null
          wasted_quantity?: number | null
        }
        Update: {
          allocated_cost_per_unit?: number | null
          created_at?: string
          created_by?: string
          id?: string
          is_scrap?: boolean
          item_id?: string
          notes?: string | null
          order_id?: string
          planned_quantity?: number
          produced_quantity?: number | null
          sequence?: number
          stock_transaction_id?: string | null
          stock_transaction_waste_id?: string | null
          total_allocated_cost?: number | null
          uom_id?: string
          updated_at?: string
          updated_by?: string
          warehouse_id?: string
          waste_reason?: string | null
          wasted_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transformation_order_outputs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_outputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_outputs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "transformation_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_outputs_stock_transaction_id_fkey"
            columns: ["stock_transaction_id"]
            isOneToOne: false
            referencedRelation: "stock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_outputs_stock_transaction_waste_id_fkey"
            columns: ["stock_transaction_waste_id"]
            isOneToOne: false
            referencedRelation: "stock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_outputs_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_outputs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_order_outputs_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      transformation_orders: {
        Row: {
          actual_quantity: number | null
          business_unit_id: string | null
          company_id: string
          completion_date: string | null
          cost_variance: number | null
          created_at: string
          created_by: string
          deleted_at: string | null
          execution_date: string | null
          id: string
          notes: string | null
          order_code: string
          order_date: string
          planned_date: string | null
          planned_quantity: number
          reference_id: string | null
          reference_type: string | null
          source_warehouse_id: string
          status: string
          template_id: string
          total_input_cost: number | null
          total_output_cost: number | null
          updated_at: string
          updated_by: string
          variance_notes: string | null
        }
        Insert: {
          actual_quantity?: number | null
          business_unit_id?: string | null
          company_id: string
          completion_date?: string | null
          cost_variance?: number | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          execution_date?: string | null
          id?: string
          notes?: string | null
          order_code: string
          order_date?: string
          planned_date?: string | null
          planned_quantity: number
          reference_id?: string | null
          reference_type?: string | null
          source_warehouse_id: string
          status?: string
          template_id: string
          total_input_cost?: number | null
          total_output_cost?: number | null
          updated_at?: string
          updated_by: string
          variance_notes?: string | null
        }
        Update: {
          actual_quantity?: number | null
          business_unit_id?: string | null
          company_id?: string
          completion_date?: string | null
          cost_variance?: number | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          execution_date?: string | null
          id?: string
          notes?: string | null
          order_code?: string
          order_date?: string
          planned_date?: string | null
          planned_quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          source_warehouse_id?: string
          status?: string
          template_id?: string
          total_input_cost?: number | null
          total_output_cost?: number | null
          updated_at?: string
          updated_by?: string
          variance_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transformation_orders_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_orders_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_orders_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "transformation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transformation_template_inputs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          item_id: string
          notes: string | null
          quantity: number
          sequence: number
          template_id: string
          uom_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          item_id: string
          notes?: string | null
          quantity: number
          sequence?: number
          template_id: string
          uom_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          sequence?: number
          template_id?: string
          uom_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "transformation_template_inputs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_template_inputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_template_inputs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "transformation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_template_inputs_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_template_inputs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transformation_template_outputs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_scrap: boolean
          item_id: string
          notes: string | null
          quantity: number
          sequence: number
          template_id: string
          uom_id: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_scrap?: boolean
          item_id: string
          notes?: string | null
          quantity: number
          sequence?: number
          template_id: string
          uom_id: string
          updated_at?: string
          updated_by: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_scrap?: boolean
          item_id?: string
          notes?: string | null
          quantity?: number
          sequence?: number
          template_id?: string
          uom_id?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "transformation_template_outputs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_template_outputs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_template_outputs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "transformation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_template_outputs_uom_id_fkey"
            columns: ["uom_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_template_outputs_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transformation_templates: {
        Row: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          layout_json: Json | null
          sheet_height: number | null
          sheet_unit: string | null
          sheet_width: number | null
          template_code: string
          template_kind: string
          template_name: string
          updated_at: string
          updated_by: string
          usage_count: number
        }
        Insert: {
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          layout_json?: Json | null
          sheet_height?: number | null
          sheet_unit?: string | null
          sheet_width?: number | null
          template_code: string
          template_kind?: string
          template_name: string
          updated_at?: string
          updated_by: string
          usage_count?: number
        }
        Update: {
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          layout_json?: Json | null
          sheet_height?: number | null
          sheet_unit?: string | null
          sheet_width?: number | null
          template_code?: string
          template_kind?: string
          template_name?: string
          updated_at?: string
          updated_by?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "transformation_templates_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transformation_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      units_of_measure: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          is_base_unit: boolean | null
          name: string
          symbol: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          is_base_unit?: boolean | null
          name: string
          symbol?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          is_base_unit?: boolean | null
          name?: string
          symbol?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "units_of_measure_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_of_measure_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "units_of_measure_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          action: string
          actor_label: string | null
          actor_type: string
          business_unit_id: string | null
          company_id: string | null
          display_message: string
          duration_ms: number | null
          entity_code: string | null
          entity_id: string | null
          entity_ids: Json | null
          entity_label: string | null
          error_code: string | null
          event_kind: string
          http_method: string | null
          http_status: number | null
          id: string
          ip_address: string | null
          message_key: string
          metadata: Json
          occurred_at: string
          outcome: string
          query_params: Json | null
          request_id: string
          request_payload: Json | null
          resource_type: string
          route: string | null
          route_params: Json | null
          source: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_label?: string | null
          actor_type: string
          business_unit_id?: string | null
          company_id?: string | null
          display_message?: string
          duration_ms?: number | null
          entity_code?: string | null
          entity_id?: string | null
          entity_ids?: Json | null
          entity_label?: string | null
          error_code?: string | null
          event_kind: string
          http_method?: string | null
          http_status?: number | null
          id?: string
          ip_address?: string | null
          message_key?: string
          metadata?: Json
          occurred_at?: string
          outcome: string
          query_params?: Json | null
          request_id: string
          request_payload?: Json | null
          resource_type: string
          route?: string | null
          route_params?: Json | null
          source: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_label?: string | null
          actor_type?: string
          business_unit_id?: string | null
          company_id?: string | null
          display_message?: string
          duration_ms?: number | null
          entity_code?: string | null
          entity_id?: string | null
          entity_ids?: Json | null
          entity_label?: string | null
          error_code?: string | null
          event_kind?: string
          http_method?: string | null
          http_status?: number | null
          id?: string
          ip_address?: string | null
          message_key?: string
          metadata?: Json
          occurred_at?: string
          outcome?: string
          query_params?: Json | null
          request_id?: string
          request_payload?: Json | null
          resource_type?: string
          route?: string | null
          route_params?: Json | null
          source?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_business_unit_access: {
        Row: {
          business_unit_id: string
          granted_at: string
          granted_by: string | null
          is_current: boolean | null
          is_default: boolean
          role: string | null
          user_id: string
        }
        Insert: {
          business_unit_id: string
          granted_at?: string
          granted_by?: string | null
          is_current?: boolean | null
          is_default?: boolean
          role?: string | null
          user_id: string
        }
        Update: {
          business_unit_id?: string
          granted_at?: string
          granted_by?: string | null
          is_current?: boolean | null
          is_default?: boolean
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_business_unit_access_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_business_unit_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_business_unit_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          font_size: string | null
          id: string
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          font_size?: string | null
          id?: string
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          font_size?: string | null
          id?: string
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          role_id: string
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          role_id: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          role_id?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string
          employee_id: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
          username: string
          van_warehouse_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email: string
          employee_id?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          username: string
          van_warehouse_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          employee_id?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          username?: string
          van_warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_employee_commission_summary"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "users_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "vw_sales_by_employee"
            referencedColumns: ["employee_id"]
          },
          {
            foreignKeyName: "users_van_warehouse_id_fkey"
            columns: ["van_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      van_eod_reconciliations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string | null
          driver_id: string
          driver_notes: string | null
          expected_ending: Json
          id: string
          physical_counts: Json
          reconciliation_date: string
          rejection_reason: string | null
          status: string
          stock_adjustment_id: string | null
          updated_at: string
          updated_by: string | null
          van_warehouse_id: string
          variances: Json
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          driver_id: string
          driver_notes?: string | null
          expected_ending?: Json
          id?: string
          physical_counts?: Json
          reconciliation_date: string
          rejection_reason?: string | null
          status?: string
          stock_adjustment_id?: string | null
          updated_at?: string
          updated_by?: string | null
          van_warehouse_id: string
          variances?: Json
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          driver_id?: string
          driver_notes?: string | null
          expected_ending?: Json
          id?: string
          physical_counts?: Json
          reconciliation_date?: string
          rejection_reason?: string | null
          status?: string
          stock_adjustment_id?: string | null
          updated_at?: string
          updated_by?: string | null
          van_warehouse_id?: string
          variances?: Json
        }
        Relationships: [
          {
            foreignKeyName: "van_eod_reconciliations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_eod_reconciliations_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_eod_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_eod_reconciliations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_eod_reconciliations_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_eod_reconciliations_stock_adjustment_id_fkey"
            columns: ["stock_adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_eod_reconciliations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "van_eod_reconciliations_van_warehouse_id_fkey"
            columns: ["van_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          code: string
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          is_pickable: boolean | null
          is_storable: boolean | null
          location_type: string
          name: string | null
          parent_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_id: string
        }
        Insert: {
          code: string
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          is_pickable?: boolean | null
          is_storable?: boolean | null
          location_type?: string
          name?: string | null
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id: string
        }
        Update: {
          code?: string
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          is_pickable?: boolean | null
          is_storable?: boolean | null
          location_type?: string
          name?: string | null
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_unit_id: string | null
          city: string | null
          company_id: string
          contact_person: string | null
          country: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          is_van: boolean | null
          phone: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
          updated_by: string | null
          version: number
          warehouse_code: string
          warehouse_name: string
          warehouse_type: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_unit_id?: string | null
          city?: string | null
          company_id: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_van?: boolean | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_code: string
          warehouse_name: string
          warehouse_type?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_unit_id?: string | null
          city?: string | null
          company_id?: string
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          is_van?: boolean | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          warehouse_code?: string
          warehouse_name?: string
          warehouse_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_inventory_recon_item_batch_vs_batch_location: {
        Row: {
          batch_code: string | null
          batch_location_qty: number | null
          batch_qty: number | null
          company_id: string | null
          item_batch_id: string | null
          item_id: string | null
          qty_diff: number | null
          warehouse_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_batches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inventory_recon_item_warehouse_vs_batch: {
        Row: {
          batch_qty: number | null
          company_id: string | null
          item_id: string | null
          qty_diff: number | null
          warehouse_id: string | null
          warehouse_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_warehouse_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inventory_recon_item_warehouse_vs_batch_location: {
        Row: {
          batch_location_qty: number | null
          company_id: string | null
          item_id: string | null
          location_id: string | null
          qty_diff: number | null
          warehouse_id: string | null
          warehouse_qty: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_warehouse_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_warehouse_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_employee_commission_summary: {
        Row: {
          company_id: string | null
          employee_code: string | null
          employee_id: string | null
          employee_name: string | null
          invoice_count: number | null
          month: string | null
          paid_commission: number | null
          pending_commission: number | null
          total_commission: number | null
          total_sales: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_sales_by_employee: {
        Row: {
          average_order_value: number | null
          commission_rate: number | null
          company_id: string | null
          employee_code: string | null
          employee_id: string | null
          employee_name: string | null
          role: string | null
          sales_date: string | null
          total_commission: number | null
          total_sales: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_delivery_note_receiving_exception: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_dn_id: string
          p_exception_id: string
          p_notes?: string
          p_user_id: string
        }
        Returns: undefined
      }
      accept_delivery_note_receiving_overage: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_dn_id: string
          p_dn_item_id: string
          p_notes?: string
          p_user_id: string
        }
        Returns: undefined
      }
      acknowledge_reorder_alerts: {
        Args: {
          p_acknowledged_by: string
          p_alert_ids: string[]
          p_as_of_date?: string
          p_company_id: string
        }
        Returns: {
          acknowledged_count: number
        }[]
      }
      adjust_dispatched_delivery_note_item: {
        Args: {
          p_company_id: string
          p_delivery_note_item_id: string
          p_dn_id: string
          p_new_dispatched_qty: number
          p_reason?: string
          p_user_id: string
        }
        Returns: undefined
      }
      allocate_sales_order_item_quotation_fulfillment: {
        Args: { p_order_quantity: number; p_quotation_item_id: string }
        Returns: number
      }
      append_user_activity_log: { Args: { p_event: Json }; Returns: string }
      apply_manufacturing_floor_action_transaction: {
        Args: {
          p_action: string
          p_manufacturing_order_id: string
          p_note?: string
        }
        Returns: string
      }
      approve_grn_with_batch_inventory_apply_inventory: {
        Args: {
          p_company_id: string
          p_grn_id: string
          p_notes?: string
          p_user_id: string
        }
        Returns: string
      }
      calculate_sales_quotation_item: {
        Args: { p_item: Json }
        Returns: {
          discount_amount: number
          discount_percent: number
          item_description: string
          item_id: string
          line_total: number
          notes: string
          quantity: number
          rate: number
          sort_order: number
          tax_amount: number
          tax_percent: number
          uom_id: string
        }[]
      }
      cancel_pick_list_reset_progress: {
        Args: {
          p_company_id: string
          p_pick_list_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      cancel_sales_order_transaction: {
        Args: { p_sales_order_id: string }
        Returns: {
          sales_order_id: string
          status: string
        }[]
      }
      claim_pick_list_item: {
        Args: {
          p_company_id: string
          p_pick_list_id: string
          p_pick_list_item_id: string
          p_user_id: string
        }
        Returns: string
      }
      complete_delivery_note_direct_customer_pickup: {
        Args: {
          p_company_id: string
          p_dn_id: string
          p_items: Json
          p_notes: string
          p_received_date: string
          p_user_id: string
        }
        Returns: undefined
      }
      complete_frame_job_order_transaction: {
        Args: { p_job_order_id: string }
        Returns: string
      }
      complete_pick_list_transaction: {
        Args: {
          p_company_id: string
          p_pick_list_id: string
          p_pick_rows?: Json
          p_user_id: string
        }
        Returns: string
      }
      confirm_grn_with_putaway: {
        Args: {
          p_company_id: string
          p_grn_id: string
          p_notes?: string
          p_user_id: string
        }
        Returns: string
      }
      confirm_sales_quotation_transaction:
        | {
            Args: {
              p_business_unit_id: string
              p_quotation_id: string
              p_warehouse_id: string
            }
            Returns: {
              draft_invoice_id: string
              frame_job_order_id: string
              invoice_code: string
              job_order_code: string
              quotation_id: string
            }[]
          }
        | {
            Args: { p_quotation_id: string; p_warehouse_id?: string }
            Returns: {
              quotation_id: string
              status: string
            }[]
          }
      create_delivery_note_transactionally: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_driver_name: string
          p_fulfilling_warehouse_id: string
          p_fulfillment_mode: string
          p_lines: Json
          p_notes: string
          p_requesting_warehouse_id: string
          p_user_id: string
        }
        Returns: Json
      }
      create_draft_stock_adjustment: {
        Args: {
          p_adjustment_date?: string
          p_adjustment_id?: string
          p_adjustment_type?: string
          p_business_unit_id: string
          p_company_id: string
          p_items?: Json
          p_location_id?: string
          p_location_id_provided?: boolean
          p_notes?: string
          p_notes_provided?: boolean
          p_reason?: string
          p_user_id: string
          p_warehouse_id?: string
        }
        Returns: {
          adjustment_code: string
          adjustment_id: string
          status: string
        }[]
      }
      create_frame_job_order_from_sales_order_transaction: {
        Args: { p_sales_order_id: string; p_warehouse_id: string }
        Returns: {
          job_order_code: string
          job_order_id: string
        }[]
      }
      create_manufacturing_order_from_frame_job_order_transaction: {
        Args: { p_frame_job_order_id: string }
        Returns: {
          manufacturing_order_code: string
          manufacturing_order_id: string
        }[]
      }
      create_manufacturing_order_from_sales_order_transaction: {
        Args: { p_sales_order_id: string }
        Returns: {
          manufacturing_order_code: string
          manufacturing_order_id: string
        }[]
      }
      create_pick_list_with_allocation: {
        Args: {
          p_batch_allocation_mode?: string
          p_company_id: string
          p_current_business_unit_id?: string
          p_dn_id: string
          p_notes?: string
          p_picker_user_ids: string[]
          p_user_id: string
        }
        Returns: Json
      }
      create_putaway_task:
        | {
            Args: {
              p_business_unit_id: string
              p_company_id: string
              p_item_id: string
              p_notes?: string
              p_quantity: number
              p_source_batch_code?: string
              p_source_id: string
              p_source_line_id: string
              p_source_reference: string
              p_source_type: string
              p_unit_cost: number
              p_uom_id: string
              p_user_id: string
              p_warehouse_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_business_unit_id: string
              p_company_id: string
              p_in_transit_decrease: number
              p_item_id: string
              p_notes?: string
              p_quantity: number
              p_source_batch_code?: string
              p_source_id: string
              p_source_line_id: string
              p_source_reference: string
              p_source_type: string
              p_suggested_location_id: string
              p_unit_cost: number
              p_uom_id: string
              p_user_id: string
              p_warehouse_id: string
            }
            Returns: string
          }
      create_sales_order_transaction: {
        Args: { p_business_unit_id: string; p_quotation_id: string }
        Returns: {
          order_code: string
          sales_order_id: string
        }[]
      }
      create_sales_quotation_transaction: {
        Args: {
          p_business_unit_id: string
          p_customer_id: string
          p_items: Json
          p_notes: string
          p_price_list_id: string
          p_quotation_date: string
          p_terms_conditions: string
          p_valid_until: string
        }
        Returns: string
      }
      create_stock_adjustment: {
        Args: {
          p_adjustment_date: string
          p_adjustment_type: string
          p_business_unit_id: string
          p_company_id: string
          p_items: Json
          p_location_id: string
          p_notes: string
          p_reason: string
          p_user_id: string
          p_warehouse_id: string
        }
        Returns: {
          adjustment_code: string
          adjustment_id: string
          status: string
        }[]
      }
      create_transformation_output_putaway: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_item_id: string
          p_order_code: string
          p_order_id: string
          p_output_line_id: string
          p_produced_quantity: number
          p_total_cost: number
          p_transaction_date: string
          p_unit_cost: number
          p_uom_id: string
          p_user_id: string
          p_warehouse_id: string
          p_waste_reason: string
          p_wasted_quantity: number
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_item_custom_field: {
        Args: { p_item_id: string; p_key: string; p_updated_by?: string }
        Returns: Json
      }
      delete_sales_quotation_transaction: {
        Args: { p_quotation_id: string }
        Returns: string
      }
      ensure_default_manufacturing_workstations: {
        Args: { p_business_unit_id?: string; p_company_id: string }
        Returns: undefined
      }
      ensure_user_activity_log_partitions: {
        Args: { p_months_ahead?: number; p_months_before?: number }
        Returns: undefined
      }
      finalize_frame_job_order_completion_transaction: {
        Args: { p_job_order_id: string }
        Returns: string
      }
      generate_document_code: {
        Args: { p_code_prefix: string; p_company_id: string; p_digits?: number }
        Returns: string
      }
      generate_item_batch_location_sku: { Args: never; Returns: string }
      generate_item_unit_option_barcode: { Args: never; Returns: string }
      get_accounts_receivable_aging_report: {
        Args: {
          p_as_of_date?: string
          p_bucket?: string
          p_business_unit_id?: string
          p_company_id: string
          p_customer_id?: string
          p_limit?: number
          p_page?: number
          p_search?: string
        }
        Returns: {
          amount_paid: number
          balance: number
          current_amount: number
          customer_code: string
          customer_id: string
          customer_name: string
          days_1_to_30: number
          days_31_to_60: number
          days_61_to_90: number
          days_90_plus: number
          days_overdue: number
          due_date: string
          invoice_code: string
          invoice_date: string
          invoice_id: string
          status: string
          summary_current_amount: number
          summary_customer_count: number
          summary_days_1_to_30: number
          summary_days_31_to_60: number
          summary_days_61_to_90: number
          summary_days_90_plus: number
          summary_invoice_count: number
          summary_total_balance: number
          total_amount: number
          total_count: number
        }[]
      }
      get_available_sales_quotation_lines: {
        Args: {
          p_customer_id: string
          p_limit?: number
          p_offset?: number
          p_search?: string
        }
        Returns: {
          discount_percent: number
          item_code: string
          item_description: string
          item_id: string
          item_name: string
          line_total: number
          ordered_quantity: number
          quantity: number
          quotation_code: string
          quotation_date: string
          quotation_id: string
          quotation_item_id: string
          rate: number
          remaining_quantity: number
          tax_percent: number
          uom_code: string
          uom_id: string
          uom_name: string
          valid_until: string
        }[]
      }
      get_current_business_unit_id: { Args: never; Returns: string }
      get_customer_ledger_entries: {
        Args: {
          p_company_id: string
          p_customer_id: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_page?: number
          p_search?: string
          p_source_type?: string
        }
        Returns: {
          amount: number
          balance_effect: number
          credit: number
          debit: number
          description: string
          document_number: string
          due_date: string
          entry_id: string
          event_at: string
          payment_method: string
          reference: string
          running_balance: number
          sort_key: string
          source_id: string
          source_type: string
          status: string
          total_count: number
        }[]
      }
      get_customer_ledger_summary: {
        Args: {
          p_company_id: string
          p_customer_id: string
          p_date_from?: string
          p_date_to?: string
        }
        Returns: {
          active_invoice_count: number
          closing_balance: number
          invoice_charges: number
          last_activity_at: string
          opening_balance: number
          overdue_invoice_count: number
          payments_received: number
          period_credits: number
          period_debits: number
          pos_sales: number
        }[]
      }
      get_delivery_note_allocation_availability: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_sr_item_ids: string[]
          p_user_id: string
        }
        Returns: {
          available_base_qty: number
          available_qty: number
          base_unit_label: string
          qty_per_unit: number
          selected_item_batch_id: string
          sr_item_id: string
        }[]
      }
      get_effective_reorder_alerts: {
        Args: {
          p_acknowledgment_status?: string
          p_as_of_date?: string
          p_company_id: string
          p_limit?: number
          p_page?: number
          p_search?: string
          p_severity?: string
        }
        Returns: {
          acknowledged: boolean
          acknowledged_at: string
          acknowledged_by: string
          acknowledgment_id: string
          id: string
          item_code: string
          item_id: string
          item_name: string
          message: string
          minimum_level: number
          policy_source: string
          reorder_point: number
          reorder_quantity: number
          season_code: string
          season_id: string
          season_name: string
          severity: string
          total_available_stock: number
          total_count: number
          total_current_stock: number
          warehouse_breakdown: Json
        }[]
      }
      get_inventory_batch_reconciliation_mismatches: {
        Args: { p_company_id?: string; p_tolerance?: number }
        Returns: {
          batch_code: string
          check_name: string
          company_id: string
          item_batch_id: string
          item_id: string
          location_id: string
          qty_diff: number
          warehouse_id: string
        }[]
      }
      get_items_enhanced_page: {
        Args: {
          p_business_unit_id?: string
          p_category_id?: string
          p_company_id: string
          p_item_type?: string
          p_limit?: number
          p_page?: number
          p_search?: string
          p_status?: string
          p_warehouse_id?: string
        }
        Returns: {
          allocated: number
          available: number
          category_id: string
          category_name: string
          custom_fields: Json
          estimated_arrival_date: string
          id: string
          image_url: string
          import_cost: number
          import_currency: string
          in_transit: number
          is_active: boolean
          item_code: string
          item_name: string
          item_name_cn: string
          item_type: string
          max_stock_level: number
          on_hand: number
          purchase_price: number
          putaway_qty: number
          reorder_point: number
          sales_price: number
          status: string
          supplier_code: string
          total_count: number
          uom_code: string
          uom_id: string
        }[]
      }
      get_items_enhanced_stats: {
        Args: {
          p_business_unit_id?: string
          p_category_id?: string
          p_company_id: string
          p_item_type?: string
          p_search?: string
          p_status?: string
          p_warehouse_id?: string
        }
        Returns: {
          low_stock_count: number
          out_of_stock_count: number
          total_available_value: number
          total_count: number
        }[]
      }
      get_product_movement_report: {
        Args: {
          p_business_unit_id?: string
          p_category_id?: string
          p_company_id: string
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_movement_type?: string
          p_page?: number
          p_search?: string
        }
        Returns: {
          available_stock: number
          average_daily_quantity: number
          category_id: string
          category_name: string
          current_stock: number
          days_of_cover: number
          item_code: string
          item_id: string
          item_name: string
          last_sold_at: string
          movement_rank: number
          quantity_sold: number
          revenue: number
          stock_value: number
          summary_average_daily_quantity: number
          summary_total_quantity_sold: number
          summary_total_revenue: number
          summary_total_stock_value: number
          summary_zero_sales_count: number
          total_count: number
          transaction_count: number
          unit_cost: number
          uom: string
        }[]
      }
      get_purchase_on_order_items: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_expected_from?: string
          p_expected_to?: string
          p_limit?: number
          p_page?: number
          p_search?: string
          p_status?: string
          p_supplier_id?: string
        }
        Returns: {
          expected_delivery: string
          item_code: string
          item_id: string
          item_name: string
          ordered_qty: number
          outstanding_qty: number
          received_qty: number
          sr_id: string
          sr_item_id: string
          sr_number: string
          status: string
          supplier_code: string
          supplier_id: string
          supplier_name: string
          total_count: number
        }[]
      }
      get_reorder_statistics: {
        Args: { p_as_of_date?: string; p_company_id: string }
        Returns: {
          active_alerts: number
          approved_suggestions: number
          items_critical: number
          items_low_stock: number
          items_ok: number
          items_out_of_stock: number
          pending_suggestions: number
          total_estimated_reorder_cost: number
          total_items_tracked: number
        }[]
      }
      get_user_business_units: {
        Args: never
        Returns: {
          code: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          role: string
          type: string
        }[]
      }
      get_user_permissions: {
        Args: { p_business_unit_id?: string; p_user_id: string }
        Returns: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          resource: string
        }[]
      }
      get_van_expected_ending_stock: {
        Args: { p_date: string; p_van_warehouse_id: string }
        Returns: Json
      }
      get_warehouse_business_units: {
        Args: { p_company_id: string; p_warehouse_ids: string[] }
        Returns: {
          business_unit_id: string
          warehouse_id: string
        }[]
      }
      get_warehouse_dashboard_low_stocks: {
        Args: {
          p_business_unit_id?: string
          p_company_id: string
          p_limit?: number
        }
        Returns: {
          item_id: string
          item_name: string
          location_code: string
          qty: number
          reorder_level: number
          uom: string
        }[]
      }
      get_warehouses: {
        Args: {
          p_accessible_business_unit_ids?: string[]
          p_company_id: string
          p_country?: string
          p_is_active?: boolean
          p_limit?: number
          p_page?: number
          p_search?: string
        }
        Returns: {
          address: string
          businessUnitId: string
          city: string
          code: string
          companyId: string
          country: string
          createdAt: string
          description: string
          email: string
          id: string
          isActive: boolean
          isVan: boolean
          managerName: string
          name: string
          phone: string
          postalCode: string
          state: string
          total_count: number
          updatedAt: string
        }[]
      }
      increase_item_batch_location_stock: {
        Args: {
          p_batch_code: string
          p_company_id: string
          p_item_id: string
          p_location_id: string
          p_quantity: number
          p_received_at: string
          p_user_id?: string
          p_warehouse_id: string
        }
        Returns: string
      }
      link_load_list_stock_requisitions: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_links: Json
          p_load_list_id: string
          p_user_id: string
        }
        Returns: number
      }
      list_eligible_load_list_requisition_items: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_limit?: number
          p_load_list_id: string
          p_page?: number
          p_search?: string
          p_user_id: string
        }
        Returns: {
          fulfilled_qty: number
          item_code: string
          item_id: string
          item_name: string
          outstanding_qty: number
          requested_qty: number
          requisition_date: string
          sr_id: string
          sr_item_id: string
          sr_number: string
          sr_status: string
          total_count: number
        }[]
      }
      maintain_user_activity_logs: {
        Args: { p_delete_batch_size?: number; p_retention_days?: number }
        Returns: {
          deleted_rows: number
          dropped_partitions: number
        }[]
      }
      mark_load_list_arrived: {
        Args: {
          p_actual_arrival_date?: string
          p_business_unit_id: string
          p_company_id: string
          p_load_list_id: string
          p_user_id: string
        }
        Returns: string
      }
      mark_load_list_in_transit: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_estimated_arrival_date?: string
          p_liner_name?: string
          p_load_list_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      notify_business_units: {
        Args: {
          p_actor_user_id: string
          p_company_id: string
          p_exclude_user_ids?: string[]
          p_message: string
          p_metadata?: Json
          p_target_business_unit_ids: string[]
          p_title: string
          p_type: string
        }
        Returns: number
      }
      notify_users:
        | {
            Args: {
              p_actor_user_id: string
              p_company_id: string
              p_message: string
              p_metadata?: Json
              p_target_user_ids: string[]
              p_title: string
              p_type: string
            }
            Returns: number
          }
        | {
            Args: {
              p_actor_user_id: string
              p_business_unit_id?: string
              p_company_id: string
              p_message: string
              p_metadata?: Json
              p_target_user_ids: string[]
              p_title: string
              p_type: string
            }
            Returns: number
          }
      pause_grn_receiving: {
        Args: { p_company_id: string; p_grn_id: string; p_user_id: string }
        Returns: undefined
      }
      post_delivery_note_dispatch:
        | {
            Args: {
              p_business_unit_id: string
              p_company_id: string
              p_dispatch_date: string
              p_dn_id: string
              p_driver_name: string
              p_driver_signature: string
              p_items: Json
              p_notes: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_business_unit_id: string
              p_company_id: string
              p_delivery_time: string
              p_dispatch_date: string
              p_dn_id: string
              p_driver_name: string
              p_driver_signature: string
              p_helper_name: string
              p_items: Json
              p_notes: string
              p_plate_number: string
              p_user_id: string
            }
            Returns: undefined
          }
      post_delivery_note_receive: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_dn_id: string
          p_items: Json
          p_notes: string
          p_received_date: string
          p_user_id: string
        }
        Returns: undefined
      }
      post_putaway_task: {
        Args: {
          p_batch_code: string
          p_location_id: string
          p_quantity: number
          p_task_id: string
          p_user_id: string
        }
        Returns: {
          batch_code: string
          batch_location_id: string
          batch_location_sku: string
          location_id: string
          posted_date: string
          posted_quantity: number
          transaction_id: string
        }[]
      }
      post_stock_adjustment: {
        Args: {
          p_adjustment_id: string
          p_business_unit_id: string
          p_company_id: string
          p_user_id: string
        }
        Returns: {
          adjustment_id: string
          stock_transaction_code: string
          stock_transaction_id: string
        }[]
      }
      recalculate_sales_order_linked_quotation_statuses: {
        Args: { p_sales_order_id: string }
        Returns: undefined
      }
      recalculate_sales_quotation_order_status: {
        Args: { p_quotation_id: string }
        Returns: undefined
      }
      recalculate_stock_requisition_fulfillment_for_items: {
        Args: { p_company_id: string; p_sr_item_ids: string[] }
        Returns: undefined
      }
      recalculate_stock_requisition_fulfillment_for_load_list: {
        Args: { p_company_id: string; p_load_list_id: string }
        Returns: undefined
      }
      record_delivery_note_receiving_scan: {
        Args: {
          p_accepted_qty?: number
          p_adjustment_reason?: string
          p_batch_number?: string
          p_box_id: string
          p_business_unit_id: string
          p_company_id: string
          p_dn_id: string
          p_item_id: string
          p_item_unit_option_id?: string
          p_location_id?: string
          p_notes?: string
          p_qr_code: string
          p_qr_qty: number
          p_user_id: string
        }
        Returns: Json
      }
      record_pick_list_item_progress: {
        Args: {
          p_batch_location_sku?: string
          p_company_id: string
          p_mismatch_acknowledged?: boolean
          p_mismatch_reason?: string
          p_operation_id: string
          p_pick_list_id: string
          p_pick_list_item_id: string
          p_picked_batch_code?: string
          p_picked_batch_received_at?: string
          p_picked_location_id?: string
          p_picked_qty: number
          p_user_id: string
        }
        Returns: string
      }
      refresh_delivery_note_item_received_qty: {
        Args: { p_company_id: string; p_dn_item_id: string }
        Returns: number
      }
      regenerate_grn_boxes: {
        Args: {
          p_company_id: string
          p_grn_id: string
          p_grn_item_id: string
          p_num_boxes: number
          p_user_id: string
          p_warehouse_location_id?: string
        }
        Returns: number
      }
      reject_delivery_note_receiving_exception: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_dn_id: string
          p_exception_id: string
          p_notes?: string
          p_user_id: string
        }
        Returns: undefined
      }
      reject_delivery_note_receiving_overage: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_dn_id: string
          p_dn_item_id: string
          p_notes?: string
          p_user_id: string
        }
        Returns: undefined
      }
      release_pick_list_item_claim: {
        Args: {
          p_company_id: string
          p_pick_list_id: string
          p_pick_list_item_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      release_sales_order_item_quotation_fulfillment: {
        Args: { p_fulfilled_qty: number; p_quotation_item_id: string }
        Returns: undefined
      }
      remove_load_list_sr_link: {
        Args: {
          p_business_unit_id: string
          p_company_id: string
          p_link_id: string
          p_load_list_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      reserve_delivery_note_inventory: {
        Args: { p_company_id: string; p_dn_id: string; p_user_id: string }
        Returns: undefined
      }
      reserve_delivery_note_inventory_lines: {
        Args: {
          p_company_id: string
          p_dn_id: string
          p_line_ids: string[]
          p_user_id: string
        }
        Returns: undefined
      }
      reverse_load_list_arrival: {
        Args: {
          p_company_id: string
          p_load_list_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      save_grn_receiving: {
        Args: {
          p_company_id: string
          p_grn_id: string
          p_patch: Json
          p_user_id: string
        }
        Returns: undefined
      }
      save_sales_quotation_item_frame_details: {
        Args: {
          p_company_id: string
          p_item: Json
          p_quotation_item_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      setup_company_rbac: { Args: { p_company_id: string }; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_grn_receiving: {
        Args: { p_company_id: string; p_grn_id: string; p_user_id: string }
        Returns: undefined
      }
      submit_delivery_note_receiving:
        | {
            Args: {
              p_business_unit_id: string
              p_company_id: string
              p_dn_id: string
              p_notes?: string
              p_received_date?: string
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_acknowledge_discrepancy?: boolean
              p_business_unit_id: string
              p_company_id: string
              p_discrepancy_notes?: string
              p_dn_id: string
              p_notes?: string
              p_received_date?: string
              p_user_id: string
            }
            Returns: undefined
          }
      submit_grn_to_putaway: {
        Args: {
          p_company_id: string
          p_grn_id: string
          p_notes?: string
          p_user_id: string
        }
        Returns: string
      }
      sync_reorder_alert_notifications: {
        Args: { p_company_id: string }
        Returns: number
      }
      sync_reorder_alert_notifications_internal: {
        Args: { p_company_id: string; p_item_ids?: string[] }
        Returns: number
      }
      unacknowledge_reorder_alerts: {
        Args: {
          p_alert_ids: string[]
          p_as_of_date?: string
          p_company_id: string
          p_unacknowledged_by: string
        }
        Returns: {
          unacknowledged_count: number
        }[]
      }
      update_current_business_unit: {
        Args: { p_business_unit_id: string }
        Returns: Json
      }
      update_sales_quotation_transaction: {
        Args: {
          p_items: Json
          p_notes: string
          p_quotation_date: string
          p_quotation_id: string
          p_terms_conditions: string
          p_valid_until: string
        }
        Returns: string
      }
      update_stock_adjustment: {
        Args: {
          p_adjustment_date?: string
          p_adjustment_id: string
          p_adjustment_type?: string
          p_business_unit_id: string
          p_company_id: string
          p_items?: Json
          p_location_id?: string
          p_location_id_provided?: boolean
          p_notes?: string
          p_notes_provided?: boolean
          p_reason?: string
          p_user_id: string
          p_warehouse_id?: string
        }
        Returns: {
          adjustment_code: string
          adjustment_id: string
          status: string
        }[]
      }
      update_transformation_template: {
        Args: {
          p_company_id: string
          p_description?: string
          p_description_provided?: boolean
          p_image_url?: string
          p_image_url_provided?: boolean
          p_inputs?: Json
          p_is_active?: boolean
          p_is_active_provided?: boolean
          p_outputs?: Json
          p_template_id: string
          p_template_name?: string
          p_template_name_provided?: boolean
          p_user_id: string
        }
        Returns: {
          business_unit_id: string | null
          company_id: string
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          layout_json: Json | null
          sheet_height: number | null
          sheet_unit: string | null
          sheet_width: number | null
          template_code: string
          template_kind: string
          template_name: string
          updated_at: string
          updated_by: string
          usage_count: number
        }
        SetofOptions: {
          from: "*"
          to: "transformation_templates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_item_custom_field: {
        Args: {
          p_item_id: string
          p_key: string
          p_original_key?: string
          p_updated_by?: string
          p_value: string
        }
        Returns: Json
      }
      user_can_view_pick_list: {
        Args: {
          p_company_id: string
          p_pick_list_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      user_has_permission: {
        Args: {
          p_action: string
          p_business_unit_id?: string
          p_resource: string
          p_user_id: string
        }
        Returns: boolean
      }
      void_delivery_note_pre_dispatch: {
        Args: {
          p_company_id: string
          p_dn_id: string
          p_reason?: string
          p_user_id: string
        }
        Returns: undefined
      }
      void_delivery_note_receiving_scan: {
        Args: {
          p_company_id: string
          p_dn_id: string
          p_reason?: string
          p_scan_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      void_pos_transaction: {
        Args: {
          p_business_unit_id?: string
          p_company_id: string
          p_transaction_id: string
          p_user_id: string
          p_void_reason?: string
        }
        Returns: Json
      }
    }
    Enums: {
      delivery_note_status:
        | "draft"
        | "confirmed"
        | "queued_for_picking"
        | "picking_in_progress"
        | "dispatch_ready"
        | "dispatched"
        | "received"
        | "voided"
      pick_list_status:
        | "pending"
        | "in_progress"
        | "paused"
        | "cancelled"
        | "done"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      delivery_note_status: [
        "draft",
        "confirmed",
        "queued_for_picking",
        "picking_in_progress",
        "dispatch_ready",
        "dispatched",
        "received",
        "voided",
      ],
      pick_list_status: [
        "pending",
        "in_progress",
        "paused",
        "cancelled",
        "done",
      ],
    },
  },
} as const
