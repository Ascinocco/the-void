// Database types for The Void project

export type ArticleStatus =
  | "not_started"
  | "ready_for_ai_analysis"
  | "ready_for_social_media"
  | "complete";

export type SocialPlatform = "mastodon" | "bluesky";

export type PostVisibility = "public" | "unlisted" | "private" | "followers";

export interface Article {
  id: number;
  title: string;
  link: string;
  published_at: string | null; // ISO timestamp string
  embedding: number[] | null; // Vector embedding (1536 dimensions)
  topic_group_id: number | null;
  topic: string | null;
  description: string | null;
  summary: string | null;
  fact_check: string | null;
  tldr: string | null;
  related_content: string[] | null; // Array of links
  fact_check_references: string[] | null; // Array of reference sources
  original_content: string | null;
  status: ArticleStatus;
  created_at: string; // ISO timestamp string
  updated_at: string; // ISO timestamp string
}

export interface TopicGroup {
  id: number;
  topic_group: string;
  created_at: string; // ISO timestamp string
  updated_at: string; // ISO timestamp string
}

export interface SocialMediaPost {
  id: string; // Platform-specific post ID
  url: string;
  platform: SocialPlatform;

  // Content
  content: string;
  truncated_content: string;
  original_content: string | null;
  language: string | null;

  // Author information (stored as JSONB)
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    url: string;
    followerCount?: number;
    isBot?: boolean;
    isVerified?: boolean;
  };

  // Timestamps
  created_at: string; // ISO timestamp string
  edited_at: string | null; // ISO timestamp string

  // Engagement metrics (stored as JSONB)
  engagement: {
    likes: number;
    shares: number;
    replies: number;
    views?: number;
  };

  // Content metadata
  is_reply: boolean;
  is_repost: boolean;
  original_post_id: string | null; // Reference to another post if this is a repost

  // Social features
  hashtags: string[];
  mentions: string[];

  // Content flags
  is_sensitive: boolean;
  spoiler_text: string | null;
  visibility: PostVisibility;

  // Platform-specific and analysis data
  raw_data: any | null; // JSONB
  popularity_score: number | null;

  // Timestamps for our system
  db_created_at: string; // ISO timestamp string
  db_updated_at: string; // ISO timestamp string
}

export interface ArticleSocialPost {
  article_id: number;
  social_post_id: string;
  created_at: string; // ISO timestamp string
}

// For creating new social media posts (omitting auto-generated fields)
export interface CreateSocialMediaPost {
  id: string;
  url: string;
  platform: SocialPlatform;
  content: string;
  truncated_content: string;
  original_content?: string | null;
  language?: string | null;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    url: string;
    followerCount?: number;
    isBot?: boolean;
    isVerified?: boolean;
  };
  created_at: string;
  edited_at?: string | null;
  engagement: {
    likes: number;
    shares: number;
    replies: number;
    views?: number;
  };
  is_reply?: boolean;
  is_repost?: boolean;
  original_post_id?: string | null;
  hashtags?: string[];
  mentions?: string[];
  is_sensitive?: boolean;
  spoiler_text?: string | null;
  visibility?: PostVisibility;
  raw_data?: any | null;
  popularity_score?: number | null;
}

// For creating article-social post relationships
export interface CreateArticleSocialPost {
  article_id: number;
  social_post_id: string;
}

// For creating new articles (omitting auto-generated fields)
export interface CreateArticle {
  title: string;
  link: string;
  published_at?: string | null;
  embedding?: number[] | null;
  topic_group_id?: number | null;
  topic?: string | null;
  description?: string | null;
  summary?: string | null;
  fact_check?: string | null;
  tldr?: string | null;
  related_content?: string[] | null;
  fact_check_references?: string[] | null;
  original_content?: string | null;
  status?: ArticleStatus;
}

// For updating articles (all fields optional except id)
export interface UpdateArticle {
  id: number;
  title?: string;
  link?: string;
  published_at?: string | null;
  embedding?: number[] | null;
  topic_group_id?: number | null;
  topic?: string | null;
  description?: string | null;
  summary?: string | null;
  fact_check?: string | null;
  tldr?: string | null;
  related_content?: string[] | null;
  fact_check_references?: string[] | null;
  original_content?: string | null;
  status?: ArticleStatus;
}

// Database response types
export interface Database {
  public: {
    Tables: {
      articles: {
        Row: Article;
        Insert: CreateArticle;
        Update: UpdateArticle;
      };
      topic_groups: {
        Row: TopicGroup;
        Insert: Omit<TopicGroup, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<TopicGroup, "id" | "created_at" | "updated_at">>;
      };
      social_media_posts: {
        Row: SocialMediaPost;
        Insert: CreateSocialMediaPost;
        Update: Partial<
          Omit<SocialMediaPost, "id" | "db_created_at" | "db_updated_at">
        >;
      };
      article_social_posts: {
        Row: ArticleSocialPost;
        Insert: CreateArticleSocialPost;
        Update: never; // Junction table doesn't support updates
      };
    };
  };
}
