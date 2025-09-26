// Mastodon API Types
export interface Account {
  id: string;
  username: string;
  acct: string; // username@domain or just username if local
  display_name: string;
  locked: boolean;
  bot: boolean;
  discoverable?: boolean;
  group: boolean;
  created_at: string; // ISO timestamp
  note: string; // Bio/description (HTML)
  url: string; // Profile URL
  avatar: string; // Avatar image URL
  avatar_static: string; // Non-animated avatar URL
  header: string; // Header image URL
  header_static: string; // Non-animated header URL
  followers_count: number;
  following_count: number;
  statuses_count: number;
  last_status_at?: string; // ISO date (YYYY-MM-DD)
  noindex?: boolean;
  emojis: CustomEmoji[];
  fields: Field[];
}

export interface Tag {
  name: string; // Hashtag name without the #
  url: string; // URL to the hashtag page
  history: TagHistory[]; // Usage statistics
}

export interface TagHistory {
  day: string; // Unix timestamp as string
  uses: string; // Number of uses as string
  accounts: string; // Number of accounts as string
}

export interface Field {
  name: string;
  value: string; // HTML
  verified_at?: string; // ISO timestamp if verified
}

export interface CustomEmoji {
  shortcode: string;
  url: string;
  static_url: string;
  visible_in_picker: boolean;
  category?: string;
}

export interface MediaAttachment {
  id: string;
  type: "image" | "video" | "gifv" | "audio" | "unknown";
  url: string; // Original media URL
  preview_url: string; // Thumbnail/preview URL
  remote_url?: string; // Original URL if federated
  preview_remote_url?: string;
  text_url?: string; // Shorter URL for text posts
  meta?: MediaMeta;
  description?: string; // Alt text
  blurhash?: string; // Blurhash for image placeholders
}

export interface MediaMeta {
  original?: MediaMetaInfo;
  small?: MediaMetaInfo;
  focus?: MediaFocus;
  length?: string; // Duration for audio/video
  duration?: number; // Duration in seconds
  fps?: number; // For video files
  size?: string; // File size
  width?: number;
  height?: number;
  aspect?: number;
  audio_encode?: string;
  audio_bitrate?: string;
  audio_channels?: string;
}

export interface MediaMetaInfo {
  width: number;
  height: number;
  size?: string; // "WIDTHxHEIGHT"
  aspect?: number;
  frame_rate?: string; // For videos
  duration?: number; // For videos/audio
  bitrate?: number; // For videos/audio
}

export interface MediaFocus {
  x: number; // Focus point X (-1.0 to 1.0)
  y: number; // Focus point Y (-1.0 to 1.0)
}

export interface MastodonSearchResponse {
  accounts: Account[];
  statuses: Status[];
  hashtags: Tag[];
}

export interface Status {
  id: string;
  uri: string;
  url: string; // Direct link to the post
  account: {
    id: string;
    username: string;
    acct: string; // Just username for local accounts
    display_name: string;
    avatar: string;
    followers_count: number;
    following_count: number;
    bot?: boolean; // Whether the account is a bot
  };
  content: string; // HTML content
  created_at: string; // ISO timestamp
  edited_at?: string; // ISO timestamp if edited
  reblogs_count: number; // Boost count
  favourites_count: number; // Like count
  replies_count: number;
  media_attachments: MediaAttachment[];
  tags: Tag[]; // Hashtags used in the post
  visibility: "public" | "unlisted" | "private" | "direct";
  sensitive?: boolean; // Whether the post is marked as sensitive
  spoiler_text?: string; // Content warning text
  in_reply_to_id?: string; // ID of the post this is replying to
  reblog?: Status; // If this is a reblog, the original post
  language?: string; // ISO language code
}

export interface MastodonSearchOptions {
  query: string;
  accessToken?: string; // Optional for public searches
  type?: "accounts" | "hashtags" | "statuses";
  limit?: number;
  resolve?: boolean;
  offset?: number;
  instance?: string; // Optional instance URL, defaults to mastodon.social
}

export interface MastodonServiceParams {
  defaultInstance?: string | undefined;
  defaultAccessToken?: string | undefined;
}
