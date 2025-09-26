"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NewsFilter } from "@/components/news-filter";
import { Pagination } from "@/components/pagination";

// Types for API data
interface NewsArticle {
  id: number;
  title: string;
  link: string;
  topic: string;
  description: string;
  published_at: string;
  topic_group_id: number;
  tldr: string;
  topic_groups: {
    topic_group: string;
  };
}

interface NewsData {
  data: NewsArticle[];
  pagination: {
    page: number;
    hasMore: boolean;
    totalItems: number;
  };
}

// Mock data based on the provided structure (fallback)
const mockNewsData = {
  data: [
    {
      id: 153,
      title:
        "'I've got to get out of here': Antisocial acts leave locals living in fear",
      link: "https://www.bbc.com/news/videos/c0jqv18yd5eo",
      topic: "Portsmouth Crime Fear",
      description:
        "People living in Portsmouth have told the BBC's Dan Johnson they feel unsafe in their own homes.",
      published_at: "2025-09-26T05:06:07+00:00",
      topic_group_id: 50,
      tldr: "Portsmouth residents report feeling unsafe due to persistent antisocial behavior including vandalism, drug dealing, and abuse. Government promises more neighborhood officers and new 'Respect Orders' to tackle repeat offenders.",
      topic_groups: {
        topic_group: "Public Safety",
      },
    },
    {
      id: 154,
      title:
        "Sikh granny deported after 'unacceptable' treatment by US immigration",
      link: "https://www.bbc.com/news/articles/c0jqvz24llyo",
      topic: "Sikh Deportation Case",
      description:
        "Harjit Kaur, 73, had lived in the US for over 30 years before being deported to India.",
      published_at: "2025-09-26T06:06:25+00:00",
      topic_group_id: 43,
      tldr: "73-year-old Harjit Kaur, who lived in California since 1991, was deported to India after failed asylum attempts despite living legally in the US for 32 years with no criminal record.",
      topic_groups: {
        topic_group: "Immigration Policy",
      },
    },
    {
      id: 141,
      title: "Life-saving stem cell centre welcomes first donors",
      link: "https://www.bbc.com/news/articles/c5y2y2pgd75o",
      topic: "Stem Cell Donation Center",
      description:
        "The Anthony Nolan Cell Collection Centre is the first in the UK dedicated to transplants.",
      published_at: "2025-09-26T01:13:26+00:00",
      topic_group_id: 42,
      tldr: "UK's first dedicated stem cell collection center opens at Nottingham's Queen's Medical Centre, creating 1,300 new donation slots annually.",
      topic_groups: {
        topic_group: "Healthcare Science",
      },
    },
    {
      id: 136,
      title:
        "Chris Mason: Starmer's irritation with Burnham shows as he seeks to tackle critics",
      link: "https://www.bbc.com/news/articles/cly19zld70qo",
      topic: "Starmer-Burnham Political Tension",
      description:
        "Andy Burnham's recent remarks seem to have narked the prime minister, our political editor writes.",
      published_at: "2025-09-26T05:36:16+00:00",
      topic_group_id: 38,
      tldr: "Labour leader Keir Starmer clashes with Manchester Mayor Andy Burnham while addressing Reform UK's rising influence.",
      topic_groups: {
        topic_group: "British Politics",
      },
    },
    {
      id: 148,
      title:
        "Trump announces new tariffs on drugs, trucks and kitchen cabinets",
      link: "https://www.bbc.com/news/articles/crkjreprp3po",
      topic: "Trump Trade Tariffs",
      description:
        "The US president said the move aims to help protect American manufacturers from foreign imports.",
      published_at: "2025-09-26T08:50:42+00:00",
      topic_group_id: 47,
      tldr: "Trump announced new tariffs effective October 1st: 100% on branded drugs, 25% on heavy trucks, and 50% on kitchen/bathroom cabinets.",
      topic_groups: {
        topic_group: "American Politics",
      },
    },
    {
      id: 145,
      title: "China launches campaign to keep killjoys off the internet",
      link: "https://www.bbc.com/news/articles/c39r7p47wzgo",
      topic: "China Internet Censorship",
      description:
        "Pessimistic social media posts may now be targets of a fresh crackdown by the Chinese government.",
      published_at: "2025-09-25T22:01:24+00:00",
      topic_group_id: 44,
      tldr: "China launches 2-month campaign to censor 'negative' social media content amid economic slowdown and youth disillusionment.",
      topic_groups: {
        topic_group: "Chinese Politics",
      },
    },
    {
      id: 147,
      title:
        "Mass arrests for sextortion and romance scams in sting operation across Africa",
      link: "https://www.bbc.com/news/articles/c0r04vjvkljo",
      topic: "African Sextortion Sting Operation",
      description:
        "Some 260 suspects were arrested in the operation across 14 African countries, says Interpol.",
      published_at: "2025-09-26T08:28:28+00:00",
      topic_group_id: 46,
      tldr: "Interpol arrested 260 cyber scammers across 14 African countries in a UK-funded sting operation targeting romance scams and sextortion.",
      topic_groups: {
        topic_group: "Global Crime",
      },
    },
    {
      id: 140,
      title: "Trump says he 'will not allow' Netanyahu to annex West Bank",
      link: "https://www.bbc.com/news/articles/c3e7d32epk3o",
      topic: "Trump-Netanyahu West Bank",
      description:
        "The US president spoke ahead the Israeli PM's address to the UN General Assembly on Friday.",
      published_at: "2025-09-26T01:13:41+00:00",
      topic_group_id: 39,
      tldr: "Trump opposes Netanyahu's potential West Bank annexation, stating 'it's not going to happen' ahead of their Monday meeting.",
      topic_groups: {
        topic_group: "Global Politics",
      },
    },
  ],
  pagination: {
    page: 1,
    hasMore: true,
    totalItems: 19,
  },
};

