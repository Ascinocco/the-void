import { Logger } from "../utils/logger";
import { EnvConfig } from "../utils/env";
import {
  type BlueskySearchOptions,
  type BlueskySearchResponse,
  type BlueskyServiceParams,
  type PostView,
} from "../types/bluesky";
import { UnifiedSocialPost } from "../types/social";

export class BlueskyService {
  private readonly baseUrl: string;
  private accessToken?: string | undefined;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number = 1000; // 1 second between requests
  private authenticationPromise?: Promise<void>;

  constructor({
    baseUrl = "https://bsky.social",
    accessToken,
    identifier,
    password,
  }: BlueskyServiceParams = {}) {
    this.baseUrl = baseUrl;

    // If accessToken is provided directly, use it
    if (accessToken) {
      this.accessToken = accessToken;
      Logger.info("BlueskyService initialized with provided access token");
      return;
    }

    // Try to get credentials from environment
    const envIdentifier = identifier ?? EnvConfig.get("BLUESKY_IDENTIFIER");
    const envPassword = password ?? EnvConfig.get("BLUESKY_PASSWORD");
    const envAccessToken = EnvConfig.get("BLUESKY_ACCESS_TOKEN");

    if (envAccessToken) {
      this.accessToken = envAccessToken;
      Logger.info(
        "BlueskyService initialized with access token from environment"
      );
    } else if (envIdentifier && envPassword) {
      Logger.info(
        "BlueskyService will authenticate using identifier and password"
      );
      // Start authentication process
      this.authenticationPromise = this.authenticate(
        envIdentifier,
        envPassword
      );
    } else {
      Logger.warn(
        "BlueskyService initialized without authentication credentials - API access will be limited. " +
          "Please set BLUESKY_IDENTIFIER and BLUESKY_PASSWORD, or BLUESKY_ACCESS_TOKEN in your environment."
      );
    }
  }

