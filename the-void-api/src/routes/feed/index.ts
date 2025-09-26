import { FastifyPluginAsync } from "fastify";
import { dataService } from "../../services/dataService";
import { AnalysisStatus } from "../../lib/constants";

const feed: FastifyPluginAsync = async (fastify, opts): Promise<void> => {
  fastify.get("/", async function (request, reply) {
    // Extract pagination parameters from query string
    const { page = 1 } = request.query as {
      page?: number;
    };

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page.toString()));
    const limitNum = 25; // Always 25 items per page
    const offset = (pageNum - 1) * limitNum;

    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    const { data, error } = await dataService.supabase
      .from("articles")
      .select(
        `
        id, 
        title, 
        link, 
        topic, 
        description, 
        published_at, 
        topic_group_id, 
        tldr,
        topic_groups!inner(topic_group)
      `
      )
      .gt("updated_at", twentyFourHoursAgo.toISOString())
      .eq("status", AnalysisStatus.Complete)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (error) {
      return reply.status(500).send({
        error: "Failed to fetch articles",
        message: error.message,
      });
    }

    // Calculate pagination metadata
    const hasMore = data && data.length === limitNum;

    return reply.status(200).send({
      data,
      pagination: {
        page: pageNum,
        hasMore,
        totalItems: data?.length || 0,
      },
    });
  });

  fastify.get("/:id", async function (request, reply) {
    const { id } = request.params as { id: string };

    // Validate ID parameter
    if (!id || !/^\d+$/.test(id)) {
      return reply.status(400).send({
        error: "Invalid article ID",
        message: "Article ID must be a valid number",
      });
    }

    const { data, error } = await dataService.supabase
      .from("articles")
      .select(
        `
        id, 
        title, 
        link, 
        topic, 
        description, 
        published_at, 
        topic_group_id, 
        tldr,
        summary,
        fact_check,
        related_content,
        fact_check_references,
        topic_groups!inner(topic_group),
        article_social_posts(
          social_media_posts(
            id,
            url,
            platform,
            content,
            truncated_content,
            original_content,
            created_at
          )
        )
      `
      )
      .eq("id", id)
      .eq("status", AnalysisStatus.Complete)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return reply.status(404).send({
          error: "Article not found",
          message: "No article found with the specified ID",
        });
      }

      return reply.status(500).send({
        error: "Failed to fetch article",
        message: error.message,
      });
    }

    return reply.status(200).send({
      data,
    });
  });
};

export default feed;
