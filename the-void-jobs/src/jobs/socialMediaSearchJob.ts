import { Job } from "../types/job";
import { Logger } from "../utils/logger";
import { AnalysisStatus } from "../lib/constants";
import { type LLMService } from "../services/llmService";
import { type DataService } from "../services/dataService";
import { SocialMediaService } from "../services/socialMediaService";
import { Article } from "../types/database";

interface SocialMediaSearchJobParams {
  llm: LLMService;
  data: DataService;
  socialMedia: SocialMediaService;
}

export class SocialMediaSearchJob implements Job {
  public readonly name = "social-media-search-job";
  public readonly description =
    "Search for social media posts related to the article";
  public readonly dependencies?: string[] = ["ai-analysis-job"];
  private readonly dataService: DataService;
  private readonly socialMediaService: SocialMediaService;

  constructor({ llm, data, socialMedia }: SocialMediaSearchJobParams) {
    this.dataService = data;
    this.socialMediaService = socialMedia;
  }

  async execute(): Promise<void> {
    Logger.info("Starting social media search job");

    try {
      const { data: articlesResponse, error: articlesResponseError } =
        await this.dataService.supabase
          .from("articles")
          .select("*")
          .eq("status", AnalysisStatus.ReadyForSocialMedia);

      if (articlesResponseError) {
        throw new Error("Failed to fetch articles");
      }

      const articles: Array<Article> = articlesResponse;

      for (const article of articles) {
        if (
          !article.summary ||
          !article.topic ||
          !article.title ||
          !article.description
        ) {
          Logger.error(
            "Article missing summary or topic or title or description",
            new Error("Missing required article fields")
          );
          continue;
        }

        const queryContent = `
        - Topic: ${article.topic}
        - Title: ${article.title}
        - Description: ${article.description}
        - Summary: ${article.summary}
        `;

        const socialMediaSearchResults =
          await this.socialMediaService.searchForRelatedSocialMediaPosts(
            queryContent
          );

        await this.socialMediaService.savePostsAndLinkToArticle(
          socialMediaSearchResults.posts,
          article.id
        );
      }
      Logger.info("Successfully completed social media search job");
    } catch (error) {
      Logger.error(
        "Social media search job failed",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}
