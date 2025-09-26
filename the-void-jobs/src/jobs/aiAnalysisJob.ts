import { AiAnalysisService } from "../services/aiAnalysisService";
import { SearchService } from "../services/searchService";
import { Job } from "../types/job";
import { type LLMService } from "../services/llmService";
import { type DataService } from "../services/dataService";
import { AnalysisStatus } from "../lib/constants";
import { Article } from "../types/database";
import { Logger } from "../utils/logger";

interface AiAnalysisJobParams {
  llm: LLMService;
  data: DataService;
  search: SearchService;
}

export class AiAnalysisJob implements Job {
  public readonly name = "ai-analysis-job";
  public readonly description = "Analyze RSS feeds";
  public readonly dependencies?: string[] = ["parse-feeds-job"];
  private readonly aiAnalysisService: AiAnalysisService;
  private readonly dataService: DataService;
  private readonly llmService: LLMService;

  constructor({ llm, data, search }: AiAnalysisJobParams) {
    this.dataService = data;
    this.llmService = llm;

    this.aiAnalysisService = new AiAnalysisService({
      llm,
      search,
    });
  }

  async execute(): Promise<void> {
    Logger.info("Starting AI analysis job");
    try {
      // fetch all articles with the status "ready_for_ai_analysis"
      const { data: articlesResponse, error } = await this.dataService.supabase
        .from("articles")
        .select("*")
        .eq("status", AnalysisStatus.ReadyForAiAnalysis);

      if (error) {
        throw new Error(`Failed to fetch articles: ${error.message}`);
      }

      const articles: Array<Article> = articlesResponse;

      for (const article of articles) {
        if (!article.original_content) {
          Logger.error("Original Article Content Missing.");
          continue;
        }

        const summary = await this.aiAnalysisService.summerizeArticle(
          article.original_content
        );

        const factCheck = await this.aiAnalysisService.factCheckArticle(
          article.original_content
        );

        const tldr = await this.aiAnalysisService.tldrArticle(
          article.original_content
        );

        const allContent = `Summary: ${summary}. Fact Check: ${factCheck.content}. tldr: ${tldr}`;

        const embedding = await this.llmService.createEmbedding(allContent);

        // Update the article with AI analysis results
        const { error: updateError } = await this.dataService.supabase
          .from("articles")
          .update({
            summary,
            fact_check: factCheck.content,
            tldr,
            embedding,
            status: AnalysisStatus.ReadyForSocialMedia,
            original_content: "",
            fact_check_references: factCheck?.searchResults || [],
          })
          .eq("id", article.id);

        if (updateError) {
          Logger.error(
            `Failed to update article ${article.id}: ${updateError.message}`
          );
          continue;
        }

        Logger.info(
          `Successfully analyzed article ${article.id}: ${article.title}`
        );
      }

      // Process articles here
    } catch (error) {
      Logger.error("Ai Analysis Job Failed");
      console.error("Error---------", error);
    }
  }
}
