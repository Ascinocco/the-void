import { Job } from "../types/job";
import { Logger } from "../utils/logger";
import { type DataService } from "../services/dataService";
import { SocialMediaService } from "../services/socialMediaService";
import { BlueskyService } from "../services/blueskyService";
import { MastodonService } from "../services/mastedonService";
import { SocialMediaPost } from "../types/database";
import { UnifiedSocialPost } from "../types/social";

interface SocialMediaUpdatesJobParams {
  data: DataService;
  socialMedia: SocialMediaService;
  bluesky: BlueskyService;
  mastodon: MastodonService;
}

export class SocialMediaUpdatesJob implements Job {
  public readonly name = "social-media-updates-job";
  public readonly description =
    "Update social media posts or delete if no longer exist";
  // This job is independent of other jobs
  public readonly dependencies?: string[] = undefined;

  private readonly dataService: DataService;
  private readonly socialMediaService: SocialMediaService;
  private readonly blueskyService: BlueskyService;
  private readonly mastodonService: MastodonService;

  constructor({
    data,
    socialMedia,
    bluesky,
    mastodon,
  }: SocialMediaUpdatesJobParams) {
    this.dataService = data;
    this.socialMediaService = socialMedia;
    this.blueskyService = bluesky;
    this.mastodonService = mastodon;
  }

