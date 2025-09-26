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

// @TODO: Tony - remove tavily from data service
export class SearchService {
  public readonly tavily: ReturnType<typeof tavily>;

  constructor() {
    this.tavily = tavily({ apiKey: EnvConfig.getRequired("TAVILY_API_KEY") });
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

      const response = await this.tavily.search(query, {
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
      // Validate and truncate query to stay within Tavily's 400 character limit
      const maxQueryLength = 400;
      let sanitizedQuery = query.trim();

      if (sanitizedQuery.length === 0) {
        throw new Error("Search query cannot be empty");
      }

      if (sanitizedQuery.length > maxQueryLength) {
        Logger.warn(
          `Query too long (${sanitizedQuery.length} chars), truncating to ${maxQueryLength} chars`
        );
        sanitizedQuery = sanitizedQuery.substring(0, maxQueryLength).trim();

        // Try to cut at a word boundary if possible
        const lastSpaceIndex = sanitizedQuery.lastIndexOf(" ");
        if (lastSpaceIndex > maxQueryLength * 0.8) {
          // Only cut at word boundary if we don't lose too much
          sanitizedQuery = sanitizedQuery.substring(0, lastSpaceIndex).trim();
        }
      }

      Logger.info(`Searching Tavily news for: ${sanitizedQuery}`);

      const response = await this.tavily.search(sanitizedQuery, {
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
