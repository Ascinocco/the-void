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

    if (!this.defaultAccessToken) {
      Logger.warn(
        "MastodonService initialized without authentication - " +
          "search results may be limited. Consider setting MASTODON_ACCESS_TOKEN for better results."
      );
    }
  }

  /**
   * Get a specific status (post) by its ID
   * @param statusId The status ID to fetch
   * @param instance The Mastodon instance URL (optional, uses default if not provided)
   * @param accessToken Access token for authentication (optional, uses default if not provided)
   * @returns Promise<Status | null> The status or null if not found
   */
  getStatus = async (
    statusId: string,
    instance?: string,
    accessToken?: string
  ): Promise<Status | null> => {
    try {
      const baseUrl = instance || this.defaultInstance;
      const token = accessToken || this.defaultAccessToken;
      const endpoint = `/api/v1/statuses/${statusId}`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      Logger.debug("Making Mastodon getStatus request", {
        baseUrl,
        endpoint,
        statusId,
        hasToken: !!token,
      });

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: "GET",
        headers,
      });

      if (response.status === 404) {
        // Status not found (deleted or never existed)
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        Logger.error(
          `Mastodon getStatus API error: ${response.status} - ${errorText}`,
          undefined,
          {
            status: response.status,
            statusId,
            instance: baseUrl,
          }
        );
        throw new Error(
          `Mastodon API error: ${response.status} - ${errorText}`
        );
      }

      const status = (await response.json()) as Status;
      return status;
    } catch (error) {
      Logger.debug(`Failed to fetch Mastodon status ${statusId}: ${error}`);
      return null;
    }
  };

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
