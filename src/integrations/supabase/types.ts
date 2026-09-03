export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      messages: {
        Row: {
          attachment_url: string | null;
          body: string;
          created_at: string;
          id: string;
          priority: string;
          school_id: string;
          sender_id: string;
          subject: string | null;
        };
        Insert: {
          attachment_url?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          priority?: string;
          school_id: string;
          sender_id: string;
          subject?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
        Relationships: [];
      };
      message_recipients: {
        Row: {
          id: string;
          is_read: boolean;
          message_id: string;
          read_at: string | null;
          recipient_id: string;
        };
        Insert: {
          id?: string;
          is_read?: boolean;
          message_id: string;
          read_at?: string | null;
          recipient_id: string;
        };
        Update: {
          id?: string;
          is_read?: boolean;
          message_id?: string;
          read_at?: string | null;
          recipient_id?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          school_id: string;
          user_id: string;
          type: string;
          title: string;
          message: string;
          related_link: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          school_id: string;
          user_id: string;
          type?: string;
          title: string;
          message: string;
          related_link?: string | null;
          is_read?: boolean;
          created_at?: string;
        };
        Update: { id?: string; is_read?: boolean };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          academic_year_id: string | null;
          attendance_date: string;
          created_at: string;
          id: string;
          learner_id: string;
          marked_by: string | null;
          notes: string | null;
          school_id: string;
          status: string;
          stream_id: string;
          term_id: string | null;
          timetable_slot_id: string | null;
          teacher_allocation_id: string | null;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          attendance_date: string;
          created_at?: string;
          id?: string;
          learner_id: string;
          marked_by?: string | null;
          notes?: string | null;
          school_id: string;
          status?: string;
          stream_id: string;
          term_id?: string | null;
          timetable_slot_id?: string | null;
          teacher_allocation_id?: string | null;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          attendance_date?: string;
          created_at?: string;
          id?: string;
          learner_id?: string;
          marked_by?: string | null;
          notes?: string | null;
          school_id?: string;
          status?: string;
          stream_id?: string;
          term_id?: string | null;
          timetable_slot_id?: string | null;
          teacher_allocation_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      academic_years: {
        Row: {
          created_at: string;
          end_date: string;
          id: string;
          is_archived: boolean;
          is_current: boolean;
          name: string;
          school_id: string;
          start_date: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_date: string;
          id?: string;
          is_archived?: boolean;
          is_current?: boolean;
          name: string;
          school_id: string;
          start_date: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_date?: string;
          id?: string;
          is_archived?: boolean;
          is_current?: boolean;
          name?: string;
          school_id?: string;
          start_date?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_years_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      assessments: {
        Row: {
          academic_year_id: string | null;
          approved_at: string | null;
          approved_by: string | null;
          assessment_date: string;
          assessment_type: string;
          created_at: string;
          created_by: string | null;
          entry_mode: string;
          grade: Database["public"]["Enums"]["cbe_grade"];
          id: string;
          learning_area_id: string;
          max_score: number;
          school_id: string;
          status: string;
          stream_id: string | null;
          term_id: string | null;
          title: string;
          updated_at: string;
          weight: number;
        };
        Insert: {
          academic_year_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          assessment_date?: string;
          assessment_type?: string;
          created_at?: string;
          created_by?: string | null;
          entry_mode?: string;
          grade: Database["public"]["Enums"]["cbe_grade"];
          id?: string;
          learning_area_id: string;
          max_score?: number;
          school_id: string;
          status?: string;
          stream_id?: string | null;
          term_id?: string | null;
          title: string;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          academic_year_id?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          assessment_date?: string;
          assessment_type?: string;
          created_at?: string;
          created_by?: string | null;
          entry_mode?: string;
          grade?: Database["public"]["Enums"]["cbe_grade"];
          id?: string;
          learning_area_id?: string;
          max_score?: number;
          school_id?: string;
          status?: string;
          stream_id?: string | null;
          term_id?: string | null;
          title?: string;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_learning_area_id_fkey";
            columns: ["learning_area_id"];
            isOneToOne: false;
            referencedRelation: "learning_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string | null;
          after_data: Json | null;
          before_data: Json | null;
          created_at: string;
          entity: string;
          entity_id: string | null;
          id: string;
          reason: string | null;
          school_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity: string;
          entity_id?: string | null;
          id?: string;
          reason?: string | null;
          school_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          after_data?: Json | null;
          before_data?: Json | null;
          created_at?: string;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          reason?: string | null;
          school_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      departments: {
        Row: {
          created_at: string;
          head_staff_id: string | null;
          id: string;
          is_active: boolean;
          name: string;
          school_id: string;
        };
        Insert: {
          created_at?: string;
          head_staff_id?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          school_id: string;
        };
        Update: {
          created_at?: string;
          head_staff_id?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "departments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          academic_year_id: string;
          boarding_status: string | null;
          created_at: string;
          effective_date: string;
          grade: Database["public"]["Enums"]["cbe_grade"];
          id: string;
          is_active: boolean;
          learner_id: string;
          school_id: string;
          stream_id: string | null;
          term_id: string | null;
        };
        Insert: {
          academic_year_id: string;
          boarding_status?: string | null;
          created_at?: string;
          effective_date?: string;
          grade: Database["public"]["Enums"]["cbe_grade"];
          id?: string;
          is_active?: boolean;
          learner_id: string;
          school_id: string;
          stream_id?: string | null;
          term_id?: string | null;
        };
        Update: {
          academic_year_id?: string;
          boarding_status?: string | null;
          created_at?: string;
          effective_date?: string;
          grade?: Database["public"]["Enums"]["cbe_grade"];
          id?: string;
          is_active?: boolean;
          learner_id?: string;
          school_id?: string;
          stream_id?: string | null;
          term_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      fee_items: {
        Row: {
          amount: number;
          created_at: string;
          grade: Database["public"]["Enums"]["cbe_grade"] | null;
          id: string;
          is_active: boolean;
          is_mandatory: boolean;
          name: string;
          school_id: string;
          term_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          id?: string;
          is_active?: boolean;
          is_mandatory?: boolean;
          name: string;
          school_id: string;
          term_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          id?: string;
          is_active?: boolean;
          is_mandatory?: boolean;
          name?: string;
          school_id?: string;
          term_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fee_items_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fee_items_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      guardians: {
        Row: {
          address: string | null;
          alt_phone: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          is_archived: boolean;
          national_id: string | null;
          occupation: string | null;
          phone: string | null;
          portal_access: boolean;
          relationship: string | null;
          school_id: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          address?: string | null;
          alt_phone?: string | null;
          created_at?: string;
          email?: string | null;
          full_name: string;
          id?: string;
          is_archived?: boolean;
          national_id?: string | null;
          occupation?: string | null;
          phone?: string | null;
          portal_access?: boolean;
          relationship?: string | null;
          school_id: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          address?: string | null;
          alt_phone?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          is_archived?: boolean;
          national_id?: string | null;
          occupation?: string | null;
          phone?: string | null;
          portal_access?: boolean;
          relationship?: string | null;
          school_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "guardians_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_items: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          invoice_id: string;
          quantity: number;
          school_id: string;
          unit_amount: number;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          invoice_id: string;
          quantity?: number;
          school_id: string;
          unit_amount: number;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          invoice_id?: string;
          quantity?: number;
          school_id?: string;
          unit_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_items_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          academic_year_id: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          id: string;
          invoice_number: string;
          issue_date: string;
          learner_id: string;
          notes: string | null;
          school_id: string;
          status: string;
          term_id: string | null;
          total: number;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_number: string;
          issue_date?: string;
          learner_id: string;
          notes?: string | null;
          school_id: string;
          status?: string;
          term_id?: string | null;
          total?: number;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_number?: string;
          issue_date?: string;
          learner_id?: string;
          notes?: string | null;
          school_id?: string;
          status?: string;
          term_id?: string | null;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      learner_guardians: {
        Row: {
          created_at: string;
          fee_responsibility_percent: number;
          guardian_id: string;
          id: string;
          is_primary: boolean;
          learner_id: string;
          pickup_authorized: boolean;
          relationship: string | null;
          school_id: string;
        };
        Insert: {
          created_at?: string;
          fee_responsibility_percent?: number;
          guardian_id: string;
          id?: string;
          is_primary?: boolean;
          learner_id: string;
          pickup_authorized?: boolean;
          relationship?: string | null;
          school_id: string;
        };
        Update: {
          created_at?: string;
          fee_responsibility_percent?: number;
          guardian_id?: string;
          id?: string;
          is_primary?: boolean;
          learner_id?: string;
          pickup_authorized?: boolean;
          relationship?: string | null;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learner_guardians_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learner_guardians_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learner_guardians_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      learner_status_history: {
        Row: {
          academic_year_id: string | null;
          action: string;
          actor_id: string | null;
          created_at: string;
          effective_date: string;
          id: string;
          learner_id: string;
          new_grade: Database["public"]["Enums"]["cbe_grade"] | null;
          new_status: Database["public"]["Enums"]["learner_status"] | null;
          new_stream_id: string | null;
          previous_grade: Database["public"]["Enums"]["cbe_grade"] | null;
          previous_status: Database["public"]["Enums"]["learner_status"] | null;
          previous_stream_id: string | null;
          reason: string | null;
          school_id: string;
          term_id: string | null;
        };
        Insert: {
          academic_year_id?: string | null;
          action: string;
          actor_id?: string | null;
          created_at?: string;
          effective_date?: string;
          id?: string;
          learner_id: string;
          new_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          new_status?: Database["public"]["Enums"]["learner_status"] | null;
          new_stream_id?: string | null;
          previous_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          previous_status?: Database["public"]["Enums"]["learner_status"] | null;
          previous_stream_id?: string | null;
          reason?: string | null;
          school_id: string;
          term_id?: string | null;
        };
        Update: {
          academic_year_id?: string | null;
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          effective_date?: string;
          id?: string;
          learner_id?: string;
          new_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          new_status?: Database["public"]["Enums"]["learner_status"] | null;
          new_stream_id?: string | null;
          previous_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          previous_status?: Database["public"]["Enums"]["learner_status"] | null;
          previous_stream_id?: string | null;
          reason?: string | null;
          school_id?: string;
          term_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "learner_status_history_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learner_status_history_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      learners: {
        Row: {
          admission_date: string | null;
          admission_number: string;
          assessment_number: string | null;
          birth_certificate_no: string | null;
          boarding_status: string | null;
          county: string | null;
          created_at: string;
          current_grade: Database["public"]["Enums"]["cbe_grade"] | null;
          current_stream_id: string | null;
          date_of_birth: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          exit_date: string | null;
          exit_reason: string | null;
          first_name: string;
          gender: string | null;
          id: string;
          is_archived: boolean;
          last_name: string;
          medical_alerts: string | null;
          middle_name: string | null;
          nationality: string | null;
          photo_url: string | null;
          religion: string | null;
          school_id: string;
          status: Database["public"]["Enums"]["learner_status"];
          sub_county: string | null;
          transport_route: string | null;
          updated_at: string;
          upi_number: string | null;
          user_id: string | null;
        };
        Insert: {
          admission_date?: string | null;
          admission_number: string;
          assessment_number?: string | null;
          birth_certificate_no?: string | null;
          boarding_status?: string | null;
          county?: string | null;
          created_at?: string;
          current_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          current_stream_id?: string | null;
          date_of_birth?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          exit_date?: string | null;
          exit_reason?: string | null;
          first_name: string;
          gender?: string | null;
          id?: string;
          is_archived?: boolean;
          last_name: string;
          medical_alerts?: string | null;
          middle_name?: string | null;
          nationality?: string | null;
          photo_url?: string | null;
          religion?: string | null;
          school_id: string;
          status?: Database["public"]["Enums"]["learner_status"];
          sub_county?: string | null;
          transport_route?: string | null;
          updated_at?: string;
          upi_number?: string | null;
          user_id?: string | null;
        };
        Update: {
          admission_date?: string | null;
          admission_number?: string;
          assessment_number?: string | null;
          birth_certificate_no?: string | null;
          boarding_status?: string | null;
          county?: string | null;
          created_at?: string;
          current_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          current_stream_id?: string | null;
          date_of_birth?: string | null;
          emergency_contact_name?: string | null;
          emergency_contact_phone?: string | null;
          exit_date?: string | null;
          exit_reason?: string | null;
          first_name?: string;
          gender?: string | null;
          id?: string;
          is_archived?: boolean;
          last_name?: string;
          medical_alerts?: string | null;
          middle_name?: string | null;
          nationality?: string | null;
          photo_url?: string | null;
          religion?: string | null;
          school_id?: string;
          status?: Database["public"]["Enums"]["learner_status"];
          sub_county?: string | null;
          transport_route?: string | null;
          updated_at?: string;
          upi_number?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "learners_current_stream_id_fkey";
            columns: ["current_stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "learners_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      learning_areas: {
        Row: {
          code: string | null;
          created_at: string;
          grades: Database["public"]["Enums"]["cbe_grade"][];
          id: string;
          is_active: boolean;
          is_core: boolean;
          name: string;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          code?: string | null;
          created_at?: string;
          grades?: Database["public"]["Enums"]["cbe_grade"][];
          id?: string;
          is_active?: boolean;
          is_core?: boolean;
          name: string;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          code?: string | null;
          created_at?: string;
          grades?: Database["public"]["Enums"]["cbe_grade"][];
          id?: string;
          is_active?: boolean;
          is_core?: boolean;
          name?: string;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learning_areas_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          amount: number;
          created_at: string;
          description: string;
          entry_date: string;
          entry_type: string;
          id: string;
          learner_id: string;
          school_id: string;
          source: string;
          source_id: string | null;
          term_id: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          description: string;
          entry_date?: string;
          entry_type: string;
          id?: string;
          learner_id: string;
          school_id: string;
          source: string;
          source_id?: string | null;
          term_id?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          description?: string;
          entry_date?: string;
          entry_type?: string;
          id?: string;
          learner_id?: string;
          school_id?: string;
          source?: string;
          source_id?: string | null;
          term_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      marks: {
        Row: {
          assessment_id: string;
          comment: string | null;
          created_at: string;
          descriptor: string | null;
          entered_by: string | null;
          id: string;
          is_absent: boolean;
          is_exempt: boolean;
          learner_id: string;
          level_code: string | null;
          percentage: number | null;
          points: number | null;
          raw_score: number | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          comment?: string | null;
          created_at?: string;
          descriptor?: string | null;
          entered_by?: string | null;
          id?: string;
          is_absent?: boolean;
          is_exempt?: boolean;
          learner_id: string;
          level_code?: string | null;
          percentage?: number | null;
          points?: number | null;
          raw_score?: number | null;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          assessment_id?: string;
          comment?: string | null;
          created_at?: string;
          descriptor?: string | null;
          entered_by?: string | null;
          id?: string;
          is_absent?: boolean;
          is_exempt?: boolean;
          learner_id?: string;
          level_code?: string | null;
          percentage?: number | null;
          points?: number | null;
          raw_score?: number | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marks_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marks_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "marks_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          invoice_id: string | null;
          is_reversed: boolean;
          learner_id: string;
          method: string;
          notes: string | null;
          paid_at: string;
          payer_name: string | null;
          receipt_number: string;
          recorded_by: string | null;
          reference: string | null;
          school_id: string;
          term_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          invoice_id?: string | null;
          is_reversed?: boolean;
          learner_id: string;
          method?: string;
          notes?: string | null;
          paid_at?: string;
          payer_name?: string | null;
          receipt_number: string;
          recorded_by?: string | null;
          reference?: string | null;
          school_id: string;
          term_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          invoice_id?: string | null;
          is_reversed?: boolean;
          learner_id?: string;
          method?: string;
          notes?: string | null;
          paid_at?: string;
          payer_name?: string | null;
          receipt_number?: string;
          recorded_by?: string | null;
          reference?: string | null;
          school_id?: string;
          term_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_cards: {
        Row: {
          academic_year_id: string | null;
          class_position: number | null;
          class_size: number | null;
          class_teacher_comment: string | null;
          created_at: string;
          created_by: string | null;
          grade: Database["public"]["Enums"]["cbe_grade"] | null;
          head_teacher_comment: string | null;
          id: string;
          learner_id: string;
          mean_percentage: number | null;
          payload: Json;
          published_at: string | null;
          published_by: string | null;
          school_id: string;
          status: string;
          term_id: string | null;
          total_points: number | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          academic_year_id?: string | null;
          class_position?: number | null;
          class_size?: number | null;
          class_teacher_comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          head_teacher_comment?: string | null;
          id?: string;
          learner_id: string;
          mean_percentage?: number | null;
          payload?: Json;
          published_at?: string | null;
          published_by?: string | null;
          school_id: string;
          status?: string;
          term_id?: string | null;
          total_points?: number | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          academic_year_id?: string | null;
          class_position?: number | null;
          class_size?: number | null;
          class_teacher_comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          head_teacher_comment?: string | null;
          id?: string;
          learner_id?: string;
          mean_percentage?: number | null;
          payload?: Json;
          published_at?: string | null;
          published_by?: string | null;
          school_id?: string;
          status?: string;
          term_id?: string | null;
          total_points?: number | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "report_cards_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_cards_learner_id_fkey";
            columns: ["learner_id"];
            isOneToOne: false;
            referencedRelation: "learners";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_cards_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "report_cards_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      rooms: {
        Row: {
          capacity: number | null;
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          room_type: string | null;
          school_id: string;
        };
        Insert: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          room_type?: string | null;
          school_id: string;
        };
        Update: {
          capacity?: number | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          room_type?: string | null;
          school_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rooms_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_counters: {
        Row: {
          key: string;
          school_id: string;
          seq: number;
        };
        Insert: {
          key: string;
          school_id: string;
          seq?: number;
        };
        Update: {
          key?: string;
          school_id?: string;
          seq?: number;
        };
        Relationships: [
          {
            foreignKeyName: "school_counters_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_grade_offerings: {
        Row: {
          created_at: string;
          grade: Database["public"]["Enums"]["cbe_grade"];
          id: string;
          is_active: boolean;
          level: Database["public"]["Enums"]["cbe_level"];
          pathway: string | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          grade: Database["public"]["Enums"]["cbe_grade"];
          id?: string;
          is_active?: boolean;
          level: Database["public"]["Enums"]["cbe_level"];
          pathway?: string | null;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          grade?: Database["public"]["Enums"]["cbe_grade"];
          id?: string;
          is_active?: boolean;
          level?: Database["public"]["Enums"]["cbe_level"];
          pathway?: string | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_grade_offerings_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      school_settings: {
        Row: {
          created_at: string;
          currency: string;
          staff_attendance_enabled: boolean;
          staff_attendance_end_time: string;
          staff_attendance_grace_minutes: number;
          staff_attendance_start_time: string;
          grading_scheme_key: string;
          locale: string;
          report_footer: string | null;
          school_id: string;
          show_ranking: boolean;
          show_raw_scores: boolean;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          staff_attendance_enabled?: boolean;
          staff_attendance_end_time?: string;
          staff_attendance_grace_minutes?: number;
          staff_attendance_start_time?: string;
          grading_scheme_key?: string;
          locale?: string;
          report_footer?: string | null;
          school_id: string;
          show_ranking?: boolean;
          show_raw_scores?: boolean;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          staff_attendance_enabled?: boolean;
          staff_attendance_end_time?: string;
          staff_attendance_grace_minutes?: number;
          staff_attendance_start_time?: string;
          grading_scheme_key?: string;
          locale?: string;
          report_footer?: string | null;
          school_id?: string;
          show_ranking?: boolean;
          show_raw_scores?: boolean;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: true;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      schools: {
        Row: {
          admission_number_format: string;
          admission_number_seq: number;
          alt_phone: string | null;
          boarding_type: string | null;
          category: string | null;
          county: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          gender_composition: string | null;
          headteacher_email: string | null;
          headteacher_name: string | null;
          headteacher_phone: string | null;
          id: string;
          knec_centre_code: string | null;
          logo_url: string | null;
          motto: string | null;
          name: string;
          nemis_code: string | null;
          onboarding_completed: boolean;
          ownership: string | null;
          phone: string | null;
          physical_address: string | null;
          postal_address: string | null;
          short_name: string | null;
          status: Database["public"]["Enums"]["school_status"];
          sub_county: string | null;
          updated_at: string;
          ward: string | null;
          website: string | null;
        };
        Insert: {
          admission_number_format?: string;
          admission_number_seq?: number;
          alt_phone?: string | null;
          boarding_type?: string | null;
          category?: string | null;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          gender_composition?: string | null;
          headteacher_email?: string | null;
          headteacher_name?: string | null;
          headteacher_phone?: string | null;
          id?: string;
          knec_centre_code?: string | null;
          logo_url?: string | null;
          motto?: string | null;
          name: string;
          nemis_code?: string | null;
          onboarding_completed?: boolean;
          ownership?: string | null;
          phone?: string | null;
          physical_address?: string | null;
          postal_address?: string | null;
          short_name?: string | null;
          status?: Database["public"]["Enums"]["school_status"];
          sub_county?: string | null;
          updated_at?: string;
          ward?: string | null;
          website?: string | null;
        };
        Update: {
          admission_number_format?: string;
          admission_number_seq?: number;
          alt_phone?: string | null;
          boarding_type?: string | null;
          category?: string | null;
          county?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          gender_composition?: string | null;
          headteacher_email?: string | null;
          headteacher_name?: string | null;
          headteacher_phone?: string | null;
          id?: string;
          knec_centre_code?: string | null;
          logo_url?: string | null;
          motto?: string | null;
          name?: string;
          nemis_code?: string | null;
          onboarding_completed?: boolean;
          ownership?: string | null;
          phone?: string | null;
          physical_address?: string | null;
          postal_address?: string | null;
          short_name?: string | null;
          status?: Database["public"]["Enums"]["school_status"];
          sub_county?: string | null;
          updated_at?: string;
          ward?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          assigned_grade: Database["public"]["Enums"]["cbe_grade"] | null;
          assigned_grades: Database["public"]["Enums"]["cbe_grade"][];
          class_teacher_grade: Database["public"]["Enums"]["cbe_grade"] | null;
          credentials_expires_at: string | null;
          credentials_sent_at: string | null;
          created_at: string;
          department_id: string | null;
          email: string | null;
          employment_date: string | null;
          employment_type: string | null;
          full_name: string;
          gender: string | null;
          id: string;
          is_archived: boolean;
          job_title: string | null;
          national_id: string | null;
          phone: string | null;
          photo_url: string | null;
          qualified_learning_areas: string[];
          school_id: string;
          staff_number: string;
          status: string;
          tsc_number: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          assigned_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          assigned_grades?: Database["public"]["Enums"]["cbe_grade"][];
          class_teacher_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          credentials_expires_at?: string | null;
          credentials_sent_at?: string | null;
          created_at?: string;
          department_id?: string | null;
          email?: string | null;
          employment_date?: string | null;
          employment_type?: string | null;
          full_name: string;
          gender?: string | null;
          id?: string;
          is_archived?: boolean;
          job_title?: string | null;
          national_id?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          qualified_learning_areas?: string[];
          school_id: string;
          staff_number: string;
          status?: string;
          tsc_number?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          assigned_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          assigned_grades?: Database["public"]["Enums"]["cbe_grade"][];
          class_teacher_grade?: Database["public"]["Enums"]["cbe_grade"] | null;
          credentials_expires_at?: string | null;
          credentials_sent_at?: string | null;
          created_at?: string;
          department_id?: string | null;
          email?: string | null;
          employment_date?: string | null;
          employment_type?: string | null;
          full_name?: string;
          gender?: string | null;
          id?: string;
          is_archived?: boolean;
          job_title?: string | null;
          national_id?: string | null;
          phone?: string | null;
          photo_url?: string | null;
          qualified_learning_areas?: string[];
          school_id?: string;
          staff_number?: string;
          status?: string;
          tsc_number?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "staff_department_id_fkey";
            columns: ["department_id"];
            isOneToOne: false;
            referencedRelation: "departments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      streams: {
        Row: {
          academic_year_id: string | null;
          assistant_teacher_id: string | null;
          capacity: number;
          class_teacher_id: string | null;
          color_label: string;
          created_at: string;
          display_name: string | null;
          grade: Database["public"]["Enums"]["cbe_grade"];
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          room_id: string | null;
          school_id: string;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          assistant_teacher_id?: string | null;
          capacity?: number;
          class_teacher_id?: string | null;
          color_label?: string;
          created_at?: string;
          display_name?: string | null;
          grade: Database["public"]["Enums"]["cbe_grade"];
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          room_id?: string | null;
          school_id: string;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          assistant_teacher_id?: string | null;
          capacity?: number;
          class_teacher_id?: string | null;
          color_label?: string;
          created_at?: string;
          display_name?: string | null;
          grade?: Database["public"]["Enums"]["cbe_grade"];
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          room_id?: string | null;
          school_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "streams_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "streams_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "streams_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_allocations: {
        Row: {
          academic_year_id: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          learning_area_id: string;
          periods_per_week: number;
          school_id: string;
          staff_id: string;
          stream_id: string;
          updated_at: string;
        };
        Insert: {
          academic_year_id?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          learning_area_id: string;
          periods_per_week?: number;
          school_id: string;
          staff_id: string;
          stream_id: string;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          learning_area_id?: string;
          periods_per_week?: number;
          school_id?: string;
          staff_id?: string;
          stream_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_allocations_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_learning_area_id_fkey";
            columns: ["learning_area_id"];
            isOneToOne: false;
            referencedRelation: "learning_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_allocations_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
        ];
      };
      academic_calendar_events: {
        Row: {
          academic_year_id: string;
          all_day: boolean;
          created_at: string;
          created_by: string | null;
          end_date: string | null;
          event_type: string;
          id: string;
          image_url: string | null;
          notes: string | null;
          school_id: string;
          start_date: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          academic_year_id: string;
          all_day?: boolean;
          created_at?: string;
          created_by?: string | null;
          end_date?: string | null;
          event_type?: string;
          id?: string;
          image_url?: string | null;
          notes?: string | null;
          school_id: string;
          start_date: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string;
          all_day?: boolean;
          created_at?: string;
          created_by?: string | null;
          end_date?: string | null;
          event_type?: string;
          id?: string;
          image_url?: string | null;
          notes?: string | null;
          school_id?: string;
          start_date?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_calendar_events_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_calendar_events_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      terms: {
        Row: {
          academic_year_id: string;
          closing_date: string | null;
          created_at: string;
          id: string;
          is_current: boolean;
          midterm_end_date: string | null;
          midterm_start_date: string | null;
          name: string;
          opening_date: string | null;
          school_id: string;
          term_number: number;
          updated_at: string;
        };
        Insert: {
          academic_year_id: string;
          closing_date?: string | null;
          created_at?: string;
          id?: string;
          is_current?: boolean;
          midterm_end_date?: string | null;
          midterm_start_date?: string | null;
          name: string;
          opening_date?: string | null;
          school_id: string;
          term_number: number;
          updated_at?: string;
        };
        Update: {
          academic_year_id?: string;
          closing_date?: string | null;
          created_at?: string;
          id?: string;
          is_current?: boolean;
          midterm_end_date?: string | null;
          midterm_start_date?: string | null;
          name?: string;
          opening_date?: string | null;
          school_id?: string;
          term_number?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "terms_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "terms_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      timetable_periods: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          is_break: boolean;
          label: string;
          period_index: number;
          school_id: string;
          start_time: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          end_time: string;
          id?: string;
          is_break?: boolean;
          label: string;
          period_index: number;
          school_id: string;
          start_time: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          is_break?: boolean;
          label?: string;
          period_index?: number;
          school_id?: string;
          start_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timetable_periods_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      timetable_slots: {
        Row: {
          created_at: string;
          day_of_week: number;
          id: string;
          learning_area_id: string | null;
          period_index: number;
          room_id: string | null;
          school_id: string;
          staff_id: string | null;
          stream_id: string;
          timetable_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          day_of_week: number;
          id?: string;
          learning_area_id?: string | null;
          period_index: number;
          room_id?: string | null;
          school_id: string;
          staff_id?: string | null;
          stream_id: string;
          timetable_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          day_of_week?: number;
          id?: string;
          learning_area_id?: string | null;
          period_index?: number;
          room_id?: string | null;
          school_id?: string;
          staff_id?: string | null;
          stream_id?: string;
          timetable_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timetable_slots_learning_area_id_fkey";
            columns: ["learning_area_id"];
            isOneToOne: false;
            referencedRelation: "learning_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_slots_room_id_fkey";
            columns: ["room_id"];
            isOneToOne: false;
            referencedRelation: "rooms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_slots_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_slots_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_slots_stream_id_fkey";
            columns: ["stream_id"];
            isOneToOne: false;
            referencedRelation: "streams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetable_slots_timetable_id_fkey";
            columns: ["timetable_id"];
            isOneToOne: false;
            referencedRelation: "timetables";
            referencedColumns: ["id"];
          },
        ];
      };
      timetables: {
        Row: {
          academic_year_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          published_at: string | null;
          published_by: string | null;
          school_id: string;
          status: string;
          term_id: string | null;
          updated_at: string;
          version: number;
        };
        Insert: {
          academic_year_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          school_id: string;
          status?: string;
          term_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Update: {
          academic_year_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          school_id?: string;
          status?: string;
          term_id?: string | null;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "timetables_academic_year_id_fkey";
            columns: ["academic_year_id"];
            isOneToOne: false;
            referencedRelation: "academic_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetables_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "timetables_term_id_fkey";
            columns: ["term_id"];
            isOneToOne: false;
            referencedRelation: "terms";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["app_role"];
          school_id: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          role: Database["public"]["Enums"]["app_role"];
          school_id?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          school_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
      user_school_memberships: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          school_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          school_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          school_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_school_memberships_school_id_fkey";
            columns: ["school_id"];
            isOneToOne: false;
            referencedRelation: "schools";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      delete_learner_permanently: {
        Args: { _learner_id: string; _school_id: string };
        Returns: undefined;
      };
      has_school_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][];
          _school_id: string;
        };
        Returns: boolean;
      };
      is_school_admin: { Args: { _school_id: string }; Returns: boolean };
      is_school_member: { Args: { _school_id: string }; Returns: boolean };
      is_super_admin: { Args: never; Returns: boolean };
      learner_balance: { Args: { _learner_id: string }; Returns: number };
      next_admission_number: { Args: { _school_id: string }; Returns: string };
      next_counter: {
        Args: { _key: string; _prefix: string; _school_id: string };
        Returns: string;
      };
    };
    Enums: {
      app_role:
        | "super_admin"
        | "admin"
        | "exam_officer"
        | "principal"
        | "deputy"
        | "teacher"
        | "class_teacher"
        | "parent"
        | "student";
      cbe_grade:
        | "PP1"
        | "PP2"
        | "G1"
        | "G2"
        | "G3"
        | "G4"
        | "G5"
        | "G6"
        | "G7"
        | "G8"
        | "G9"
        | "G10"
        | "G11"
        | "G12";
      cbe_level:
        "pre_primary" | "lower_primary" | "upper_primary" | "junior_school" | "senior_school";
      learner_status:
        | "applicant"
        | "admitted"
        | "enrolled"
        | "active"
        | "promoted"
        | "repeated"
        | "transferred_out"
        | "withdrawn"
        | "completed"
        | "alumni"
        | "archived";
      school_status: "active" | "suspended" | "archived";
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
      app_role: [
        "super_admin",
        "admin",
        "exam_officer",
        "principal",
        "deputy",
        "teacher",
        "class_teacher",
        "parent",
        "student",
      ],
      cbe_grade: [
        "PP1",
        "PP2",
        "G1",
        "G2",
        "G3",
        "G4",
        "G5",
        "G6",
        "G7",
        "G8",
        "G9",
        "G10",
        "G11",
        "G12",
      ],
      cbe_level: [
        "pre_primary",
        "lower_primary",
        "upper_primary",
        "junior_school",
        "senior_school",
      ],
      learner_status: [
        "applicant",
        "admitted",
        "enrolled",
        "active",
        "promoted",
        "repeated",
        "transferred_out",
        "withdrawn",
        "completed",
        "alumni",
        "archived",
      ],
      school_status: ["active", "suspended", "archived"],
    },
  },
} as const;
