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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          end_date: string
          id: string
          label: string
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["academic_year_state"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          label: string
          notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["academic_year_state"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          label?: string
          notes?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["academic_year_state"]
          updated_at?: string
        }
        Relationships: []
      }
      admission_applications: {
        Row: {
          academic_year_id: string
          admission_fee_recorded_at: string | null
          application_number: string | null
          created_at: string
          created_by: string | null
          decision_reason: string | null
          id: string
          requested_grade_level_id: string
          requested_section_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seat_reserved_until: string | null
          status: Database["public"]["Enums"]["admission_application_status"]
          student_id: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          admission_fee_recorded_at?: string | null
          application_number?: string | null
          created_at?: string
          created_by?: string | null
          decision_reason?: string | null
          id?: string
          requested_grade_level_id: string
          requested_section_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seat_reserved_until?: string | null
          status?: Database["public"]["Enums"]["admission_application_status"]
          student_id: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          admission_fee_recorded_at?: string | null
          application_number?: string | null
          created_at?: string
          created_by?: string | null
          decision_reason?: string | null
          id?: string
          requested_grade_level_id?: string
          requested_section_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seat_reserved_until?: string | null
          status?: Database["public"]["Enums"]["admission_application_status"]
          student_id?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_applications_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_applications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_applications_requested_grade_level_id_fkey"
            columns: ["requested_grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_applications_requested_section_id_academic_year__fkey"
            columns: [
              "requested_section_id",
              "academic_year_id",
              "requested_grade_level_id",
            ]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id", "academic_year_id", "grade_level_id"]
          },
          {
            foreignKeyName: "admission_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_applications_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      admission_status_history: {
        Row: {
          admission_application_id: string
          changed_at: string
          changed_by: string | null
          from_status:
            | Database["public"]["Enums"]["admission_application_status"]
            | null
          id: string
          reason: string | null
          to_status: Database["public"]["Enums"]["admission_application_status"]
        }
        Insert: {
          admission_application_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?:
            | Database["public"]["Enums"]["admission_application_status"]
            | null
          id?: string
          reason?: string | null
          to_status: Database["public"]["Enums"]["admission_application_status"]
        }
        Update: {
          admission_application_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?:
            | Database["public"]["Enums"]["admission_application_status"]
            | null
          id?: string
          reason?: string | null
          to_status?: Database["public"]["Enums"]["admission_application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "admission_status_history_admission_application_id_fkey"
            columns: ["admission_application_id"]
            isOneToOne: false
            referencedRelation: "admission_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_staff_id: string | null
          after_snapshot: Json | null
          before_snapshot: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          outcome: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_staff_id?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          outcome?: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_staff_id?: string | null
          after_snapshot?: Json | null
          before_snapshot?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          outcome?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_staff_id_fkey"
            columns: ["actor_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_versions: {
        Row: {
          approved_by: string | null
          content_snapshot: Json
          generated_at: string
          generated_by: string | null
          id: string
          issue_or_reissue_reason: string | null
          pdf_storage_bucket: string | null
          pdf_storage_object_key: string | null
          student_year_certificate_id: string
          template_version: string
          version_number: number
        }
        Insert: {
          approved_by?: string | null
          content_snapshot: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          issue_or_reissue_reason?: string | null
          pdf_storage_bucket?: string | null
          pdf_storage_object_key?: string | null
          student_year_certificate_id: string
          template_version: string
          version_number: number
        }
        Update: {
          approved_by?: string | null
          content_snapshot?: Json
          generated_at?: string
          generated_by?: string | null
          id?: string
          issue_or_reissue_reason?: string | null
          pdf_storage_bucket?: string | null
          pdf_storage_object_key?: string | null
          student_year_certificate_id?: string
          template_version?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_versions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_versions_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_versions_student_year_certificate_id_fkey"
            columns: ["student_year_certificate_id"]
            isOneToOne: false
            referencedRelation: "student_year_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidated_receipt_items: {
        Row: {
          amount_snapshot: number
          consolidated_receipt_id: string
          created_at: string
          display_order: number
          id: string
          receipt_id: string
          receipt_number_snapshot: string
        }
        Insert: {
          amount_snapshot: number
          consolidated_receipt_id: string
          created_at?: string
          display_order: number
          id?: string
          receipt_id: string
          receipt_number_snapshot: string
        }
        Update: {
          amount_snapshot?: number
          consolidated_receipt_id?: string
          created_at?: string
          display_order?: number
          id?: string
          receipt_id?: string
          receipt_number_snapshot?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidated_receipt_items_consolidated_receipt_id_fkey"
            columns: ["consolidated_receipt_id"]
            isOneToOne: false
            referencedRelation: "consolidated_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidated_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      consolidated_receipts: {
        Row: {
          created_at: string
          generated_at: string
          generated_by: string | null
          id: string
          pdf_storage_bucket: string | null
          pdf_storage_object_key: string | null
          receipt_number: string
          rendered_snapshot: Json
          student_academic_record_id: string
          template_version: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          pdf_storage_bucket?: string | null
          pdf_storage_object_key?: string | null
          receipt_number: string
          rendered_snapshot: Json
          student_academic_record_id: string
          template_version: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          pdf_storage_bucket?: string | null
          pdf_storage_object_key?: string | null
          receipt_number?: string
          rendered_snapshot?: Json
          student_academic_record_id?: string
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consolidated_receipts_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consolidated_receipts_student_academic_record_id_fkey"
            columns: ["student_academic_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requirements: {
        Row: {
          academic_year_id: string
          applies_to_new_admission: boolean
          created_at: string
          document_type_id: string
          grade_level_id: string | null
          id: string
          is_required: boolean
          notes: string | null
        }
        Insert: {
          academic_year_id: string
          applies_to_new_admission?: boolean
          created_at?: string
          document_type_id: string
          grade_level_id?: string | null
          id?: string
          is_required?: boolean
          notes?: string | null
        }
        Update: {
          academic_year_id?: string
          applies_to_new_admission?: boolean
          created_at?: string
          document_type_id?: string
          grade_level_id?: string | null
          id?: string
          is_required?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_requirements_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requirements_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requirements_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_adjustments: {
        Row: {
          adjustment_type: Database["public"]["Enums"]["adjustment_kind"]
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          reason: string
          requested_at: string
          requested_by: string
          status: Database["public"]["Enums"]["approval_state"]
          student_fee_assessment_line_id: string
        }
        Insert: {
          adjustment_type: Database["public"]["Enums"]["adjustment_kind"]
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          reason: string
          requested_at?: string
          requested_by: string
          status?: Database["public"]["Enums"]["approval_state"]
          student_fee_assessment_line_id: string
        }
        Update: {
          adjustment_type?: Database["public"]["Enums"]["adjustment_kind"]
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          reason?: string
          requested_at?: string
          requested_by?: string
          status?: Database["public"]["Enums"]["approval_state"]
          student_fee_assessment_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_adjustments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_adjustments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_adjustments_student_fee_assessment_line_id_fkey"
            columns: ["student_fee_assessment_line_id"]
            isOneToOne: false
            referencedRelation: "student_fee_assessment_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_heads: {
        Row: {
          category: Database["public"]["Enums"]["fee_category"]
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_optional: boolean
          is_variable: boolean
          name: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["fee_category"]
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_optional?: boolean
          is_variable?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["fee_category"]
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_optional?: boolean
          is_variable?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_structure_lines: {
        Row: {
          amount: number | null
          applicability_rule: string | null
          created_at: string
          display_order: number
          fee_head_id: string
          fee_structure_id: string
          id: string
        }
        Insert: {
          amount?: number | null
          applicability_rule?: string | null
          created_at?: string
          display_order?: number
          fee_head_id: string
          fee_structure_id: string
          id?: string
        }
        Update: {
          amount?: number | null
          applicability_rule?: string | null
          created_at?: string
          display_order?: number
          fee_head_id?: string
          fee_structure_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structure_lines_fee_head_id_fkey"
            columns: ["fee_head_id"]
            isOneToOne: false
            referencedRelation: "fee_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structure_lines_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_structures: {
        Row: {
          academic_year_id: string
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          grade_level_id: string
          id: string
          status: Database["public"]["Enums"]["fee_structure_state"]
          updated_at: string
          version: number
        }
        Insert: {
          academic_year_id: string
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          grade_level_id: string
          id?: string
          status?: Database["public"]["Enums"]["fee_structure_state"]
          updated_at?: string
          version?: number
        }
        Update: {
          academic_year_id?: string
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          grade_level_id?: string
          id?: string
          status?: Database["public"]["Enums"]["fee_structure_state"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_levels: {
        Row: {
          code: string
          created_at: string
          group_name: Database["public"]["Enums"]["grade_group"]
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          group_name: Database["public"]["Enums"]["grade_group"]
          id?: string
          is_active?: boolean
          name: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          group_name?: Database["public"]["Enums"]["grade_group"]
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      guardians: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          occupation: string | null
          phone: string | null
          postal_code: string | null
          relationship_to_student: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          occupation?: string | null
          phone?: string | null
          postal_code?: string | null
          relationship_to_student?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          occupation?: string | null
          phone?: string | null
          postal_code?: string | null
          relationship_to_student?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_allocations: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_id: string
          student_fee_assessment_line_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_id: string
          student_fee_assessment_line_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_id?: string
          student_fee_assessment_line_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_student_fee_assessment_line_id_fkey"
            columns: ["student_fee_assessment_line_id"]
            isOneToOne: false
            referencedRelation: "student_fee_assessment_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payer_contact: string | null
          payer_name: string
          recorded_by: string | null
          reference_number: string | null
          reverses_payment_id: string | null
          student_academic_record_id: string
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["payment_kind"]
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payer_contact?: string | null
          payer_name: string
          recorded_by?: string | null
          reference_number?: string | null
          reverses_payment_id?: string | null
          student_academic_record_id: string
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["payment_kind"]
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payer_contact?: string | null
          payer_name?: string
          recorded_by?: string | null
          reference_number?: string | null
          reverses_payment_id?: string | null
          student_academic_record_id?: string
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["payment_kind"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_reverses_payment_id_fkey"
            columns: ["reverses_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_academic_record_id_fkey"
            columns: ["student_academic_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_number_counters: {
        Row: {
          next_value: number
          series_code: string
          updated_at: string
        }
        Insert: {
          next_value?: number
          series_code: string
          updated_at?: string
        }
        Update: {
          next_value?: number
          series_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          category: Database["public"]["Enums"]["fee_category"]
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          last_reprinted_at: string | null
          payment_id: string
          pdf_storage_bucket: string | null
          pdf_storage_object_key: string | null
          receipt_number: string
          rendered_snapshot: Json
          reprint_count: number
          template_version: string
        }
        Insert: {
          category: Database["public"]["Enums"]["fee_category"]
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_reprinted_at?: string | null
          payment_id: string
          pdf_storage_bucket?: string | null
          pdf_storage_object_key?: string | null
          receipt_number: string
          rendered_snapshot: Json
          reprint_count?: number
          template_version: string
        }
        Update: {
          category?: Database["public"]["Enums"]["fee_category"]
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_reprinted_at?: string | null
          payment_id?: string
          pdf_storage_bucket?: string | null
          pdf_storage_object_key?: string | null
          receipt_number?: string
          rendered_snapshot?: Json
          reprint_count?: number
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          academic_year_id: string
          created_at: string
          grade_level_id: string
          id: string
          is_active: boolean
          max_capacity: number
          name: string
        }
        Insert: {
          academic_year_id: string
          created_at?: string
          grade_level_id: string
          id?: string
          is_active?: boolean
          max_capacity: number
          name: string
        }
        Update: {
          academic_year_id?: string
          created_at?: string
          grade_level_id?: string
          id?: string
          is_active?: boolean
          max_capacity?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sections_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          auth_user_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          is_active?: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
        }
        Relationships: []
      }
      student_academic_records: {
        Row: {
          academic_year_id: string
          admission_date: string | null
          admission_number: string | null
          created_at: string
          grade_level_id: string
          id: string
          notes: string | null
          roll_number: string | null
          section_id: string | null
          status: Database["public"]["Enums"]["student_year_status"]
          student_id: string
          transport_opted_in: boolean
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          admission_date?: string | null
          admission_number?: string | null
          created_at?: string
          grade_level_id: string
          id?: string
          notes?: string | null
          roll_number?: string | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["student_year_status"]
          student_id: string
          transport_opted_in?: boolean
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          admission_date?: string | null
          admission_number?: string | null
          created_at?: string
          grade_level_id?: string
          id?: string
          notes?: string | null
          roll_number?: string | null
          section_id?: string | null
          status?: Database["public"]["Enums"]["student_year_status"]
          student_id?: string
          transport_opted_in?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_academic_records_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_academic_records_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_academic_records_section_id_academic_year_id_grade_fkey"
            columns: ["section_id", "academic_year_id", "grade_level_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id", "academic_year_id", "grade_level_id"]
          },
          {
            foreignKeyName: "student_academic_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_documents: {
        Row: {
          admission_application_id: string | null
          created_at: string
          document_type_id: string
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          rejection_reason: string | null
          replaces_document_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          storage_bucket: string | null
          storage_object_key: string | null
          student_academic_record_id: string | null
          student_id: string
          uploaded_at: string | null
          uploaded_by: string | null
          verification_status: Database["public"]["Enums"]["document_verification_status"]
        }
        Insert: {
          admission_application_id?: string | null
          created_at?: string
          document_type_id: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          rejection_reason?: string | null
          replaces_document_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_bucket?: string | null
          storage_object_key?: string | null
          student_academic_record_id?: string | null
          student_id: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          verification_status?: Database["public"]["Enums"]["document_verification_status"]
        }
        Update: {
          admission_application_id?: string | null
          created_at?: string
          document_type_id?: string
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          rejection_reason?: string | null
          replaces_document_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          storage_bucket?: string | null
          storage_object_key?: string | null
          student_academic_record_id?: string | null
          student_id?: string
          uploaded_at?: string | null
          uploaded_by?: string | null
          verification_status?: Database["public"]["Enums"]["document_verification_status"]
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_admission_application_id_fkey"
            columns: ["admission_application_id"]
            isOneToOne: false
            referencedRelation: "admission_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_documents_replaces_document_id_fkey"
            columns: ["replaces_document_id"]
            isOneToOne: false
            referencedRelation: "student_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_documents_student_academic_record_id_fkey"
            columns: ["student_academic_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fee_assessment_lines: {
        Row: {
          assessed_amount: number
          created_at: string
          description_snapshot: string | null
          fee_head_id: string
          id: string
          student_fee_assessment_id: string
        }
        Insert: {
          assessed_amount: number
          created_at?: string
          description_snapshot?: string | null
          fee_head_id: string
          id?: string
          student_fee_assessment_id: string
        }
        Update: {
          assessed_amount?: number
          created_at?: string
          description_snapshot?: string | null
          fee_head_id?: string
          id?: string
          student_fee_assessment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_assessment_lines_fee_head_id_fkey"
            columns: ["fee_head_id"]
            isOneToOne: false
            referencedRelation: "fee_heads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_assessment_lines_student_fee_assessment_id_fkey"
            columns: ["student_fee_assessment_id"]
            isOneToOne: false
            referencedRelation: "student_fee_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fee_assessments: {
        Row: {
          assessed_at: string
          assessment_number: string
          created_at: string
          fee_structure_id: string
          id: string
          issued_at: string | null
          issued_by: string | null
          snapshot: Json
          status: Database["public"]["Enums"]["assessment_state"]
          student_academic_record_id: string
          updated_at: string
        }
        Insert: {
          assessed_at?: string
          assessment_number: string
          created_at?: string
          fee_structure_id: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["assessment_state"]
          student_academic_record_id: string
          updated_at?: string
        }
        Update: {
          assessed_at?: string
          assessment_number?: string
          created_at?: string
          fee_structure_id?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          snapshot?: Json
          status?: Database["public"]["Enums"]["assessment_state"]
          student_academic_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fee_assessments_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_assessments_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fee_assessments_student_academic_record_id_fkey"
            columns: ["student_academic_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
        ]
      }
      student_guardians: {
        Row: {
          can_collect_student: boolean
          created_at: string
          guardian_id: string
          is_primary_contact: boolean
          relationship_type: string
          student_id: string
        }
        Insert: {
          can_collect_student?: boolean
          created_at?: string
          guardian_id: string
          is_primary_contact?: boolean
          relationship_type: string
          student_id: string
        }
        Update: {
          can_collect_student?: boolean
          created_at?: string
          guardian_id?: string
          is_primary_contact?: boolean
          relationship_type?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_id_fkey"
            columns: ["guardian_id"]
            isOneToOne: false
            referencedRelation: "guardians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_sensitive_details: {
        Row: {
          aadhaar_encrypted: string | null
          aadhaar_last_four: string | null
          annual_family_income: number | null
          caste: string | null
          student_id: string
          sub_caste: string | null
          updated_at: string
        }
        Insert: {
          aadhaar_encrypted?: string | null
          aadhaar_last_four?: string | null
          annual_family_income?: number | null
          caste?: string | null
          student_id: string
          sub_caste?: string | null
          updated_at?: string
        }
        Update: {
          aadhaar_encrypted?: string | null
          aadhaar_last_four?: string | null
          annual_family_income?: number | null
          caste?: string | null
          student_id?: string
          sub_caste?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_sensitive_details_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_transport_assignments: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          student_academic_record_id: string
          transport_rate_id: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          student_academic_record_id: string
          transport_rate_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          student_academic_record_id?: string
          transport_rate_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_transport_assignments_student_academic_record_id_fkey"
            columns: ["student_academic_record_id"]
            isOneToOne: true
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_transport_assignments_transport_rate_id_fkey"
            columns: ["transport_rate_id"]
            isOneToOne: false
            referencedRelation: "transport_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      student_year_certificates: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          certificate_number: string | null
          certificate_type: Database["public"]["Enums"]["certificate_kind"]
          created_at: string
          generated_by: string | null
          id: string
          issued_at: string | null
          status: Database["public"]["Enums"]["certificate_state"]
          student_academic_record_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          certificate_number?: string | null
          certificate_type: Database["public"]["Enums"]["certificate_kind"]
          created_at?: string
          generated_by?: string | null
          id?: string
          issued_at?: string | null
          status?: Database["public"]["Enums"]["certificate_state"]
          student_academic_record_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          certificate_number?: string | null
          certificate_type?: Database["public"]["Enums"]["certificate_kind"]
          created_at?: string
          generated_by?: string | null
          id?: string
          issued_at?: string | null
          status?: Database["public"]["Enums"]["certificate_state"]
          student_academic_record_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_year_certificates_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_year_certificates_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_year_certificates_student_academic_record_id_fkey"
            columns: ["student_academic_record_id"]
            isOneToOne: false
            referencedRelation: "student_academic_records"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string
          gender: string | null
          id: string
          is_active: boolean
          last_name: string
          middle_name: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name: string
          gender?: string | null
          id?: string
          is_active?: boolean
          last_name: string
          middle_name?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          last_name?: string
          middle_name?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transport_rates: {
        Row: {
          academic_year_id: string
          amount: number
          created_at: string
          id: string
          is_active: boolean
          mode: Database["public"]["Enums"]["transport_mode"]
          place_label: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          amount: number
          created_at?: string
          id?: string
          is_active?: boolean
          mode: Database["public"]["Enums"]["transport_mode"]
          place_label: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          amount?: number
          created_at?: string
          id?: string
          is_active?: boolean
          mode?: Database["public"]["Enums"]["transport_mode"]
          place_label?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_rates_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
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
      academic_year_state: "planning" | "current" | "closed"
      adjustment_kind: "concession" | "additional_charge" | "correction"
      admission_application_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "on_hold"
        | "approved"
        | "rejected"
        | "withdrawn"
      approval_state: "pending" | "approved" | "rejected"
      assessment_state: "draft" | "issued" | "cancelled"
      certificate_kind: "LC" | "TC"
      certificate_state: "draft" | "issued" | "cancelled"
      document_verification_status:
        | "pending"
        | "verified"
        | "rejected"
        | "replaced"
      fee_category: "school_fee" | "vehicle" | "books"
      fee_structure_state: "draft" | "pending_approval" | "approved" | "retired"
      grade_group: "pre_primary" | "primary" | "high_school"
      payment_kind: "collection" | "refund" | "reversal"
      payment_method:
        | "cash"
        | "cheque"
        | "bank_transfer"
        | "upi_manual"
        | "other"
      staff_role:
        | "system_admin"
        | "principal"
        | "admission_officer"
        | "clerk"
        | "accountant"
        | "read_only"
      student_year_status:
        | "admitted"
        | "active"
        | "left"
        | "transferred"
        | "withdrawn"
      transport_mode: "school_bus" | "private_vehicle"
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
      academic_year_state: ["planning", "current", "closed"],
      adjustment_kind: ["concession", "additional_charge", "correction"],
      admission_application_status: [
        "draft",
        "submitted",
        "under_review",
        "on_hold",
        "approved",
        "rejected",
        "withdrawn",
      ],
      approval_state: ["pending", "approved", "rejected"],
      assessment_state: ["draft", "issued", "cancelled"],
      certificate_kind: ["LC", "TC"],
      certificate_state: ["draft", "issued", "cancelled"],
      document_verification_status: [
        "pending",
        "verified",
        "rejected",
        "replaced",
      ],
      fee_category: ["school_fee", "vehicle", "books"],
      fee_structure_state: ["draft", "pending_approval", "approved", "retired"],
      grade_group: ["pre_primary", "primary", "high_school"],
      payment_kind: ["collection", "refund", "reversal"],
      payment_method: [
        "cash",
        "cheque",
        "bank_transfer",
        "upi_manual",
        "other",
      ],
      staff_role: [
        "system_admin",
        "principal",
        "admission_officer",
        "clerk",
        "accountant",
        "read_only",
      ],
      student_year_status: [
        "admitted",
        "active",
        "left",
        "transferred",
        "withdrawn",
      ],
      transport_mode: ["school_bus", "private_vehicle"],
    },
  },
} as const
