-- Create enum for social media platforms
create type social_platform as enum ('mastodon', 'bluesky');

-- Create enum for post visibility
create type post_visibility as enum ('public', 'unlisted', 'private', 'followers');

-- Create social_media_posts table
create table social_media_posts (
  id text primary key, -- Platform-specific post ID
  url text not null,
  platform social_platform not null,
  
  -- Content
  content text not null,
  truncated_content text not null,
  original_content text,
  language text,
  
  -- Author information (stored as JSONB for flexibility)
  author jsonb not null,
  
  -- Timestamps
  created_at timestamptz not null,
  edited_at timestamptz,
  
  -- Engagement metrics (stored as JSONB)
  engagement jsonb not null,
  
  -- Content metadata
  is_reply boolean not null default false,
  is_repost boolean not null default false,
  original_post_id text, -- Reference to another post if this is a repost
  
  -- Social features
  hashtags text[] not null default '{}',
  mentions text[] not null default '{}',
  
  -- Content flags
  is_sensitive boolean not null default false,
  spoiler_text text,
  visibility post_visibility not null default 'public',
  
  -- Platform-specific and analysis data
  raw_data jsonb,
  popularity_score numeric,
  
  -- Timestamps for our system
  db_created_at timestamptz not null default now(),
  db_updated_at timestamptz not null default now(),
  
  -- Foreign key constraint for reposts
  foreign key (original_post_id) references social_media_posts(id) on delete set null
);

-- Create junction table for many-to-many relationship between articles and social media posts
create table article_social_posts (
  article_id bigint not null,
  social_post_id text not null,
  primary key (article_id, social_post_id),
  foreign key (article_id) references articles(id) on delete cascade,
  foreign key (social_post_id) references social_media_posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Create indexes for better query performance
create index idx_social_media_posts_platform on social_media_posts(platform);
create index idx_social_media_posts_created_at on social_media_posts(created_at);
create index idx_social_media_posts_is_repost on social_media_posts(is_repost);
create index idx_social_media_posts_hashtags on social_media_posts using gin(hashtags);
create index idx_article_social_posts_article_id on article_social_posts(article_id);
create index idx_article_social_posts_social_post_id on article_social_posts(social_post_id);
