-- Create enum type for article processing status
create type article_status as enum ('not_started', 'ready_for_ai_analysis', 'complete');

-- Add status field to articles table
alter table articles 
add column status article_status not null default 'not_started';

-- Create index on status for efficient filtering
create index idx_articles_status on articles(status);
