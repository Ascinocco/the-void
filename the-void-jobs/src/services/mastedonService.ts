import { Logger } from "../utils/logger";
import { EnvConfig } from "../utils/env";
import {
  type MastodonSearchOptions,
  type MastodonSearchResponse,
  type MastodonServiceParams,
  type Status,
} from "../types/mastedon";

import { UnifiedSocialPost } from "../types/social";

export class MastodonService {
  private readonly defaultInstance: string;
  private readonly defaultAccessToken?: string | undefined;

  constructor({
    defaultInstance,
    defaultAccessToken,
  }: MastodonServiceParams = {}) {
    // Try to get configuration from environment variables
    this.defaultInstance =
      defaultInstance ??
      EnvConfig.get("MASTODON_INSTANCE", "https://mastodon.social");
    this.defaultAccessToken =
      defaultAccessToken ??
      (EnvConfig.get("MASTODON_ACCESS_TOKEN") || undefined);

    // Log initialization
    Logger.info("MastodonService initialized", {
      instance: this.defaultInstance,
      hasToken: !!this.defaultAccessToken,
    });

    if (!this.defaultAccessToken) {
      Logger.warn(
        "MastodonService initialized without authentication - " +
          "search results may be limited. Consider setting MASTODON_ACCESS_TOKEN for better results."
      );
    }
  }

  /**
   * Test Mastodon instance connectivity and search functionality
   * @param query Simple test query
   * @returns Promise<boolean> True if search works
   */
  async testConnectivity(query: string = "hello"): Promise<boolean> {
    try {
      Logger.info(`Testing Mastodon connectivity with query: "${query}"`);

      const response = await this.search({
        query,
        type: "statuses",
        limit: 1,
      });

      Logger.info("Mastodon connectivity test result", {
        success: true,
        statusesFound: response.statuses?.length || 0,
        accountsFound: response.accounts?.length || 0,
        hashtagsFound: response.hashtags?.length || 0,
      });

      return true;
    } catch (error) {
      Logger.error("Mastodon connectivity test failed", error as Error);
      return false;
    }
  }

