-- Add timestamps and original_content field to articles table
alter table articles 
add column created_at timestamptz not null default now(),
add column updated_at timestamptz not null default now(),
add column original_content text;