  async execute(): Promise<void> {
    Logger.info("Starting social media updates job");

    try {
      // Get posts that need updating (older than 24 hours)
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

      const { data: postsToUpdate, error } = await this.dataService.supabase
        .from("social_media_posts")
        .select("*")
        .lt("db_updated_at", twentyFourHoursAgo.toISOString())
        .order("db_updated_at", { ascending: true })
        .limit(100); // Process in batches to avoid overwhelming APIs

      if (error) {
        throw new Error(`Failed to fetch posts for update: ${error.message}`);
      }

      if (!postsToUpdate || postsToUpdate.length === 0) {
        Logger.info("No social media posts need updating");
        return;
      }

      Logger.info(`Found ${postsToUpdate.length} posts that need updating`);

      let updatedCount = 0;
      let deletedCount = 0;
      let errorCount = 0;

      for (const post of postsToUpdate) {
        try {
          const updatedPost = await this.updateOrDeletePost(post);

          if (updatedPost === null) {
            // Post was deleted
            deletedCount++;
          } else {
            // Post was updated
            updatedCount++;
          }
        } catch (error) {
          Logger.error(
            `Failed to update post ${post.id}`,
            error instanceof Error ? error : new Error(String(error)),
            { platform: post.platform, url: post.url }
          );
          errorCount++;
        }
      }

      Logger.info("Social media updates job completed", {
        postsProcessed: postsToUpdate.length,
        updated: updatedCount,
        deleted: deletedCount,
        errors: errorCount,
      });
    } catch (error) {
      Logger.error(
        "Social media updates job failed",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Update a single post or delete it if it no longer exists
   * @param post The post to update
   * @returns UnifiedSocialPost if updated, null if deleted
   */
  private async updateOrDeletePost(
    post: SocialMediaPost
  ): Promise<UnifiedSocialPost | null> {
    try {
      let freshPost: UnifiedSocialPost | null = null;

      // Try to fetch fresh data from the platform
      if (post.platform === "bluesky") {
        freshPost = await this.fetchBlueskyPost(post);
      } else if (post.platform === "mastodon") {
        freshPost = await this.fetchMastodonPost(post);
      }

      if (freshPost) {
        // Post still exists, update it with fresh data
        await this.updatePostInDatabase(freshPost);
        Logger.debug(`Updated post ${post.id} from ${post.platform}`);
        return freshPost;
      } else {
        // Post no longer exists, delete it from our database
        await this.deletePostFromDatabase(post.id);
        Logger.info(
          `Deleted non-existent post ${post.id} from ${post.platform}`
        );
        return null;
      }
    } catch (error) {
      // If we can't determine the post status, log error but don't delete
      Logger.warn(`Could not verify post status for ${post.id}`, {
        error: error instanceof Error ? error.message : String(error),
        platform: post.platform,
        url: post.url,
      });
      throw error;
    }
  }

  /**
   * Fetch fresh data for a Bluesky post
   */
  private async fetchBlueskyPost(
    post: SocialMediaPost
  ): Promise<UnifiedSocialPost | null> {
    try {
      // For Bluesky, the post.id should be the AT URI
      // If it's not a URI, we need to construct it or use the stored URI
      let postUri = post.id;

      // If the ID doesn't look like an AT URI, try to use the raw_data to get the URI
      if (!postUri.startsWith("at://")) {
        if (post.raw_data && post.raw_data.uri) {
          postUri = post.raw_data.uri;
        } else {
          Logger.warn(`Bluesky post ${post.id} doesn't have a valid URI`);
          return null;
        }
      }

      // Use the new getPost method to fetch the post directly
      const blueskyPost = await this.blueskyService.getPost(postUri);

      if (!blueskyPost) {
        return null; // Post no longer exists
      }

      // Transform to UnifiedSocialPost (this logic is already in BlueskyService)
      // We need to call the transformation method or duplicate it here
      return this.transformBlueskyPostToUnified(blueskyPost);
    } catch (error) {
      Logger.debug(`Failed to fetch Bluesky post ${post.id}: ${error}`);
      return null;
    }
  }

  /**
   * Fetch fresh data for a Mastodon post
   */
  private async fetchMastodonPost(
    post: SocialMediaPost
  ): Promise<UnifiedSocialPost | null> {
    try {
      // Extract instance from the post URL
      const urlMatch = post.url.match(/https:\/\/([^\/]+)/);
      if (!urlMatch) {
        Logger.warn(`Could not parse Mastodon instance from URL: ${post.url}`);
        return null;
      }

      const instance = `https://${urlMatch[1]}`;

      // Use the new getStatus method to fetch the post directly
      const mastodonStatus = await this.mastodonService.getStatus(
        post.id,
        instance
      );

      if (!mastodonStatus) {
        return null; // Post no longer exists
      }

      // Transform to UnifiedSocialPost using the transformation method
      return this.transformMastodonStatusToUnified(mastodonStatus);
    } catch (error) {
      Logger.debug(`Failed to fetch Mastodon post ${post.id}: ${error}`);
      return null;
    }
  }

  /**
   * Transform Bluesky PostView to UnifiedSocialPost
   * This duplicates logic from BlueskyService since the method is private
   */
  private transformBlueskyPostToUnified(post: any): UnifiedSocialPost {
    const content = post.record.text || "";
    const truncatedContent =
      content.length > 280 ? content.substring(0, 277) + "..." : content;

    // Use the full URI as ID to ensure uniqueness, or fallback to CID
    const postId = post.uri || post.cid;
    const postUrlId = post.uri.split("/").pop() || post.cid;
    const webUrl = `https://bsky.app/profile/${post.author.handle}/post/${postUrlId}`;

    return {
      id: postId,
      url: webUrl,
      platform: "bluesky",
      content,
      truncatedContent,
      originalContent: content,
      ...(post.record.langs?.[0] && { language: post.record.langs[0] }),
      author: {
        id: post.author.did,
        username: post.author.handle,
        displayName: post.author.displayName || post.author.handle,
        ...(post.author.avatar && { avatar: post.author.avatar }),
        url: `https://bsky.app/profile/${post.author.handle}`,
        ...(post.author.followersCount !== undefined && {
          followerCount: post.author.followersCount,
        }),
        isBot: false,
        isVerified: !!post.author.labels?.some(
          (label: any) => label.val === "verified"
        ),
      },
      createdAt: new Date(post.record.createdAt),
      engagement: {
        likes: post.likeCount || 0,
        shares: post.repostCount || 0,
        replies: post.replyCount || 0,
        ...(post.viewCount !== undefined && { views: post.viewCount }),
      },
      isReply: !!post.record.reply,
      isRepost: post.reason?.$type === "app.bsky.feed.defs#reasonRepost",
      hashtags: this.extractHashtagsFromText(content),
      mentions: this.extractMentionsFromText(content),
      isSensitive: !!post.author.labels?.some((label: any) =>
        ["sexual", "graphic-media"].includes(label.val)
      ),
      visibility: "public",
      rawData: post,
    };
  }

  /**
   * Extract hashtags from text content
   */
  private extractHashtagsFromText(text: string): string[] {
    const hashtagRegex = /#(\w+)/g;
    const hashtags: string[] = [];
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
      if (match[1]) {
        hashtags.push(match[1]);
      }
    }
    return hashtags;
  }

  /**
   * Extract mentions from text content
   */
  private extractMentionsFromText(text: string): string[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      if (match[1]) {
        mentions.push(match[1]);
      }
    }
    return mentions;
  }

  /**
   * Transform Mastodon status to UnifiedSocialPost
   * This duplicates logic from MastodonService since the method is private
   */
  private transformMastodonStatusToUnified(status: any): UnifiedSocialPost {
    const cleanContent = this.cleanStatusContent(status.content || "");
    const truncatedContent =
      cleanContent.length > 280
        ? cleanContent.substring(0, 277) + "..."
        : cleanContent;

    const hashtags = status.tags?.map((tag: any) => tag.name) || [];
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(cleanContent)) !== null) {
      if (match[1]) {
        mentions.push(match[1]);
      }
    }

