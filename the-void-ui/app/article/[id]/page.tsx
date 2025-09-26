"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, Calendar, Tag } from "lucide-react";
import { MarkdownRenderer } from "@/components/markdown-renderer";

// Types for API data
interface SocialMediaPost {
  id: string;
  url: string;
  content: string;
  platform: string;
  created_at: string;
  original_content?: string;
  truncated_content?: string;
}

interface FactCheckReference {
  url: string;
  title: string;
}

interface ArticleData {
  id: number;
  title: string;
  link: string;
  topic: string;
  description: string;
  published_at: string;
  topic_group_id: number;
  tldr: string;
  summary: string;
  fact_check: string;
  related_content: string[];
  fact_check_references: FactCheckReference[];
  topic_groups: {
    topic_group: string;
  };
  article_social_posts: {
    social_media_posts: SocialMediaPost;
  }[];
}

// Mock detailed article data based on the provided structure
const mockArticleDetails = {
  136: {
    id: 136,
    title:
      "Chris Mason: Starmer's irritation with Burnham shows as he seeks to tackle critics",
    link: "https://www.bbc.com/news/articles/cly19zld70qo",
    topic: "Starmer-Burnham Political Tension",
    description:
      "Andy Burnham's recent remarks seem to have narked the prime minister, our political editor writes.",
    published_at: "2025-09-26T05:36:16+00:00",
    topic_group_id: 38,
    tldr: "Labour leader Keir Starmer clashes with Manchester Mayor Andy Burnham while addressing Reform UK's rising influence. Starmer plans to announce compulsory digital ID scheme as a tool against illegal immigration, drawing mixed reactions from other parties. Internal Labour tensions surface as Starmer compares Burnham's economic proposals to Liz Truss's 'disaster.'",
    summary: `## Executive Summary
This article analyzes recent political dynamics within the UK Labour Party, focusing on tensions between Prime Minister Keir Starmer and Manchester Mayor Andy Burnham, alongside Labour's strategy to counter the rising influence of Reform UK. The piece examines how these developments intersect with Starmer's proposed compulsory digital ID scheme and broader political positioning.

## Key Points
- Starmer will address the Global Progressive Action Conference about confronting Reform UK and similar political movements
- Significant tension has emerged between Starmer and Andy Burnham, with Starmer comparing Burnham's economic proposals to Liz Truss's "disaster"
- Labour is introducing a compulsory digital ID scheme as a practical policy measure and political differentiator
- Reform UK's recent rise in popularity has caused concern within the Labour Party
- Multiple opposition parties (Reform UK, Liberal Democrats, SNP) oppose the digital ID plan, while Conservatives remain ambiguous

## Main Arguments/Findings
1. **Political Strategy**
- Labour is actively seeking ways to counter Reform UK's growing influence
- Starmer aims to present a choice between "predatory grievance" politics and "patriotic renewal"

2. **Internal Party Dynamics**
- Significant backlash from Labour MPs against Burnham's public statements
- Clear frustration from Downing Street regarding Burnham's interventions
- Persistent criticism about lack of clear direction in Starmer's leadership

## Conclusions
- The Labour Party is attempting to define itself more clearly through concrete policy proposals like the digital ID scheme
- Internal party tensions reflect broader challenges in positioning against Reform UK
- Starmer is taking a more assertive stance against internal critics, particularly Burnham`,
    fact_check: `## Fact-Check Summary
Overall assessment: PARTIALLY ACCURATE  
The article is largely based on recent political developments and aligns with multiple reliable sources, including BBC's own reporting. It accurately captures tensions within Labour, Starmer's policy announcements, and political context. However, it contains one clear factual error regarding a key figure's identity, and some claims lack full context on policy details, slightly undermining precision without introducing widespread misinformation.

## Verified Claims
- **Starmer will address the Global Progressive Action Conference on Friday (2025-09-26) and argue for centre-left parties to confront public concerns, including a quote about "look[ing] ourselves in the mirror" and recognizing where parties have "sh[ied] away from people's concerns."** (High confidence)  
  Supported by BBC articles and cross-referenced with The Guardian coverage of the conference focusing on "patriotic renewal" versus "predatory grievance."

- **The conference theme involves Labour and global centre-left parties addressing the rise of parties like Reform UK.** (High confidence)  
  Confirmed in BBC and Sky News reports, which discuss Labour's strategy against Reform UK's "insurgency" and equivalents abroad.

- **Recent headlines focused on Andy Burnham's criticisms of Starmer and the government's plans for compulsory digital ID.** (High confidence)  
  Verified via multiple sources, including The Independent, Sky News, and BBC, which report Burnham's leadership ambitions and Starmer's digital ID announcement.

## Areas of Concern
- Some policy details lack complete context
- Minor discrepancies in timeline reporting across sources
- Limited verification of private conversations between political figures`,
    related_content: [
      "https://www.theguardian.com/politics/2025/sep/25/andy-burnham-mps-challenge-starmer-labour-leadership",
      "https://www.telegraph.co.uk/politics/2025/09/25/keir-starmer-andy-burnham-would-inflict-harm-like-liz-truss/",
      "https://www.bbc.com/news/articles/cly19zld70qo",
    ],
    topic_groups: {
      topic_group: "British Politics",
    },
    article_social_posts: [
      {
        social_media_posts: {
          id: "at://did:plc:bgipxd4s574vv4p2hd5mk2kr/app.bsky.feed.post/3lzq5qfivfk2z",
          url: "https://bsky.app/profile/donethat2.bsky.social/post/3lzq5qfivfk2z",
          content:
            "Digital ID cards, is that really all Starmer can come up with? Stop chasing bloody Reform and start to find ideas that get them chasing you. Maybe Andy Burnham would be something fresh that the Labour Party desperately need",
          platform: "bluesky",
          created_at: "2025-09-26T09:29:38.503+00:00",
        },
      },
    ],
  },
};

