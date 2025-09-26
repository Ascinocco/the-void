create extension if not exists vector with schema extensions;

-- 2. Create the articles table
create table articles (
  id bigserial primary key,
  title text not null,
  link text not null unique,
  content text,
  published_at timestamptz,
  category text,
  embedding vector(1536) -- Match the dimension of your embedding model
);

create or replace function match_articles (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language sql stable
as $$
  select
    articles.id,
    articles.content,
    1 - (articles.embedding <=> query_embedding) as similarity
  from articles
  where 1 - (articles.embedding <=> query_embedding) > match_threshold
  order by similarity desc
  limit match_count;
$$;