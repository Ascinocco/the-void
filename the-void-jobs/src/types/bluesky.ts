export interface BlueskyServiceParams {
  baseUrl?: string;
  accessToken?: string;
  identifier?: string; // Bluesky handle or email
  password?: string; // App password
}

export interface BlueskySearchOptions {
  query: string;
  limit?: number;
  sort?: "top" | "latest";
  since?: string; // YYYY-MM-DD format
  until?: string; // YYYY-MM-DD format
  mentions?: string; // Filter posts mentioning this user
  author?: string; // Filter posts by this author
  lang?: string; // Language filter (e.g., 'en', 'ja')
  domain?: string; // Filter posts linking to this domain
  url?: string; // Filter posts linking to this URL
  tag?: string[]; // Filter by hashtags
  cursor?: string; // For pagination
  accessToken?: string;
}

export interface BlueskySearchResponse {
  posts: PostView[];
  cursor?: string;
  hitsTotal?: number;
}

export interface PostView {
  uri: string;
  cid: string;
  author: {
    did: string;
    handle: string;
    displayName?: string;
    avatar?: string;
    followersCount?: number;
    labels?: Array<{ val: string }>;
  };
  record: {
    text: string;
    createdAt: string;
    langs?: string[];
    reply?: {
      root: { uri: string; cid: string };
      parent: { uri: string; cid: string };
    };
  };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
  viewCount?: number;
  indexedAt: string;
  reason?: {
    $type: string;
  };
}