  /**
   * Search Mastodon instance for accounts, statuses, or hashtags
   */
  search = async (
    options: MastodonSearchOptions
  ): Promise<MastodonSearchResponse> => {
    try {
      const baseUrl = options.instance || this.defaultInstance;
      const endpoint = "/api/v2/search";

      const params = new URLSearchParams({
        q: options.query,
        limit: (options.limit || 20).toString(),
      });

      if (options.type) params.append("type", options.type);
      if (options.resolve) params.append("resolve", "true");
      if (options.offset) params.append("offset", options.offset.toString());

      const headers: Record<string, string> = {};
      const accessToken = options.accessToken || this.defaultAccessToken;
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      Logger.debug("Making Mastodon search request", {
        baseUrl,
        endpoint,
        query: options.query,
        type: options.type,
        limit: options.limit,
        fullUrl: `${baseUrl}${endpoint}?${params}`,
        hasAuth: !!accessToken,
      });

      const response = await fetch(`${baseUrl}${endpoint}?${params}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(
          `Mastodon search failed with status ${response.status}`,
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

      const data = (await response.json()) as MastodonSearchResponse;
      Logger.info("Mastodon search completed successfully", {
        query: options.query,
        accountsFound: data.accounts?.length || 0,
        statusesFound: data.statuses?.length || 0,
        hashtagsFound: data.hashtags?.length || 0,
        responseKeys: Object.keys(data),
        fullResponse: JSON.stringify(data).substring(0, 500) + "...",
      });

      return data;
    } catch (error) {
      Logger.error("Mastodon search failed", error as Error, {
        query: options.query,
        type: options.type,
        instance: options.instance || this.defaultInstance,
      });
      throw error;
    }
  };

  /**
   * Search for the top posts related to a query, sorted by popularity
   * @param query Search query
   * @param options Search options (excluding query and type)
   * @returns Promise<Status[]> Top posts sorted by engagement (favorites + boosts)
   */
  searchTopPostsByPopularity = async (
    query: string,
    options?: Omit<MastodonSearchOptions, "query" | "type">
  ): Promise<UnifiedSocialPost[]> => {
    try {
      Logger.info(`Searching for top posts by popularity: "${query}"`, {
        hasAuth: !!(options?.accessToken || this.defaultAccessToken),
        instance: options?.instance || this.defaultInstance,
      });

      // Search for more posts than needed to have a better selection for sorting
      const searchLimit = Math.min((options?.limit || 10) * 3, 40); // Get 3x the requested amount, max 40

      const response = await this.search({
        ...options,
        query,
        type: "statuses",
        limit: searchLimit,
      });

      const posts = response.statuses || [];

      if (posts.length === 0) {
        Logger.warn(`No Mastodon posts found for query: "${query}"`, {
          searchResponse: {
            accountsFound: response.accounts?.length || 0,
            hashtagsFound: response.hashtags?.length || 0,
            statusesFound: response.statuses?.length || 0,
          },
          searchLimit,
          instance: options?.instance || this.defaultInstance,
        });
        return [];
      }

      // Calculate popularity score (favorites + boosts) and sort
      const sortedPosts = posts
        .map((post) => ({
          ...post,
          popularityScore:
            post.favourites_count + post.reblogs_count + post.replies_count,
        }))
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, options?.limit || 10); // Take only the requested number

      Logger.info(
        `Found ${sortedPosts.length} top posts for query: "${query}"`,
        {
          topScore: sortedPosts[0]?.popularityScore || 0,
          averageScore:
            sortedPosts.length > 0
              ? Math.round(
                  sortedPosts.reduce(
                    (sum, post) => sum + post.popularityScore,
                    0
                  ) / sortedPosts.length
                )
              : 0,
        }
      );

      // Transform Mastodon posts to UnifiedSocialPost format
      const unifiedPosts = sortedPosts.map((post) =>
        this.transformToUnifiedPost(post)
      );

      return unifiedPosts;
    } catch (error) {
      Logger.error("Failed to search top posts by popularity", error as Error, {
        query,
        instance: options?.instance || this.defaultInstance,
      });
      throw error;
    }
  };

  /**
   * Helper method to clean HTML content from status text
   */
  cleanStatusContent = (htmlContent: string): string => {
    return htmlContent.replace(/<[^>]*>/g, "").trim();
  };

  /**
   * Transform a Mastodon Status to UnifiedSocialPost format
   */
  private transformToUnifiedPost = (status: Status): UnifiedSocialPost => {
    const cleanContent = this.cleanStatusContent(status.content || "");
    const truncatedContent =
      cleanContent.length > 280
        ? cleanContent.substring(0, 277) + "..."
        : cleanContent;

    // Extract hashtags from the tags array
    const hashtags = status.tags?.map((tag) => tag.name) || [];

    // Extract mentions from content (simplified approach)
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(cleanContent)) !== null) {
      if (match[1]) {
        mentions.push(match[1]);
      }
    }

    return {
      // Core identification
      id: status.id,
      url: status.url,
      platform: "mastodon",

      // Content
      content: cleanContent,
      truncatedContent,
      originalContent: status.content,
      ...(status.language && { language: status.language }),

      // Author information
      author: {
        id: status.account.id,
        username: status.account.username,
        displayName: status.account.display_name || status.account.username,
        avatar: status.account.avatar,
        url: `https://${
          status.account.acct.includes("@")
            ? status.account.acct.split("@")[1]
            : this.defaultInstance.replace("https://", "")
        }/@${status.account.username}`,
        followerCount: status.account.followers_count,
        isBot: status.account.bot || false,
        isVerified: false, // Mastodon doesn't have verification like Twitter
      },

      // Timestamps
      createdAt: new Date(status.created_at),
      ...(status.edited_at && { editedAt: new Date(status.edited_at) }),

      // Engagement metrics
      engagement: {
        likes: status.favourites_count,
        shares: status.reblogs_count,
        replies: status.replies_count,
      },

      // Content metadata
      isReply: !!status.in_reply_to_id,
      isRepost: !!status.reblog,
      ...(status.reblog && {
        originalPost: this.transformToUnifiedPost(status.reblog),
      }),

      // Social features
      hashtags,
      mentions,

      // Content flags
      isSensitive: status.sensitive || false,
      ...(status.spoiler_text && { spoilerText: status.spoiler_text }),
      visibility:
        status.visibility === "direct"
          ? "private"
          : (status.visibility as
              | "public"
              | "unlisted"
              | "private"
              | "followers"),

      // Platform-specific data
      rawData: status,
    };
  };
}
