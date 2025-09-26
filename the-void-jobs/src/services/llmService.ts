import OpenAI from "openai";
import { Logger } from "../utils/logger";

interface ChatMessage
  extends Omit<
    OpenAI.ChatCompletionCreateParamsNonStreaming,
    "messages" | "model"
  > {
  prompt: string;
  model?: string;
}

interface LLMServiceParams {
  openai: OpenAI;
  openRouter: OpenAI;
}

export class LLMService {
  public readonly openai: OpenAI;
  public readonly openRouter: OpenAI;

  constructor({ openai, openRouter }: LLMServiceParams) {
    this.openai = openai;
    this.openRouter = openRouter;
  }

  createEmbedding = async (text: string) => {
    const response = await this.openai.embeddings.create({
      model: "text-embedding-3-small", // 1536 dimensions
      input: text.replace(/\n/g, " "),
    });

    const data = response.data[0];

    if (!data) {
      throw new Error("Failed to generate embedding");
    }

    return data.embedding;
  };

  chat = async ({
    prompt,
    model = "anthropic/claude-3.5-sonnet",
    ...rest
  }: ChatMessage) => {
    const response = (await this.openRouter.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      ...rest,
    })) as OpenAI.Chat.Completions.ChatCompletion;

    const data = response?.choices[0];

    if (!data) {
      throw new Error("Failed to create Chat Completion");
    }

    if (!data.message.content) {
      throw new Error("Failed to get chat content");
    }

    return data.message.content.trim();
  };

  chatWithSearch = async ({
    prompt,
    model = "x-ai/grok-4:online",
    ...rest
  }: ChatMessage) => {
    const response = (await this.openRouter.chat.completions.create({
      model,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      // @ts-ignore
      extra_body: {
        plugins: [{ id: "web" }],
        return_citations: true,
      },
      ...rest,
    })) as OpenAI.Chat.Completions.ChatCompletion;

    const data = response.choices[0];

    if (!data) {
      throw new Error("Failed to create Chat Completion");
    }

    if (!data.message.content) {
      throw new Error("Failed to get chat content");
    }

    const content = data.message.content.trim();
    const annotations = data.message.annotations;

    if (!annotations || annotations.length === 0) {
      return {
        content,
      };
    }

    const searchResults: Array<{ url: string; title: string }> = [];

    for (const annotation of annotations) {
      try {
        if (annotation.type !== "url_citation") continue;

        const title = annotation.url_citation.title;
        const url = annotation.url_citation.url;

        searchResults.push({
          title,
          url,
        });
      } catch (error) {
        Logger.error("Failed to parse tool calls");
        throw error;
      }
    }

    return {
      content,
      searchResults,
    };
  };

  /**
   * Generate optimized search queries for finding related articles
   * @param title Article title
   * @param description Article description
   * @param topic Article topic
   * @returns Promise<string[]> Array of search queries
   */
  generateSearchQueries = async ({
    title,
    description,
    topic,
  }: {
    title: string;
    description: string;
    topic: string;
  }): Promise<string[]> => {
    const prompt = `Given this article information, generate 3 optimized search queries that would help find related and relevant articles on the web. The queries should be diverse, specific enough to find quality content, but broad enough to return results.

Article Title: ${title}
Article Description: ${description}
Article Topic: ${topic}

Guidelines:
- Focus on the core concepts and themes
- Include different angles and perspectives
- Use keywords that would appear in related articles
- Avoid overly specific details that might limit results
- Each query should be 3-8 words

Return ONLY the search queries, one per line, without numbers or bullet points.`;

    try {
      const response = await this.chat({
        prompt,
        temperature: 0.7,
      });

      const queries = response
        .split("\n")
        .map((q) => q.trim())
        .filter((q) => q.length > 0)
        .slice(0, 3); // Ensure we get exactly 3 queries

      Logger.info(
        `Generated ${queries.length} search queries for article: ${title}`
      );
      return queries;
    } catch (error) {
      Logger.error(
        "Failed to generate search queries",
        error instanceof Error ? error : new Error(String(error))
      );
      throw new Error(
        `Search query generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };

  /**
   * Generate optimized search query for social media platforms
   * @param content Large text content to analyze
   * @returns Promise<string> Single optimized query for social media search
   */
  generateSocialMediaQuery = async (content: string): Promise<string> => {
    const prompt = `You are an expert at analyzing content and creating optimized search queries for social media platforms (Twitter, Mastodon, Bluesky, etc.).

Given the following large text content, extract the key themes, topics, and concepts, then create ONE optimized search query that would help find related social media posts and discussions.

Content to analyze:
${content}

Guidelines for the social media search query:
- Focus on the most important 2-4 keywords or phrases
- Use terms that people would naturally discuss on social media
- Include hashtag-worthy concepts (but don't include the # symbol)
- Prioritize trending topics, controversial aspects, or discussion-worthy elements
- Keep it concise (3-8 words maximum)
- Use language that would appear in social media conversations
- Consider current events, public figures, or viral topics mentioned
- Avoid overly technical jargon unless it's a tech-focused topic

Return ONLY the search query, nothing else. No explanations, quotes, or additional text.`;

    try {
      const response = await this.chat({
        prompt,
        temperature: 0.4, // Balanced creativity for social media relevance
        max_tokens: 50, // Keep response short
      });

      const query = response.trim().replace(/^["']|["']$/g, ""); // Remove any quotes

      Logger.info(
        `Generated social media search query: "${query}" from content of ${content.length} characters`
      );
      return query;
    } catch (error) {
      Logger.error(
        "Failed to generate social media search query",
        error instanceof Error ? error : new Error(String(error))
      );
      throw new Error(
        `Social media query generation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  };
}
