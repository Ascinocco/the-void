-- Add topic and description fields to articles, remove category
alter table articles 
add column topic text,
add column description text,
drop column category;

-- Drop the article_topics junction table (no longer needed)
drop table if exists article_topics;

-- Drop the topics table (no longer needed)
drop table if exists topics;
