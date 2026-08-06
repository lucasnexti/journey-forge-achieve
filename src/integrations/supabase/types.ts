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
      certificates: {
        Row: {
          certificate_code: string | null
          id: string
          issued_at: string | null
          track_id: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          certificate_code?: string | null
          id?: string
          issued_at?: string | null
          track_id: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          certificate_code?: string | null
          id?: string
          issued_at?: string | null
          track_id?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
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
          details: Json
          duration_seconds: number
          exam_id: string
          id: string
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
          details?: Json
          duration_seconds?: number
          exam_id: string
          id?: string
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
          details?: Json
          duration_seconds?: number
          exam_id?: string
          id?: string
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
            foreignKeyName: "exams_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: true
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
          order_index?: number | null
          title?: string
          track_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
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
          empresa: string | null
          id: string
          interests: string[] | null
          is_active: boolean | null
          last_active_at: string | null
          nome: string
          onboarding_completed: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          empresa?: string | null
          id?: string
          interests?: string[] | null
          is_active?: boolean | null
          last_active_at?: string | null
          nome: string
          onboarding_completed?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          cpf?: string | null
          created_at?: string
          empresa?: string | null
          id?: string
          interests?: string[] | null
          is_active?: boolean | null
          last_active_at?: string | null
          nome?: string
          onboarding_completed?: boolean | null
          updated_at?: string
          user_id?: string
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
      reward_redemptions: {
        Row: {
          admin_note: string | null
          cost: number
          created_at: string
          id: string
          reward_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          cost: number
          created_at?: string
          id?: string
          reward_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          cost?: number
          created_at?: string
          id?: string
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
          created_at: string | null
          description: string | null
          estimated_hours: number | null
          id: string
          is_active: boolean | null
          order_index: number | null
          prerequisite_track_id: string | null
          published_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          prerequisite_track_id?: string | null
          published_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          id?: string
          is_active?: boolean | null
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
      admin_enrollment_report: { Args: { _track_id?: string }; Returns: Json }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_same_company: { Args: { _user_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      start_exam_attempt: { Args: { _track_id: string }; Returns: Json }
      submit_exam_attempt: {
        Args: { _answers: Json; _duration_seconds: number; _exam_id: string }
        Returns: Json
      }
      update_user_streak: { Args: { _user_id: string }; Returns: undefined }
      validate_kb_quiz_attempt: {
        Args: { _answers: Json; _module_ids: string[]; _user_id: string }
        Returns: Json
      }
      validate_quiz_attempt: {
        Args: { _answers: Json; _quiz_id: string; _user_id: string }
        Returns: Json
      }
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