    return {
      id: status.id,
      url: status.url,
      platform: "mastodon",
      content: cleanContent,
      truncatedContent,
      originalContent: status.content,
      ...(status.language && { language: status.language }),
      author: {
        id: status.account.id,
        username: status.account.username,
        displayName: status.account.display_name || status.account.username,
        avatar: status.account.avatar,
        url: status.account.url,
        followerCount: status.account.followers_count,
        isBot: status.account.bot || false,
        isVerified: false,
      },
      createdAt: new Date(status.created_at),
      ...(status.edited_at && { editedAt: new Date(status.edited_at) }),
      engagement: {
        likes: status.favourites_count,
        shares: status.reblogs_count,
        replies: status.replies_count,
      },
      isReply: !!status.in_reply_to_id,
      isRepost: !!status.reblog,
      hashtags,
      mentions,
      isSensitive: status.sensitive || false,
      ...(status.spoiler_text && { spoilerText: status.spoiler_text }),
      visibility: status.visibility || "public",
      rawData: status,
    };
  }

  /**
   * Clean HTML content from Mastodon posts
   */
  private cleanStatusContent(htmlContent: string): string {
    return htmlContent
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  /**
   * Update post in database with fresh data
   */
  private async updatePostInDatabase(post: UnifiedSocialPost): Promise<void> {
    const updateData = {
      content: post.content,
      truncated_content: post.truncatedContent,
      original_content: post.originalContent,
      language: post.language,
      author: post.author,
      edited_at: post.editedAt?.toISOString() || null,
      engagement: post.engagement,
      hashtags: post.hashtags,
      mentions: post.mentions,
      is_sensitive: post.isSensitive,
      spoiler_text: post.spoilerText || null,
      visibility: post.visibility,
      raw_data: post.rawData,
      popularity_score: post.popularityScore,
      db_updated_at: new Date().toISOString(),
    };

    const { error } = await this.dataService.supabase
      .from("social_media_posts")
      .update(updateData)
      .eq("id", post.id);

    if (error) {
      throw new Error(`Failed to update post in database: ${error.message}`);
    }
  }

  /**
   * Delete post from database and clean up relationships
   */
  private async deletePostFromDatabase(postId: string): Promise<void> {
    // First delete relationships
    const { error: relationshipError } = await this.dataService.supabase
      .from("article_social_posts")
      .delete()
      .eq("social_post_id", postId);

    if (relationshipError) {
      Logger.warn(
        `Failed to delete post relationships for ${postId}: ${relationshipError.message}`
      );
    }

    // Then delete the post itself
    const { error: postError } = await this.dataService.supabase
      .from("social_media_posts")
      .delete()
      .eq("id", postId);

    if (postError) {
      throw new Error(
        `Failed to delete post from database: ${postError.message}`
      );
    }
  }
}
