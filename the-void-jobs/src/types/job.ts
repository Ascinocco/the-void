export interface Job {
  name: string;
  description?: string;
  dependencies?: string[]; // Array of job names this job depends on
  execute(): Promise<void>;
}

export interface JobResult {
  success: boolean;
  message?: string;
  error?: Error;
  executionTime: number;
  jobName?: string;
  dependenciesMet?: boolean;
  skippedReason?: string;
}

export interface JobConfig {
  name: string;
  schedule: string; // cron expression
  enabled: boolean;
  timeout?: number; // timeout in milliseconds
}
