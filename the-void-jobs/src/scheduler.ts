import * as cron from "node-cron";
import { Job, JobResult } from "./types/job";
import { Logger } from "./utils/logger";

export class JobScheduler {
  private jobs: Map<string, Job> = new Map();
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  /**
   * Register a job to be run on a schedule
   */
  registerJob(
    job: Job,
    cronExpression: string = "0 * * * *",
    validateDependencies: boolean = true
  ): void {
    Logger.info(`Registering job: ${job.name}`, {
      schedule: cronExpression,
      dependencies: job.dependencies || [],
    });

    this.jobs.set(job.name, job);

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    // Validate dependencies if requested
    if (validateDependencies) {
      this.validateJobDependencies(job);
    }

    // Schedule the job - for now we'll keep individual job scheduling
    // but we could enhance this to run dependency resolution on each trigger
    const task = cron.schedule(
      cronExpression,
      async () => {
        // For now, execute all jobs with dependencies when any job is triggered
        // This ensures dependencies are always respected
        await this.executeJobsWithDependencies();
      },
      {
        scheduled: false, // Don't start immediately
        timezone: "UTC",
      }
    );

    this.scheduledTasks.set(job.name, task);
  }

  /**
   * Validate job dependencies
   */
  private validateJobDependencies(job: Job): void {
    if (!job.dependencies || job.dependencies.length === 0) {
      return;
    }

    // Check if all dependencies exist
    for (const depName of job.dependencies) {
      if (!this.jobs.has(depName)) {
        throw new Error(
          `Job dependency not found: ${depName} (required by ${job.name})`
        );
      }
    }

    // Check for circular dependencies
    this.detectCircularDependencies();
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(): void {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (jobName: string): boolean => {
      if (recursionStack.has(jobName)) {
        return true; // Circular dependency detected
      }

      if (visited.has(jobName)) {
        return false; // Already processed
      }

      visited.add(jobName);
      recursionStack.add(jobName);

      const job = this.jobs.get(jobName);
      if (job?.dependencies) {
        for (const depName of job.dependencies) {
          if (hasCycle(depName)) {
            return true;
          }
        }
      }

      recursionStack.delete(jobName);
      return false;
    };

    for (const jobName of this.jobs.keys()) {
      if (hasCycle(jobName)) {
        throw new Error(
          `Circular dependency detected involving job: ${jobName}`
        );
      }
    }
  }

  /**
   * Resolve job execution order using topological sort
   */
  private resolveDependencies(): string[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // Initialize
    for (const jobName of this.jobs.keys()) {
      inDegree.set(jobName, 0);
      adjList.set(jobName, []);
    }

    // Build adjacency list and calculate in-degrees
    for (const [jobName, job] of this.jobs) {
      if (job.dependencies) {
        for (const depName of job.dependencies) {
          adjList.get(depName)?.push(jobName);
          inDegree.set(jobName, (inDegree.get(jobName) || 0) + 1);
        }
      }
    }

    // Topological sort using Kahn's algorithm
    const queue: string[] = [];
    const result: string[] = [];

    // Add all jobs with no dependencies to queue
    for (const [jobName, degree] of inDegree) {
      if (degree === 0) {
        queue.push(jobName);
      }
    }

    while (queue.length > 0) {
      const currentJob = queue.shift()!;
      result.push(currentJob);

      // Process all jobs that depend on current job
      const dependents = adjList.get(currentJob) || [];
      for (const dependent of dependents) {
        const newDegree = (inDegree.get(dependent) || 0) - 1;
        inDegree.set(dependent, newDegree);

        if (newDegree === 0) {
          queue.push(dependent);
        }
      }
    }

    return result;
  }

  /**
   * Execute all jobs respecting dependencies
   */
  async executeJobsWithDependencies(): Promise<JobResult[]> {
    Logger.info("Executing jobs with dependency resolution");

    const executionOrder = this.resolveDependencies();
    const results: JobResult[] = [];
    const completedJobs = new Set<string>();

    for (const jobName of executionOrder) {
      const job = this.jobs.get(jobName);
      if (!job) continue;

      // Check if all dependencies completed successfully
      let dependenciesMet = true;
      let skippedReason = "";

      if (job.dependencies) {
        for (const depName of job.dependencies) {
          if (!completedJobs.has(depName)) {
            dependenciesMet = false;
            skippedReason = `Dependency failed or was skipped: ${depName}`;
            break;
          }
        }
      }

      if (!dependenciesMet) {
        Logger.warn(`Skipping job ${jobName}: ${skippedReason}`);
        results.push({
          success: false,
          jobName,
          dependenciesMet: false,
          skippedReason,
          executionTime: 0,
        });
        continue;
      }

      // Execute the job
      const result = await this.executeJob(jobName);
      result.jobName = jobName;
      result.dependenciesMet = true;
      results.push(result);

      // Mark as completed only if successful
      if (result.success) {
        completedJobs.add(jobName);
      }
    }

    return results;
  }

  /**
   * Start all scheduled jobs
   */
  start(): void {
    Logger.info("Starting job scheduler");

    for (const [jobName, task] of this.scheduledTasks) {
      Logger.info(`Starting scheduled job: ${jobName}`);
      task.start();
    }
  }

  /**
   * Start all scheduled jobs and run them immediately
   */
  async startWithImmediateExecution(): Promise<void> {
    Logger.info("Starting job scheduler with immediate execution");

    // First, run all jobs immediately with dependency resolution
    try {
      const results = await this.executeJobsWithDependencies();

      // Log results
      results.forEach((result) => {
        if (result.success) {
          Logger.info(
            `Initial execution completed for job: ${result.jobName}`,
            {
              success: result.success,
              executionTime: `${result.executionTime}ms`,
              dependenciesMet: result.dependenciesMet,
            }
          );
        } else {
          if (result.dependenciesMet === false) {
            Logger.warn(
              `Initial execution skipped for job: ${result.jobName}`,
              {
                reason: result.skippedReason,
              }
            );
          } else {
            Logger.error(
              `Initial execution failed for job: ${result.jobName}`,
              result.error
            );
          }
        }
      });
    } catch (error) {
      Logger.error(
        "Failed to execute jobs with dependencies on startup",
        error instanceof Error ? error : new Error(String(error))
      );
    }

    // Then start the scheduled tasks
    for (const [jobName, task] of this.scheduledTasks) {
      Logger.info(`Starting scheduled job: ${jobName}`);
      task.start();
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    Logger.info("Stopping job scheduler");

    for (const [jobName, task] of this.scheduledTasks) {
      Logger.info(`Stopping scheduled job: ${jobName}`);
      task.stop();
    }
  }

  /**
   * Execute a specific job by name
   */
  async executeJob(jobName: string): Promise<JobResult> {
    const job = this.jobs.get(jobName);
    if (!job) {
      const error = new Error(`Job not found: ${jobName}`);
      Logger.error("Job execution failed", error);
      return {
        success: false,
        error,
        executionTime: 0,
      };
    }

    Logger.info(`Executing job: ${jobName}`);
    const startTime = Date.now();

    try {
      await job.execute();
      const executionTime = Date.now() - startTime;

      Logger.info(`Job completed successfully: ${jobName}`, {
        executionTime: `${executionTime}ms`,
      });

      return {
        success: true,
        message: `Job ${jobName} completed successfully`,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const jobError =
        error instanceof Error ? error : new Error(String(error));

      Logger.error(`Job failed: ${jobName}`, jobError, {
        executionTime: `${executionTime}ms`,
      });

      return {
        success: false,
        error: jobError,
        executionTime,
      };
    }
  }

  /**
   * Get a list of all registered jobs
   */
  getJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  /**
   * Check if a job is registered
   */
  hasJob(jobName: string): boolean {
    return this.jobs.has(jobName);
  }

  /**
   * Remove a job from the scheduler
   */
  removeJob(jobName: string): boolean {
    const task = this.scheduledTasks.get(jobName);
    if (task) {
      task.stop();
      this.scheduledTasks.delete(jobName);
    }

    return this.jobs.delete(jobName);
  }

  /**
   * Validate all job dependencies after registration
   */
  validateAllDependencies(): void {
    Logger.info("Validating all job dependencies");

    for (const job of this.jobs.values()) {
      this.validateJobDependencies(job);
    }

    Logger.info("All job dependencies validated successfully");
  }

  /**
   * Get execution order for all jobs
   */
  getExecutionOrder(): string[] {
    return this.resolveDependencies();
  }
}
