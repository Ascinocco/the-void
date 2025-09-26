import { type LLMService } from "./llmService";
import { type DataService } from "./dataService";
import { type SearchService } from "./searchService";
import { extractFromXml } from "@extractus/feed-extractor";
import { Logger } from "../utils/logger";

interface ParseFeedsServiceParams {
  llm: LLMService;
  data: DataService;
  search: SearchService;
}

export class RssParsingService {
  private readonly llm: LLMService;
  private readonly data: DataService;
  private readonly search: SearchService;

  constructor({ llm, data, search }: ParseFeedsServiceParams) {
    this.llm = llm;
    this.data = data;
    this.search = search;
  }

  upsertTopicGroup = async (topicGroup: string) => {
    let { data: existingTopicGroup } = await this.data.supabase
      .from("topic_groups")
      .select("id")
      .eq("topic_group", topicGroup)
      .limit(1)
      .single();

    let insertedTopicGroup;
    if (!existingTopicGroup) {
      // If not found, insert new one
      const { data: newTopicGroup, error: insertError } =
        await this.data.supabase
          .from("topic_groups")
          .insert({ topic_group: topicGroup })
          .select("id")
          .single();

      if (insertError) {
        Logger.error("Failed to insert topic group", insertError);
        throw new Error("Failed to insert topic group");
      }
      insertedTopicGroup = newTopicGroup;
    } else {
      insertedTopicGroup = existingTopicGroup;
    }

    return insertedTopicGroup.id;
  };

  assignTopicToArticle = async (params: {
    articleId: number;
    topicName: number;
  }) => {
    const { error: insertError } = await this.data.supabase
      .from("articles")
      .insert({ article_id: params.articleId, topic: params.topicName });

    if (insertError) {
      throw new Error("Failed to associate topic with article");
    }
  };

  isOfInterest = async ({
    topicName,
    title,
    description,
  }: {
    topicName: string;
    title: string;
    description: string;
  }) => {
    const prompt = `Given the following topic, title and description, determine if it is of interest to the user.

    Topic: ${topicName}
    Title: ${title}
    Description: ${description}
  
    Return true if the topic is of interest, false otherwise.
    Return ONLY the boolean value, nothing else.
  
    The user is interested in Global Politics, American Politics, European Politics, Canadian Politics, Global Economy, American Economy, European Economy, Canadian Economy, Housing, Healthcare, Business, Immigration, Technology, Science, Automotive, Finance.
    `;

    const response = await this.llm.chat({
      prompt,
      temperature: 0.1,
    });

    return response === "true";
  };

  generateTopicForArticle = async ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => {
    const prompt = `Given the following article title and description, generate a concise topic that is no more than 4 words, preferring fewer words if it doesn't lose semantic meaning.

    Title: ${title}
    Description: ${description}
    
    Topic requirements:
    - Maximum 4 words
    - Prefer fewer words if semantic meaning is preserved
    - Should capture the main theme/subject
    - Use title case
    - Be specific and descriptive
    - Examples: "Climate Change", "AI Technology", "Economic Policy", "Sports"
    
    Return ONLY the topic, nothing else.`;

    const response = await this.llm.chat({
      prompt,
      max_completion_tokens: 20,
      temperature: 0.5,
    });

    return response;
  };

  generateTopicGroupForArticle = async ({
    topic,
    title,
    description,
  }: {
    topic: string;
    title: string;
    description: string;
  }) => {
    const prompt = `Given the following topic, title and description, generate a concise topic group name that is no more than 2 words. This topic group name will be used to group articles by topic so we want it to be as deterministic as possible.
      Topic: ${topic}
      Title: ${title}
      Description: ${description}

    Topic requirements:
    - Maximum 2 words
    - Should capture the main theme/subject
    - Use title case
    - Be general, we want this to categorize
    - Examples: Global Politics, American Politics, European Politics, Canadian Politics, Global Economy, American Economy, European Economy, Canadian Economy, Housing, Healthcare, Business, Immigration, Technology, Science, Automotive, Finance.

    You do not need to strictly adhere to the example topic groups, but prefer them first.
    Response ONLY with the topic group.
    ONLY RESPOND IN TWO WORDS.
    `;

    const response = await this.llm.chat({
      prompt,
      max_completion_tokens: 20,
      temperature: 0.2,
    });

    const moreThan2WordsReturned = response.split(" ").length > 2;

    if (moreThan2WordsReturned) {
      throw new Error("Responded with more then 2 words");
    }

    return response;
  };

  getFeedData = async (feedUrl: string) => {
    const response = await fetch(feedUrl);
    const xml = await response.text();
    const feed = await extractFromXml(xml);
    return feed;
  };

  articleExists = async (link: string) => {
    const { data } = await this.data.supabase
      .from("articles")
      .select("id, status")
      .eq("link", link)
      .maybeSingle();

    if (data) {
      return data;
    }

    return null;
  };

  extractArticleData = async (link: string) => {
    const { results, failedResults } = await this.search.tavily.extract(
      [link],
      {
        includeImages: false,
        includeFavicon: false,
      }
    );

    if (failedResults[0]?.error) {
      return null;
    }

    return results[0];
  };
}
