import { Logger } from "../utils/logger";
import { BlueskyService } from "./blueskyService";
import { MastodonService } from "./mastedonService";
import { LLMService } from "./llmService";
import { DataService } from "./dataService";
import { SocialMediaSearchResult, UnifiedSocialPost } from "../types/social";
import {
  CreateSocialMediaPost,
  CreateArticleSocialPost,
} from "../types/database";
import { AnalysisStatus } from "../lib/constants";

interface SocialMediaServiceParams {
  llm: LLMService;
  data: DataService;
}

export class SocialMediaService {
  private readonly llm: LLMService;
  private readonly dataService: DataService;
  private readonly blueskyService: BlueskyService;
  private readonly mastodonService: MastodonService;

  constructor({ llm, data }: SocialMediaServiceParams) {
    this.llm = llm;
    this.dataService = data;
    this.blueskyService = new BlueskyService();
    this.mastodonService = new MastodonService();
  }

  /**
   * Search for related social media posts using AI-optimized queries
   * @param content Large text content to analyze and search for
   * @param options Optional configuration for the search
   * @returns Promise<SocialMediaSearchResult> Results from both platforms
   */
  searchForRelatedSocialMediaPosts = async (
    content: string,
    options?: {
      postsPerPlatform?: number; // Default: 10
      blueskyOptions?: any; // Platform-specific options
      mastodonOptions?: any; // Platform-specific options
    }
  ): Promise<SocialMediaSearchResult> => {
    const startTime = Date.now();
    const postsPerPlatform = options?.postsPerPlatform || 10;

    try {
      Logger.info(
        `Starting social media search for content of ${content.length} characters`
      );

      // Step 1: Use AI to generate optimized search query
      const searchQuery = await this.llm.generateSocialMediaQuery(content);

      if (!searchQuery || searchQuery.trim().length === 0) {
        throw new Error("Failed to generate search query from content");
      }

      Logger.info(`Generated search query: "${searchQuery}"`);

      // Step 2: Search both platforms in parallel for efficiency
      const [blueskyPosts, mastodonPosts] = await Promise.allSettled([
        this.searchBluesky(
          searchQuery,
          postsPerPlatform,
          options?.blueskyOptions
        ),
        this.searchMastodon(
          searchQuery,
          postsPerPlatform,
          options?.mastodonOptions
        ),
      ]);

      // Step 3: Process results and handle any failures gracefully
      const blueskyResults =
        blueskyPosts.status === "fulfilled" ? blueskyPosts.value : [];
      const mastodonResults =
        mastodonPosts.status === "fulfilled" ? mastodonPosts.value : [];

      // Log any failures but don't fail the entire operation
      if (blueskyPosts.status === "rejected") {
        Logger.error("Bluesky search failed", blueskyPosts.reason);
      }
      if (mastodonPosts.status === "rejected") {
        Logger.error("Mastodon search failed", mastodonPosts.reason);
      }

      const result: SocialMediaSearchResult = {
        query: searchQuery,
        posts: [...blueskyResults, ...mastodonResults].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ),
        totalPosts: blueskyResults.length + mastodonResults.length,
        generatedAt: new Date(),
      };

      const duration = Date.now() - startTime;
      Logger.info(`Social media search completed in ${duration}ms`, {
        query: searchQuery,
        blueskyResults: blueskyResults.length,
        mastodonResults: mastodonResults.length,
        totalResults: result.totalPosts,
        duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error("Social media search failed", error as Error, {
        contentLength: content.length,
        duration,
      });
      throw error;
    }
  };

  /**
   * Search Bluesky for posts related to the query
   * @private
   */
  private searchBluesky = async (
    query: string,
    limit: number,
    options?: any
  ): Promise<UnifiedSocialPost[]> => {
    try {
      return await this.blueskyService.searchTopPostsByPopularity(query, {
        limit,
        ...options,
      });
    } catch (error) {
      Logger.error("Bluesky search failed", error as Error, { query, limit });
      throw new Error(
        `Bluesky search failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  /**
   * Search Mastodon for posts related to the query
   * @private
   */
  private searchMastodon = async (
    query: string,
    limit: number,
    options?: any
  ): Promise<UnifiedSocialPost[]> => {
    try {
      return await this.mastodonService.searchTopPostsByPopularity(query, {
        limit,
        ...options,
      });
    } catch (error) {
      Logger.error("Mastodon search failed", error as Error, { query, limit });
      throw new Error(
        `Mastodon search failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  /**
   * Transform a UnifiedSocialPost to database format for insertion
   * @param post - The unified social post to transform
   * @returns CreateSocialMediaPost - Database-ready format
   */
  private transformPostForDatabase = (
    post: UnifiedSocialPost
  ): CreateSocialMediaPost => {
    return {
      id: post.id,
      url: post.url,
      platform: post.platform,
      content: post.content,
      truncated_content: post.truncatedContent,
      original_content: post.originalContent || null,
      language: post.language || null,
      author: post.author,
      created_at: post.createdAt.toISOString(),
      edited_at: post.editedAt?.toISOString() || null,
      engagement: post.engagement,
      is_reply: post.isReply,
      is_repost: post.isRepost,
      original_post_id: post.originalPost?.id || null,
      hashtags: post.hashtags,
      mentions: post.mentions,
      is_sensitive: post.isSensitive,
      spoiler_text: post.spoilerText || null,
      visibility: post.visibility,
      raw_data: post.rawData || null,
      popularity_score: post.popularityScore || null,
    };
  };

  /**
   * Save social media posts to the database
   * @param posts - Array of unified social posts to save
   * @returns Promise<void>
   */
  saveSocialPostsToDatabase = async (
    posts: UnifiedSocialPost[]
  ): Promise<void> => {
    if (posts.length === 0) {
      Logger.info("No posts to save to database");
      return;
    }

    try {
      Logger.info(`Saving ${posts.length} social media posts to database`);

      // Transform posts to database format
      const dbPosts: CreateSocialMediaPost[] = posts.map((post) =>
        this.transformPostForDatabase(post)
      );

      // Log the IDs being saved for debugging
      const postIds = dbPosts.map((post) => ({
        id: post.id,
        platform: post.platform,
        idLength: post.id.length,
      }));

      Logger.debug("Social media post IDs being saved", {
        totalPosts: dbPosts.length,
        blueskyPosts: postIds.filter((p) => p.platform === "bluesky").length,
        mastodonPosts: postIds.filter((p) => p.platform === "mastodon").length,
        sampleIds: postIds.slice(0, 3), // Log first 3 IDs as samples
      });

      // Insert posts using upsert to handle duplicates
      // ignoreDuplicates: false means we UPDATE existing posts with fresh data
      // This is good for updating engagement metrics (likes, shares, etc.)
      const { error } = await this.dataService.supabase
        .from("social_media_posts")
        .upsert(dbPosts, {
          onConflict: "id",
          ignoreDuplicates: false, // UPDATE duplicates with fresh engagement data
        });

      if (error) {
        throw new Error(`Failed to save social media posts: ${error.message}`);
      }

      Logger.info(
        `Successfully saved ${posts.length} social media posts to database`
      );
    } catch (error) {
      Logger.error(
        "Failed to save social media posts to database",
        error as Error,
        {
          postsCount: posts.length,
        }
      );
      throw error;
    }
  };

  /**
   * Link social media posts to an article
   * @param articleId - The article ID to link posts to
   * @param postIds - Array of social media post IDs to link
   * @returns Promise<void>
   */
  linkPostsToArticle = async (
    articleId: number,
    postIds: string[]
  ): Promise<void> => {
    if (postIds.length === 0) {
      Logger.info("No posts to link to article");
      return;
    }

    try {
      Logger.info(
        `Linking ${postIds.length} social media posts to article ${articleId}`
      );

      // Create junction table entries
      const articleSocialPosts: CreateArticleSocialPost[] = postIds.map(
        (postId) => ({
          article_id: articleId,
          social_post_id: postId,
        })
      );

      // Insert relationships using upsert to handle duplicates
      const { error } = await this.dataService.supabase
        .from("article_social_posts")
        .upsert(articleSocialPosts, {
          onConflict: "article_id,social_post_id",
          ignoreDuplicates: true,
        });

      if (error) {
        throw new Error(`Failed to link posts to article: ${error.message}`);
      }

      Logger.info(
        `Successfully linked ${postIds.length} posts to article ${articleId}`
      );
    } catch (error) {
      Logger.error("Failed to link posts to article", error as Error, {
        articleId,
        postsCount: postIds.length,
      });
      throw error;
    }
  };

  /**
   * Save social media posts and link them to an article in one operation
   * @param posts - Array of unified social posts to save
   * @param articleId - The article ID to link posts to
   * @returns Promise<void>
   */
  savePostsAndLinkToArticle = async (
    posts: UnifiedSocialPost[],
    articleId: number
  ): Promise<void> => {
    if (posts.length === 0) {
      Logger.info("No posts to save and link");
      return;
    }

    try {
      Logger.info(
        `Saving and linking ${posts.length} posts to article ${articleId}`
      );

      // First save the posts
      await this.saveSocialPostsToDatabase(posts);

      // Then link them to the article
      const postIds = posts.map((post) => post.id);
      await this.linkPostsToArticle(articleId, postIds);

      // Update article status to complete
      const { error: updateError } = await this.dataService.supabase
        .from("articles")
        .update({
          status: AnalysisStatus.Complete,
          updated_at: new Date().toISOString(),
        })
        .eq("id", articleId);

      if (updateError) {
        throw new Error(
          `Failed to update article status: ${updateError.message}`
        );
      }

      Logger.info(
        `Successfully saved and linked ${posts.length} posts to article ${articleId} and updated status to complete`
      );
    } catch (error) {
      Logger.error("Failed to save and link posts to article", error as Error, {
        articleId,
        postsCount: posts.length,
      });
      throw error;
    }
  };

  /**
   * Get social media posts linked to an article
   * @param articleId - The article ID to get linked posts for
   * @returns Promise<UnifiedSocialPost[]> - Array of linked posts
   */
  getPostsForArticle = async (
    articleId: number
  ): Promise<UnifiedSocialPost[]> => {
    try {
      Logger.info(`Getting social media posts for article ${articleId}`);

      const { data, error } = await this.dataService.supabase
        .from("article_social_posts")
        .select(
          `
          social_post_id,
          social_media_posts!inner(*)
        `
        )
        .eq("article_id", articleId);

      if (error) {
        throw new Error(`Failed to get posts for article: ${error.message}`);
      }

      if (!data || data.length === 0) {
        Logger.info(`No social media posts found for article ${articleId}`);
        return [];
      }

      // Transform database records back to UnifiedSocialPost format
      const posts: UnifiedSocialPost[] = data.map((record: any) => {
        const post = record.social_media_posts;
        return {
          id: post.id,
          url: post.url,
          platform: post.platform,
          content: post.content,
          truncatedContent: post.truncated_content,
          originalContent: post.original_content,
          language: post.language,
          author: post.author,
          createdAt: new Date(post.created_at),
          ...(post.edited_at && { editedAt: new Date(post.edited_at) }),
          engagement: post.engagement,
          isReply: post.is_reply,
          isRepost: post.is_repost,
          hashtags: post.hashtags,
          mentions: post.mentions,
          isSensitive: post.is_sensitive,
          ...(post.spoiler_text && { spoilerText: post.spoiler_text }),
          visibility: post.visibility,
          ...(post.raw_data && { rawData: post.raw_data }),
          ...(post.popularity_score && {
            popularityScore: post.popularity_score,
          }),
        };
      });

      Logger.info(
        `Found ${posts.length} social media posts for article ${articleId}`
      );
      return posts;
    } catch (error) {
      Logger.error("Failed to get posts for article", error as Error, {
        articleId,
      });
      throw error;
    }
  };
}
