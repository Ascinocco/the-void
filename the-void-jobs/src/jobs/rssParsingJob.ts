import { Job } from "../types/job";
import { Logger } from "../utils/logger";
import { AnalysisStatus, RSS_FEEDS } from "../lib/constants";
import { type LLMService } from "../services/llmService";
import { type DataService } from "../services/dataService";
import { RssParsingService } from "../services/rssParsingService";
import { SearchService } from "../services/searchService";
import { RelatedContentService } from "../services/relatedContentService";
import { FeedData } from "@extractus/feed-extractor";

interface ParseFeedsJobParams {
  llm: LLMService;
  data: DataService;
  search: SearchService;
}

export class RssParsingJob implements Job {
  public readonly name = "parse-feeds-job";
  public readonly description = "Parse rss feeds";
  private readonly rssFeeds = RSS_FEEDS;
  private readonly rssParsingService: RssParsingService;
  private readonly dataService: DataService;
  private readonly relatedContentService: RelatedContentService;

  constructor({ llm, data, search }: ParseFeedsJobParams) {
    this.dataService = data;

    this.rssParsingService = new RssParsingService({
      llm,
      data,
      search,
    });

    this.relatedContentService = new RelatedContentService({
      searchService: search,
      llmService: llm,
    });
  }

  async execute(): Promise<void> {
    Logger.info("Starting parse feeds job");

    try {
      for (const feedUrl of this.rssFeeds) {
        let feed: FeedData | undefined = undefined;

        try {
          feed = await this.rssParsingService.getFeedData(feedUrl);
        } catch (error) {
          Logger.error("Failed to parse feed");
          console.error("ERROR: ", error);
        }

        if (!feed || !feed.entries) continue;

        for (const item of feed.entries) {
          try {
            if (!item.link || !item.title || !item.description) continue;

            const existingArticle = await this.rssParsingService.articleExists(
              item.link
            );
            if (
              existingArticle &&
              existingArticle.status !== AnalysisStatus.NotStarted
            )
              continue;

            const topicName =
              await this.rssParsingService.generateTopicForArticle({
                title: item.title,
                description: item.description,
              });

            const isOfInterest = await this.rssParsingService.isOfInterest({
              topicName,
              title: item.title,
              description: item.description,
            });

            if (!isOfInterest) continue;

            const scrappedArticleData =
              await this.rssParsingService.extractArticleData(item.link);

            if (!scrappedArticleData) continue;

            const topicGroup =
              await this.rssParsingService.generateTopicGroupForArticle({
                topic: topicName,
                title: item.title,
                description: item.description,
              });

            // Find existing topic group or create new one
            const topicGroupId = await this.rssParsingService.upsertTopicGroup(
              topicGroup
            );

            // Find 5 related URLs to our article using Tavily search
            let relatedUrls: string[] = [];
            try {
              const relatedArticles =
                await this.relatedContentService.findRelatedArticles({
                  title: item.title,
                  description: item.description,
                  topic: topicName,
                  originalUrl: item.link,
                });

              relatedUrls = relatedArticles.map((article) => article.url);
              Logger.info(
                `Found ${relatedUrls.length} related URLs for article: ${item.title}`
              );
            } catch (error) {
              Logger.warn(
                `Failed to find related content for article: ${item.title}`,
                {
                  error: error instanceof Error ? error.message : String(error),
                }
              );
              // Continue with article creation even if related content search fails
            }

            const res = await this.dataService.supabase.from("articles").upsert(
              {
                title: item.title,
                description: item.description,
                link: item.link,
                topic: topicName,
                topic_group_id: topicGroupId,
                published_at: item.published
                  ? new Date(item.published).toISOString()
                  : new Date().toISOString(),
                updated_at: new Date().toISOString(),
                original_content: scrappedArticleData.rawContent,
                related_content: relatedUrls.length > 0 ? relatedUrls : null,
                status: AnalysisStatus.ReadyForAiAnalysis,
              },
              {
                onConflict: "link", // Specify that conflicts should be resolved based on the link field
              }
            );

            if (res.error) {
              Logger.error("Failed to upsert article");
              console.log("RES ERROR", res.error);
              throw new Error("Failed to save article");
            } else {
              Logger.info(`Successfully upserted article: ${item.title}`);
            }
          } catch (error) {
            console.error(error);
          }
        }
      }

      Logger.info("Completed parse feeds job");
    } catch (error) {
      Logger.error(
        "Parse feeds job failed",
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }
}
