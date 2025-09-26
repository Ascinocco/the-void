import { tavily } from "@tavily/core";
import { Logger } from "../utils/logger";
import { EnvConfig } from "../utils/env";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilyServiceParams {
  apiKey?: string;
}

// @TODO: Tony - remove tavily from data service
export class TavilyService {
  private client: ReturnType<typeof tavily>;

  constructor({ apiKey }: TavilyServiceParams = {}) {
    const key = apiKey || EnvConfig.getRequired("TAVILY_API_KEY");
    this.client = tavily({ apiKey: key });
  }

  /**
   * Search for web content related to a query
   * @param query The search query
   * @param maxResults Maximum number of results to return (default: 5)
   * @returns Promise<SearchResult[]>
   */
  async search(query: string, maxResults: number = 5): Promise<SearchResult[]> {
    try {
      Logger.info(`Searching Tavily for: ${query}`);

      const response = await this.client.search(query, {
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      });

      const results: SearchResult[] = response.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
      }));

      Logger.info(`Found ${results.length} search results`);
      return results;
    } catch (error) {
      Logger.error(`Failed to search with Tavily ${error}`);
      throw new Error(
        `Tavily search failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Search for articles related to a specific topic with news focus
   * @param query The search query
   * @param maxResults Maximum number of results to return (default: 5)
   * @returns Promise<SearchResult[]>
   */
  async searchNews(
    query: string,
    maxResults: number = 5
  ): Promise<SearchResult[]> {
    try {
      Logger.info(`Searching Tavily news for: ${query}`);

      const response = await this.client.search(query, {
        max_results: maxResults,
        search_depth: "basic",
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        days: 30, // Search within last 30 days for recent news
      });

      const results: SearchResult[] = response.results.map((result) => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
      }));

      Logger.info(`Found ${results.length} news results`);
      return results;
    } catch (error) {
      Logger.error(`Failed to search news with Tavily ${error}`);
      throw new Error(
        `Tavily news search failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
