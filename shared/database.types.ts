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
      app_events: {
        Row: {
          at: string
          id: number
          kind: Database["public"]["Enums"]["app_event_kind"]
          user_id: string
        }
        Insert: {
          at?: string
          id?: never
          kind?: Database["public"]["Enums"]["app_event_kind"]
          user_id?: string
        }
        Update: {
          at?: string
          id?: never
          kind?: Database["public"]["Enums"]["app_event_kind"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          joined_at: string
          role: Database["public"]["Enums"]["circle_role"]
          user_id: string
        }
        Insert: {
          circle_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["circle_role"]
          user_id: string
        }
        Update: {
          circle_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["circle_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          home_area: string | null
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          home_area?: string | null
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          home_area?: string | null
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "circles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          auto_nudges: boolean
          health: boolean
          location: boolean
          notify_daily_photo: boolean
          notify_friend_posts: boolean
          notify_sunday: boolean
          paused_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_nudges?: boolean
          health?: boolean
          location?: boolean
          notify_daily_photo?: boolean
          notify_friend_posts?: boolean
          notify_sunday?: boolean
          paused_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_nudges?: boolean
          health?: boolean
          location?: boolean
          notify_daily_photo?: boolean
          notify_friend_posts?: boolean
          notify_sunday?: boolean
          paused_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_signals: {
        Row: {
          day: string
          hours_away_from_home: number | null
          places_visited: number | null
          sleep_hours: number | null
          steps: number | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          day: string
          hours_away_from_home?: number | null
          places_visited?: number | null
          sleep_hours?: number | null
          steps?: number | null
          uploaded_at?: string
          user_id?: string
        }
        Update: {
          day?: string
          hours_away_from_home?: number | null
          places_visited?: number | null
          sleep_hours?: number | null
          steps?: number | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drift_scores: {
        Row: {
          circle_id: string
          day: string
          is_quiet: boolean
          score: number
          user_id: string
        }
        Insert: {
          circle_id: string
          day: string
          is_quiet?: boolean
          score: number
          user_id: string
        }
        Update: {
          circle_id?: string
          day?: string
          is_quiet?: boolean
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drift_scores_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drift_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_daily: {
        Row: {
          circle_id: string
          day: string
          opens: number
          received: number
          sent: number
          user_id: string
        }
        Insert: {
          circle_id: string
          day: string
          opens?: number
          received?: number
          sent?: number
          user_id: string
        }
        Update: {
          circle_id?: string
          day?: string
          opens?: number
          received?: number
          sent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_daily_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_messages: {
        Row: {
          body: string
          created_at: string
          event_id: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          event_id: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          event_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_messages_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_people: {
        Row: {
          added_at: string
          event_id: string
          is_lead: boolean
          opted_out: boolean
          role: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        Insert: {
          added_at?: string
          event_id: string
          is_lead?: boolean
          opted_out?: boolean
          role?: Database["public"]["Enums"]["event_role"]
          user_id: string
        }
        Update: {
          added_at?: string
          event_id?: string
          is_lead?: boolean
          opted_out?: boolean
          role?: Database["public"]["Enums"]["event_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_people_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_people_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          chat_days_after: number
          chat_enabled: boolean
          circle_id: string
          created_at: string
          created_by: string | null
          description: string | null
          gallery_enabled: boolean
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          chat_days_after?: number
          chat_enabled?: boolean
          circle_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          gallery_enabled?: boolean
          id?: string
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          chat_days_after?: number
          chat_enabled?: boolean
          circle_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          gallery_enabled?: boolean
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          body: string | null
          circle_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["interaction_kind"]
          media_path: string | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          body?: string | null
          circle_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["interaction_kind"]
          media_path?: string | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string | null
          circle_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["interaction_kind"]
          media_path?: string | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moments: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          occurs_on: string
          title: string
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          occurs_on: string
          title: string
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          occurs_on?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moments_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "moments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          circle_id: string
          created_at: string
          id: string
          read_at: string | null
          target_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          circle_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          target_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          circle_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          target_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nudges: {
        Row: {
          about_user_id: string
          acted_at: string | null
          circle_id: string
          id: string
          message: string
          reason_kind: Database["public"]["Enums"]["nudge_reason"]
          recipient_id: string
          sent_at: string
        }
        Insert: {
          about_user_id: string
          acted_at?: string | null
          circle_id: string
          id?: string
          message: string
          reason_kind: Database["public"]["Enums"]["nudge_reason"]
          recipient_id: string
          sent_at?: string
        }
        Update: {
          about_user_id?: string
          acted_at?: string | null
          circle_id?: string
          id?: string
          message?: string
          reason_kind?: Database["public"]["Enums"]["nudge_reason"]
          recipient_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nudges_about_user_id_fkey"
            columns: ["about_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          author_id: string
          circle_id: string
          created_at: string
          event_id: string | null
          height: number | null
          id: string
          media_path: string
          width: number | null
        }
        Insert: {
          author_id: string
          circle_id: string
          created_at?: string
          event_id?: string | null
          height?: number | null
          id?: string
          media_path: string
          width?: number | null
        }
        Update: {
          author_id?: string
          circle_id?: string
          created_at?: string
          event_id?: string | null
          height?: number | null
          id?: string
          media_path?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          birthday: string | null
          created_at: string
          display_name: string
          egg_style: Json
          facts: Json
          id: string
          timezone: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          birthday?: string | null
          created_at?: string
          display_name?: string
          egg_style?: Json
          facts?: Json
          id: string
          timezone?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          birthday?: string | null
          created_at?: string
          display_name?: string
          egg_style?: Json
          facts?: Json
          id?: string
          timezone?: string
          username?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          created_at: string
          emoji: string
          interaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          interaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          interaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduler_log: {
        Row: {
          circle_id: string
          kind: string
          period_key: string
          sent_at: string
          user_id: string
        }
        Insert: {
          circle_id: string
          kind: string
          period_key: string
          sent_at?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          kind?: string
          period_key?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduler_log_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduler_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_reactions: {
        Row: {
          created_at: string
          emoji: string
          share_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          share_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          share_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_reactions_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "shares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shares: {
        Row: {
          author_id: string
          body: string | null
          circle_id: string
          created_at: string
          egg_style: Json | null
          id: string
          kind: Database["public"]["Enums"]["share_kind"]
          media_path: string | null
          period_key: string
          recipient_id: string | null
        }
        Insert: {
          author_id: string
          body?: string | null
          circle_id: string
          created_at?: string
          egg_style?: Json | null
          id?: string
          kind: Database["public"]["Enums"]["share_kind"]
          media_path?: string | null
          period_key: string
          recipient_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string | null
          circle_id?: string
          created_at?: string
          egg_style?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["share_kind"]
          media_path?: string | null
          period_key?: string
          recipient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shares_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shares_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spotlight_days: {
        Row: {
          circle_id: string
          day: string
          user_id: string
        }
        Insert: {
          circle_id: string
          day: string
          user_id: string
        }
        Update: {
          circle_id?: string
          day?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spotlight_days_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spotlight_days_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sunday_pairs: {
        Row: {
          circle_id: string
          created_at: string
          giver_id: string
          period_key: string
          receiver_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          giver_id: string
          period_key: string
          receiver_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          giver_id?: string
          period_key?: string
          receiver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sunday_pairs_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sunday_pairs_giver_id_fkey"
            columns: ["giver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sunday_pairs_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      circle_profiles: {
        Row: {
          avatar_path: string | null
          birthday: string | null
          circle_id: string | null
          display_name: string | null
          egg_style: Json | null
          facts: Json | null
          id: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["circle_role"] | null
          username: string | null
        }
        Relationships: []
      }
      event_profiles: {
        Row: {
          avatar_path: string | null
          display_name: string | null
          egg_style: Json | null
          event_id: string | null
          id: string | null
          username: string | null
        }
        Relationships: []
      }
      my_nudges: {
        Row: {
          about_user_id: string | null
          acted_at: string | null
          circle_id: string | null
          id: string | null
          message: string | null
          sent_at: string | null
        }
        Insert: {
          about_user_id?: string | null
          acted_at?: string | null
          circle_id?: string | null
          id?: string | null
          message?: string | null
          sent_at?: string | null
        }
        Update: {
          about_user_id?: string | null
          acted_at?: string | null
          circle_id?: string | null
          id?: string | null
          message?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nudges_about_user_id_fkey"
            columns: ["about_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nudges_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_event_guest_to_circle: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: undefined
      }
      add_people_to_event: {
        Args: { p_event_id: string; p_people: Json }
        Returns: number
      }
      circle_daily: {
        Args: { p_circle_id: string; p_days?: number; p_today?: string }
        Returns: {
          day: string
          media_path: string
          posted: boolean
          posted_at: string
          prompt: string
          share_id: string
          user_id: string
        }[]
      }
      coop_overview: {
        Args: { p_today?: string }
        Returns: {
          cover_path: string
          description: string
          home_area: string
          id: string
          invite_code: string
          joined_at: string
          members: number
          name: string
          streak: number
          today_posted: boolean
          today_user_id: string
        }[]
      }
      create_circle: {
        Args: { description?: string; home_area?: string; name: string }
        Returns: {
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          home_area: string | null
          id: string
          invite_code: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "circles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_event: {
        Args: {
          p_chat_days_after?: number
          p_chat_enabled?: boolean
          p_circle_id: string
          p_description?: string
          p_gallery_enabled?: boolean
          p_location?: string
          p_people?: Json
          p_starts_at: string
          p_title: string
        }
        Returns: {
          chat_days_after: number
          chat_enabled: boolean
          circle_id: string
          created_at: string
          created_by: string | null
          description: string | null
          gallery_enabled: boolean
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_notifications: { Args: { p_rows: Json }; Returns: number }
      daily_prompt: { Args: { p_day?: string }; Returns: string }
      demo_reseed: { Args: { p_emails?: string[] }; Returns: Json }
      ensure_sunday_pairs: {
        Args: { p_circle_id: string; p_period_key: string }
        Returns: number
      }
      join_circle: {
        Args: { invite_code: string }
        Returns: {
          cover_path: string | null
          created_at: string
          created_by: string | null
          description: string | null
          home_area: string | null
          id: string
          invite_code: string
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "circles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      leave_circle: { Args: { circle_id: string }; Returns: undefined }
      run_drift: { Args: { p_day?: string }; Returns: Json }
      set_event_chat_timer: {
        Args: { p_days: number; p_event_id: string }
        Returns: {
          chat_days_after: number
          chat_enabled: boolean
          circle_id: string
          created_at: string
          created_by: string | null
          description: string | null
          gallery_enabled: boolean
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_event_opt_out: {
        Args: { p_event_id: string; p_out: boolean }
        Returns: undefined
      }
      set_event_person: {
        Args: {
          p_event_id: string
          p_lead?: boolean
          p_remove?: boolean
          p_role?: Database["public"]["Enums"]["event_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      sunday_prompt: {
        Args: { p_name: string; p_week: string }
        Returns: string
      }
      sunday_status: {
        Args: { p_circle_id: string; p_period_key?: string }
        Returns: {
          from_id: string
          i_sent: boolean
          my_share_id: string
          period_key: string
          prompt: string
          send_to: string
          their_share_id: string
          they_sent: boolean
        }[]
      }
      update_event: {
        Args: {
          p_chat_enabled?: boolean
          p_description?: string
          p_event_id: string
          p_gallery_enabled?: boolean
          p_location?: string
          p_starts_at?: string
          p_title?: string
        }
        Returns: {
          chat_days_after: number
          chat_enabled: boolean
          circle_id: string
          created_at: string
          created_by: string | null
          description: string | null
          gallery_enabled: boolean
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_media_paths: { Args: { p_user_id: string }; Returns: string[] }
      username_available: { Args: { p_username: string }; Returns: boolean }
      verify_webhook_secret: { Args: { p_secret: string }; Returns: boolean }
    }
    Enums: {
      app_event_kind: "app_open"
      circle_role: "owner" | "member"
      event_role: "edit" | "comment" | "view"
      interaction_kind: "egg" | "photo" | "voice" | "text"
      notification_type:
        | "interaction"
        | "nudge"
        | "share_open"
        | "spotlight"
        | "birthday"
        | "moment"
        | "event"
      nudge_reason: "drift" | "cover" | "birthday" | "moment" | "spotlight"
      share_kind: "sunday" | "spotlight"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_event_kind: ["app_open"],
      circle_role: ["owner", "member"],
      event_role: ["edit", "comment", "view"],
      interaction_kind: ["egg", "photo", "voice", "text"],
      notification_type: [
        "interaction",
        "nudge",
        "share_open",
        "spotlight",
        "birthday",
        "moment",
        "event",
      ],
      nudge_reason: ["drift", "cover", "birthday", "moment", "spotlight"],
      share_kind: ["sunday", "spotlight"],
    },
  },
} as const
