import { type LLMService } from "./llmService";
import { type SearchService } from "./searchService";

interface AiAnalysisServiceParams {
  llm: LLMService;
  search: SearchService;
}

export class AiAnalysisService {
  private readonly llm: LLMService;
  private readonly search: SearchService;

  constructor({ llm, search }: AiAnalysisServiceParams) {
    this.llm = llm;
    this.search = search;
  }

  // summarize article.
  // analysis 1
  // analysis 2
  // bias check, left, right, neutral.
  // related content

  factCheckArticle = async (content: string) => {
    const prompt = `You are an expert fact-checker tasked with analyzing the following article for accuracy, reliability, and potential misinformation. Conduct a thorough fact-checking analysis following these guidelines:

**FACT-CHECKING METHODOLOGY:**

1. **Identify Factual Claims**: Extract all verifiable factual statements, statistics, quotes, dates, names, and specific claims that can be independently verified.

2. **Source Verification**: For each significant claim, attempt to trace it back to primary sources or authoritative references.

3. **Cross-Reference Analysis**: Compare claims against multiple reliable sources to identify discrepancies or confirmations.

4. **Context Assessment**: Evaluate whether facts are presented accurately within their proper context or if they're misleading through selective presentation.

**REQUIRED OUTPUT STRUCTURE:**

## Fact-Check Summary
[Overall assessment: VERIFIED | PARTIALLY ACCURATE | MISLEADING | FALSE]

## Verified Claims
- [List factual statements that are accurate with confidence level]
- Include supporting evidence and source types where applicable

## Questionable Claims
- [List statements requiring further verification or context]
- Explain why they need additional scrutiny
- Suggest what additional information would be needed

## False or Misleading Information
- [List any inaccurate, outdated, or misleading statements]
- Provide correct information with reliable sources
- Explain the nature of the inaccuracy (factual error, missing context, etc.)

## Missing Context
- [Identify important context that may be missing]
- Explain how this affects the accuracy of the overall narrative

## Source Quality Assessment
- [Evaluate the credibility of sources cited in the article]
- Note any potential bias or reliability concerns

## Recommendations
- [Suggest specific improvements or corrections needed]
- Rate overall reliability on a scale of 1-10 with justification

**IMPORTANT GUIDELINES:**
- Be precise and specific in your analysis
- Distinguish between factual errors and opinion/interpretation
- Note when claims cannot be verified due to insufficient information
- Consider the publication date and whether information may be outdated
- Identify any potential bias or agenda that might affect accuracy
- Use clear, professional language suitable for editorial review

**Article to Fact-Check:**
${content}

Provide your analysis in the structured format above, being thorough but concise. Focus on significant factual claims rather than minor details.`;

    const response = await this.llm.chatWithSearch({
      prompt,
      temperature: 0.1, // Very low temperature for factual accuracy
      max_completion_tokens: 2000, // Allow for comprehensive analysis
    });

    return response;
  };

  summerizeArticle = async (content: string) => {
    const prompt = `You are an expert content analyst. Read the following article carefully and create a comprehensive summary that captures all essential information.

**Instructions:**
- Create a structured summary with clear sections
- Include all key facts, figures, statistics, and important quotes
- Highlight main arguments, findings, and conclusions
- Maintain the original tone and perspective
- Use clear, professional language suitable for informed readers
- Format your response in clean Markdown with appropriate headers

**Required Structure:**
## Executive Summary
[2-3 sentence overview of the main topic and significance]

## Key Points
- [List 4-6 most important points with supporting details]
- [Include specific data, statistics, or quotes where relevant]

## Main Arguments/Findings
[Detailed explanation of central arguments or research findings]

## Conclusions
[Author's conclusions and implications]

## Notable Details
[Any additional important context, background, or implications]

**Article Content:**
${content}

Respond ONLY in the structured Markdown format above. Ensure completeness while maintaining clarity and readability.`;

    const response = await this.llm.chat({
      prompt,
      temperature: 0.3, // Lower temperature for more consistent, factual summaries
    });

    return response;
  };

