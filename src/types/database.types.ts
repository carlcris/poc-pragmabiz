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
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          legal_name: string | null
          name: string
          phone: string | null
          postal_code: string | null
          settings: Json | null
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
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          settings?: Json | null
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
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          legal_name?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          settings?: Json | null
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
      grn_boxes: {
        Row: {
          barcode: string
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
          load_list_qty: number
          notes: string | null
          num_boxes: number | null
          received_qty: number
          updated_at: string
        }
        Insert: {
          barcodes_printed?: boolean | null
          created_at?: string
          damaged_qty?: number
          grn_id: string
          id?: string
          item_id: string
          load_list_qty: number
          notes?: string | null
          num_boxes?: number | null
          received_qty?: number
          updated_at?: string
        }
        Update: {
          barcodes_printed?: boolean | null
          created_at?: string
          damaged_qty?: number
          grn_id?: string
          id?: string
          item_id?: string
          load_list_qty?: number
          notes?: string | null
          num_boxes?: number | null
          received_qty?: number
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
      item_location: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
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
          company_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
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
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
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
            foreignKeyName: "item_location_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_location_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_location_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_location_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_location_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_location_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          cost_price: number | null
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          default_warehouse: string | null
          deleted_at: string | null
          description: string | null
          dimensions: Json | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_stock_item: boolean | null
          item_code: string
          item_name: string
          item_name_cn: string | null
          item_type: string
          purchase_price: number | null
          sales_price: number | null
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
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          default_warehouse?: string | null
          deleted_at?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_stock_item?: boolean | null
          item_code: string
          item_name: string
          item_name_cn?: string | null
          item_type: string
          purchase_price?: number | null
          sales_price?: number | null
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
          cost_price?: number | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          default_warehouse?: string | null
          deleted_at?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_stock_item?: boolean | null
          item_code?: string
          item_name?: string
          item_name_cn?: string | null
          item_type?: string
          purchase_price?: number | null
          sales_price?: number | null
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
          load_list_id: string
          load_list_qty: number
          notes: string | null
          received_qty: number
          shortage_qty: number | null
          total_price: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          damaged_qty?: number
          id?: string
          item_id: string
          load_list_id: string
          load_list_qty: number
          notes?: string | null
          received_qty?: number
          shortage_qty?: number | null
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          damaged_qty?: number
          id?: string
          item_id?: string
          load_list_id?: string
          load_list_qty?: number
          notes?: string | null
          received_qty?: number
          shortage_qty?: number | null
          total_price?: number | null
          unit_price?: number
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
            foreignKeyName: "load_list_items_load_list_id_fkey"
            columns: ["load_list_id"]
            isOneToOne: false
            referencedRelation: "load_lists"
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
          deleted_at: string | null
          estimated_arrival_date: string | null
          id: string
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
          deleted_at?: string | null
          estimated_arrival_date?: string | null
          id?: string
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
          deleted_at?: string | null
          estimated_arrival_date?: string | null
          id?: string
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
      notifications: {
        Row: {
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
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          resource: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          resource: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          resource?: string
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
          quantity: number
          rate: number
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
          quantity: number
          rate: number
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
          quantity?: number
          rate?: number
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
          quantity: number
          quantity_delivered: number | null
          quantity_shipped: number | null
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
          order_id: string
          quantity: number
          quantity_delivered?: number | null
          quantity_shipped?: number | null
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
          order_id?: string
          quantity?: number
          quantity_delivered?: number | null
          quantity_shipped?: number | null
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
          quotation_id: string | null
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
          quotation_id?: string | null
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
          quotation_id?: string | null
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
            foreignKeyName: "sales_orders_quotation_id_fkey"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "sales_quotations"
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
      sales_quotation_items: {
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
          id?: string
          item_description?: string | null
          item_id: string
          line_total: number
          notes?: string | null
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
          id?: string
          item_description?: string | null
          item_id?: string
          line_total?: number
          notes?: string | null
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
          id: string
          notes: string | null
          price_list_id: string | null
          quotation_code: string
          quotation_date: string
          sales_order_id: string | null
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
          id?: string
          notes?: string | null
          price_list_id?: string | null
          quotation_code: string
          quotation_date: string
          sales_order_id?: string | null
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
          id?: string
          notes?: string | null
          price_list_id?: string | null
          quotation_code?: string
          quotation_date?: string
          sales_order_id?: string | null
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
            foreignKeyName: "sales_quotations_sales_order_id_fkey"
            columns: ["sales_order_id"]
            isOneToOne: false
            referencedRelation: "sales_orders"
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
          id: string
          item_id: string
          notes: string | null
          picked_qty: number | null
          requested_qty: number
          stock_request_id: string
          uom_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          picked_qty?: number | null
          requested_qty: number
          stock_request_id: string
          uom_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          picked_qty?: number | null
          requested_qty?: number
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
          destination_warehouse_id: string | null
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
          required_date: string
          source_warehouse_id: string
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
          destination_warehouse_id?: string | null
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
          required_date: string
          source_warehouse_id: string
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
          destination_warehouse_id?: string | null
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
          required_date?: string
          source_warehouse_id?: string
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
            foreignKeyName: "stock_requests_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
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
            foreignKeyName: "stock_requests_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
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
          notes: string | null
          outstanding_qty: number | null
          requested_qty: number
          sr_id: string
          total_price: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fulfilled_qty?: number
          id?: string
          item_id: string
          notes?: string | null
          outstanding_qty?: number | null
          requested_qty: number
          sr_id: string
          total_price?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fulfilled_qty?: number
          id?: string
          item_id?: string
          notes?: string | null
          outstanding_qty?: number | null
          requested_qty?: number
          sr_id?: string
          total_price?: number | null
          unit_price?: number
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
            foreignKeyName: "stock_requisition_items_sr_id_fkey"
            columns: ["sr_id"]
            isOneToOne: false
            referencedRelation: "stock_requisitions"
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
          business_unit_id: string | null
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
          business_unit_id?: string | null
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
          business_unit_id?: string | null
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
            foreignKeyName: "suppliers_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
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
          is_active: boolean
          template_code: string
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
          is_active?: boolean
          template_code: string
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
          is_active?: boolean
          template_code?: string
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
      create_item_with_packages: {
        Args: {
          p_additional_packages?: Json
          p_base_package_name?: string
          p_base_package_type?: string
          p_base_uom_id?: string
          p_company_id: string
          p_item_code: string
          p_item_description?: string
          p_item_name: string
          p_item_name_cn?: string
          p_item_type?: string
          p_list_price?: number
          p_standard_cost?: number
          p_user_id: string
        }
        Returns: {
          base_package_id: string
          item_id: string
          message: string
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_current_business_unit_id: { Args: never; Returns: string }
      get_next_journal_code: { Args: { p_company_id: string }; Returns: string }
      get_next_stock_request_code: {
        Args: { p_company_id: string }
        Returns: string
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
      setup_company_rbac: { Args: { p_company_id: string }; Returns: undefined }
      update_current_business_unit: {
        Args: { p_business_unit_id: string }
        Returns: Json
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

