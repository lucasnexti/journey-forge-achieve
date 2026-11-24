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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_assistant_feedback: {
        Row: {
          created_at: string
          helpful: boolean
          id: string
          source_page_ids: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          helpful: boolean
          id?: string
          source_page_ids?: string[]
          user_id?: string
        }
        Update: {
          created_at?: string
          helpful?: boolean
          id?: string
          source_page_ids?: string[]
          user_id?: string
        }
        Relationships: []
      }
      alert_history: {
        Row: {
          id: string
          metric_key: string
          metric_value: number
          notification_id: string | null
          rule_id: string
          threshold: number
          triggered_at: string
        }
        Insert: {
          id?: string
          metric_key: string
          metric_value: number
          notification_id?: string | null
          rule_id: string
          threshold: number
          triggered_at?: string
        }
        Update: {
          id?: string
          metric_key?: string
          metric_value?: number
          notification_id?: string | null
          rule_id?: string
          threshold?: number
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          cooldown_minutes: number
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          metric_key: string
          metric_label: string
          operator: string
          threshold: number
          updated_at: string
        }
        Insert: {
          cooldown_minutes?: number
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          metric_key: string
          metric_label: string
          operator?: string
          threshold: number
          updated_at?: string
        }
        Update: {
          cooldown_minutes?: number
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          metric_key?: string
          metric_label?: string
          operator?: string
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      badges: {
        Row: {
          created_at: string | null
          criteria_type: string
          criteria_value: number | null
          description: string | null
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          criteria_type?: string
          criteria_value?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          criteria_type?: string
          criteria_value?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      certificate_templates: {
        Row: {
          created_at: string
          created_by: string | null
          fields: Json
          file_name: string | null
          file_path: string
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          track_ids: string[]
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          fields?: Json
          file_name?: string | null
          file_path: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          track_ids?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          fields?: Json
          file_name?: string | null
          file_path?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          track_ids?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      certificates: {
        Row: {
          certificate_code: string | null
          file_path: string | null
          generated_at: string | null
          generation_count: number
          generation_error: string | null
          id: string
          issued_at: string | null
          revoked_at: string | null
          revoked_by: string | null
          revoked_reason: string | null
          status: string
          template_id: string | null
          track_id: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          certificate_code?: string | null
          file_path?: string | null
          generated_at?: string | null
          generation_count?: number
          generation_error?: string | null
          id?: string
          issued_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          status?: string
          template_id?: string | null
          track_id: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          certificate_code?: string | null
          file_path?: string | null
          generated_at?: string | null
          generation_count?: number
          generation_error?: string | null
          id?: string
          issued_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          revoked_reason?: string | null
          status?: string
          template_id?: string | null
          track_id?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "certificate_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_rules: {
        Row: {
          amount: number
          daily_cap: number | null
          is_active: boolean
          key: string
          label: string
          reference_type: string
          updated_at: string
        }
        Insert: {
          amount: number
          daily_cap?: number | null
          is_active?: boolean
          key: string
          label: string
          reference_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          daily_cap?: number | null
          is_active?: boolean
          key?: string
          label?: string
          reference_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          reference_id: string | null
          reference_type: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          reference_id?: string | null
          reference_type?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      course_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          order_index: number
          title: string
          track_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title: string
          track_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          completed_at: string | null
          enrolled_at: string | null
          id: string
          status: string | null
          track_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          enrolled_at?: string | null
          id?: string
          status?: string | null
          track_id: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          enrolled_at?: string | null
          id?: string
          status?: string | null
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answers: Json
          attempt_number: number
          correct_count: number
          created_at: string
          cycle: number
          details: Json
          duration_seconds: number
          exam_id: string
          id: string
          module_id: string | null
          passed: boolean
          passing_score: number
          percent: number
          score: number
          total_questions: number
          track_id: string
          user_id: string
        }
        Insert: {
          answers?: Json
          attempt_number?: number
          correct_count?: number
          created_at?: string
          cycle?: number
          details?: Json
          duration_seconds?: number
          exam_id: string
          id?: string
          module_id?: string | null
          passed?: boolean
          passing_score?: number
          percent?: number
          score?: number
          total_questions?: number
          track_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          attempt_number?: number
          correct_count?: number
          created_at?: string
          cycle?: number
          details?: Json
          duration_seconds?: number
          exam_id?: string
          id?: string
          module_id?: string | null
          passed?: boolean
          passing_score?: number
          percent?: number
          score?: number
          total_questions?: number
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: number | null
          created_at: string
          exam_id: string
          expected_answer: string | null
          explanation: string | null
          id: string
          is_active: boolean
          options: Json
          order_index: number
          points: number
          question: string
          type: string
          updated_at: string
        }
        Insert: {
          correct_answer?: number | null
          created_at?: string
          exam_id: string
          expected_answer?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          order_index?: number
          points?: number
          question: string
          type?: string
          updated_at?: string
        }
        Update: {
          correct_answer?: number | null
          created_at?: string
          exam_id?: string
          expected_answer?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          order_index?: number
          points?: number
          question?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_sessions: {
        Row: {
          created_at: string
          exam_id: string
          expires_at: string | null
          id: string
          started_at: string
          submitted_at: string | null
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          expires_at?: string | null
          id?: string
          started_at?: string
          submitted_at?: string | null
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          expires_at?: string | null
          id?: string
          started_at?: string
          submitted_at?: string | null
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_sessions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_sessions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          max_attempts: number
          module_id: string | null
          passing_score: number
          question_count: number
          shuffle_options: boolean
          shuffle_questions: boolean
          time_limit_minutes: number | null
          title: string
          track_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_attempts?: number
          module_id?: string | null
          passing_score?: number
          question_count?: number
          shuffle_options?: boolean
          shuffle_questions?: boolean
          time_limit_minutes?: number | null
          title?: string
          track_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          max_attempts?: number
          module_id?: string | null
          passing_score?: number
          question_count?: number
          shuffle_options?: boolean
          shuffle_questions?: boolean
          time_limit_minutes?: number | null
          title?: string
          track_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          parent_id: string | null
          title: string
          track_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          title: string
          track_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          title?: string
          track_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forum_posts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_quiz_attempts: {
        Row: {
          answers: Json | null
          attempted_at: string | null
          id: string
          module_id: string
          passed: boolean | null
          score: number
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempted_at?: string | null
          id?: string
          module_id: string
          passed?: boolean | null
          score?: number
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempted_at?: string | null
          id?: string
          module_id?: string
          passed?: boolean | null
          score?: number
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_quiz_attempts_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "kb_quiz_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_quiz_modules: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          order_index: number | null
          playbook_section_title: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          playbook_section_title?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          playbook_section_title?: string | null
          title?: string
        }
        Relationships: []
      }
      kb_quiz_questions: {
        Row: {
          correct_answer: number
          created_at: string | null
          explanation: string | null
          id: string
          module_id: string
          options: Json
          order_index: number | null
          question: string
          type: string
        }
        Insert: {
          correct_answer?: number
          created_at?: string | null
          explanation?: string | null
          id?: string
          module_id: string
          options?: Json
          order_index?: number | null
          question: string
          type?: string
        }
        Update: {
          correct_answer?: number
          created_at?: string | null
          explanation?: string | null
          id?: string
          module_id?: string
          options?: Json
          order_index?: number | null
          question?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_quiz_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "kb_quiz_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base_content: {
        Row: {
          dados: Json
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          dados: Json
          id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          dados?: Json
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      learning_companies: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      learning_company_memberships: {
        Row: {
          company_id: string
          revoked_at: string | null
          user_id: string
          validated_at: string
          validated_by: string
        }
        Insert: {
          company_id: string
          revoked_at?: string | null
          user_id: string
          validated_at?: string
          validated_by: string
        }
        Update: {
          company_id?: string
          revoked_at?: string | null
          user_id?: string
          validated_at?: string
          validated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_company_memberships_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "learning_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_courses: {
        Row: {
          category: string
          path_id: string
          position: number
          track_id: string
        }
        Insert: {
          category: string
          path_id: string
          position: number
          track_id: string
        }
        Update: {
          category?: string
          path_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_courses_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_courses_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_grants: {
        Row: {
          company_id: string | null
          granted_at: string
          granted_by: string
          id: string
          path_id: string
          revoked_at: string | null
          user_id: string | null
        }
        Insert: {
          company_id?: string | null
          granted_at?: string
          granted_by: string
          id?: string
          path_id: string
          revoked_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_id?: string | null
          granted_at?: string
          granted_by?: string
          id?: string
          path_id?: string
          revoked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_grants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "learning_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_grants_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          categories: Json
          cover_path: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          name: string
          progression: string
          status: string
          updated_at: string
        }
        Insert: {
          categories?: Json
          cover_path?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          name: string
          progression?: string
          status?: string
          updated_at?: string
        }
        Update: {
          categories?: Json
          cover_path?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          name?: string
          progression?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      lesson_materials: {
        Row: {
          created_at: string | null
          id: string
          lesson_id: string
          title: string
          type: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lesson_id: string
          title: string
          type?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lesson_id?: string
          title?: string
          type?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          content: string
          created_at: string | null
          id: string
          lesson_id: string
          timestamp_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string | null
          id?: string
          lesson_id: string
          timestamp_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          lesson_id?: string
          timestamp_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_notes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_progress: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          last_watched_at: string | null
          lesson_id: string
          track_id: string
          user_id: string
          watched_seconds: number | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          lesson_id: string
          track_id: string
          user_id: string
          watched_seconds?: number | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          last_watched_at?: string | null
          lesson_id?: string
          track_id?: string
          user_id?: string
          watched_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_progress_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          created_at: string | null
          description: string | null
          duration: number | null
          id: string
          is_published: boolean
          module_id: string | null
          order_index: number | null
          title: string
          track_id: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          is_published?: boolean
          module_id?: string | null
          order_index?: number | null
          title: string
          track_id: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          is_published?: boolean
          module_id?: string | null
          order_index?: number | null
          title?: string
          track_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      module_materials: {
        Row: {
          created_at: string
          description: string | null
          external_url: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          kind: string
          lesson_id: string | null
          mime_type: string | null
          module_id: string
          order_index: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          lesson_id?: string | null
          mime_type?: string | null
          module_id: string
          order_index?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_url?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind?: string
          lesson_id?: string | null
          mime_type?: string | null
          module_id?: string
          order_index?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_materials_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_materials_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notion_chunks: {
        Row: {
          content: string
          created_at: string
          id: string
          orientation_path: string | null
          orientation_title: string | null
          page_id: string
          page_title: string
          page_updated_at: string | null
          position: number
          search: unknown
          section: string
          source_id: string
          url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          orientation_path?: string | null
          orientation_title?: string | null
          page_id: string
          page_title?: string
          page_updated_at?: string | null
          position?: number
          search?: unknown
          section?: string
          source_id: string
          url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          orientation_path?: string | null
          orientation_title?: string | null
          page_id?: string
          page_title?: string
          page_updated_at?: string | null
          position?: number
          search?: unknown
          section?: string
          source_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notion_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "notion_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      notion_sources: {
        Row: {
          audience: string
          chunk_count: number
          created_at: string
          depth: number
          id: string
          kind: string
          last_synced_at: string | null
          linked_orientation_path: string | null
          linked_orientation_title: string | null
          module: string | null
          notion_last_edited: string | null
          page_id: string
          parent_page_id: string | null
          position: number
          provider: string
          removed_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          sync_error: string | null
          synced_edited_time: string | null
          title: string
          unprocessed: Json
          updated_at: string
          url: string | null
          viewer_url: string | null
        }
        Insert: {
          audience?: string
          chunk_count?: number
          created_at?: string
          depth?: number
          id?: string
          kind?: string
          last_synced_at?: string | null
          linked_orientation_path?: string | null
          linked_orientation_title?: string | null
          module?: string | null
          notion_last_edited?: string | null
          page_id: string
          parent_page_id?: string | null
          position?: number
          provider?: string
          removed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          sync_error?: string | null
          synced_edited_time?: string | null
          title?: string
          unprocessed?: Json
          updated_at?: string
          url?: string | null
          viewer_url?: string | null
        }
        Update: {
          audience?: string
          chunk_count?: number
          created_at?: string
          depth?: number
          id?: string
          kind?: string
          last_synced_at?: string | null
          linked_orientation_path?: string | null
          linked_orientation_title?: string | null
          module?: string | null
          notion_last_edited?: string | null
          page_id?: string
          parent_page_id?: string | null
          position?: number
          provider?: string
          removed_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          sync_error?: string | null
          synced_edited_time?: string | null
          title?: string
          unprocessed?: Json
          updated_at?: string
          url?: string | null
          viewer_url?: string | null
        }
        Relationships: []
      }
      notion_sync_runs: {
        Row: {
          details: Json
          finished_at: string | null
          id: string
          kind: string
          pages_failed: number
          pages_processed: number
          pages_removed: number
          pages_unchanged: number
          started_at: string
          started_by: string | null
          status: string
        }
        Insert: {
          details?: Json
          finished_at?: string | null
          id?: string
          kind: string
          pages_failed?: number
          pages_processed?: number
          pages_removed?: number
          pages_unchanged?: number
          started_at?: string
          started_by?: string | null
          status?: string
        }
        Update: {
          details?: Json
          finished_at?: string | null
          id?: string
          kind?: string
          pages_failed?: number
          pages_processed?: number
          pages_removed?: number
          pages_unchanged?: number
          started_at?: string
          started_by?: string | null
          status?: string
        }
        Relationships: []
      }
      performance_snapshots: {
        Row: {
          active_today: number
          avg_response_ms: number
          captured_at: string
          content_completeness: number
          data_volume: Json
          enrollments_total: number
          error_rate: number
          execution_time_ms: number
          id: string
          lessons_completed_today: number
          max_response_ms: number
          p95_response_ms: number
          query_benchmarks: Json
          quiz_coverage: number
          quiz_pass_rate: number
          slo_score: number
          throughput_enrollments_hour: number
          throughput_lessons_hour: number
          throughput_quizzes_hour: number
          uptime_proxy: number
          users_online: number
          video_availability: number
        }
        Insert: {
          active_today?: number
          avg_response_ms?: number
          captured_at?: string
          content_completeness?: number
          data_volume?: Json
          enrollments_total?: number
          error_rate?: number
          execution_time_ms?: number
          id?: string
          lessons_completed_today?: number
          max_response_ms?: number
          p95_response_ms?: number
          query_benchmarks?: Json
          quiz_coverage?: number
          quiz_pass_rate?: number
          slo_score?: number
          throughput_enrollments_hour?: number
          throughput_lessons_hour?: number
          throughput_quizzes_hour?: number
          uptime_proxy?: number
          users_online?: number
          video_availability?: number
        }
        Update: {
          active_today?: number
          avg_response_ms?: number
          captured_at?: string
          content_completeness?: number
          data_volume?: Json
          enrollments_total?: number
          error_rate?: number
          execution_time_ms?: number
          id?: string
          lessons_completed_today?: number
          max_response_ms?: number
          p95_response_ms?: number
          query_benchmarks?: Json
          quiz_coverage?: number
          quiz_pass_rate?: number
          slo_score?: number
          throughput_enrollments_hour?: number
          throughput_lessons_hour?: number
          throughput_quizzes_hour?: number
          uptime_proxy?: number
          users_online?: number
          video_availability?: number
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          cpf: string | null
          created_at: string
          email: string | null
          empresa: string | null
          id: string
          interest_areas: string[]
          interests: string[] | null
          is_active: boolean | null
          last_active_at: string | null
          nome: string
          onboarding_completed: boolean | null
          onboarding_completed_at: string | null
          telefone: string | null
          updated_at: string
          user_id: string
          workplace_empresa: string | null
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          interest_areas?: string[]
          interests?: string[] | null
          is_active?: boolean | null
          last_active_at?: string | null
          nome: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
          workplace_empresa?: string | null
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          id?: string
          interest_areas?: string[]
          interests?: string[] | null
          is_active?: boolean | null
          last_active_at?: string | null
          nome?: string
          onboarding_completed?: boolean | null
          onboarding_completed_at?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
          workplace_empresa?: string | null
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          attempted_at: string | null
          id: string
          passed: boolean | null
          quiz_id: string
          score: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          attempted_at?: string | null
          id?: string
          passed?: boolean | null
          quiz_id: string
          score?: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          attempted_at?: string | null
          id?: string
          passed?: boolean | null
          quiz_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: number
          id: string
          options: Json
          order_index: number | null
          question: string
          quiz_id: string
        }
        Insert: {
          correct_answer?: number
          id?: string
          options?: Json
          order_index?: number | null
          question: string
          quiz_id: string
        }
        Update: {
          correct_answer?: number
          id?: string
          options?: Json
          order_index?: number | null
          question?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string | null
          id: string
          passing_score: number | null
          title: string
          track_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          passing_score?: number | null
          title: string
          track_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          passing_score?: number | null
          title?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      research_answers: {
        Row: {
          choice_values: string[] | null
          id: string
          indicator: string | null
          numeric_value: number | null
          question_id: string
          response_id: string
          survey_id: string
          text_value: string | null
        }
        Insert: {
          choice_values?: string[] | null
          id?: string
          indicator?: string | null
          numeric_value?: number | null
          question_id: string
          response_id: string
          survey_id: string
          text_value?: string | null
        }
        Update: {
          choice_values?: string[] | null
          id?: string
          indicator?: string | null
          numeric_value?: number | null
          question_id?: string
          response_id?: string
          survey_id?: string
          text_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "research_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "research_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_answers_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "research_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      research_attendance: {
        Row: {
          area: string | null
          audience: string
          class_name: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          list_id: string
          name: string
          track_id: string | null
          training_date: string
          training_name: string
        }
        Insert: {
          area?: string | null
          audience: string
          class_name?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          list_id: string
          name: string
          track_id?: string | null
          training_date: string
          training_name: string
        }
        Update: {
          area?: string | null
          audience?: string
          class_name?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          list_id?: string
          name?: string
          track_id?: string | null
          training_date?: string
          training_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_attendance_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "research_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_attendance_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      research_deadline_changes: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          new_deadline: string
          previous_deadline: string | null
          reason: string | null
          survey_id: string
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          new_deadline: string
          previous_deadline?: string | null
          reason?: string | null
          survey_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          new_deadline?: string
          previous_deadline?: string | null
          reason?: string | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_deadline_changes_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "research_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      research_dispatches: {
        Row: {
          created_at: string
          created_by: string | null
          details: Json
          id: string
          kind: string
          list_id: string | null
          recipients: number
          skipped_existing: number
          survey_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          details?: Json
          id?: string
          kind: string
          list_id?: string | null
          recipients?: number
          skipped_existing?: number
          survey_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          details?: Json
          id?: string
          kind?: string
          list_id?: string | null
          recipients?: number
          skipped_existing?: number
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_dispatches_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "research_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_dispatches_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "research_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      research_email_jobs: {
        Row: {
          attempts: number
          created_at: string
          dedupe_key: string
          dispatch_id: string | null
          id: string
          invitation_id: string
          kind: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          processed_at: string | null
          provider_message_id: string | null
          sender_email: string | null
          status: string
          survey_id: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          dedupe_key: string
          dispatch_id?: string | null
          id?: string
          invitation_id: string
          kind: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          processed_at?: string | null
          provider_message_id?: string | null
          sender_email?: string | null
          status?: string
          survey_id: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          dedupe_key?: string
          dispatch_id?: string | null
          id?: string
          invitation_id?: string
          kind?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          processed_at?: string | null
          provider_message_id?: string | null
          sender_email?: string | null
          status?: string
          survey_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_email_jobs_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "research_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_email_jobs_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "research_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_email_jobs_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "research_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      research_employee_bases: {
        Row: {
          absent_policy: string
          audience: string
          company_name: string
          created_at: string
          created_by: string
          id: string
          previous_base_id: string | null
          reference_date: string
          source_file_name: string | null
          summary: Json
          version: number
        }
        Insert: {
          absent_policy?: string
          audience: string
          company_name: string
          created_at?: string
          created_by: string
          id?: string
          previous_base_id?: string | null
          reference_date: string
          source_file_name?: string | null
          summary?: Json
          version: number
        }
        Update: {
          absent_policy?: string
          audience?: string
          company_name?: string
          created_at?: string
          created_by?: string
          id?: string
          previous_base_id?: string | null
          reference_date?: string
          source_file_name?: string | null
          summary?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_employee_bases_previous_base_id_fkey"
            columns: ["previous_base_id"]
            isOneToOne: false
            referencedRelation: "research_employee_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      research_employees: {
        Row: {
          active: boolean
          area: string | null
          base_id: string
          company: string | null
          email: string | null
          external_id: string | null
          id: string
          name: string
          origin: string
        }
        Insert: {
          active?: boolean
          area?: string | null
          base_id: string
          company?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          name: string
          origin?: string
        }
        Update: {
          active?: boolean
          area?: string | null
          base_id?: string
          company?: string | null
          email?: string | null
          external_id?: string | null
          id?: string
          name?: string
          origin?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_employees_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "research_employee_bases"
            referencedColumns: ["id"]
          },
        ]
      }
      research_invitation_tokens: {
        Row: {
          created_at: string
          invitation_id: string
          token: string
        }
        Insert: {
          created_at?: string
          invitation_id: string
          token: string
        }
        Update: {
          created_at?: string
          invitation_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_invitation_tokens_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "research_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      research_invitations: {
        Row: {
          area: string | null
          company: string | null
          created_at: string
          delivered_at: string | null
          dispatch_id: string | null
          email: string
          id: string
          last_error: string | null
          last_reminder_at: string | null
          list_id: string | null
          name: string
          provider_message_id: string | null
          reminder_count: number
          responded_at: string | null
          send_attempts: number
          send_status: string
          sent_at: string | null
          survey_id: string
          training_date: string | null
          training_name: string | null
        }
        Insert: {
          area?: string | null
          company?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatch_id?: string | null
          email: string
          id?: string
          last_error?: string | null
          last_reminder_at?: string | null
          list_id?: string | null
          name: string
          provider_message_id?: string | null
          reminder_count?: number
          responded_at?: string | null
          send_attempts?: number
          send_status?: string
          sent_at?: string | null
          survey_id: string
          training_date?: string | null
          training_name?: string | null
        }
        Update: {
          area?: string | null
          company?: string | null
          created_at?: string
          delivered_at?: string | null
          dispatch_id?: string | null
          email?: string
          id?: string
          last_error?: string | null
          last_reminder_at?: string | null
          list_id?: string | null
          name?: string
          provider_message_id?: string | null
          reminder_count?: number
          responded_at?: string | null
          send_attempts?: number
          send_status?: string
          sent_at?: string | null
          survey_id?: string
          training_date?: string | null
          training_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_invitations_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "research_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_invitations_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "research_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_invitations_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "research_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      research_list_members: {
        Row: {
          area: string | null
          class_name: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          list_id: string
          name: string
          training_date: string | null
          training_name: string | null
        }
        Insert: {
          area?: string | null
          class_name?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          list_id: string
          name: string
          training_date?: string | null
          training_name?: string | null
        }
        Update: {
          area?: string | null
          class_name?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          list_id?: string
          name?: string
          training_date?: string | null
          training_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "research_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      research_lists: {
        Row: {
          audience: string
          class_name: string | null
          company_name: string | null
          created_at: string
          created_by: string
          id: string
          member_count: number
          name: string
          purpose: string
          source_file_name: string | null
          source_sheet: string | null
          summary: Json
          track_id: string | null
          training_date: string | null
          training_name: string | null
        }
        Insert: {
          audience: string
          class_name?: string | null
          company_name?: string | null
          created_at?: string
          created_by: string
          id?: string
          member_count?: number
          name: string
          purpose: string
          source_file_name?: string | null
          source_sheet?: string | null
          summary?: Json
          track_id?: string | null
          training_date?: string | null
          training_name?: string | null
        }
        Update: {
          audience?: string
          class_name?: string | null
          company_name?: string | null
          created_at?: string
          created_by?: string
          id?: string
          member_count?: number
          name?: string
          purpose?: string
          source_file_name?: string | null
          source_sheet?: string | null
          summary?: Json
          track_id?: string | null
          training_date?: string | null
          training_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_lists_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      research_permissions: {
        Row: {
          granted_at: string
          granted_by: string
          permission: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          permission: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      research_questions: {
        Row: {
          created_at: string
          id: string
          indicator: string | null
          max_label: string | null
          min_label: string | null
          options: Json
          position: number
          prompt: string
          required: boolean
          scale_max: number | null
          scale_min: number | null
          survey_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicator?: string | null
          max_label?: string | null
          min_label?: string | null
          options?: Json
          position?: number
          prompt: string
          required?: boolean
          scale_max?: number | null
          scale_min?: number | null
          survey_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          indicator?: string | null
          max_label?: string | null
          min_label?: string | null
          options?: Json
          position?: number
          prompt?: string
          required?: boolean
          scale_max?: number | null
          scale_min?: number | null
          survey_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "research_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      research_responses: {
        Row: {
          id: string
          invitation_id: string
          submitted_at: string
          survey_id: string
        }
        Insert: {
          id?: string
          invitation_id: string
          submitted_at?: string
          survey_id: string
        }
        Update: {
          id?: string
          invitation_id?: string
          submitted_at?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_responses_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: true
            referencedRelation: "research_invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "research_surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      research_settings: {
        Row: {
          audience: string
          default_deadline_days: number
          default_reminder_days: number
          sender_email: string
          sender_name: string
          sending_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          audience: string
          default_deadline_days?: number
          default_reminder_days?: number
          sender_email: string
          sender_name: string
          sending_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          audience?: string
          default_deadline_days?: number
          default_reminder_days?: number
          sender_email?: string
          sender_name?: string
          sending_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      research_surveys: {
        Row: {
          audience: string
          class_name: string | null
          closed_at: string | null
          created_at: string
          created_by: string
          deadline_at: string | null
          deadline_days: number
          description: string
          email_body: string
          email_subject: string
          first_sent_at: string | null
          id: string
          kind: string
          reminder_after_days: number
          reminder_enabled: boolean
          source_survey_id: string | null
          standalone_reason: string | null
          status: string
          title: string
          track_id: string | null
          training_name: string | null
          updated_at: string
          version: number
        }
        Insert: {
          audience: string
          class_name?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          deadline_at?: string | null
          deadline_days?: number
          description?: string
          email_body?: string
          email_subject?: string
          first_sent_at?: string | null
          id?: string
          kind: string
          reminder_after_days?: number
          reminder_enabled?: boolean
          source_survey_id?: string | null
          standalone_reason?: string | null
          status?: string
          title: string
          track_id?: string | null
          training_name?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          audience?: string
          class_name?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string
          deadline_at?: string | null
          deadline_days?: number
          description?: string
          email_body?: string
          email_subject?: string
          first_sent_at?: string | null
          id?: string
          kind?: string
          reminder_after_days?: number
          reminder_enabled?: boolean
          source_survey_id?: string | null
          standalone_reason?: string | null
          status?: string
          title?: string
          track_id?: string | null
          training_name?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "research_surveys_source_survey_id_fkey"
            columns: ["source_survey_id"]
            isOneToOne: false
            referencedRelation: "research_surveys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_surveys_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          admin_note: string | null
          cost: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          id: string
          refund_email_status: string | null
          refunded_at: string | null
          reward_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          cost: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          refund_email_status?: string | null
          refunded_at?: string | null
          reward_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          cost?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          id?: string
          refund_email_status?: string | null
          refunded_at?: string | null
          reward_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          category: string | null
          cost: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          stock: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          stock?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          stock?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          comment: string | null
          context: Json | null
          created_at: string | null
          id: string
          score: number
          survey_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          score: number
          survey_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          context?: Json | null
          created_at?: string | null
          id?: string
          score?: number
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          question: string
          title: string
          trigger_config: Json | null
          trigger_type: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          question: string
          title: string
          trigger_config?: Json | null
          trigger_type?: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          question?: string
          title?: string
          trigger_config?: Json | null
          trigger_type?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      track_favorites: {
        Row: {
          created_at: string | null
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_favorites_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          rating: number
          track_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating: number
          track_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          rating?: number
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_ratings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          category: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          instructor: string | null
          is_active: boolean | null
          learning_path_restricted: boolean
          order_index: number | null
          prerequisite_track_id: string | null
          published_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          instructor?: string | null
          is_active?: boolean | null
          learning_path_restricted?: boolean
          order_index?: number | null
          prerequisite_track_id?: string | null
          published_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          instructor?: string | null
          is_active?: boolean | null
          learning_path_restricted?: boolean
          order_index?: number | null
          prerequisite_track_id?: string | null
          published_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracks_prerequisite_track_id_fkey"
            columns: ["prerequisite_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          category: string | null
          cost_per_hour: number
          cost_per_hour_remote: number
          created_at: string
          description: string | null
          duration_hours: number
          id: string
          is_active: boolean
          order_index: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_per_hour?: number
          cost_per_hour_remote?: number
          created_at?: string
          description?: string | null
          duration_hours?: number
          id?: string
          is_active?: boolean
          order_index?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_per_hour?: number
          cost_per_hour_remote?: number
          created_at?: string
          description?: string | null
          duration_hours?: number
          id?: string
          is_active?: boolean
          order_index?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      training_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          id: string
          modality: string
          module_id: string
          notes: string | null
          participants: number | null
          preferred_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          id?: string
          modality?: string
          module_id: string
          notes?: string | null
          participants?: number | null
          preferred_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          id?: string
          modality?: string
          module_id?: string
          notes?: string | null
          participants?: number | null
          preferred_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_requests_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_levels: {
        Row: {
          current_level: number
          id: string
          total_xp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_level?: number
          id?: string
          total_xp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_level?: number
          id?: string
          total_xp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_streaks: {
        Row: {
          current_streak: number
          id: string
          last_active_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      company_colleagues: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          empresa: string | null
          is_active: boolean | null
          last_active_at: string | null
          nome: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          empresa?: string | null
          is_active?: boolean | null
          last_active_at?: string | null
          nome?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          empresa?: string | null
          is_active?: boolean | null
          last_active_at?: string | null
          nome?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      kb_quiz_questions_safe: {
        Row: {
          explanation: string | null
          id: string | null
          module_id: string | null
          options: Json | null
          order_index: number | null
          question: string | null
          type: string | null
        }
        Insert: {
          explanation?: string | null
          id?: string | null
          module_id?: string | null
          options?: Json | null
          order_index?: number | null
          question?: string | null
          type?: string | null
        }
        Update: {
          explanation?: string | null
          id?: string | null
          module_id?: string | null
          options?: Json | null
          order_index?: number | null
          question?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_quiz_questions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "kb_quiz_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions_safe: {
        Row: {
          id: string | null
          options: Json | null
          order_index: number | null
          question: string | null
          quiz_id: string | null
        }
        Insert: {
          id?: string | null
          options?: Json | null
          order_index?: number | null
          question?: string | null
          quiz_id?: string | null
        }
        Update: {
          id?: string | null
          options?: Json | null
          order_index?: number | null
          question?: string | null
          quiz_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_adjust_coins: {
        Args: {
          _amount: number
          _reason: string
          _reference_id?: string
          _user_id: string
        }
        Returns: Json
      }
      admin_enrollment_report: { Args: { _track_id?: string }; Returns: Json }
      admin_learning_access_check: {
        Args: { _path: string; _user: string }
        Returns: Json
      }
      admin_revoke_certificate: {
        Args: { _id: string; _reason: string }
        Returns: Json
      }
      admin_update_redemption: {
        Args: { _id: string; _reason?: string; _status: string }
        Returns: Json
      }
      award_coins: {
        Args: {
          _amount: number
          _reason: string
          _reference_id?: string
          _reference_type?: string
          _user_id: string
        }
        Returns: undefined
      }
      award_xp: { Args: { _user_id: string; _xp: number }; Returns: undefined }
      can_access_learning_course: { Args: { _track: string }; Returns: boolean }
      can_access_learning_path: { Args: { _path: string }; Returns: boolean }
      claim_coin_reward: {
        Args: { _key: string; _reference_id: string }
        Returns: Json
      }
      coin_evidence_ok: {
        Args: { _key: string; _reference_id: string; _user_id: string }
        Returns: boolean
      }
      complete_onboarding: {
        Args: {
          _cargo: string
          _interest_areas: string[]
          _nome: string
          _workplace_empresa: string
        }
        Returns: Json
      }
      complete_track_without_exam: {
        Args: { _track_id: string }
        Returns: Json
      }
      evaluate_user_badges: { Args: never; Returns: Json }
      exam_current_cycle: {
        Args: { _exam_id: string; _max_attempts: number; _user_id: string }
        Returns: number
      }
      gamification_fraud_report: { Args: { _days?: number }; Returns: Json }
      get_kb_quiz_questions: {
        Args: { _module_ids: string[] }
        Returns: {
          explanation: string
          id: string
          module_id: string
          options: Json
          order_index: number
          question: string
          type: string
        }[]
      }
      get_knowledge_base: { Args: { _id: string }; Returns: Json }
      get_level_from_xp: { Args: { _xp: number }; Returns: number }
      get_quiz_questions: {
        Args: { _quiz_id: string }
        Returns: {
          id: string
          options: Json
          order_index: number
          question: string
          quiz_id: string
        }[]
      }
      get_user_coins: { Args: { _user_id: string }; Returns: number }
      get_user_empresa: { Args: { _user_id: string }; Returns: string }
      has_completed_all_lessons: {
        Args: { _track_id: string; _user_id: string }
        Returns: boolean
      }
      has_completed_module_lessons: {
        Args: { _module_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_same_company: { Args: { _user_id: string }; Returns: boolean }
      learning_course_access: {
        Args: { _track: string; _user: string }
        Returns: boolean
      }
      learning_lesson_access: { Args: { _lesson: string }; Returns: boolean }
      learning_material_file_access: {
        Args: { _path: string }
        Returns: boolean
      }
      learning_module_access: { Args: { _module: string }; Returns: boolean }
      learning_path_authorized: {
        Args: { _path: string; _user: string }
        Returns: boolean
      }
      learning_path_report: { Args: { _path: string }; Returns: Json }
      learning_path_snapshot: { Args: { _path: string }; Returns: Json }
      learning_quiz_access: { Args: { _quiz: string }; Returns: boolean }
      redeem_reward: { Args: { _reward_id: string }; Returns: Json }
      replace_notion_chunks: {
        Args: {
          _chunks: Json
          _edited: string
          _source_id: string
          _unprocessed: Json
        }
        Returns: number
      }
      research_can: { Args: { _perm: string }; Returns: boolean }
      research_claim_email_jobs: { Args: { _limit: number }; Returns: Json }
      research_close_survey: { Args: { _id: string }; Returns: undefined }
      research_complete_email_job: {
        Args: {
          _error: string
          _job: string
          _outcome: string
          _provider_id: string
        }
        Returns: undefined
      }
      research_dashboard: { Args: { _f: Json }; Returns: Json }
      research_day_end: { Args: { _d: string }; Returns: string }
      research_duplicate_survey: {
        Args: { _id: string; _new_version: boolean }
        Returns: string
      }
      research_email_ok: { Args: { _e: string }; Returns: boolean }
      research_export: { Args: { _f: Json }; Returns: Json }
      research_extend_deadline: {
        Args: { _id: string; _new_date: string; _reason: string }
        Returns: string
      }
      research_filter_options: { Args: { _audience: string }; Returns: Json }
      research_filtered_invitations: {
        Args: { _f: Json }
        Returns: {
          area: string | null
          company: string | null
          created_at: string
          delivered_at: string | null
          dispatch_id: string | null
          email: string
          id: string
          last_error: string | null
          last_reminder_at: string | null
          list_id: string | null
          name: string
          provider_message_id: string | null
          reminder_count: number
          responded_at: string | null
          send_attempts: number
          send_status: string
          sent_at: string | null
          survey_id: string
          training_date: string | null
          training_name: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "research_invitations"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      research_get_form: { Args: { _token: string }; Returns: Json }
      research_has_any: { Args: never; Returns: boolean }
      research_import_employee_base: { Args: { _p: Json }; Returns: Json }
      research_import_list: { Args: { _p: Json }; Returns: Json }
      research_mark_delivered: {
        Args: { _provider_id: string }
        Returns: undefined
      }
      research_my_permissions: { Args: never; Returns: string[] }
      research_notify_extension: { Args: { _id: string }; Returns: number }
      research_reach: { Args: { _f: Json }; Returns: Json }
      research_requeue_blocked: { Args: { _survey: string }; Returns: number }
      research_scheduler_tick: { Args: never; Returns: Json }
      research_send_preview: {
        Args: { _list: string; _survey: string }
        Returns: Json
      }
      research_send_survey: {
        Args: {
          _deadline_days: number
          _list: string
          _reminder_after_days: number
          _reminder_enabled: boolean
          _survey: string
        }
        Returns: Json
      }
      research_set_user_permissions: {
        Args: { _permissions: string[]; _user_id: string }
        Returns: undefined
      }
      research_submit_response: {
        Args: { _answers: Json; _token: string }
        Returns: Json
      }
      save_knowledge_base: {
        Args: { _dados: Json; _expected: string; _id: string }
        Returns: string
      }
      save_learning_path: {
        Args: { _data: Json; _id: string }
        Returns: string
      }
      save_my_personal_data: {
        Args: {
          _cargo?: string
          _email: string
          _empresa: string
          _nome: string
          _telefone: string
        }
        Returns: undefined
      }
      search_notion_knowledge: {
        Args: {
          _include_admin: boolean
          _limit?: number
          _module?: string
          _query: string
        }
        Returns: {
          chunk_id: string
          content: string
          linked_orientation_path: string
          linked_orientation_title: string
          page_id: string
          page_title: string
          page_updated_at: string
          provider: string
          rank: number
          section: string
          url: string
        }[]
      }
      set_learning_path_access: {
        Args: {
          _company?: string
          _path: string
          _revoke?: boolean
          _users?: string[]
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_exam_attempt: {
        Args: { _module_id?: string; _track_id: string }
        Returns: Json
      }
      submit_exam_attempt: {
        Args: { _answers: Json; _duration_seconds: number; _exam_id: string }
        Returns: Json
      }
      touch_my_streak: { Args: never; Returns: Json }
      track_has_exam: { Args: { _track_id: string }; Returns: boolean }
      update_user_streak: { Args: { _user_id: string }; Returns: undefined }
      validate_kb_quiz_attempt: {
        Args: { _answers: Json; _module_ids: string[]; _user_id: string }
        Returns: Json
      }
      validate_learning_company: {
        Args: { _company: string; _revoke?: boolean; _users: string[] }
        Returns: undefined
      }
      validate_quiz_attempt: {
        Args: { _answers: Json; _quiz_id: string; _user_id: string }
        Returns: Json
      }
      verify_certificate: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
