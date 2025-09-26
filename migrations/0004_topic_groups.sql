-- Create topic_groups table
create table topic_groups (
  id bigserial primary key,
  topic_group text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add topic_group_id column to articles table
alter table articles 
add column topic_group_id bigint,
add foreign key (topic_group_id) references topic_groups(id) on delete set null;

-- Create index on topic_group_id for better query performance
create index idx_articles_topic_group_id on articles(topic_group_id);

-- Insert some example topic groups
insert into topic_groups (topic_group) values 
  ('Global Economy'),
  ('Technology'),
  ('Climate Change'),
  ('Political News'),
  ('Health Science'),
  ('Space Exploration');
