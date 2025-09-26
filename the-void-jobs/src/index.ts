import { EnvConfig } from "./utils/env";

import { JobScheduler } from "./scheduler";
import { RssParsingJob } from "./jobs/rssParsingJob";
import { Logger } from "./utils/logger";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";
import { DataService } from "./services/dataService";
import { LLMService } from "./services/llmService";
import { SearchService } from "./services/searchService";
import { AiAnalysisJob } from "./jobs/aiAnalysisJob";
import { SocialMediaSearchJob } from "./jobs/socialMediaSearchJob";
import { SocialMediaUpdatesJob } from "./jobs/socialMediaUpdatesJob";
import { SocialMediaService } from "./services/socialMediaService";
import { BlueskyService } from "./services/blueskyService";
import { MastodonService } from "./services/mastedonService";

async function main() {
  Logger.info("Starting The Void Jobs Scheduler");

  try {
    const openai = new OpenAI({
      apiKey: EnvConfig.getRequired("OPENAI_API_KEY"),
    });

    const openRouter = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: EnvConfig.getRequired("OPENROUTER_API_KEY"),
    });

    const supabase = createClient(
      EnvConfig.getRequired("SUPABASE_URL"),
      EnvConfig.getRequired("SUPABASE_SERVICE_ROLE_KEY")
    );

    const dataService = new DataService({
      supabase,
    });

    const llmService = new LLMService({
      openai,
      openRouter,
    });

    const searchService = new SearchService();

    // Create social media platform services
    const blueskyService = new BlueskyService();
    const mastodonService = new MastodonService();

    // Create social media service with injected dependencies
    const socialMediaService = new SocialMediaService({
      llm: llmService,
      data: dataService,
      bluesky: blueskyService,
      mastodon: mastodonService,
    });

    // Register jobs
    const rssParsingJob = new RssParsingJob({
      llm: llmService,
      data: dataService,
      search: searchService,
    });

    const aiAnalysisJob = new AiAnalysisJob({
      llm: llmService,
      data: dataService,
      search: searchService,
    });

    const socialMediaSearchJob = new SocialMediaSearchJob({
      llm: llmService,
      data: dataService,
      socialMedia: socialMediaService,
    });

    const socialMediaUpdatesJob = new SocialMediaUpdatesJob({
      data: dataService,
      bluesky: blueskyService,
      mastodon: mastodonService,
    });

    // Initialize the job scheduler
    const scheduler = new JobScheduler();

    // Run jobs every hour by default (0 * * * * = at minute 0 of every hour)
    // You can customize the cron expression for each job
    const hourlySchedule = EnvConfig.get("JOB_SCHEDULE", "0 * * * *");

    scheduler.registerJob(rssParsingJob, hourlySchedule);
    scheduler.registerJob(aiAnalysisJob, hourlySchedule);
    scheduler.registerJob(socialMediaSearchJob, hourlySchedule);

    // Register the social media updates job to run every 24 hours at 2 AM UTC
    // This ensures compliance with social media platform ToS by updating posts daily
    const dailyUpdatesSchedule = EnvConfig.get(
      "UPDATES_JOB_SCHEDULE",
      "0 2 * * *"
    );
    scheduler.registerJob(socialMediaUpdatesJob, dailyUpdatesSchedule);

    // Add more jobs here as needed
    // const anotherJob = new AnotherJob();
    // scheduler.registerJob(anotherJob, '30 * * * *'); // Run at minute 30 of every hour

    // Start the scheduler with immediate execution
    await scheduler.startWithImmediateExecution();

    Logger.info("Job scheduler started successfully", {
      registeredJobs: scheduler.getJobs(),
      schedule: hourlySchedule,
    });

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      Logger.info("Received SIGINT, shutting down gracefully");
      scheduler.stop();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      Logger.info("Received SIGTERM, shutting down gracefully");
      scheduler.stop();
      process.exit(0);
    });

    // Keep the process running
    process.on("unhandledRejection", (reason, promise) => {
      Logger.error("Unhandled Rejection at:", new Error(String(reason)), {
        promise,
      });
    });

    process.on("uncaughtException", (error) => {
      Logger.error("Uncaught Exception:", error);
      scheduler.stop();
      process.exit(1);
    });
  } catch (error) {
    Logger.error(
      "Failed to start job scheduler",
      error instanceof Error ? error : new Error(String(error))
    );
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  Logger.error("Application startup failed", error);
  process.exit(1);
});