export default function ArticlePage() {
  const params = useParams();
  const id = params.id as string;
  const articleId = Number.parseInt(id);

  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch article data from API
  const fetchArticleData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`http://localhost:3001/feed/${articleId}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError("Article not found");
          return;
        }
        throw new Error(`Failed to fetch article: ${response.status}`);
      }

      const data = await response.json();
      setArticle(data.data);
    } catch (err) {
      console.error("Error fetching article data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch article data"
      );
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    if (articleId) {
      fetchArticleData();
    }
  }, [articleId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-destructive mb-4">
            <h3 className="text-lg font-semibold">Failed to load article</h3>
            <p className="text-sm">{error || "Article not found"}</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/">Back to News</Link>
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to News
              </Link>
            </Button>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <Badge variant="secondary">
              {article.topic_groups.topic_group}
            </Badge>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {formatDate(article.published_at)}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground leading-tight mb-4">
            {article.title}
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            {article.description}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button asChild variant="outline">
              <a href={article.link} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Original Source
              </a>
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Tag className="h-4 w-4" />
              {article.topic}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* TLDR Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Quick Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground leading-relaxed">{article.tldr}</p>
            </CardContent>
          </Card>

          {/* Main Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Detailed Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownRenderer content={article.summary} />
            </CardContent>
          </Card>

          <Separator />

          {/* Fact Check */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Fact Check</CardTitle>
            </CardHeader>
            <CardContent>
              <MarkdownRenderer content={article.fact_check} />
            </CardContent>
          </Card>

          {/* Fact Check References */}
          {article.fact_check_references &&
            article.fact_check_references.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">
                    Fact Check References
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {article.fact_check_references.map((reference, index) => (
                      <a
                        key={index}
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-foreground hover:underline">
                            {reference.title}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Related Content */}
          {article.related_content && article.related_content.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Related Articles</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {article.related_content.map((url, index) => (
                    <a
                      key={index}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg border border-border hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-foreground hover:underline">
                          {new URL(url).hostname}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Social Media Posts */}
          {article.article_social_posts &&
            article.article_social_posts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">
                    Social Media Discussion
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {article.article_social_posts.map((post, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-lg border border-border"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="text-xs">
                            {post.social_media_posts.platform}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(
                              post.social_media_posts.created_at
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-foreground mb-2">
                          {post.social_media_posts.content}
                        </p>
                        <a
                          href={post.social_media_posts.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View Post
                        </a>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
        </div>
      </main>
    </div>
  );
}
