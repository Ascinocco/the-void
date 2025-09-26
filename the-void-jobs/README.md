# The Void Jobs

A lightweight Node.js TypeScript project for running scheduled jobs on an hourly cadence.

## Features

- ⏰ Hourly job scheduling using cron expressions
- 🔧 TypeScript support with strict type checking
- 🌍 Environment variable parsing with validation
- 📝 Structured logging with timestamps
- 🛡️ Error handling and graceful shutdown
- 🔌 Easy job registration and management

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp env.example .env
   # Edit .env with your configuration
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Start the job scheduler:**
   ```bash
   npm start
   ```

## Development

### Available Scripts

- `npm run dev` - Run in development mode with ts-node
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Run the built JavaScript
- `npm run watch` - Build in watch mode
- `npm run clean` - Clean build output

### Creating New Jobs

1. Create a new job class in `src/jobs/`:

```typescript
import { Job } from '../types/job';
import { Logger } from '../utils/logger';
import { EnvConfig } from '../utils/env';

export class MyCustomJob implements Job {
  public readonly name = 'my-custom-job';
  public readonly description = 'Description of what this job does';

  async execute(): Promise<void> {
    Logger.info('Starting my custom job');
    
    // Your job logic here
    const apiUrl = EnvConfig.getRequired('MY_API_URL');
    
    // Make API calls, process data, etc.
    
    Logger.info('My custom job completed');
  }
}
```

2. Register the job in `src/index.ts`:

```typescript
import { MyCustomJob } from './jobs/myCustomJob';

// In the main function:
const myJob = new MyCustomJob();
scheduler.registerJob(myJob, '0 * * * *'); // Every hour
```

### Environment Variables

Configure your jobs using environment variables. See `env.example` for available options:

- `NODE_ENV` - Environment (development/production)
- `JOB_SCHEDULE` - Default cron schedule (default: "0 * * * *" - every hour)
- `API_BASE_URL` - Base URL for API calls
- `API_KEY` - API authentication key
- `DEBUG` - Enable debug logging

### Cron Schedule Examples

- `0 * * * *` - Every hour at minute 0
- `30 * * * *` - Every hour at minute 30
- `0 */2 * * *` - Every 2 hours
- `0 0 * * *` - Daily at midnight
- `0 0 * * 1` - Weekly on Monday at midnight

## Project Structure

```
src/
├── jobs/           # Job implementations
│   └── exampleJob.ts
├── types/          # TypeScript type definitions
│   └── job.ts
├── utils/          # Utility functions
│   ├── env.ts      # Environment variable helpers
│   └── logger.ts   # Logging utilities
├── scheduler.ts    # Job scheduler implementation
└── index.ts        # Application entry point
```

## Production Deployment

1. Build the project: `npm run build`
2. Set environment variables in production
3. Use a process manager like PM2 or Docker
4. Monitor logs for job execution status

## Contributing

1. Follow TypeScript best practices
2. Add proper error handling to jobs
3. Use the provided Logger for consistent logging
4. Test jobs thoroughly before deployment
