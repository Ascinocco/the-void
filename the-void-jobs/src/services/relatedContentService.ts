import { Logger } from "../utils/logger";
import { SearchService, SearchResult } from "./searchService";
import { LLMService } from "./llmService";

export interface RelatedArticle {
  title: string;
  url: string;
  description: string;
  score: number;
}

export interface RelatedContentServiceParams {
  searchService: SearchService;
  llmService: LLMService;
}

export class RelatedContentService {
  private searchService: SearchService;
  private llmService: LLMService;

  constructor({ searchService, llmService }: RelatedContentServiceParams) {
    this.searchService = searchService;
    this.llmService = llmService;
  }

  /**
   * Find 5 related articles using LLM-generated search queries and Tavily search
   * @param articleData The article to find related content for
   * @returns Promise<RelatedArticle[]> Array of related articles (max 5)
   */
  async findRelatedArticles({
    title,
    description,
    topic,
    originalUrl,
  }: {
    title: string;
    description: string;
    topic: string;
    originalUrl: string;
  }): Promise<RelatedArticle[]> {
    try {
      Logger.info(`Finding related articles for: ${title}`);

      // Step 1: Generate search queries using LLM
      const searchQueries = await this.llmService.generateSearchQueries({
        title,
        description,
        topic,
      });

      if (searchQueries.length === 0) {
        Logger.warn(
          "No search queries generated, skipping related content search"
        );
        return [];
      }

      // Step 2: Search for articles using each query
      const allResults: SearchResult[] = [];

      for (const query of searchQueries) {
        try {
          const results = await this.searchService.searchNews(query, 3); // Get 3 results per query
          allResults.push(...results);
        } catch (error) {
          Logger.warn(`Failed to search for query: ${query} ${error}`);
          // Continue with other queries even if one fails
        }
      }

      if (allResults.length === 0) {
        Logger.warn("No search results found from any query");
        return [];
      }

      // Step 3: Filter out duplicates and the original article URL
      const uniqueResults = this.deduplicateResults(allResults, originalUrl);

      // Step 4: Sort by score and take top 5
      const topResults = uniqueResults
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      // Step 5: Convert to RelatedArticle format
      const relatedArticles: RelatedArticle[] = topResults.map((result) => ({
        title: result.title,
        url: result.url,
        description: result.content,
        score: result.score,
      }));

      Logger.info(
        `Found ${relatedArticles.length} related articles for: ${title}`
      );
      return relatedArticles;
    } catch (error) {
      Logger.error(`Failed to find related articles ${error}`);
      throw new Error(
        `Related content search failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Remove duplicate results and filter out the original article URL
   * @param results Array of search results
   * @param originalUrl The original article URL to exclude
   * @returns Deduplicated array of search results
   */
  private deduplicateResults(
    results: SearchResult[],
    originalUrl: string
  ): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];

    for (const result of results) {
      // Skip if it's the original article
      if (result.url === originalUrl) {
        continue;
      }

      // Skip if we've already seen this URL
      if (seen.has(result.url)) {
        continue;
      }

      // Skip if title or URL is too similar to something we've already added
      const isDuplicate = deduplicated.some(
        (existing) =>
          this.isSimilarTitle(result.title, existing.title) ||
          this.isSimilarUrl(result.url, existing.url)
      );

      if (!isDuplicate) {
        seen.add(result.url);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  /**
   * Check if two titles are similar (basic similarity check)
   * @param title1 First title
   * @param title2 Second title
   * @returns boolean indicating if titles are similar
   */
  private isSimilarTitle(title1: string, title2: string): boolean {
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .trim();
    const normalized1 = normalize(title1);
    const normalized2 = normalize(title2);

    // Simple similarity check: if one title contains most words of the other
    const words1 = normalized1.split(/\s+/);
    const words2 = normalized2.split(/\s+/);

    if (words1.length < 3 || words2.length < 3) {
      return normalized1 === normalized2;
    }

    const commonWords = words1.filter(
      (word) => words2.includes(word) && word.length > 3
    );
    const similarity =
      commonWords.length / Math.min(words1.length, words2.length);

    return similarity > 0.7; // 70% similarity threshold
  }

  /**
   * Check if two URLs are similar (same domain or very similar paths)
   * @param url1 First URL
   * @param url2 Second URL
   * @returns boolean indicating if URLs are similar
   */
  private isSimilarUrl(url1: string, url2: string): boolean {
    try {
      const domain1 = new URL(url1).hostname;
      const domain2 = new URL(url2).hostname;

      // Same domain check
      return domain1 === domain2;
    } catch {
      // If URL parsing fails, fall back to string comparison
      return url1 === url2;
    }
  }
}
