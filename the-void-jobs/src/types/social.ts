// Result interface for social media search
export interface SocialMediaSearchResult {
  query: string; // The optimized search query that was used
  posts: UnifiedSocialPost[];
  totalPosts: number;
  generatedAt: Date;
}

// Unified post interface (no media)
export interface UnifiedSocialPost {
  // Core identification
  id: string; // Platform-specific post ID
  url: string; // Web URL to view the post
  platform: "mastodon" | "bluesky";

  // Content
  content: string; // Plain text content (HTML stripped)
  truncatedContent: string;
  originalContent?: string; // Original content with formatting
  language?: string; // ISO language code if available

  // Author information
  author: {
    id: string;
    username: string; // Handle/username
    displayName: string;
    avatar?: string;
    url: string; // Link to author profile
    followerCount?: number;
    isBot?: boolean;
    isVerified?: boolean;
  };

  // Timestamps
  createdAt: Date;
  editedAt?: Date;

  // Engagement metrics
  engagement: {
    likes: number; // favourites/likes
    shares: number; // reblogs/reposts
    replies: number;
    views?: number; // If available
  };

  // Content metadata
  isReply: boolean;
  isRepost: boolean; // Is this a boost/repost?
  originalPost?: UnifiedSocialPost; // If it's a repost

  // Social features
  hashtags: string[]; // Without the # symbol
  mentions: string[]; // Usernames mentioned

  // Content flags
  isSensitive: boolean;
  spoilerText?: string;
  visibility: "public" | "unlisted" | "private" | "followers";

  // Platform-specific data (for debugging or advanced features)
  rawData?: any; // Original platform response
  popularityScore?: number;
  articleId?: number;
}