// Topic groups will be generated dynamically from API data

const ARTICLES_PER_PAGE = 6;

export default function NewsPage() {
  const [selectedTopic, setSelectedTopic] = useState("All Topics");
  const [currentPage, setCurrentPage] = useState(1);
  const [newsData, setNewsData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch news data from API
  const fetchNewsData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("http://localhost:3001/feed");

      if (!response.ok) {
        throw new Error(`Failed to fetch news data: ${response.status}`);
      }

      const data: NewsData = await response.json();
      setNewsData(data);
    } catch (err) {
      console.error("Error fetching news data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch news data"
      );
      // Fallback to mock data on error
      setNewsData(mockNewsData);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchNewsData();
  }, []);

  // Generate topic groups dynamically from API data
  const topicGroups = useMemo(() => {
    const articles = newsData?.data || mockNewsData.data;
    const uniqueTopicGroups = Array.from(
      new Set(articles.map((article) => article.topic_groups.topic_group))
    ).sort();
    return ["All Topics", ...uniqueTopicGroups];
  }, [newsData]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const { filteredArticles, paginatedArticles, totalPages } = useMemo(() => {
    // Use API data if available, otherwise fallback to mock data
    const articles = newsData?.data || mockNewsData.data;

    // Filter articles based on selected topic
    const filtered =
      selectedTopic === "All Topics"
        ? articles
        : articles.filter(
            (article) => article.topic_groups.topic_group === selectedTopic
          );

    // Calculate pagination
    const total = Math.ceil(filtered.length / ARTICLES_PER_PAGE);
    const startIndex = (currentPage - 1) * ARTICLES_PER_PAGE;
    const endIndex = startIndex + ARTICLES_PER_PAGE;
    const paginated = filtered.slice(startIndex, endIndex);

    return {
      filteredArticles: filtered,
      paginatedArticles: paginated,
      totalPages: total,
    };
  }, [selectedTopic, currentPage, newsData]);

  // Reset to page 1 when topic changes
  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-foreground">
            News Aggregator
          </h1>
          <p className="text-muted-foreground mt-2">
            Stay informed with the latest news from around the world
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading news articles...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="text-destructive mb-4">
                <h3 className="text-lg font-semibold">Failed to load news</h3>
                <p className="text-sm">{error}</p>
              </div>
              <Button onClick={fetchNewsData} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Content - only show when not loading and no error */}
        {!loading && !error && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <NewsFilter
                selectedTopic={selectedTopic}
                onTopicChange={handleTopicChange}
                topicGroups={topicGroups}
              />
              <div className="text-sm text-muted-foreground flex items-center">
                Showing {filteredArticles.length} articles
                {selectedTopic !== "All Topics" && ` in ${selectedTopic}`}
              </div>
            </div>

            {/* News Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 min-h-[600px]">
              {paginatedArticles.map((article) => (
                <Card
                  key={article.id}
                  className="flex flex-col h-full hover:shadow-lg transition-shadow"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        {article.topic_groups.topic_group}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(article.published_at)}
                      </span>
                    </div>
                    <CardTitle className="text-lg leading-tight line-clamp-3">
                      {article.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {article.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3 flex-1">
                      {article.tldr}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        asChild
                        variant="default"
                        size="sm"
                        className="flex-1"
                      >
                        <Link href={`/article/${article.id}`}>Read More</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <a
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Source
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              className="mt-12"
            />
          </>
        )}
      </main>
    </div>
  );
}
