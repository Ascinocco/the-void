create table topics (
  id bigserial primary key,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

CREATE TABLE article_topics (
  article_id bigint not null,
  topic_id bigint not null,
  PRIMARY KEY (article_id, topic_id),
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);