  tldrArticle = async (content: string) => {
    const prompt = `You are a content analyst specializing in ultra-concise summaries. Read the following article and create a TLDR (Too Long; Didn't Read) that captures the absolute essence in the most efficient way possible.

**Instructions:**
- Maximum 3-4 sentences total
- Focus only on the most crucial information
- Include key numbers, dates, or facts if they're central to the story
- Use clear, direct language that anyone can understand quickly
- No fluff or unnecessary words
- Start with "TLDR:" followed by the summary

**What to prioritize:**
1. The main event, discovery, or announcement
2. Key impact or significance 
3. Most important outcome or consequence
4. Critical timeline if relevant

**Article Content:**
${content}

Respond with ONLY the TLDR summary - nothing else.`;

    const response = await this.llm.chat({
      prompt,
      temperature: 0.2, // Low temperature for consistent, focused output
      max_completion_tokens: 150, // Strict limit to enforce brevity
    });

    return response;
  };

  doNotUse__factCheckArticleWithWebSearch = async (content: string) => {
    // First, extract key claims that need verification
    const claimsExtractionPrompt = `Analyze the following article and extract 3-5 of the most significant factual claims that can be independently verified through web search. For each claim, provide:

1. A concise statement of the claim
2. A search query that would help verify this claim

Format your response as a JSON array with objects containing "claim" and "searchQuery" fields.

Article: ${content}

Return ONLY the JSON array, no additional text.`;

    const claimsResponse = await this.llm.chat({
      prompt: claimsExtractionPrompt,
      temperature: 0.1,
      max_completion_tokens: 500,
    });

    let claims: Array<{ claim: string; searchQuery: string }> = [];
    try {
      claims = JSON.parse(claimsResponse);
    } catch (error) {
      // If JSON parsing fails, fall back to basic fact-checking
      return this.factCheckArticle(content);
    }

    // Search for evidence for each claim
    const searchResults: Array<{ claim: string; evidence: string }> = [];

    for (const claimObj of claims.slice(0, 3)) {
      // Limit to 3 searches to manage API costs
      try {
        const searchResult = await this.search.tavily.search(
          claimObj.searchQuery,
          {
            searchDepth: "basic",
            maxResults: 3,
            includeImages: false,
            includeAnswer: true,
          }
        );

        const evidenceText = searchResult.results
          .map((r) => `Source: ${r.url}\nContent: ${r.content}`)
          .join("\n\n");

        searchResults.push({
          claim: claimObj.claim,
          evidence: evidenceText || "No relevant evidence found",
        });
      } catch (error) {
        searchResults.push({
          claim: claimObj.claim,
          evidence: "Search failed - unable to verify this claim",
        });
      }
    }

    // Now perform comprehensive fact-checking with the search evidence
    const factCheckPrompt = `You are an expert fact-checker. Analyze the following article for accuracy using both your knowledge and the provided web search evidence for key claims.

**ARTICLE TO FACT-CHECK:**
${content}

**WEB SEARCH EVIDENCE FOR KEY CLAIMS:**
${searchResults
  .map(
    (r, i) => `
**Claim ${i + 1}:** ${r.claim}
**Search Evidence:**
${r.evidence}
`
  )
  .join("\n")}

**FACT-CHECKING ANALYSIS:**

Provide a comprehensive fact-check analysis following this structure:

## Overall Assessment
[VERIFIED | PARTIALLY ACCURATE | MISLEADING | FALSE] - Brief justification

## Claim-by-Claim Analysis
For each claim with search evidence:
- **Claim:** [Restate the claim]
- **Verification Status:** [VERIFIED/CONTRADICTED/INCONCLUSIVE]
- **Evidence Summary:** [How the search results support or contradict the claim]
- **Confidence Level:** [High/Medium/Low]

## Additional Factual Issues
[Any other factual problems not covered by the searched claims]

## Source Credibility Assessment
[Evaluate sources cited in the original article]

## Context and Accuracy Notes
[Any missing context or nuances that affect accuracy]

## Final Reliability Score
[1-10 scale with detailed justification based on evidence found]

## Recommendations
[Specific suggestions for corrections or improvements]

Focus on evidence-based analysis. Clearly distinguish between what you verified through search results versus your existing knowledge.`;

    const response = await this.llm.chat({
      prompt: factCheckPrompt,
      temperature: 0.1,
      max_completion_tokens: 2500,
    });

    return response;
  };
}
