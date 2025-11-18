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
      item_warehouse: {
        Row: {
          available_stock: number | null
          company_id: string
          created_at: string
          created_by: string | null
          current_stock: number | null
          deleted_at: string | null
          id: string
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
          deleted_at?: string | null
          id?: string
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
          deleted_at?: string | null
          id?: string
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
          is_active: boolean | null
          is_stock_item: boolean | null
          item_code: string
          item_name: string
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
          is_active?: boolean | null
          is_stock_item?: boolean | null
          item_code: string
          item_name: string
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
          is_active?: boolean | null
          is_stock_item?: boolean | null
          item_code?: string
          item_name?: string
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
            foreignKeyName: "sales_quotations_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_ledger: {
        Row: {
          actual_qty: number
          batch_no: string | null
          company_id: string
          created_at: string
          id: string
          incoming_rate: number | null
          is_cancelled: boolean | null
          item_id: string
          posting_date: string
          posting_time: string
          qty_after_trans: number
          serial_no: string | null
          stock_value: number | null
          stock_value_diff: number | null
          transaction_id: string
          transaction_item_id: string
          valuation_rate: number | null
          voucher_no: string
          voucher_type: string
          warehouse_id: string
        }
        Insert: {
          actual_qty: number
          batch_no?: string | null
          company_id: string
          created_at?: string
          id?: string
          incoming_rate?: number | null
          is_cancelled?: boolean | null
          item_id: string
          posting_date: string
          posting_time: string
          qty_after_trans: number
          serial_no?: string | null
          stock_value?: number | null
          stock_value_diff?: number | null
          transaction_id: string
          transaction_item_id: string
          valuation_rate?: number | null
          voucher_no: string
          voucher_type: string
          warehouse_id: string
        }
        Update: {
          actual_qty?: number
          batch_no?: string | null
          company_id?: string
          created_at?: string
          id?: string
          incoming_rate?: number | null
          is_cancelled?: boolean | null
          item_id?: string
          posting_date?: string
          posting_time?: string
          qty_after_trans?: number
          serial_no?: string | null
          stock_value?: number | null
          stock_value_diff?: number | null
          transaction_id?: string
          transaction_item_id?: string
          valuation_rate?: number | null
          voucher_no?: string
          voucher_type?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_ledger_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "stock_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_transaction_item_id_fkey"
            columns: ["transaction_item_id"]
            isOneToOne: false
            referencedRelation: "stock_transaction_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_ledger_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          quantity: number
          serial_no: string | null
          total_cost: number | null
          transaction_id: string
          unit_cost: number | null
          uom_id: string
          updated_at: string
          updated_by: string
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
          quantity: number
          serial_no?: string | null
          total_cost?: number | null
          transaction_id: string
          unit_cost?: number | null
          uom_id: string
          updated_at?: string
          updated_by: string
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
          quantity?: number
          serial_no?: string | null
          total_cost?: number | null
          transaction_id?: string
          unit_cost?: number | null
          uom_id?: string
          updated_at?: string
          updated_by?: string
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
          company_id: string
          created_at: string
          created_by: string | null
          custom_fields: Json | null
          deleted_at: string | null
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          status: string | null
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
          company_id: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
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
          company_id?: string
          created_at?: string
          created_by?: string | null
          custom_fields?: Json | null
          deleted_at?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string | null
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
      users: {
        Row: {
          company_id: string
          created_at: string
          deleted_at: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
          username: string
        }
        Insert: {
          company_id: string
          created_at?: string
          deleted_at?: string | null
          email: string
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          company_id?: string
          created_at?: string
          deleted_at?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