  /**
   * Authenticate with Bluesky using identifier and password
   * @private
   */
  private async authenticate(
    identifier: string,
    password: string
  ): Promise<void> {
    try {
      Logger.info("Authenticating with Bluesky API");

      const response = await fetch(
        `${this.baseUrl}/xrpc/com.atproto.server.createSession`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ identifier, password }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(
          `Bluesky authentication failed with status ${response.status}`,
          undefined,
          {
            status: response.status,
            statusText: response.statusText,
            errorText,
            identifier: identifier.replace(/@.*/, "@***"), // Hide domain for privacy
          }
        );
        throw new Error(
          `Authentication failed: ${response.status} - ${errorText}`
        );
      }

      const data = (await response.json()) as {
        accessJwt: string;
        refreshJwt: string;
      };
      this.accessToken = data.accessJwt;

      Logger.info("Bluesky authentication successful", {
        identifier: identifier.replace(/@.*/, "@***"), // Hide domain for privacy
        tokenLength: this.accessToken?.length || 0,
      });
    } catch (error) {
      Logger.error("Bluesky authentication failed", error as Error, {
        identifier: identifier.replace(/@.*/, "@***"), // Hide domain for privacy
      });
      throw error;
    }
  }

  /**
   * Ensure the service is authenticated before making API calls
   * @private
   */
  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken) {
      return; // Already authenticated
    }

    if (this.authenticationPromise) {
      await this.authenticationPromise;
      return;
    }

    throw new Error(
      "BlueskyService is not authenticated. Please provide BLUESKY_IDENTIFIER and BLUESKY_PASSWORD, " +
        "or BLUESKY_ACCESS_TOKEN in your environment variables."
    );
  }

  /**
   * Search Bluesky for posts with various options
   */
  search = async (
    options: BlueskySearchOptions
  ): Promise<BlueskySearchResponse> => {
    try {
      // Ensure we're authenticated before making the request
      await this.ensureAuthenticated();

      // Rate limiting: ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        const delay = this.minRequestInterval - timeSinceLastRequest;
        Logger.debug(
          `Rate limiting: waiting ${delay}ms before Bluesky request`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      this.lastRequestTime = Date.now();

      const endpoint = "/xrpc/app.bsky.feed.searchPosts";

      const params = new URLSearchParams({
        q: options.query,
        limit: (options.limit || 25).toString(),
      });

      // Bluesky native parameters
      if (options.sort) params.append("sort", options.sort);
      if (options.since) params.append("since", options.since);
      if (options.until) params.append("until", options.until);
      if (options.mentions) params.append("mentions", options.mentions);
      if (options.author) params.append("author", options.author);
      if (options.lang) params.append("lang", options.lang);
      if (options.domain) params.append("domain", options.domain);
      if (options.url) params.append("url", options.url);
      if (options.tag) {
        options.tag.forEach((t) => params.append("tag", t));
      }
      if (options.cursor) params.append("cursor", options.cursor);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Use authenticated token (we've already ensured we're authenticated)
      if (this.accessToken) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
      }

      Logger.debug("Making Bluesky search request", {
        baseUrl: this.baseUrl,
        endpoint,
        query: options.query,
        sort: options.sort,
        limit: options.limit,
      });

      const response = await fetch(`${this.baseUrl}${endpoint}?${params}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();

        // Special handling for 403 errors
        if (response.status === 403) {
          Logger.warn(
            `Bluesky API returned 403 Forbidden - authentication may have failed or expired`,
            {
              status: response.status,
              query: options.query,
              hasToken: !!this.accessToken,
              suggestion:
                "Check your BLUESKY_IDENTIFIER and BLUESKY_PASSWORD environment variables, or try refreshing authentication",
            }
          );
        }

        Logger.error(
          `Bluesky search failed with status ${response.status}`,
          undefined,
          {
            status: response.status,
            statusText: response.statusText,
            errorText,
            query: options.query,
          }
        );
        throw new Error(
          `HTTP error! status: ${response.status} - ${errorText}`
        );
      }

      const data = (await response.json()) as BlueskySearchResponse;
      Logger.info("Bluesky search completed successfully", {
        query: options.query,
        postsFound: data.posts?.length || 0,
        cursor: data.cursor,
        hitsTotal: data.hitsTotal,
      });

      return data;
    } catch (error) {
      Logger.error("Bluesky search failed", error as Error, {
        query: options.query,
        sort: options.sort,
        baseUrl: this.baseUrl,
      });
      throw error;
    }
  };

  /**
   * Search for the top posts related to a query using Bluesky's native sorting
   * @param query Search query
   * @param options Search options (excluding query and sort)
   * @returns Promise<UnifiedSocialPost[]> Top posts sorted by Bluesky's algorithm
   */
  searchTopPostsByPopularity = async (
    query: string,
    options?: Omit<BlueskySearchOptions, "query" | "sort">
  ): Promise<UnifiedSocialPost[]> => {
    try {
      Logger.info(`Searching for top posts by popularity: "${query}"`);

      // Use Bluesky's native "top" sorting - much more efficient than manual sorting
      const response = await this.search({
        ...options,
        query,
        sort: "top", // Leverage Bluesky's native top sorting
        limit: options?.limit || 25,
      });

      const posts = response.posts || [];

      if (posts.length === 0) {
        Logger.info(`No posts found for query: "${query}"`);
        return [];
      }

      Logger.info(`Found ${posts.length} top posts for query: "${query}"`, {
        totalHits: response.hitsTotal,
        cursor: response.cursor,
        topPostLikes: posts[0]?.likeCount || 0,
        topPostReposts: posts[0]?.repostCount || 0,
      });

      // Transform Bluesky posts to UnifiedSocialPost format
      const unifiedPosts = posts.map((post) =>
        this.transformToUnifiedPost(post)
      );

      return unifiedPosts;
    } catch (error) {
      Logger.error("Failed to search top posts by popularity", error as Error, {
        query,
        baseUrl: this.baseUrl,
      });
      throw error;
    }
  };

  /**
   * Extract hashtags from Bluesky post text
   */
  private extractHashtags = (text: string): string[] => {
    return (text.match(/#\w+/g) || []).map((tag) => tag.substring(1));
  };

  /**
   * Extract mentions from Bluesky post text
   */
  private extractMentions = (text: string): string[] => {
    return (text.match(/@[\w.]+/g) || []).map((mention) =>
      mention.substring(1)
    );
  };

  /**
   * Transform a Bluesky PostView to UnifiedSocialPost format
   */
  private transformToUnifiedPost = (post: PostView): UnifiedSocialPost => {
    const content = post.record.text || "";
    const truncatedContent =
      content.length > 280 ? content.substring(0, 277) + "..." : content;

    // Use the full URI as ID to ensure uniqueness, or fallback to CID
    // Bluesky URIs are unique across the entire network
    const postId = post.uri || post.cid;

    // Extract just the post part for web URL construction
    const postUrlId = post.uri.split("/").pop() || post.cid;
    const webUrl = `https://bsky.app/profile/${post.author.handle}/post/${postUrlId}`;

    Logger.debug("Bluesky post ID extraction", {
      originalUri: post.uri,
      cid: post.cid,
      extractedId: postId,
      urlId: postUrlId,
    });

    return {
      // Core identification
      id: postId,
      url: webUrl,
      platform: "bluesky",

      // Content
      content,
      truncatedContent,
      originalContent: content, // Bluesky doesn't have HTML formatting
      ...(post.record.langs?.[0] && { language: post.record.langs[0] }),

      // Author information
      author: {
        id: post.author.did,
        username: post.author.handle,
        displayName: post.author.displayName || post.author.handle,
        ...(post.author.avatar && { avatar: post.author.avatar }),
        url: `https://bsky.app/profile/${post.author.handle}`,
        ...(post.author.followersCount !== undefined && {
          followerCount: post.author.followersCount,
        }),
        isBot: false, // Bluesky doesn't have explicit bot flags
        isVerified: !!post.author.labels?.some(
          (label) => label.val === "verified"
        ),
      },

      // Timestamps
      createdAt: new Date(post.record.createdAt),
      // Bluesky doesn't support post editing yet - omit editedAt entirely

      // Engagement metrics
      engagement: {
        likes: post.likeCount || 0,
        shares: post.repostCount || 0,
        replies: post.replyCount || 0,
        ...(post.viewCount !== undefined && { views: post.viewCount }),
      },

      // Content metadata
      isReply: !!post.record.reply,
      isRepost: post.reason?.$type === "app.bsky.feed.defs#reasonRepost",
      // Note: Would need additional API call to get original post for reposts

      // Social features
      hashtags: this.extractHashtags(content),
      mentions: this.extractMentions(content),

      // Content flags
      isSensitive: !!post.author.labels?.some((label) =>
        ["sexual", "graphic-media"].includes(label.val)
      ),
      // Bluesky doesn't have spoiler text - omit spoilerText entirely
      visibility: "public", // Bluesky posts are generally public

      // Platform-specific data
      rawData: post,
    };
  };
}
